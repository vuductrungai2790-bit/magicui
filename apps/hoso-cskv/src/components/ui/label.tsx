"use client"

import * as LabelPrimitive from "@radix-ui/react-label"
import type * as React from "react"

import { cn } from "@/lib/utils"

export const Label = ({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) => (
  <LabelPrimitive.Root
    className={cn("flex items-center gap-1.5 text-sm leading-none font-medium select-none", className)}
    {...props}
  />
)
