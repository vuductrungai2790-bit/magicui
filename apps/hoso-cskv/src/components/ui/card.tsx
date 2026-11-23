import type * as React from "react"

import { cn } from "@/lib/utils"

export const Card = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("bg-card text-card-foreground rounded-xl border shadow-xs", className)} {...props} />
)

export const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-1 border-b px-5 py-4", className)} {...props} />
)

export const CardTitle = ({ className, ...props }: React.ComponentProps<"h3">) => (
  <h3 className={cn("text-base leading-tight font-semibold", className)} {...props} />
)

export const CardDescription = ({ className, ...props }: React.ComponentProps<"p">) => (
  <p className={cn("text-muted-foreground text-sm", className)} {...props} />
)

export const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("p-5", className)} {...props} />
)
