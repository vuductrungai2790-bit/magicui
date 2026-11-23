"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

export const Toaster = () => {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      closeButton
      position="bottom-right"
      richColors
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  )
}
