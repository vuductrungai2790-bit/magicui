"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { ClipboardCopyIcon, ExternalLinkIcon, Loader2Icon, SettingsIcon, SparklesIcon } from "lucide-react"
import { useState } from "react"
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
import { Textarea } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AI_KEY,
  type AiSettings,
  buildDraftPrompt,
  buildExtractPrompt,
  DEFAULT_AI,
  type DraftRequest,
  draftText,
  extractValues,
  normalizeExtracted,
  parseLooseJson,
} from "@/lib/ai"
import { db } from "@/lib/db"
import { Link } from "@/lib/router"
import type { DossierData, FieldDef, FieldValue } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate, parseIsoDate } from "@/lib/vn"

export const useAiSettings = (): AiSettings => {
  const rec = useLiveQuery(() => db.settings.get(AI_KEY), [])
  return { ...DEFAULT_AI, ...((rec?.value as Partial<AiSettings> | undefined) ?? {}) }
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Đã sao chép câu lệnh", { description: "Dán vào ô chat trên claude.ai rồi gửi." })
  } catch {
    toast.error("Không sao chép được – hãy bôi đen và sao chép thủ công.")
  }
}

/** Khi chưa có khóa API: sao chép câu lệnh sang claude.ai rồi dán câu trả lời về. */
const ManualPanel = ({
  prompt,
  answer,
  onAnswer,
}: {
  prompt: string
  answer: string
  onAnswer: (v: string) => void
}) => (
  <div className="space-y-3 rounded-lg border border-dashed p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm">
        <strong>Chưa có khóa API.</strong>{" "}
        <span className="text-muted-foreground">
          Dùng tạm qua claude.ai, hoặc nhập khóa trong Cài đặt để làm tự động.
        </span>
      </p>
      <Button asChild size="sm" variant="ghost">
        <Link href="/cai-dat/">
          <SettingsIcon />
          Cài đặt
        </Link>
      </Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => copy(prompt)} size="sm" variant="outline">
        <ClipboardCopyIcon />
        1. Sao chép câu lệnh
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href="https://claude.ai/new" rel="noopener noreferrer" target="_blank">
          <ExternalLinkIcon />
          2. Mở claude.ai và dán
        </a>
      </Button>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor="ai-manual-answer">3. Dán câu trả lời của Claude vào đây</Label>
      <Textarea id="ai-manual-answer" onChange={(e) => onAnswer(e.target.value)} rows={5} value={answer} />
    </div>
  </div>
)

/* ------------------------------ Soạn nội dung ------------------------------ */

interface DraftDialogProps {
  request: Omit<DraftRequest, "notes"> | null
  onClose: () => void
  onApply: (text: string) => void
}

export const AiDraftDialog = ({ request, onClose, onApply }: DraftDialogProps) => {
  const settings = useAiSettings()
  const [notes, setNotes] = useState("")
  const [output, setOutput] = useState("")
  const [busy, setBusy] = useState(false)
  const hasKey = Boolean(settings.apiKey.trim())

  if (!request) {
    return null
  }
  const full: DraftRequest = { ...request, notes }

  const run = async () => {
    setBusy(true)
    setOutput("")
    try {
      const text = await draftText(settings, full, setOutput)
      setOutput(text)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không soạn được nội dung")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="text-primary size-5" />
            Soạn “{request.fieldLabel}” bằng Claude
          </DialogTitle>
          <DialogDescription>
            Claude dùng các thông tin đã nhập của hồ sơ để soạn. Hãy đọc lại và sửa trước khi dùng.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {request.documents.map((d) => (
            <Badge key={d} variant="secondary">
              {d}
            </Badge>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-notes">Ý chính / yêu cầu (không bắt buộc)</Label>
          <Textarea
            id="ai-notes"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ví dụ: đối tượng có mặt đúng hẹn, chấp hành tốt; nhắc nhở không đi khỏi địa phương…"
            rows={3}
            value={notes}
          />
        </div>
        {hasKey ? (
          <Button className="w-fit" disabled={busy} onClick={run}>
            {busy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {output ? "Soạn lại" : "Soạn nội dung"}
          </Button>
        ) : (
          <ManualPanel answer={output} onAnswer={setOutput} prompt={buildDraftPrompt(full)} />
        )}
        {hasKey ? (
          <div className="space-y-1.5">
            <Label htmlFor="ai-output">Nội dung Claude soạn (sửa được)</Label>
            <Textarea
              className={cn("min-h-40", busy && "animate-pulse")}
              id="ai-output"
              onChange={(e) => setOutput(e.target.value)}
              placeholder={busy ? "Claude đang soạn…" : "Bấm “Soạn nội dung”."}
              rows={8}
              value={output}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Hủy
          </Button>
          <Button
            disabled={!output.trim() || busy}
            onClick={() => {
              onApply(output.trim())
              onClose()
            }}
          >
            Dùng nội dung này
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ Tự điền thông tin ------------------------------ */

const show = (f: FieldDef, v: FieldValue | undefined): string => {
  if (typeof v === "boolean") {
    return v ? "Có" : "Không"
  }
  if (typeof v !== "string" || !v) {
    return "—"
  }
  return f.type === "date" && parseIsoDate(v) ? formatDate(v) : v
}

interface ExtractDialogProps {
  open: boolean
  fields: FieldDef[]
  data: DossierData
  onClose: () => void
  onApply: (values: Record<string, string | boolean>) => void
}

export const AiExtractDialog = ({ open, fields, data, onClose, onApply }: ExtractDialogProps) => {
  const settings = useAiSettings()
  const [text, setText] = useState("")
  const [answer, setAnswer] = useState("")
  const [result, setResult] = useState<Record<string, string | boolean> | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const hasKey = Boolean(settings.apiKey.trim())

  const accept = (values: Record<string, string | boolean>) => {
    setResult(values)
    setChosen(new Set(Object.keys(values).filter((k) => values[k] !== data[k])))
  }

  const run = async () => {
    if (!text.trim()) {
      toast.error("Hãy dán nội dung văn bản trước")
      return
    }
    setBusy(true)
    try {
      accept(await extractValues(settings, { text, fields }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không phân tích được")
    } finally {
      setBusy(false)
    }
  }

  const readManual = () => {
    try {
      accept(normalizeExtracted(fields, parseLooseJson(answer)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đọc được câu trả lời")
    }
  }

  const rows = result ? fields.filter((f) => f.code in result) : []

  let primary: React.ReactNode = null
  if (result) {
    primary = (
      <Button
        disabled={chosen.size === 0}
        onClick={() => {
          onApply(Object.fromEntries([...chosen].map((k) => [k, result[k] ?? ""])))
          toast.success(`Đã điền ${chosen.size} trường`)
          onClose()
        }}
      >
        Điền {chosen.size} trường
      </Button>
    )
  } else if (hasKey) {
    primary = (
      <Button disabled={busy || !text.trim()} onClick={run}>
        {busy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
        Phân tích
      </Button>
    )
  }

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="text-primary size-5" />
            Điền tự động bằng Claude
          </DialogTitle>
          <DialogDescription>
            Dán nội dung lệnh, quyết định, bản án, tờ khai hoặc ghi chép… Claude sẽ tìm thông tin tương ứng
            với các trường của hồ sơ để bạn duyệt trước khi điền.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="max-h-[55vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground sticky top-0 text-left text-xs">
                <tr>
                  <th className="w-10 px-3 py-2" scope="col">
                    <span className="sr-only">Chọn</span>
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Trường
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Hiện tại
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Claude đề xuất
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const on = chosen.has(f.code)
                  const same = result[f.code] === data[f.code]
                  return (
                    <tr className={cn("border-t", same && "text-muted-foreground")} key={f.code}>
                      <td className="px-3 py-2">
                        <input
                          aria-label={`Điền ${f.label}`}
                          checked={on}
                          className="size-4 accent-[var(--primary)]"
                          disabled={same}
                          onChange={(e) => {
                            const next = new Set(chosen)
                            if (e.target.checked) {
                              next.add(f.code)
                            } else {
                              next.delete(f.code)
                            }
                            setChosen(next)
                          }}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{f.label}</td>
                      <td className="text-muted-foreground px-3 py-2">{show(f, data[f.code])}</td>
                      <td className="px-3 py-2 whitespace-pre-wrap">{show(f, result[f.code])}</td>
                    </tr>
                  )
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground px-3 py-8 text-center" colSpan={4}>
                      Không tìm thấy thông tin nào khớp với các trường.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ai-source">Nội dung văn bản</Label>
              <Textarea
                className="min-h-48"
                id="ai-source"
                onChange={(e) => setText(e.target.value)}
                placeholder="Dán nội dung tại đây…"
                rows={10}
                value={text}
              />
            </div>
            {hasKey ? null : (
              <>
                <ManualPanel
                  answer={answer}
                  onAnswer={setAnswer}
                  prompt={buildExtractPrompt({ text, fields }, true)}
                />
                <Button className="w-fit" disabled={!answer.trim()} onClick={readManual} variant="secondary">
                  Đọc câu trả lời
                </Button>
              </>
            )}
          </>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => setResult(null)} variant="ghost">
              Quay lại
            </Button>
          ) : null}
          <Button onClick={onClose} variant="outline">
            Hủy
          </Button>
          {primary}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
