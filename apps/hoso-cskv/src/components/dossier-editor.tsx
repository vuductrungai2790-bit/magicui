"use client"

import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  CloudCheckIcon,
  DownloadIcon,
  EyeIcon,
  FileArchiveIcon,
  FileTextIcon,
  Loader2Icon,
  MinusCircleIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { DocxPreviewDialog } from "@/components/docx-preview-dialog"
import { AiDraftDialog, AiExtractDialog, useAiSettings } from "@/components/ai-dialogs"
import { FieldRow } from "@/components/field-input"
import { EmptyState } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type DraftRequest, describeData } from "@/lib/ai"
import { DEFAULT_FORMAT, db, FORMAT_KEY, type FormatSettings } from "@/lib/db"
import { downloadBlob, isFilled, TemplateError, validateValue } from "@/lib/docx"
import {
  collectExamples,
  collectFieldsFor,
  deadlineInfo,
  fieldUsage,
  generateBundle,
  generateComponent,
  type ResolvedComponent,
  resolveComponents,
  shortTemplateName,
  STATUS_LABEL,
  suggestTitle,
  TONE_CLASS,
} from "@/lib/dossier"
import { useFieldMap, useTemplateMap } from "@/lib/hooks"
import { Link } from "@/lib/router"
import type { Dossier, DossierData, DossierType, FieldDef, FieldValue } from "@/lib/types"
import { cn } from "@/lib/utils"
import { safeFileName } from "@/lib/vn"

type SaveState = "saved" | "saving" | "dirty"

const reportError = (error: unknown) => {
  if (error instanceof TemplateError) {
    toast.error(error.message, { description: error.details.slice(0, 3).join(" · ") || undefined })
    return
  }
  toast.error(error instanceof Error ? error.message : "Đã xảy ra lỗi")
}

const groupFields = (defs: FieldDef[]): [string, FieldDef[]][] => {
  const map = new Map<string, FieldDef[]>()
  for (const d of defs) {
    const list = map.get(d.group) ?? []
    list.push(d)
    map.set(d.group, list)
  }
  return [...map.entries()]
}

const sectionId = (group: string) => `nhom-${group.replace(/[^\p{L}\p{N}]+/gu, "-")}`

interface EditorProps {
  id: string
}

export const DossierEditor = ({ id }: EditorProps) => {
  const dictionary = useFieldMap()
  const templates = useTemplateMap()
  const [dossier, setDossier] = useState<Dossier | null | undefined>(undefined)
  const [type, setType] = useState<DossierType | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [showRequired, setShowRequired] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ blob: Blob; fileName: string; title: string } | null>(null)
  const [extractOpen, setExtractOpen] = useState(false)
  const [draft, setDraft] = useState<(Omit<DraftRequest, "notes"> & { code: string }) | null>(null)
  const ai = useAiSettings()
  const formatRec = useLiveQuery(() => db.settings.get(FORMAT_KEY), [])
  const normalize = { ...DEFAULT_FORMAT, ...((formatRec?.value as Partial<FormatSettings>) ?? {}) }.normalize
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<Dossier | null>(null)

  // Tải hồ sơ một lần khi mở trang.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const d = await db.dossiers.get(id)
      const t = d ? await db.dossierTypes.get(d.typeId) : undefined
      if (!cancelled) {
        setDossier(d ?? null)
        setType(t ?? null)
        latest.current = d ?? null
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const flush = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const d = latest.current
    if (!d) {
      return
    }
    setSaveState("saving")
    await db.dossiers.put({ ...d, updatedAt: Date.now() })
    setSaveState("saved")
  }

  // Lưu lần cuối khi rời trang.
  useEffect(
    () => () => {
      if (saveTimer.current && latest.current) {
        clearTimeout(saveTimer.current)
        db.dossiers.put({ ...latest.current, updatedAt: Date.now() })
      }
    },
    []
  )

  const patch = (next: Partial<Dossier>) => {
    setDossier((prev) => {
      if (!prev) {
        return prev
      }
      const updated = { ...prev, ...next }
      latest.current = updated
      return updated
    })
    setSaveState("dirty")
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
    }
    saveTimer.current = setTimeout(() => {
      flush()
    }, 700)
  }

  const setValue = (code: string, value: FieldValue) => {
    if (!(dossier && type)) {
      return
    }
    const nextData = { ...dossier.data, [code]: value }
    // Tiêu đề chưa bị sửa tay thì tự cập nhật theo họ tên.
    const autoTitle = dossier.title === type.name || dossier.title === suggestTitle(type.name, dossier.data)
    patch(autoTitle ? { data: nextData, title: suggestTitle(type.name, nextData) } : { data: nextData })
  }

  const data: DossierData = dossier?.data ?? {}

  const excluded = dossier?.excluded
  const extra = dossier?.extra
  const components: ResolvedComponent[] = useMemo(
    () => (type && templates ? resolveComponents(type, templates, data, { excluded, extra }) : []),
    [type, templates, data, excluded, extra]
  )

  const fields = useMemo(
    () => (type && dictionary ? collectFieldsFor(type, components, dictionary) : []),
    [type, components, dictionary]
  )
  const usage = useMemo(() => fieldUsage(components), [components])
  const examples = useMemo(() => collectExamples(components), [components])

  const groups = useMemo(() => groupFields(fields), [fields])

  const errors = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of fields) {
      const err = validateValue(f, data[f.code])
      if (err && (err !== "Bắt buộc nhập" || showRequired)) {
        map.set(f.code, err)
      }
    }
    return map
  }, [fields, data, showRequired])

  const progress = useMemo(() => {
    const countable = fields.filter((f) => f.type !== "boolean")
    const filled = countable.filter((f) => isFilled(f, data[f.code])).length
    const required = fields.filter((f) => f.required)
    const missingRequired = required.filter((f) => !isFilled(f, data[f.code]))
    return { filled, total: countable.length, missingRequired }
  }, [fields, data])

  if (dossier === undefined || !dictionary || !templates) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-24 text-sm">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Đang tải hồ sơ…
      </div>
    )
  }

  if (dossier === null || type === null) {
    return (
      <EmptyState
        action={
          <Button asChild>
            <Link href="/ho-so/">Về danh sách hồ sơ</Link>
          </Button>
        }
        description="Hồ sơ có thể đã bị xóa hoặc loại hồ sơ không còn tồn tại."
        icon={FileTextIcon}
        title="Không tìm thấy hồ sơ"
      />
    )
  }

  const ensureValid = (): boolean => {
    setShowRequired(true)
    if (progress.missingRequired.length > 0) {
      toast.warning(`Còn ${progress.missingRequired.length} trường bắt buộc chưa nhập`, {
        description: progress.missingRequired
          .slice(0, 4)
          .map((f) => f.label)
          .join(", "),
      })
    }
    // Vẫn cho phép tạo: chỗ trống sẽ in thành dấu chấm để viết tay.
    return true
  }

  const previewComponent = async (c: ResolvedComponent) => {
    setBusy(`xem-${c.index}`)
    try {
      await flush()
      const file = await generateComponent(c, dictionary, data, normalize)
      reportFormat(file.changes)
      setPreview({ blob: file.blob, fileName: file.fileName, title: file.templateName })
    } catch (e) {
      reportError(e)
    } finally {
      setBusy(null)
    }
  }

  const downloadComponent = async (c: ResolvedComponent) => {
    ensureValid()
    setBusy(`tai-${c.index}`)
    try {
      await flush()
      const file = await generateComponent(c, dictionary, data, normalize)
      reportFormat(file.changes)
      downloadBlob(file.blob, file.fileName)
    } catch (e) {
      reportError(e)
    } finally {
      setBusy(null)
    }
  }

  const downloadAll = async () => {
    ensureValid()
    setBusy("zip")
    try {
      await flush()
      const zip = await generateBundle(components, dictionary, data, normalize)
      downloadBlob(zip, `${safeFileName(dossier.title)}.zip`)
      toast.success("Đã tạo bộ hồ sơ", {
        description: `${components.filter((c) => c.included && c.template).length} văn bản trong file .zip`,
      })
    } catch (e) {
      reportError(e)
    } finally {
      setBusy(null)
    }
  }

  const reportFormat = (changes: string[]) => {
    if (changes.length > 0) {
      toast.info("Đã chuẩn hóa thể thức theo NĐ 30/2020", { description: changes.join(" · ") })
    }
  }

  const toggleComponent = (c: ResolvedComponent) => {
    if (c.extra) {
      patch({ extra: (dossier.extra ?? []).filter((x) => x !== c.key) })
      return
    }
    const list = new Set(dossier.excluded ?? [])
    if (list.has(c.key)) {
      list.delete(c.key)
    } else {
      list.add(c.key)
    }
    patch({ excluded: [...list] })
  }

  const addExtra = (templateId: string) => {
    if (!templateId) {
      return
    }
    patch({
      extra: [...(dossier.extra ?? []), templateId],
      excluded: (dossier.excluded ?? []).filter((x) => x !== templateId),
    })
  }

  const openDraft = (def: FieldDef) => {
    const value = data[def.code]
    setDraft({
      code: def.code,
      dossierType: type.name,
      documents: (usage.get(def.code) ?? []).map((c) => c.template?.name ?? ""),
      fieldLabel: def.label,
      example: examples[def.code],
      current: typeof value === "string" ? value : undefined,
      context: describeData(fields, data).filter((i) => i.label !== def.label),
    })
  }

  const applyValues = (values: Record<string, string | boolean>) => {
    const nextData = { ...dossier.data, ...values }
    const autoTitle = dossier.title === type.name || dossier.title === suggestTitle(type.name, dossier.data)
    patch(autoTitle ? { data: nextData, title: suggestTitle(type.name, nextData) } : { data: nextData })
  }

  const usedChips = (code: string) =>
    (usage.get(code) ?? []).map((c) => (
      <span
        className="bg-primary/8 text-primary border-primary/15 inline-flex max-w-full items-start gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-snug"
        key={c.key}
        title={c.template?.name}
      >
        <span className="font-semibold tabular-nums">{c.index + 1}</span>
        <span className="line-clamp-2">{shortTemplateName(c.template?.name ?? "")}</span>
      </span>
    ))

  const otherTemplates = [...templates.values()]
    .filter((t) => !components.some((c) => c.key === t.id && c.enabled))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))

  const toggleStatus = () => {
    patch({ status: dossier.status === "done" ? "draft" : "done" })
  }

  const included = components.filter((c) => c.included && c.template)
  const pct = progress.total ? Math.round((progress.filled / progress.total) * 100) : 0
  const deadline = deadlineInfo(dossier)

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-col gap-4">
        <Link
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
          href="/ho-so/"
        >
          <ArrowLeftIcon className="size-4" />
          Hồ sơ đã lập
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{type.name}</Badge>
              <Badge variant={dossier.status === "done" ? "success" : "warning"}>
                {STATUS_LABEL[dossier.status]}
              </Badge>
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" role="status">
                {saveState === "saved" ? (
                  <>
                    <CloudCheckIcon className="size-3.5" /> Đã lưu
                  </>
                ) : (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin" /> Đang lưu…
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="sr-only" htmlFor="tieu-de">
                Tiêu đề hồ sơ
              </Label>
              <Input
                className="hover:border-input focus-visible:bg-card h-11 border-transparent bg-transparent px-2 text-xl font-semibold shadow-none"
                id="tieu-de"
                onChange={(e) => patch({ title: e.target.value })}
                value={dossier.title}
              />
              <Button
                aria-label="Đặt tiêu đề theo tên người"
                onClick={() => patch({ title: suggestTitle(type.name, data) })}
                size="icon"
                title="Đặt tiêu đề theo tên người"
                variant="ghost"
              >
                <WandSparklesIcon />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ai.enabled ? (
              <Button onClick={() => setExtractOpen(true)} variant="outline">
                <SparklesIcon className="text-primary" />
                Điền tự động
              </Button>
            ) : null}
            <Button onClick={toggleStatus} variant="outline">
              {dossier.status === "done" ? <RotateCcwIcon /> : <CheckCircle2Icon />}
              {dossier.status === "done" ? "Mở lại" : "Đánh dấu hoàn thành"}
            </Button>
            <Button disabled={busy !== null || included.length === 0} onClick={downloadAll}>
              {busy === "zip" ? <Loader2Icon className="animate-spin" /> : <FileArchiveIcon />}
              Tạo trọn bộ (.zip)
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Bảng nhập liệu */}
        <div className="min-w-0 space-y-5">
          {groups.length > 1 ? (
            <nav aria-label="Các nhóm thông tin" className="flex flex-wrap gap-1.5">
              {groups.map(([group, defs]) => {
                const done = defs.filter((d) => d.type === "boolean" || isFilled(d, data[d.code])).length
                return (
                  <button
                    className="bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    key={group}
                    onClick={() =>
                      document
                        .getElementById(sectionId(group))
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    type="button"
                  >
                    {group}
                    <span className="tabular-nums opacity-70">
                      {done}/{defs.length}
                    </span>
                  </button>
                )
              })}
            </nav>
          ) : null}

          {groups.length === 0 ? (
            <EmptyState
              action={
                <Button asChild variant="outline">
                  <Link href={`/loai-ho-so/sua/?id=${type.id}`}>Cấu hình loại hồ sơ</Link>
                </Button>
              }
              description="Các biểu mẫu của loại hồ sơ này chưa có thẻ {ten_truong} nào để nhập."
              icon={FileTextIcon}
              title="Chưa có trường dữ liệu"
            />
          ) : null}

          {groups.map(([group, defs]) => (
            <Card className="scroll-mt-20 overflow-hidden" id={sectionId(group)} key={group}>
              <CardHeader className="py-3">
                <CardTitle className="text-[15px]">{group}</CardTitle>
              </CardHeader>
              <div className="bg-muted/50 text-muted-foreground hidden gap-x-4 border-b px-5 py-2 text-xs font-medium lg:grid lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,12rem)]">
                <span>Thông tin</span>
                <span>Nội dung nhập</span>
                <span>Dùng trong văn bản</span>
              </div>
              <div>
                {defs.map((def) => (
                  <FieldRow
                    action={
                      ai.enabled && def.type === "textarea" ? (
                        <Button
                          className="h-7 px-2 text-xs"
                          onClick={() => openDraft(def)}
                          size="sm"
                          variant="ghost"
                        >
                          <SparklesIcon className="text-primary" />
                          Soạn bằng Claude
                        </Button>
                      ) : null
                    }
                    def={def}
                    error={errors.get(def.code)}
                    example={examples[def.code]}
                    key={def.code}
                    onChange={(v) => setValue(def.code, v)}
                    usedIn={usedChips(def.code)}
                    value={data[def.code]}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Bảng điều khiển bên phải */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Thành phần hồ sơ</CardTitle>
              <CardDescription>
                {included.length}/{components.length} văn bản sẽ được tạo. Bỏ tích văn bản không cần.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              {components.map((c) => {
                const name = c.template?.name ?? "(Biểu mẫu đã bị xóa)"
                const condition = c.conditionField ? dictionary.get(c.conditionField)?.label : undefined
                return (
                  <div
                    className={cn(
                      "group flex items-start gap-3 rounded-lg px-3 py-2.5",
                      c.included ? "hover:bg-accent/60" : "opacity-60"
                    )}
                    key={`${c.index}-${c.key}`}
                  >
                    <button
                      aria-checked={c.enabled}
                      aria-label={`Đưa “${name}” vào hồ sơ`}
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors",
                        c.enabled
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-card text-muted-foreground"
                      )}
                      onClick={() => toggleComponent(c)}
                      role="checkbox"
                      title={c.enabled ? "Bỏ khỏi hồ sơ" : "Đưa vào hồ sơ"}
                      type="button"
                    >
                      {c.index + 1}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-medium">
                        {name}
                        {c.extra ? (
                          <button
                            aria-label="Bỏ văn bản thêm"
                            className="text-muted-foreground hover:text-destructive ml-1 inline-flex align-middle"
                            onClick={() => toggleComponent(c)}
                            type="button"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        ) : null}
                      </p>
                      {c.enabled ? null : (
                        <p className="text-muted-foreground text-xs">Không đưa vào hồ sơ này</p>
                      )}
                      {condition ? (
                        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                          {c.included ? (
                            <CheckCircle2Icon className="text-success size-3" />
                          ) : (
                            <MinusCircleIcon className="size-3" />
                          )}
                          {c.included ? "Có" : "Không"} – theo “{condition}”
                        </p>
                      ) : null}
                      {c.included && c.template ? (
                        <div className="mt-1.5 flex gap-1">
                          <Button
                            className="h-7 px-2 text-xs"
                            disabled={busy !== null}
                            onClick={() => previewComponent(c)}
                            size="sm"
                            variant="ghost"
                          >
                            {busy === `xem-${c.index}` ? (
                              <Loader2Icon className="animate-spin" />
                            ) : (
                              <EyeIcon />
                            )}
                            Xem
                          </Button>
                          <Button
                            className="h-7 px-2 text-xs"
                            disabled={busy !== null}
                            onClick={() => downloadComponent(c)}
                            size="sm"
                            variant="ghost"
                          >
                            {busy === `tai-${c.index}` ? (
                              <Loader2Icon className="animate-spin" />
                            ) : (
                              <DownloadIcon />
                            )}
                            .docx
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {otherTemplates.length > 0 ? (
                <label className="text-muted-foreground flex items-center gap-2 px-3 pt-2 text-xs">
                  <PlusIcon className="size-3.5 shrink-0" />
                  <span className="sr-only">Thêm văn bản khác</span>
                  <select
                    className="bg-card h-8 w-full rounded-md border px-2 text-xs"
                    onChange={(e) => addExtra(e.target.value)}
                    value=""
                  >
                    <option value="">Thêm văn bản khác vào hồ sơ…</option>
                    {otherTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Mức độ hoàn thiện</span>
                  <span className="text-muted-foreground tabular-nums">
                    {progress.filled}/{progress.total} trường
                  </span>
                </div>
                <div
                  aria-label="Mức độ hoàn thiện"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={pct}
                  className="bg-muted h-2 overflow-hidden rounded-full"
                  role="progressbar"
                >
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {progress.missingRequired.length > 0 ? (
                  <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                    <CircleDashedIcon className="text-warning mt-px size-3.5 shrink-0" />
                    Thiếu bắt buộc: {progress.missingRequired.map((f) => f.label).join(", ")}
                  </p>
                ) : (
                  <p className="text-success flex items-center gap-1.5 text-xs">
                    <CheckCircle2Icon className="size-3.5" />
                    Đã đủ các trường bắt buộc
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="han-xu-ly">Hạn hoàn thành</Label>
                <Input
                  id="han-xu-ly"
                  onChange={(e) => patch({ deadline: e.target.value || undefined })}
                  type="date"
                  value={dossier.deadline ?? ""}
                />
                {deadline.text ? (
                  <p className={cn("text-xs", TONE_CLASS[deadline.tone])}>{deadline.text}</p>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Trường để trống giữ nguyên dòng chấm của mẫu để viết tay bổ sung.
                {normalize ? " File xuất ra được chuẩn hóa thể thức theo NĐ 30/2020." : ""}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <DocxPreviewDialog file={preview} onOpenChange={(o) => !o && setPreview(null)} />
      <AiExtractDialog
        data={data}
        fields={fields}
        key={extractOpen ? "open" : "closed"}
        onApply={applyValues}
        onClose={() => setExtractOpen(false)}
        open={extractOpen}
      />
      <AiDraftDialog
        key={draft?.code ?? "none"}
        onApply={(text) => draft && setValue(draft.code, text)}
        onClose={() => setDraft(null)}
        request={draft}
      />
    </div>
  )
}
