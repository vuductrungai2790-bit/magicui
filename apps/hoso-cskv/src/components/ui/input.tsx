import type * as React from "react"

import { cn } from "@/lib/utils"

export const inputClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 file:border-0 file:bg-transparent file:text-sm file:font-medium dark:[color-scheme:dark]"

export const Input = ({ className, ...props }: React.ComponentProps<"input">) => (
  <input className={cn(inputClass, className)} {...props} />
)

export const Textarea = ({ className, ...props }: React.ComponentProps<"textarea">) => (
  <textarea
    className={cn(inputClass, "field-sizing-content min-h-20 py-2 leading-relaxed", className)}
    {...props}
  />
)
