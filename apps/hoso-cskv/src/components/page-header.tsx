import type * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => (
  <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0 space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      {description ? <p className="text-muted-foreground max-w-2xl text-sm">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
)

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}

export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="bg-card/50 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
    <span className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-full">
      <Icon className="size-6" />
    </span>
    <h3 className="font-semibold">{title}</h3>
    <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
    {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
  </div>
)
