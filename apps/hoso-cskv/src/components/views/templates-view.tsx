"use client"

import { useLiveQuery } from "dexie-react-hooks"
import {
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  FileUpIcon,
  ListTreeIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react"
import { Link } from "@/lib/router"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { DocxPreviewDialog } from "@/components/docx-preview-dialog"
import { EmptyState, PageHeader } from "@/components/page-header"
import { SampleDataButton } from "@/components/sample-data-button"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input, Textarea } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { db } from "@/lib/db"
import { buildRenderData, downloadBlob, renderTemplate, TemplateError } from "@/lib/docx"
import { useFieldMap } from "@/lib/hooks"
import { BlankReviewDialog, type ReviewTarget } from "@/components/blank-review-dialog"
import {
  addTemplate,
  deleteTemplate,
  isDocx,
  nameFromFile,
  prepareTemplate,
  replaceTemplateFile,
} from "@/lib/templates"
import type { FieldDef, TemplateRecord } from "@/lib/types"
import { FIELD_TYPE_LABELS } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/vn"

const reportError = (error: unknown) => {
  if (error instanceof TemplateError) {
    toast.error(error.message, { description: error.details.slice(0, 3).join(" · ") || undefined })
  } else {
    toast.error(error instanceof Error ? error.message : "Đã xảy ra lỗi")
  }
}

const announceNewFields = (fileLabel: string, total: number, newFields: FieldDef[]) => {
  if (total === 0) {
    toast.warning(`${fileLabel}: không tìm thấy thẻ {ten_truong} nào`, {
      description: "Hãy đánh dấu các chỗ cần điền trong file Word (xem mục Hướng dẫn).",
    })
    return
  }
  toast.success(`${fileLabel}: nhận diện ${total} trường`, {
    description:
      newFields.length > 0
        ? `${newFields.length} trường mới đã được thêm vào Từ điển trường – nên rà soát nhãn và kiểu dữ liệu.`
        : undefined,
  })
}

/* ------------------------------------------------------------------ */

const UploadDialog = ({
  open,
  onOpenChange,
  onReview,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onReview: (targets: ReviewTarget[]) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const pick = (list: FileList | null) => {
    const docx = Array.from(list ?? []).filter(isDocx)
    if (list && list.length > docx.length) {
      toast.warning("Chỉ nhận file Word .docx", {
        description: "File .doc cũ hãy mở bằng Word rồi Lưu thành (Save As) định dạng .docx.",
      })
    }
    setFiles(docx)
    if (docx.length === 1 && docx[0]) {
      setName(nameFromFile(docx[0].name))
    }
  }

  const reset = () => {
    setFiles([])
    setName("")
    setDescription("")
  }

  const submit = async () => {
    setBusy(true)
    try {
      const review: ReviewTarget[] = []
      for (const f of files) {
        const label = files.length === 1 ? name : nameFromFile(f.name)
        // Tuần tự để từ điển trường không bị ghi chồng khi nhiều mẫu cùng có trường mới.
        const prepared = await prepareTemplate(f)
        if (prepared.analysis.hasTags) {
          // Mẫu đã đánh dấu sẵn {ma_truong}: lưu ngay.
          const { template, newFields } = await addTemplate(f, f.name, label, description)
          announceNewFields(template.name, template.fieldCodes.length, newFields)
        } else {
          review.push({ prepared, original: f, fileName: f.name, name: label })
        }
      }
      onReview(review)
      reset()
      onOpenChange(false)
    } catch (e) {
      reportError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) {
          reset()
        }
        onOpenChange(o)
      }}
      open={open}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Thêm biểu mẫu</DialogTitle>
          <DialogDescription>
            Chọn một hoặc nhiều file Word (.docx). Phần mềm tự tìm các chỗ “……”, chỗ trống sau nhãn và cả mẫu
            đã điền sẵn để tạo ô nhập; bạn rà soát lại trước khi lưu.
          </DialogDescription>
        </DialogHeader>

        <button
          className={cn(
            "hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-ring/50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-[3px]",
            dragging && "border-primary bg-primary/5"
          )}
          onClick={() => inputRef.current?.click()}
          onDragLeave={() => setDragging(false)}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pick(e.dataTransfer.files)
          }}
          type="button"
        >
          <UploadCloudIcon className="text-primary size-8" />
          <span className="text-sm font-medium">Kéo thả file vào đây hoặc bấm để chọn</span>
          <span className="text-muted-foreground text-xs">Chỉ nhận .docx · có thể chọn nhiều file</span>
        </button>
        <input
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          multiple
          onChange={(e) => pick(e.target.files)}
          ref={inputRef}
          type="file"
        />

        {files.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {files.map((f) => (
              <li className="bg-muted/60 flex items-center gap-2 rounded-md px-3 py-2" key={f.name}>
                <FileTextIcon className="text-primary size-4" />
                <span className="truncate">{f.name}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {files.length === 1 ? (
          <div className="space-y-1.5">
            <Label htmlFor="ten-mau">Tên biểu mẫu</Label>
            <Input id="ten-mau" onChange={(e) => setName(e.target.value)} value={name} />
          </div>
        ) : null}
        {files.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="mo-ta-mau">Ghi chú (không bắt buộc)</Label>
            <Textarea
              id="mo-ta-mau"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: căn cứ văn bản …, áp dụng từ ngày …"
              rows={2}
              value={description}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Hủy
          </Button>
          <Button disabled={files.length === 0 || busy} onClick={submit}>
            {busy ? <Loader2Icon className="animate-spin" /> : <FileUpIcon />}
            Thêm {files.length > 1 ? `${files.length} biểu mẫu` : "biểu mẫu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

const EditDialog = ({ template, onClose }: { template: TemplateRecord | null; onClose: () => void }) => {
  const [name, setName] = useState(template?.name ?? "")
  const [description, setDescription] = useState(template?.description ?? "")

  const save = async () => {
    if (!template) {
      return
    }
    await db.templates.update(template.id, {
      name: name.trim() || template.name,
      description,
      updatedAt: Date.now(),
    })
    toast.success("Đã lưu")
    onClose()
  }

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={template !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa thông tin biểu mẫu</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="sua-ten-mau">Tên biểu mẫu</Label>
          <Input id="sua-ten-mau" onChange={(e) => setName(e.target.value)} value={name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sua-mo-ta-mau">Ghi chú</Label>
          <Textarea
            id="sua-mo-ta-mau"
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            value={description}
          />
        </div>
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

const FieldsDialog = ({
  template,
  dictionary,
  onClose,
}: {
  template: TemplateRecord | null
  dictionary: Map<string, FieldDef> | undefined
  onClose: () => void
}) => (
  <Dialog onOpenChange={(o) => !o && onClose()} open={template !== null}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Trường dữ liệu của mẫu</DialogTitle>
        <DialogDescription>{template?.name}</DialogDescription>
      </DialogHeader>
      <div className="max-h-[55vh] overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium" scope="col">
                Nhãn
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Mã (thẻ trong Word)
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Kiểu
              </th>
            </tr>
          </thead>
          <tbody>
            {template?.fieldCodes.map((code) => {
              const f = dictionary?.get(code)
              return (
                <tr className="border-t" key={code}>
                  <td className="px-3 py-2">
                    {f?.label ?? code}
                    {f?.autoDetected ? (
                      <Badge className="ml-2" variant="warning">
                        mới
                      </Badge>
                    ) : null}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">{`{${code}}`}</td>
                  <td className="px-3 py-2 text-xs">{f ? FIELD_TYPE_LABELS[f.type] : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <DialogFooter>
        <Button asChild variant="outline">
          <Link href="/truong/">
            <ListTreeIcon />
            Mở Từ điển trường
          </Link>
        </Button>
        <Button onClick={onClose}>Đóng</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

/* ------------------------------------------------------------------ */

export const TemplatesView = () => {
  const templates = useLiveQuery(() => db.templates.orderBy("updatedAt").reverse().toArray(), [])
  const dictionary = useFieldMap()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateRecord | null>(null)
  const [viewingFields, setViewingFields] = useState<TemplateRecord | null>(null)
  const [preview, setPreview] = useState<{ blob: Blob; fileName: string; title: string } | null>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const [replaceTarget, setReplaceTarget] = useState<TemplateRecord | null>(null)
  const [reviewQueue, setReviewQueue] = useState<ReviewTarget[]>([])

  const showPreview = async (t: TemplateRecord) => {
    try {
      const { blob } = await renderTemplate(t.file, buildRenderData(dictionary ?? new Map(), {}), {
        guarded: t.guarded,
      })
      setPreview({ blob, fileName: t.fileName, title: `${t.name} (bản trống)` })
    } catch (e) {
      reportError(e)
    }
  }

  const onReplace = async (list: FileList | null) => {
    const f = list?.[0]
    const target = replaceTarget
    setReplaceTarget(null)
    if (replaceRef.current) {
      replaceRef.current.value = ""
    }
    if (!(f && target)) {
      return
    }
    if (!isDocx(f)) {
      toast.error("Chỉ nhận file .docx")
      return
    }
    try {
      const prepared = await prepareTemplate(f)
      if (!prepared.analysis.hasTags) {
        setReviewQueue((q) => [
          ...q,
          { prepared, original: f, fileName: f.name, name: target.name, targetId: target.id },
        ])
        return
      }
      const { template, newFields } = await replaceTemplateFile(target.id, f, f.name)
      announceNewFields(
        `${template.name} (phiên bản ${template.version})`,
        template.fieldCodes.length,
        newFields
      )
    } catch (e) {
      reportError(e)
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <FileUpIcon />
            Thêm biểu mẫu
          </Button>
        }
        description="Kho biểu mẫu Word. Mỗi chỗ cần điền trong mẫu được đánh dấu bằng {ten_truong}; phần mềm tự nhận diện và tạo ô nhập tương ứng."
        title="Biểu mẫu"
      />

      {templates && templates.length === 0 ? (
        <EmptyState
          action={
            <>
              <Button onClick={() => setUploadOpen(true)}>
                <FileUpIcon />
                Thêm biểu mẫu
              </Button>
              <SampleDataButton variant="outline" />
            </>
          }
          description="Tải file Word (.docx) đã đánh dấu thẻ {ten_truong} lên để bắt đầu. Xem mục Hướng dẫn để biết cách đánh dấu."
          icon={FileTextIcon}
          title="Chưa có biểu mẫu"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates?.map((t) => {
            const newCount = t.fieldCodes.filter((c) => dictionary?.get(c)?.autoDetected).length
            return (
              <Card className="flex flex-col gap-3 p-4" key={t.id}>
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <FileTextIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug font-semibold">{t.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{t.fileName}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label={`Thao tác với ${t.name}`} size="icon-sm" variant="ghost">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(t)}>
                        <PencilIcon />
                        Đổi tên, ghi chú
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setReplaceTarget(t)
                          replaceRef.current?.click()
                        }}
                      >
                        <RefreshCwIcon />
                        Thay file (phiên bản mới)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => downloadBlob(t.file, t.fileName)}>
                        <DownloadIcon />
                        Tải file gốc
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <Confirm
                        description={`Biểu mẫu “${t.name}” sẽ bị xóa và gỡ khỏi các loại hồ sơ đang dùng nó.`}
                        onConfirm={async () => {
                          await deleteTemplate(t.id)
                          toast.success("Đã xóa biểu mẫu")
                        }}
                        title="Xóa biểu mẫu?"
                        trigger={(open) => (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              open()
                            }}
                            variant="destructive"
                          >
                            <Trash2Icon />
                            Xóa
                          </DropdownMenuItem>
                        )}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {t.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{t.description}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{t.fieldCodes.length} trường</Badge>
                  {t.tags.sections.length > 0 ? (
                    <Badge variant="secondary">{t.tags.sections.length} khối điều kiện / bảng</Badge>
                  ) : null}
                  <Badge variant="outline">v{t.version}</Badge>
                  {newCount > 0 ? <Badge variant="warning">{newCount} trường cần rà soát</Badge> : null}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-muted-foreground text-xs">{formatDateTime(t.updatedAt)}</span>
                  <div className="flex gap-1">
                    <Button onClick={() => setViewingFields(t)} size="sm" variant="ghost">
                      <ListTreeIcon />
                      Trường
                    </Button>
                    <Button onClick={() => showPreview(t)} size="sm" variant="outline">
                      <EyeIcon />
                      Xem
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <input
        accept=".docx"
        className="hidden"
        onChange={(e) => onReplace(e.target.files)}
        ref={replaceRef}
        type="file"
      />
      <UploadDialog
        onOpenChange={setUploadOpen}
        onReview={(targets) => setReviewQueue((q) => [...q, ...targets])}
        open={uploadOpen}
      />
      {reviewQueue[0] ? (
        <BlankReviewDialog
          key={`${reviewQueue[0].fileName}-${reviewQueue.length}`}
          onClose={() => setReviewQueue((q) => q.slice(1))}
          target={reviewQueue[0]}
        />
      ) : null}
      <EditDialog key={editing?.id ?? "none"} onClose={() => setEditing(null)} template={editing} />
      <FieldsDialog dictionary={dictionary} onClose={() => setViewingFields(null)} template={viewingFields} />
      <DocxPreviewDialog file={preview} onOpenChange={(o) => !o && setPreview(null)} />
    </>
  )
}
