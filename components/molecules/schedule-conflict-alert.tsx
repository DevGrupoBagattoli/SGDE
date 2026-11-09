import { TriangleAlert } from "lucide-react"

import type { ScheduleConflictDto } from "@/lib/demands"
import { formatAppDateTimeRange } from "@/lib/timezone"

type ScheduleConflictAlertProps = {
  conflicts: ScheduleConflictDto[]
}

export function ScheduleConflictAlert({ conflicts }: ScheduleConflictAlertProps) {
  if (conflicts.length === 0) {
    return null
  }

  return (
    <div
      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      role="alert"
    >
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-4 shrink-0" />
        Este horário está ocupado por uma atividade já marcada.
      </p>
      <ul className="mt-2 grid gap-1">
        {conflicts.map((conflict) => (
          <li key={`${conflict.userId}-${conflict.demandId ?? "restrito"}`}>
            <span className="font-medium">{conflict.userName}</span>
            {conflict.restrito || !conflict.inicio || !conflict.fim ? (
              <span> está ocupado(a) em outro chamado.</span>
            ) : (
              <span>
                {" "}
                em {conflict.local}, {formatAppDateTimeRange(new Date(conflict.inicio), new Date(conflict.fim))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
