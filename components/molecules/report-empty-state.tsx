type ReportEmptyStateProps = {
  message: string
}

export function ReportEmptyState({ message }: ReportEmptyStateProps) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}
