"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { CreateDemandModal } from "@/components/organisms/create-demand-modal"
import {
  DashboardMobileSidebar,
  type DashboardMobileMainView,
} from "@/components/organisms/dashboard-mobile-sidebar"
import { DashboardHero } from "@/components/organisms/dashboard-hero"
import { DaySchedulePanel } from "@/components/organisms/day-schedule-panel"
import { DemandCalendar } from "@/components/organisms/demand-calendar"
import { DemandDetailsList } from "@/components/organisms/demand-details-list"
import { DemandSummary } from "@/components/organisms/demand-summary"
import { DemandSummaryDetailModal } from "@/components/organisms/demand-summary-detail-modal"
import { ScheduleEditModal } from "@/components/organisms/schedule-edit-modal"
import { useSession } from "@/hooks/use-session"
import {
  buildCalendarDays,
  enumerateDateKeysLocal,
  getDateKey,
  toDateTimeLocalValue,
} from "@/lib/calendar"
import {
  apiCreateDemand,
  apiGetDemands,
  apiGetTechnicians,
  apiUpdateSchedule,
  apiUpdateStatus,
} from "@/lib/api"
import {
  Demand,
  DemandStatus,
  statusLabels,
  type SummaryDetailSegment,
} from "@/lib/demands"

export function DemandsDashboard() {
  const router = useRouter()
  const { session, status, logout } = useSession()

  const [demands, setDemands] = useState<Demand[]>([])
  const [availableTechnicians, setAvailableTechnicians] = useState<string[]>([])
  const [isBooting, setIsBooting] = useState(true)
  const [globalError, setGlobalError] = useState("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState("Todos")
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null)
  const [scheduleValue, setScheduleValue] = useState("")
  const [observationValue, setObservationValue] = useState("")
  const [scheduleError, setScheduleError] = useState("")
  const [requestWarning, setRequestWarning] = useState("")
  const [summarySegment, setSummarySegment] =
    useState<SummaryDetailSegment | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileMainView, setMobileMainView] =
    useState<DashboardMobileMainView>("day")
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated" || !session) return

    const bootstrap = async () => {
      try {
        const technicians = await apiGetTechnicians()
        setAvailableTechnicians(technicians.map((technician) => technician.name))
      } catch {
        setAvailableTechnicians([])
      }

      try {
        const loadedDemands = await apiGetDemands()
        setDemands(loadedDemands)

        if (session.role === "eletricista") {
          setSelectedTechnician(session.name)
          const today = new Date()
          setSelectedDate(today)
          setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
        }
      } catch {
        setDemands([])
      } finally {
        setIsBooting(false)
      }
    }

    void bootstrap()
  }, [status, session])

  const technicians = useMemo(
    () => [
      "Todos",
      ...Array.from(new Set(demands.map((demand) => demand.tecnico))),
    ],
    [demands]
  )

  const technicianOptions = useMemo(() => {
    const fromDemands = Array.from(new Set(demands.map((demand) => demand.tecnico)))
    const fromAuthList = availableTechnicians

    return Array.from(new Set([...fromDemands, ...fromAuthList]))
  }, [availableTechnicians, demands])

  const filteredDemands = useMemo(() => {
    const visibleDemands =
      selectedTechnician === "Todos"
        ? demands
        : demands.filter((demand) => demand.tecnico === selectedTechnician)

    return [...visibleDemands].sort(
      (first, second) =>
        new Date(first.horarioInicio).getTime() -
        new Date(second.horarioInicio).getTime()
    )
  }, [demands, selectedTechnician])

  const statusTotals = useMemo(
    () =>
      statusLabels.map((statusLabel) => ({
        status: statusLabel,
        total: filteredDemands.filter((demand) => demand.status === statusLabel)
          .length,
      })),
    [filteredDemands]
  )

  const summaryModalDemands = useMemo(() => {
    if (!summarySegment) return []
    if (summarySegment === "total") return filteredDemands
    return filteredDemands.filter((d) => d.status === summarySegment)
  }, [filteredDemands, summarySegment])

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth]
  )

  const demandsByDate = useMemo(() => {
    return filteredDemands.reduce<Record<string, Demand[]>>((acc, demand) => {
      const keys = enumerateDateKeysLocal(
        new Date(demand.horarioInicio),
        new Date(demand.horarioFim),
      )

      keys.forEach((dateKey) => {
        acc[dateKey] = [...(acc[dateKey] ?? []), demand]
      })

      return acc
    }, {})
  }, [filteredDemands])

  const selectedDateKey = getDateKey(selectedDate)
  const selectedDayDemands = demandsByDate[selectedDateKey] ?? []

  const handleChangeMonth = (direction: -1 | 1) => {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + direction,
      1
    )
    setCurrentMonth(nextMonth)
    setSelectedDate((prev) => {
      if (
        prev.getFullYear() === nextMonth.getFullYear() &&
        prev.getMonth() === nextMonth.getMonth()
      ) {
        return prev
      }
      const today = new Date()
      if (
        today.getFullYear() === nextMonth.getFullYear() &&
        today.getMonth() === nextMonth.getMonth()
      ) {
        return new Date(today)
      }
      return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
    })
  }

  const handleUpdateStatus = async (id: string, newStatus: DemandStatus) => {
    setGlobalError("")
    setRequestWarning("")

    const currentDemand = demands.find((demand) => demand.id === id)

    if (!currentDemand) {
      return
    }

    try {
      const response = await apiUpdateStatus(id, newStatus, currentDemand.version)

      setDemands((currentDemands) =>
        currentDemands.map((demand) =>
          demand.id === id ? response.data.demand : demand
        )
      )

      if (response.warnings.length > 0) {
        setRequestWarning(response.warnings[0].message)
      }
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Falha ao atualizar status"
      )
    }
  }

  const handleCreateDemand = async (
    newDemand: Omit<Demand, "id" | "version" | "dateKeys" | "horarioFim">
  ) => {
    setGlobalError("")
    setRequestWarning("")

    try {
      const response = await apiCreateDemand(newDemand)
      const createdDemand = response.data.demand
      const createdAt = new Date(createdDemand.horarioInicio)

      setDemands((currentDemands) => [...currentDemands, createdDemand])
      setSelectedDate(createdAt)
      setCurrentMonth(new Date(createdAt.getFullYear(), createdAt.getMonth(), 1))

      if (session?.role === "gestor" && selectedTechnician !== "Todos") {
        setSelectedTechnician(createdDemand.tecnico)
      }

      if (response.warnings.length > 0) {
        setRequestWarning(response.warnings[0].message)
      }

      setIsCreateModalOpen(false)
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Falha ao criar demanda"
      )
    }
  }

  const handleLogout = () => {
    void logout()
  }

  const handleOpenScheduleEditor = (demand: Demand) => {
    setEditingDemand(demand)
    setScheduleValue(toDateTimeLocalValue(demand.horarioInicio))
    setObservationValue(demand.observacoes)
    setScheduleError("")
  }

  const handleUpdateSchedule = async (
    event: FormEvent<HTMLFormElement>,
    participantes: string[],
    duracaoPrevista: string
  ) => {
    event.preventDefault()

    if (!editingDemand) {
      return
    }

    const nextSchedule = new Date(scheduleValue).toISOString()
    const scheduleChanged = nextSchedule !== editingDemand.horarioInicio

    if (scheduleChanged && !observationValue.trim()) {
      setScheduleError(
        "Informe uma observação para justificar a alteração de dia ou horário."
      )
      return
    }

    try {
      const response = await apiUpdateSchedule(editingDemand.id, {
        horarioInicio: nextSchedule,
        duracaoPrevista,
        observacoes: observationValue.trim(),
        participantes,
        version: editingDemand.version,
      })

      setDemands((currentDemands) =>
        currentDemands.map((demand) =>
          demand.id === editingDemand.id ? response.data.demand : demand
        )
      )

      if (response.warnings.length > 0) {
        setRequestWarning(response.warnings[0].message)
      } else {
        setRequestWarning("")
      }

      setEditingDemand(null)
    } catch (error) {
      setScheduleError(
        error instanceof Error ? error.message : "Falha ao atualizar agenda"
      )
    }
  }

  if (status === "loading" || status === "unauthenticated" || isBooting || !session) {
    return (
      <main className="grid min-h-svh place-items-center bg-slate-100 text-slate-700">
        Carregando SGDE...
      </main>
    )
  }

  const isElectrician = session.role === "eletricista"
  const isManager = session.role === "gestor"
  const selectableTechnicians = isElectrician ? [session.name] : technicians

  return (
    <main className="min-h-svh bg-slate-100 text-slate-950">
      <DashboardHero
        session={session}
        onMenuOpen={() => setMobileNavOpen(true)}
      />

      <DashboardMobileSidebar
        layout="demands"
        isManager={isManager}
        totalDemands={filteredDemands.length}
        open={mobileNavOpen}
        view={mobileMainView}
        onOpenChange={setMobileNavOpen}
        onLogout={handleLogout}
        onViewChange={setMobileMainView}
      />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {globalError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {globalError}
          </div>
        ) : null}
        {requestWarning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            {requestWarning}
          </div>
        ) : null}
        <>
          <div className="flex flex-col gap-4 md:hidden">
            {mobileMainView === "day" ? (
              <DemandCalendar
                calendarDays={calendarDays}
                currentMonth={currentMonth}
                demandsByDate={demandsByDate}
                isTechnicianFilterLocked={isElectrician}
                selectedDateKey={selectedDateKey}
                selectedTechnician={selectedTechnician}
                technicians={selectableTechnicians}
                showCreateButton={isManager}
                onChangeMonth={handleChangeMonth}
                onChangeTechnician={setSelectedTechnician}
                onCreateDemand={
                  isManager ? () => setIsCreateModalOpen(true) : undefined
                }
                onSelectDate={setSelectedDate}
                onSelectDemand={handleOpenScheduleEditor}
              />
            ) : (
              <div className="flex flex-col gap-6">
                <DemandSummary
                  statusTotals={statusTotals}
                  totalDemands={filteredDemands.length}
                  onSelectSegment={setSummarySegment}
                />
                <DemandDetailsList
                  demands={filteredDemands}
                  onEditSchedule={handleOpenScheduleEditor}
                  onUpdateStatus={handleUpdateStatus}
                />
              </div>
            )}
          </div>

          <div className="hidden flex-col gap-6 md:flex">
            <DemandSummary
              statusTotals={statusTotals}
              totalDemands={filteredDemands.length}
              onSelectSegment={setSummarySegment}
            />
            <DemandCalendar
              calendarDays={calendarDays}
              currentMonth={currentMonth}
              demandsByDate={demandsByDate}
              isTechnicianFilterLocked={isElectrician}
              selectedDateKey={selectedDateKey}
              selectedTechnician={selectedTechnician}
              technicians={selectableTechnicians}
              showCreateButton={isManager}
              onChangeMonth={handleChangeMonth}
              onChangeTechnician={setSelectedTechnician}
              onCreateDemand={
                isManager ? () => setIsCreateModalOpen(true) : undefined
              }
              onSelectDate={setSelectedDate}
              onSelectDemand={handleOpenScheduleEditor}
            />
            <DaySchedulePanel
              demands={selectedDayDemands}
              selectedDate={selectedDate}
              onSelectDemand={handleOpenScheduleEditor}
            />
            <DemandDetailsList
              demands={filteredDemands}
              onEditSchedule={handleOpenScheduleEditor}
              onUpdateStatus={handleUpdateStatus}
            />
          </div>
        </>
      </section>

      {editingDemand ? (
        <ScheduleEditModal
          allTechnicians={technicianOptions}
          demand={editingDemand}
          error={scheduleError}
          observationValue={observationValue}
          scheduleValue={scheduleValue}
          onClose={() => setEditingDemand(null)}
          onObservationChange={(value) => {
            setObservationValue(value)
            setScheduleError("")
          }}
          onScheduleChange={(value) => {
            setScheduleValue(value)
            setScheduleError("")
          }}
          onSubmit={handleUpdateSchedule}
        />
      ) : null}

      {isCreateModalOpen ? (
        <CreateDemandModal
          currentTechnician={selectedTechnician}
          session={session}
          technicians={technicianOptions}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateDemand}
        />
      ) : null}

      <DemandSummaryDetailModal
        demands={summaryModalDemands}
        segment={summarySegment}
        onEditSchedule={handleOpenScheduleEditor}
        onOpenChange={(open) => {
          if (!open) setSummarySegment(null)
        }}
      />
    </main>
  )
}
