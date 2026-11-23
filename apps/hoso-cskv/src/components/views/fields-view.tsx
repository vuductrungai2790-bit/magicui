"use client"

import { AlertTriangleIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Confirm } from "@/components/ui/confirm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input, Textarea } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { db } from "@/lib/db"
import { DEFAULT_GROUP, GROUPS, groupIndex, SUFFIX_HELP } from "@/lib/fields"
import { useFieldMap } from "@/lib/hooks"
import { reanalyzeAll } from "@/lib/templates"
import { type ColumnDef, FIELD_TYPE_LABELS, FIELD_TYPES, type FieldDef, type FieldType } from "@/lib/types"
import { removeDiacritics, toFieldCode } from "@/lib/vn"

const COLUMN_TYPES: ColumnDef["type"][] = [
  "text",
  "number",
  "money",
  "date",
  "time",
  "select",
  "cccd",
  "phone",
]
const CODE_RE = /^[a-z][a-z0-9_]*$/

const emptyField = (): FieldDef => ({
  code: "",
  label: "",
  type: "text",
  group: DEFAULT_GROUP,
  required: false,
  order: Date.now() % 100_000,
})

interface EditorProps {
  field: FieldDef | null
  isNew: boolean
  existing: Map<string, FieldDef> | undefined
  onClose: () => void
}

const FieldEditor = ({ field, isNew, existing, onClose }: EditorProps) => {
  const [draft, setDraft] = useState<FieldDef>(field ?? emptyField())
  const [optionsText, setOptionsText] = useState((field?.options ?? []).join("\n"))
  const set = (p: Partial<FieldDef>) => setDraft((d) => ({ ...d, ...p }))
  const columns = draft.columns ?? []
  const setColumns = (cols: ColumnDef[]) => set({ columns: cols })

  const save = async () => {
    const code = draft.code.trim()
    if (!draft.label.trim()) {
      toast.error("Hãy nhập nhãn hiển thị")
      return
    }
    if (!CODE_RE.test(code)) {
      toast.error("Mã trường chỉ gồm chữ thường không dấu, số và dấu gạch dưới, bắt đầu bằng chữ")
      return
    }
    if (isNew && existing?.has(code)) {
      toast.error(`Mã “${code}” đã tồn tại`)
      return
    }
    const options = optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
    const record: FieldDef = {
      ...draft,
      code,
      label: draft.label.trim(),
      options: draft.type === "select" ? options : undefined,
      columns: draft.type === "table" ? columns.filter((c) => c.code) : undefined,
      autoDetected: false,
    }
    await db.fields.put(record)
    await reanalyzeAll()
    toast.success("Đã lưu trường")
    onClose()
  }

  const help =
    SUFFIX_HELP[
      draft.type === "cccd" || draft.type === "phone" || draft.type === "select" ? "text" : draft.type
    ]

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={field !== null}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Thêm trường" : "Sửa trường"}</DialogTitle>
          <DialogDescription>
            Nhãn là chữ hiển thị trên bảng nhập liệu; mã là thẻ dùng trong file Word.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="f-label">Nhãn hiển thị</Label>
            <Input
              id="f-label"
              onChange={(e) => {
                const label = e.target.value
                set(isNew ? { label, code: toFieldCode(label) } : { label })
              }}
              value={draft.label}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-code">Mã trường</Label>
            <Input
              className="font-mono"
              disabled={!isNew}
              id="f-code"
              onChange={(e) => set({ code: e.target.value })}
              value={draft.code}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-type">Kiểu dữ liệu</Label>
            <Select onValueChange={(v) => set({ type: v as FieldType })} value={draft.type}>
              <SelectTrigger id="f-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-group">Nhóm</Label>
            <Select onValueChange={(v) => set({ group: v })} value={draft.group}>
              <SelectTrigger id="f-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {draft.type === "select" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-options">Các lựa chọn (mỗi dòng một lựa chọn)</Label>
              <Textarea
                id="f-options"
                onChange={(e) => setOptionsText(e.target.value)}
                rows={4}
                value={optionsText}
              />
            </div>
          ) : null}
          {draft.type === "table" ? (
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium">Các cột của bảng</p>
              {columns.map((c, i) => (
                <div className="grid grid-cols-[1fr_1fr_150px_auto] gap-2" key={`${i}-${c.code}`}>
                  <Input
                    aria-label="Nhãn cột"
                    onChange={(e) =>
                      setColumns(columns.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                    placeholder="Nhãn cột"
                    value={c.label}
                  />
                  <Input
                    aria-label="Mã cột"
                    className="font-mono"
                    onChange={(e) =>
                      setColumns(columns.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))
                    }
                    placeholder="ma_cot"
                    value={c.code}
                  />
                  <Select
                    onValueChange={(v) =>
                      setColumns(
                        columns.map((x, j) => (j === i ? { ...x, type: v as ColumnDef["type"] } : x))
                      )
                    }
                    value={c.type}
                  >
                    <SelectTrigger aria-label="Kiểu cột">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMN_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {FIELD_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    aria-label="Xóa cột"
                    onClick={() => setColumns(columns.filter((_, j) => j !== i))}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => setColumns([...columns, { code: "", label: "", type: "text" }])}
                size="sm"
                variant="outline"
              >
                <PlusIcon />
                Thêm cột
              </Button>
            </div>
          ) : null}
          {draft.type === "table" || draft.type === "boolean" ? null : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="f-default">Giá trị mặc định</Label>
                <Input
                  id="f-default"
                  onChange={(e) => set({ defaultValue: e.target.value })}
                  value={draft.defaultValue ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-hint">Gợi ý khi nhập</Label>
                <Input id="f-hint" onChange={(e) => set({ hint: e.target.value })} value={draft.hint ?? ""} />
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 sm:col-span-2">
            <Label htmlFor="f-required">Bắt buộc nhập</Label>
            <Switch checked={draft.required} id="f-required" onCheckedChange={(v) => set({ required: v })} />
          </div>
        </div>

        {help && draft.code ? (
          <div className="bg-muted/60 rounded-lg p-3 text-xs">
            <p className="mb-2 font-medium">Cách dùng trong file Word</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {help.map((h) => (
                <li className="flex gap-2" key={h.suffix}>
                  <code className="bg-card shrink-0 rounded px-1.5 py-0.5 font-mono">{`{${draft.code}${h.suffix}}`}</code>
                  <span className="text-muted-foreground">→ {h.example}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Hủy
          </Button>
          <Button onClick={save}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const FieldsView = () => {
  const dictionary = useFieldMap()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<{ field: FieldDef; isNew: boolean } | null>(null)

  const grouped = useMemo(() => {
    const q = removeDiacritics(query.trim()).toLowerCase()
    const list = [...(dictionary?.values() ?? [])].filter(
      (f) => !q || removeDiacritics(`${f.label} ${f.code}`).toLowerCase().includes(q)
    )
    const map = new Map<string, FieldDef[]>()
    for (const f of list) {
      const arr = map.get(f.group) ?? []
      arr.push(f)
      map.set(f.group, arr)
    }
    return [...map.entries()]
      .sort((a, b) => groupIndex(a[0]) - groupIndex(b[0]))
      .map(([g, arr]) => [g, arr.sort((a, b) => a.order - b.order)] as const)
  }, [dictionary, query])

  const reviewCount = [...(dictionary?.values() ?? [])].filter((f) => f.autoDetected).length

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setEditing({ field: emptyField(), isNew: true })}>
            <PlusIcon />
            Thêm trường
          </Button>
        }
        description="Danh mục dùng chung cho mọi biểu mẫu: cùng một mã trường xuất hiện ở nhiều văn bản thì chỉ nhập một lần."
        title="Từ điển trường"
      />

      {reviewCount > 0 ? (
        <div className="border-warning/40 bg-warning/10 mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm">
          <AlertTriangleIcon className="text-warning mt-0.5 size-4 shrink-0" />
          <p>
            Có <strong>{reviewCount}</strong> trường được tự nhận diện từ biểu mẫu. Hãy sửa lại nhãn tiếng
            Việt, kiểu dữ liệu và nhóm cho đúng.
          </p>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b p-3">
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Tìm trường"
              className="pl-9"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo nhãn hoặc mã…"
              value={query}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Nhãn
                </th>
                <th className="px-4 py-2.5 font-medium" scope="col">
                  Mã
                </th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell" scope="col">
                  Kiểu
                </th>
                <th className="w-24 px-2" scope="col">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            {grouped.map(([group, fields]) => (
              <tbody key={group}>
                <tr className="bg-muted/25 border-t">
                  <th
                    className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold"
                    colSpan={4}
                    scope="colgroup"
                  >
                    {group} <span className="font-normal">({fields.length})</span>
                  </th>
                </tr>
                {fields.map((f) => (
                  <tr className="hover:bg-muted/30 border-t" key={f.code}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{f.label}</span>
                      {f.required ? <span className="text-destructive ml-1">*</span> : null}
                      {f.autoDetected ? (
                        <Badge className="ml-2" variant="warning">
                          cần rà soát
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">{f.code}</td>
                    <td className="hidden px-4 py-2.5 text-xs md:table-cell">{FIELD_TYPE_LABELS[f.type]}</td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                      <Button
                        aria-label={`Sửa ${f.label}`}
                        onClick={() => setEditing({ field: f, isNew: false })}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <PencilIcon />
                      </Button>
                      <Confirm
                        description={`Trường “${f.label}” (${f.code}) sẽ bị xóa khỏi từ điển. Các biểu mẫu còn dùng thẻ này sẽ tạo lại trường ở lần nhận diện sau.`}
                        onConfirm={async () => {
                          await db.fields.delete(f.code)
                          toast.success("Đã xóa trường")
                        }}
                        title="Xóa trường?"
                        trigger={(open) => (
                          <Button
                            aria-label={`Xóa ${f.label}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={open}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Trash2Icon />
                          </Button>
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>

      {editing ? (
        <FieldEditor
          existing={dictionary}
          field={editing.field}
          isNew={editing.isNew}
          key={editing.field.code || "new"}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}
