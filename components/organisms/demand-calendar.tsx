"use client"

import { ChevronLeft, ChevronRight, Filter } from "lucide-react"

import { CalendarEventPill } from "@/components/molecules/calendar-event-pill"
import { Button } from "@/components/ui/button"
import { monthFormatter, weekdayLabels } from "@/lib/calendar"
import { Demand } from "@/lib/demands"
import { cn } from "@/lib/utils"

type CalendarDay = {
  date: Date
  dateKey: string
  isCurrentMonth: boolean
}

type DemandCalendarProps = {
  calendarDays: CalendarDay[]
  currentMonth: Date
  demandsByDate: Record<string, Demand[]>
  isTechnicianFilterLocked?: boolean
  selectedDateKey: string
  selectedTechnician: string
  technicians: string[]
  onChangeMonth: (direction: -1 | 1) => void
  onChangeTechnician: (technician: string) => void
  onSelectDate: (date: Date) => void
  onSelectDemand: (demand: Demand) => void
}

export function DemandCalendar({
  calendarDays,
  currentMonth,
  demandsByDate,
  isTechnicianFilterLocked = false,
  selectedDateKey,
  selectedTechnician,
  technicians,
  onChangeMonth,
  onChangeTechnician,
  onSelectDate,
  onSelectDemand,
}: DemandCalendarProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Calendário central</h2>
          <p className="text-sm text-slate-500">
            Atendimentos distribuídos por dia, técnico e status.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:min-w-72">
            <span className="flex items-center gap-2">
              <Filter className="size-4" />
              Filtrar por eletricista
            </span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
              disabled={isTechnicianFilterLocked}
              value={selectedTechnician}
              onChange={(event) => onChangeTechnician(event.target.value)}
            >
              {technicians.map((technician) => (
                <option key={technician} value={technician}>
                  {technician}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <Button
              aria-label="Mês anterior"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => onChangeMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-semibold capitalize text-slate-800">
              {monthFormatter.format(currentMonth)}
            </span>
            <Button
              aria-label="Próximo mês"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => onChangeMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
        <div className="grid grid-cols-7 bg-slate-950 text-center text-xs font-semibold uppercase tracking-wide text-white">
          {weekdayLabels.map((weekday) => (
            <div className="px-2 py-3" key={weekday}>
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-7">
          {calendarDays.map(({ date, dateKey, isCurrentMonth }) => {
            const dayDemands = demandsByDate[dateKey] ?? []
            const isSelected = dateKey === selectedDateKey

            return (
              <div
                className={cn(
                  "min-h-40 cursor-pointer border-t border-slate-200 bg-white p-3 transition sm:border-l first:sm:border-l-0",
                  !isCurrentMonth && "bg-slate-50 text-slate-400",
                  isSelected && "bg-blue-50/60 ring-2 ring-inset ring-blue-400"
                )}
                key={dateKey}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDate(date)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onSelectDate(date)
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    aria-label={`Ver horários de ${date.getDate()}`}
                    className={cn(
                      "grid size-8 place-items-center rounded-full text-sm font-semibold",
                      dayDemands.length > 0 &&
                        "bg-slate-950 text-white shadow-sm",
                      isSelected && "bg-blue-600 text-white"
                    )}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelectDate(date)
                    }}
                  >
                    {date.getDate()}
                  </button>
                  {dayDemands.length > 0 ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {dayDemands.length} atendimento
                      {dayDemands.length > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2">
                  {dayDemands.slice(0, 3).map((demand) => (
                    <CalendarEventPill
                      demand={demand}
                      key={demand.id}
                      onSelect={onSelectDemand}
                    />
                  ))}
                  {dayDemands.length > 3 ? (
                    <span className="rounded-xl bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      +{dayDemands.length - 3} atendimento
                      {dayDemands.length - 3 > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
