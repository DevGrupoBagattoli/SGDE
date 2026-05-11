"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { CalendarRange, ChevronLeft, ChevronRight, Filter, Plus } from "lucide-react"

import { CalendarEventPill } from "@/components/molecules/calendar-event-pill"
import { DemandTimeSlot } from "@/components/molecules/demand-time-slot"
import { Button } from "@/components/ui/button"
import {
  getDateKey,
  longDateFormatter,
  monthFormatter,
  weekdayLabels,
} from "@/lib/calendar"
import {
  Demand,
  matchesTechnicianDashboardFilter,
  type DashboardTechnicianFilterRole,
} from "@/lib/demands"
import { cn } from "@/lib/utils"

type CalendarDay = {
  date: Date
  dateKey: string
  isCurrentMonth: boolean
}

type CalendarMonthGridProps = {
  calendarDays: CalendarDay[]
  demandsByDate: Record<string, Demand[]>
  selectedDateKey: string
  compact?: boolean
  onSelectDate: (date: Date) => void
  onSelectDemand: (demand: Demand) => void
}

function CalendarMonthGrid({
  calendarDays,
  demandsByDate,
  selectedDateKey,
  compact = false,
  onSelectDate,
  onSelectDemand,
}: CalendarMonthGridProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700 sm:text-xs">
        {weekdayLabels.map((weekday) => (
          <div className="px-0.5 py-2 sm:px-2 sm:py-3" key={weekday}>
            {compact ? weekday.slice(0, 3) : weekday}
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
                "cursor-pointer border-l border-t border-slate-200 bg-white p-1.5 transition first:border-l-0 sm:p-3",
                compact ? "min-h-30 sm:min-h-40" : "min-h-40",
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
              <div className="flex items-center justify-between gap-1">
                <button
                  aria-label={`Ver horários de ${date.getDate()}`}
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold sm:size-8 sm:text-sm",
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
                  <span className="hidden rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-600 sm:inline sm:px-2 sm:text-xs">
                    {dayDemands.length}
                  </span>
                ) : null}
              </div>

              <div className="mt-1.5 grid gap-1 sm:mt-3 sm:gap-2">
                {dayDemands.slice(0, compact ? 2 : 3).map((demand) => (
                  <CalendarEventPill
                    demand={demand}
                    key={demand.id}
                    onSelect={onSelectDemand}
                  />
                ))}
                {dayDemands.length > (compact ? 2 : 3) ? (
                  <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-600 sm:rounded-xl sm:px-2 sm:py-1 sm:text-xs">
                    +{dayDemands.length - (compact ? 2 : 3)}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type DemandCalendarProps = {
  calendarDays: CalendarDay[]
  currentMonth: Date
  demandsByDate: Record<string, Demand[]>
  isTechnicianFilterLocked?: boolean
  selectedDateKey: string
  selectedTechnician: string
  technicianFilterRole?: DashboardTechnicianFilterRole
  technicians: string[]
  onChangeMonth: (direction: -1 | 1) => void
  onChangeTechnician: (technician: string) => void
  onSelectDate: (date: Date) => void
  onSelectDemand: (demand: Demand) => void
  showCreateButton?: boolean
  onCreateDemand?: () => void
}

export function DemandCalendar({
  calendarDays,
  currentMonth,
  demandsByDate,
  isTechnicianFilterLocked = false,
  selectedDateKey,
  selectedTechnician,
  technicianFilterRole = "gestor",
  technicians,
  onChangeMonth,
  onChangeTechnician,
  onSelectDate,
  onSelectDemand,
  showCreateButton = false,
  onCreateDemand,
}: DemandCalendarProps) {
  const todayKey = getDateKey(new Date())
  const dayStripRef = useRef<HTMLDivElement>(null)
  const [mobileMonthView, setMobileMonthView] = useState(false)

  const agendaViewDate = useMemo(() => {
    const parts = selectedDateKey.split("-").map(Number)
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      return new Date()
    }
    const [y, m, d] = parts
    return new Date(y, m - 1, d)
  }, [selectedDateKey])

  const agendaDemands = useMemo(() => {
    const dayDemands = demandsByDate[selectedDateKey] ?? []
    const filtered =
      selectedTechnician === "Todos"
        ? dayDemands
        : dayDemands.filter((d) =>
            matchesTechnicianDashboardFilter(
              d,
              selectedTechnician,
              technicianFilterRole
            )
          )
    return [...filtered].sort(
      (a, b) =>
        new Date(a.horarioInicio).getTime() -
        new Date(b.horarioInicio).getTime(),
    )
  }, [demandsByDate, selectedDateKey, selectedTechnician, technicianFilterRole])

  const monthDaysForStrip = useMemo(
    () => calendarDays.filter((d) => d.isCurrentMonth),
    [calendarDays],
  )

  useLayoutEffect(() => {
    if (mobileMonthView) return

    const strip = dayStripRef.current
    if (!strip) return

    const todayInStrip = monthDaysForStrip.some((d) => d.dateKey === todayKey)
    if (!todayInStrip) return

    const todayEl = strip.querySelector<HTMLElement>(`[data-date-key="${todayKey}"]`)
    if (!todayEl) return

    const stripRect = strip.getBoundingClientRect()
    const elRect = todayEl.getBoundingClientRect()
    const delta = elRect.left - stripRect.left + strip.scrollLeft
    strip.scrollTo({ left: Math.max(0, delta - 8), behavior: "instant" })
  }, [currentMonth, monthDaysForStrip, mobileMonthView, todayKey])

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight">
                Calendário central
              </h2>
              <Button
                aria-label={
                  mobileMonthView
                    ? "Ver agenda diária"
                    : "Ver calendário mensal"
                }
                type="button"
                size="icon-sm"
                variant="ghost"
                className={cn(
                  "md:hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm",
                  mobileMonthView
                    ? "text-blue-700 hover:bg-blue-50/80 hover:text-blue-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
                onClick={() => setMobileMonthView((value) => !value)}
              >
                <CalendarRange className="size-4" />
              </Button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Atendimentos distribuídos por dia, técnico e status.
            </p>
          </div>
          {showCreateButton && onCreateDemand ? (
            <Button
              className="h-10 shrink-0 gap-2 bg-slate-950 text-white hover:bg-slate-800 sm:self-start"
              type="button"
              onClick={onCreateDemand}
            >
              <Plus className="size-4" />
              Novo chamado
            </Button>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:max-w-md lg:shrink-0">
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
        {mobileMonthView ? (
          <CalendarMonthGrid
            calendarDays={calendarDays}
            compact
            demandsByDate={demandsByDate}
            selectedDateKey={selectedDateKey}
            onSelectDate={onSelectDate}
            onSelectDemand={onSelectDemand}
          />
        ) : (
          <>
            <div
              ref={dayStripRef}
              className="hide-scrollbar flex gap-2 overflow-x-auto pb-4"
            >
              {monthDaysForStrip.map(({ date, dateKey }) => {
                const dayDemands = demandsByDate[dateKey] ?? []
                const isSelected = dateKey === selectedDateKey
                const isToday = dateKey === todayKey

                return (
                  <button
                    key={dateKey}
                    type="button"
                    data-date-key={dateKey}
                    onClick={() => onSelectDate(date)}
                    className={cn(
                      "flex min-w-18 flex-col items-center justify-center rounded-2xl border p-3 transition-all",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                        : isToday
                          ? "border-blue-200 bg-blue-50 text-blue-900"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium uppercase",
                        isSelected ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      {weekdayLabels[date.getDay()].slice(0, 3)}
                    </span>
                    <span className="mt-1 text-xl font-semibold">{date.getDate()}</span>
                    <div className="mt-2 flex h-1.5 gap-1">
                      {dayDemands.length > 0 ? (
                        <div
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isSelected ? "bg-white" : "bg-blue-600",
                          )}
                        />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-transparent" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Agenda do dia</h3>
                <p className="mt-1 text-sm font-medium capitalize text-slate-600">
                  {selectedDateKey === todayKey
                    ? "Hoje"
                    : longDateFormatter.format(agendaViewDate)}
                </p>
              </div>

              {agendaDemands.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  Nenhum atendimento programado para este dia.
                </div>
              ) : (
                <div className="mt-2 grid gap-3">
                  {agendaDemands.map((demand) => (
                    <DemandTimeSlot
                      key={demand.id}
                      demand={demand}
                      onSelect={onSelectDemand}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-5 hidden md:block">
        <CalendarMonthGrid
          calendarDays={calendarDays}
          demandsByDate={demandsByDate}
          selectedDateKey={selectedDateKey}
          onSelectDate={onSelectDate}
          onSelectDemand={onSelectDemand}
        />
      </div>
    </section>
  )
}
