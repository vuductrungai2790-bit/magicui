"use client"

import { useState } from "react"

import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

interface ConfirmProps {
  trigger: (open: () => void) => React.ReactNode
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
}

/** Hộp thoại xác nhận trước khi xóa. */
export const Confirm = ({ trigger, title, description, confirmLabel = "Xóa", onConfirm }: ConfirmProps) => {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="outline">
              Hủy
            </Button>
            <Button disabled={busy} onClick={run} variant="destructive">
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
