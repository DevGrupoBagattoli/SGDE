import { type ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ReportFilterFieldProps = {
  label: string
  children: ReactNode
  className?: string
}

export function ReportFilterField({
  label,
  children,
  className,
}: ReportFilterFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}
