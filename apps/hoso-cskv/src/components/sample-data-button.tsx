"use client"

import { DatabaseIcon, Loader2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button, type ButtonProps } from "@/components/ui/button"
import { loadSampleData } from "@/lib/sample"

export const SampleDataButton = ({ variant = "default", size }: Pick<ButtonProps, "variant" | "size">) => {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await loadSampleData()
      toast.success("Đã nạp dữ liệu minh họa", {
        description: "6 biểu mẫu và 2 loại hồ sơ. Hãy thay bằng biểu mẫu chính thức của đơn vị.",
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không nạp được dữ liệu minh họa")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button disabled={busy} onClick={run} size={size} variant={variant}>
      {busy ? <Loader2Icon className="animate-spin" /> : <DatabaseIcon />}
      Nạp dữ liệu minh họa
    </Button>
  )
}
