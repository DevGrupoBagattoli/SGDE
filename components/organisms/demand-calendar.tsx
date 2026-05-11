"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight, Filter } from "lucide-react"

import { CalendarEventPill } from "@/components/molecules/calendar-event-pill"
import { DemandTimeSlot } from "@/components/molecules/demand-time-slot"
import { Button } from "@/components/ui/button"
import {
  getDateKey,
  longDateFormatter,
  monthFormatter,
  weekdayLabels,
} from "@/lib/calendar"
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
  const todayKey = getDateKey(new Date())
  const agendaViewDate = useMemo(() => {
    const parts = selectedDateKey.split("-").map(Number)
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      return new Date()
    }
    const [y, m, d] = parts
    return new Date(y, m - 1, d)
  }, [selectedDateKey])

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

      <div className="mt-5 md:hidden">
        {/* Date Picker Strip */}
        <div className="flex overflow-x-auto pb-4 gap-2 snap-x hide-scrollbar">
          {calendarDays.filter(d => d.isCurrentMonth).map(({ date, dateKey }) => {
            const dayDemands = demandsByDate[dateKey] ?? []
            const isSelected = dateKey === selectedDateKey
            const isToday = dateKey === todayKey

            return (
              <button
                key={dateKey}
                onClick={() => onSelectDate(date)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[4.5rem] p-3 rounded-2xl border transition-all snap-center",
                  isSelected
                    ? "bg-slate-900 border-slate-900 text-white shadow-md"
                    : isToday
                    ? "bg-blue-50 border-blue-200 text-blue-900"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <span className={cn("text-xs font-medium uppercase", isSelected ? "text-slate-300" : "text-slate-500")}>
                  {weekdayLabels[date.getDay()].slice(0, 3)}
                </span>
                <span className="text-xl font-semibold mt-1">
                  {date.getDate()}
                </span>
                <div className="mt-2 flex gap-1 h-1.5">
                  {dayDemands.length > 0 ? (
                    <div className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : "bg-blue-600")} />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Daily Timeline (Simple List) */}
        <div className="mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Agenda do dia</h3>
            <p className="mt-1 text-sm font-medium capitalize text-slate-600">
              {selectedDateKey === todayKey
                ? "Hoje"
                : longDateFormatter.format(agendaViewDate)}
            </p>
          </div>
          
          {(() => {
            const dayDemands = demandsByDate[selectedDateKey] ?? []
            
            let filteredDemands = dayDemands
            if (selectedTechnician !== "Todos") {
              filteredDemands = dayDemands.filter(d => d.tecnico === selectedTechnician)
            }

            if (filteredDemands.length === 0) {
              return (
                <div className="flex min-h-32 items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 text-sm text-slate-500">
                  Nenhum atendimento programado para este dia.
                </div>
              )
            }

            // Sort by time
            filteredDemands.sort((a, b) => new Date(a.horarioInicio).getTime() - new Date(b.horarioInicio).getTime())

            return (
              <div className="grid gap-3 mt-2">
                {filteredDemands.map((demand) => (
                  <DemandTimeSlot
                    key={demand.id}
                    demand={demand}
                    onSelect={onSelectDemand}
                  />
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 hidden md:block">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-xs font-semibold uppercase tracking-wide text-slate-700">
          {weekdayLabels.map((weekday) => (
            <div className="px-2 py-3" key={weekday}>
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, dateKey, isCurrentMonth }) => {
            const dayDemands = demandsByDate[dateKey] ?? []
            const isSelected = dateKey === selectedDateKey

            return (
              <div
                className={cn(
                  "min-h-40 cursor-pointer border-t border-slate-200 bg-white p-3 transition border-l first:border-l-0",
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
                        "bg-slate-100 text-slate-900 shadow-sm",
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
