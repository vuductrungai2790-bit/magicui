"use client"

import { DownloadIcon, Loader2Icon, PrinterIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { downloadBlob } from "@/lib/docx"

interface DocxPreviewDialogProps {
  file: { blob: Blob; fileName: string; title: string } | null
  onOpenChange: (open: boolean) => void
}

/** Xem trước file Word ngay trong trình duyệt, có nút In. */
export const DocxPreviewDialog = ({ file, onOpenChange }: DocxPreviewDialogProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { renderAsync } = await import("docx-preview")
        if (cancelled || !bodyRef.current) {
          return
        }
        bodyRef.current.innerHTML = ""
        await renderAsync(file.blob, bodyRef.current, styleRef.current ?? undefined, {
          className: "docx",
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          breakPages: true,
        })
      } catch {
        if (!cancelled) {
          setError("Không hiển thị được văn bản. Bạn vẫn có thể tải file về để mở bằng Word.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    // Chờ hộp thoại gắn vào DOM.
    const t = setTimeout(run, 30)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [file])

  const print = () => {
    const w = window.open("", "_blank", "width=900,height=1000")
    if (!(w && bodyRef.current)) {
      return
    }
    w.document.title = file?.title ?? "In văn bản"
    const style = w.document.createElement("style")
    style.textContent = `body{margin:0;background:#fff}
      .docx-wrapper{background:#fff!important;padding:0!important}
      .docx-wrapper>section.docx{box-shadow:none!important;margin:0 auto!important}
      @media print{.docx-wrapper>section.docx{page-break-after:always}}`
    for (const el of Array.from(styleRef.current?.querySelectorAll("style") ?? [])) {
      const s = w.document.createElement("style")
      s.textContent = el.textContent
      w.document.head.appendChild(s)
    }
    w.document.head.appendChild(style)
    w.document.body.innerHTML = bodyRef.current.innerHTML
    setTimeout(() => {
      w.focus()
      w.print()
    }, 300)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={file !== null}>
      <DialogContent className="h-[calc(100dvh-2rem)] max-w-5xl gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="flex-row items-center gap-3 border-b px-5 py-3 pr-14">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{file?.title ?? "Xem trước"}</DialogTitle>
            <DialogDescription className="truncate text-xs">{file?.fileName}</DialogDescription>
          </div>
          <Button disabled={loading || Boolean(error)} onClick={print} size="sm" variant="outline">
            <PrinterIcon />
            In
          </Button>
          <Button onClick={() => file && downloadBlob(file.blob, file.fileName)} size="sm">
            <DownloadIcon />
            Tải .docx
          </Button>
        </DialogHeader>
        <div className="bg-muted/60 relative flex-1 overflow-auto p-4 sm:p-8">
          {loading ? (
            <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Đang dựng văn bản…
            </div>
          ) : null}
          {error ? <p className="text-destructive text-center text-sm">{error}</p> : null}
          <div className="hidden" ref={styleRef} />
          <div className="docx-preview-host" ref={bodyRef} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
