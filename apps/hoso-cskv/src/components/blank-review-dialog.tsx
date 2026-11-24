"use client"

import { CheckIcon, Loader2Icon, SaveIcon, SquarePenIcon, WandSparklesIcon } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input, inputClass, Textarea } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type Blank, type BlankAnalysis, paragraphBlank } from "@/lib/blanks"
import { GROUPS, sortFields } from "@/lib/fields"
import { useFieldMap } from "@/lib/hooks"
import { type FieldMeta, type PreparedTemplate, saveDetectedTemplate } from "@/lib/templates"
import { FIELD_TYPE_LABELS, FIELD_TYPES, type FieldDef, type FieldType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toFieldCode } from "@/lib/vn"

type ReviewBlank = Blank & { checked: boolean }

export interface ReviewTarget {
  prepared: PreparedTemplate
  original: Blob
  fileName: string
  name: string
  targetId?: string
}

interface Row {
  code: string
  blanks: ReviewBlank[]
  checked: boolean
  sample?: string
  first: number
}

const NEW = "__new__"

const buildRows = (blanks: ReviewBlank[]): Row[] => {
  const map = new Map<string, Row>()
  blanks.forEach((b, i) => {
    const row = map.get(b.code) ?? { code: b.code, blanks: [], checked: false, first: i }
    row.blanks.push(b)
    row.checked = row.checked || b.checked
    row.sample ??= b.sample
    map.set(b.code, row)
  })
  return [...map.values()].sort((a, b) => a.first - b.first)
}

const rowId = (code: string) => `row-${code}`

/* ------------------------------ Văn bản ------------------------------ */

const ParagraphView = ({
  analysis,
  blanks,
  numberOf,
  onMakeField,
}: {
  analysis: BlankAnalysis
  blanks: ReviewBlank[]
  numberOf: Map<string, number>
  onMakeField: (para: number) => void
}) => {
  const byPara = useMemo(() => {
    const m = new Map<number, ReviewBlank[]>()
    for (const b of blanks) {
      const list = m.get(b.para) ?? []
      list.push(b)
      m.set(b.para, list)
      for (const l of b.lines ?? []) {
        m.set(l, [
          ...(m.get(l) ?? []),
          { ...b, para: l, start: 0, end: analysis.paragraphs[l]?.text.length ?? 0 },
        ])
      }
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.start - b.start)
    }
    return m
  }, [blanks, analysis])

  return (
    <div className="space-y-1 font-serif text-[15px] leading-relaxed text-black">
      {analysis.paragraphs.map((p) => {
        const list = byPara.get(p.index) ?? []
        const tabOnly = !p.text.trim() && p.text.includes("\t")
        if (!(p.text.trim() || tabOnly)) {
          return null
        }
        const pieces: React.ReactNode[] = []
        let pos = 0
        for (const b of list) {
          if (b.start > pos) {
            pieces.push(
              <Fragment key={`t${pos}`}>{p.text.slice(pos, b.start).replace(/\t+/g, " ⋯ ")}</Fragment>
            )
          }
          const content = p.text.slice(b.start, b.end).replace(/\t+/g, " ⋯ ") || "＋"
          pieces.push(
            <a
              className={cn(
                "rounded px-0.5 font-sans text-[13px] no-underline transition-colors",
                b.checked
                  ? "bg-amber-200/80 text-amber-950 ring-1 ring-amber-400 hover:bg-amber-300"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
              )}
              href={`#${rowId(b.code)}`}
              key={`b${b.id}${b.para}`}
              onClick={(e) => {
                e.preventDefault()
                document
                  .getElementById(rowId(b.code))
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }}
              title={b.label}
            >
              <sup className="mr-0.5 font-semibold">{numberOf.get(b.code)}</sup>
              {content.length > 40 ? `${content.slice(0, 40)}…` : content}
            </a>
          )
          pos = Math.max(pos, b.end)
        }
        if (pos < p.text.length) {
          pieces.push(<Fragment key="end">{p.text.slice(pos).replace(/\t+/g, " ⋯ ")}</Fragment>)
        }
        const canMake = list.length === 0 && p.text.trim().length >= 25
        return (
          <div className="group relative" key={p.index}>
            <p
              className={cn(
                "min-h-5 pr-8 whitespace-pre-wrap",
                tabOnly && list.length === 0 && "text-slate-400"
              )}
            >
              {tabOnly && list.length === 0 ? "· · · · · · · · · ·" : pieces}
            </p>
            {canMake ? (
              <button
                aria-label="Biến đoạn văn này thành ô nhập"
                className="absolute top-0 right-0 rounded p-1 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100"
                onClick={() => onMakeField(p.index)}
                title="Biến đoạn văn này thành ô nhập (nội dung soạn mới cho từng hồ sơ)"
                type="button"
              >
                <SquarePenIcon className="size-4" />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------ Bảng trường ------------------------------ */

const RowEditor = ({
  row,
  index,
  dictionary,
  meta,
  onToggle,
  onMeta,
  onMap,
}: {
  row: Row
  index: number
  dictionary: Map<string, FieldDef>
  meta: FieldMeta | undefined
  onToggle: (checked: boolean) => void
  onMeta: (m: FieldMeta) => void
  onMap: (code: string) => void
}) => {
  const existing = dictionary.get(row.code)
  const first = row.blanks[0]
  const current: FieldMeta = meta ?? {
    label: existing?.label ?? first?.label ?? row.code,
    type: existing?.type ?? first?.type ?? "text",
    group: existing?.group ?? first?.group ?? "Khác",
  }
  const options = useMemo(() => sortFields([...dictionary.values()]), [dictionary])
  const id = rowId(row.code)

  return (
    <div
      className={cn(
        "scroll-mt-4 rounded-lg border p-3 transition-colors",
        row.checked ? "bg-card" : "bg-muted/40 opacity-75"
      )}
      id={id}
    >
      <div className="flex items-start gap-3">
        <button
          aria-checked={row.checked}
          aria-label={`Dùng trường ${current.label}`}
          className={cn(
            "mt-1.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
            row.checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
          )}
          onClick={() => onToggle(!row.checked)}
          role="checkbox"
          type="button"
        >
          {row.checked ? <CheckIcon className="size-3.5" /> : null}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded bg-amber-200 text-xs font-semibold text-amber-950">
              {index}
            </span>
            {existing ? (
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{existing.label}</p>
            ) : (
              <Input
                aria-label="Tên trường"
                className="h-8 flex-1"
                onChange={(e) => onMeta({ ...current, label: e.target.value })}
                value={current.label}
              />
            )}
            <Badge variant={existing ? "secondary" : "warning"}>{existing ? "có sẵn" : "mới"}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-muted-foreground space-y-1 text-xs">
              <span>Ghép vào trường</span>
              <select
                className={cn(inputClass, "h-8 text-xs")}
                onChange={(e) =>
                  onMap(e.target.value === NEW ? toFieldCode(current.label) || row.code : e.target.value)
                }
                value={existing ? row.code : NEW}
              >
                <option value={NEW}>(Trường mới)</option>
                {GROUPS.map((g) => {
                  const list = options.filter((o) => o.group === g)
                  return list.length ? (
                    <optgroup key={g} label={g}>
                      {list.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null
                })}
              </select>
            </label>
            <label className="text-muted-foreground space-y-1 text-xs">
              <span>Kiểu dữ liệu</span>
              <select
                className={cn(inputClass, "h-8 text-xs")}
                disabled={Boolean(existing)}
                onChange={(e) => onMeta({ ...current, type: e.target.value as FieldType })}
                value={current.type}
              >
                {FIELD_TYPES.filter((t) => t !== "table").map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {row.sample ? (
              <>
                VD: <span className="text-foreground">{row.sample}</span> ·{" "}
              </>
            ) : null}
            {row.blanks.length} chỗ trong văn bản
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Hộp thoại ------------------------------ */

export const BlankReviewDialog = ({
  target,
  onClose,
}: {
  target: ReviewTarget | null
  onClose: () => void
}) => {
  const dictionary = useFieldMap()
  const [blanks, setBlanks] = useState<ReviewBlank[]>(
    () => target?.prepared.analysis.blanks.map((b) => ({ ...b, checked: b.confidence === "high" })) ?? []
  )
  const [meta, setMeta] = useState<Record<string, FieldMeta>>({})
  const [name, setName] = useState(target?.name ?? "")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [showLow, setShowLow] = useState(false)

  const rows = useMemo(() => buildRows(blanks), [blanks])
  const numberOf = useMemo(() => new Map(rows.map((r, i) => [r.code, i + 1])), [rows])
  const visibleRows = rows.filter(
    (r) => showLow || r.checked || r.blanks.some((b) => b.confidence === "high")
  )
  const hiddenCount = rows.length - visibleRows.length
  const checkedCount = rows.filter((r) => r.checked).length

  if (!(target && dictionary)) {
    return null
  }
  const analysis = target.prepared.analysis

  const toggle = (code: string, checked: boolean) =>
    setBlanks((list) => list.map((b) => (b.code === code ? { ...b, checked } : b)))

  const remap = (from: string, to: string) => {
    if (from === to) {
      return
    }
    setBlanks((list) => list.map((b) => (b.code === from ? { ...b, code: to, checked: true } : b)))
    const m = meta[from]
    if (m && !dictionary.has(to)) {
      setMeta((prev) => ({ ...prev, [to]: m }))
    }
  }

  const makeField = (para: number) => {
    const text = analysis.paragraphs[para]?.text.trim() ?? ""
    const label = `Đoạn: ${text.split(/\s+/).slice(0, 5).join(" ")}…`
    const b = paragraphBlank(analysis, para, `noi_dung_doan_${para + 1}`, `p${para}`)
    if (!b) {
      return
    }
    setBlanks((list) =>
      [...list, { ...b, checked: true }].sort((x, y) => x.para - y.para || x.start - y.start)
    )
    setMeta((prev) => ({ ...prev, [b.code]: { label, type: "textarea", group: "Vụ việc" } }))
    toast.success("Đã thêm ô nhập cho đoạn văn", { description: "Đổi tên trường ở bảng bên phải nếu cần." })
  }

  const save = async () => {
    const chosen = blanks.filter((b) => b.checked)
    if (chosen.length === 0) {
      toast.error("Chưa chọn chỗ điền nào")
      return
    }
    setBusy(true)
    try {
      const { template } = await saveDetectedTemplate({
        original: target.original,
        fileName: target.fileName,
        name: name.trim() || target.name,
        description,
        blanks: chosen,
        meta,
        targetId: target.targetId,
      })
      toast.success(`Đã lưu “${template.name}”`, {
        description: `${template.fieldCodes.length} trường nhập liệu`,
      })
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được biểu mẫu")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="h-[calc(100dvh-2rem)] max-w-7xl gap-0 p-0 sm:max-w-7xl">
        <DialogHeader className="border-b px-5 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <WandSparklesIcon className="text-primary size-5" />
            Nhận diện chỗ cần điền
          </DialogTitle>
          <DialogDescription>
            Tìm thấy {rows.length} trường trong “{target.fileName}”. Các chỗ tô vàng sẽ thành ô nhập; bỏ chọn
            chỗ không cần, đổi tên hoặc ghép vào trường có sẵn. Rê chuột lên đoạn văn và bấm biểu tượng bút để
            biến cả đoạn thành ô nhập.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="bg-muted/60 min-h-0 overflow-auto p-4 sm:p-6">
            <div className="mx-auto max-w-[210mm] rounded-sm bg-white px-8 py-10 shadow-md sm:px-14">
              <ParagraphView
                analysis={analysis}
                blanks={blanks}
                numberOf={numberOf}
                onMakeField={makeField}
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between border-b px-4 py-2.5 text-sm">
              <span className="font-medium">
                {checkedCount}/{rows.length} trường được chọn
              </span>
              {hiddenCount > 0 || showLow ? (
                <Button onClick={() => setShowLow((v) => !v)} size="sm" variant="ghost">
                  {showLow ? "Ẩn gợi ý thêm" : `Hiện ${hiddenCount} gợi ý thêm`}
                </Button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
              {visibleRows.map((row) => (
                <RowEditor
                  dictionary={dictionary}
                  index={numberOf.get(row.code) ?? 0}
                  key={row.code}
                  meta={meta[row.code]}
                  onMap={(to) => remap(row.code, to)}
                  onMeta={(m) => setMeta((prev) => ({ ...prev, [row.code]: m }))}
                  onToggle={(c) => toggle(row.code, c)}
                  row={row}
                />
              ))}
              {rows.length === 0 ? (
                <p className="text-muted-foreground p-6 text-center text-sm">
                  Không tìm thấy chỗ trống nào. Bấm biểu tượng bút cạnh đoạn văn để tạo ô nhập.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter className="items-end gap-3 border-t px-5 py-3 sm:flex-row">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rv-name">Tên biểu mẫu</Label>
              <Input id="rv-name" onChange={(e) => setName(e.target.value)} value={name} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rv-desc">Ghi chú</Label>
              <Textarea
                className="min-h-9"
                id="rv-desc"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Không bắt buộc"
                rows={1}
                value={description}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline">
              Hủy
            </Button>
            <Button disabled={busy} onClick={save}>
              {busy ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Lưu biểu mẫu
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
