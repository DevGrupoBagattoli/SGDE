"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"

import { CreateDemandModal } from "@/components/organisms/create-demand-modal"
import { DashboardHero } from "@/components/organisms/dashboard-hero"
import { DaySchedulePanel } from "@/components/organisms/day-schedule-panel"
import { DemandCalendar } from "@/components/organisms/demand-calendar"
import { DemandDetailsList } from "@/components/organisms/demand-details-list"
import { DemandSummary } from "@/components/organisms/demand-summary"
import { LoginScreen } from "@/components/organisms/login-screen"
import { ScheduleEditModal } from "@/components/organisms/schedule-edit-modal"
import {
  buildCalendarDays,
  getDateKey,
  toDateTimeLocalValue,
} from "@/lib/calendar"
import {
  apiCreateDemand,
  apiGetDemands,
  apiGetTechnicians,
  apiLogin,
  apiLogout,
  apiMe,
  apiRefresh,
  apiUpdateSchedule,
  apiUpdateStatus,
} from "@/lib/api"
import { UserSession } from "@/lib/auth"
import { Demand, DemandStatus, statusLabels } from "@/lib/demands"

export function DemandsDashboard() {
  const [session, setSession] = useState<UserSession | null>(null)
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
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(2026, 3, 1)
  )
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 3, 30))

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const technicians = await apiGetTechnicians()
        setAvailableTechnicians(technicians.map((technician) => technician.name))
      } catch {
        setAvailableTechnicians([])
      }

      try {
        const me = await apiMe().catch(async () => apiRefresh())
        setSession(me)

        const loadedDemands = await apiGetDemands()
        setDemands(loadedDemands)
      } catch {
        setSession(null)
        setDemands([])
      } finally {
        setIsBooting(false)
      }
    }

    void bootstrap()
  }, [])

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
      statusLabels.map((status) => ({
        status,
        total: filteredDemands.filter((demand) => demand.status === status)
          .length,
      })),
    [filteredDemands]
  )

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth),
    [currentMonth]
  )

  const demandsByDate = useMemo(() => {
    return filteredDemands.reduce<Record<string, Demand[]>>((acc, demand) => {
      const keys =
        demand.dateKeys && demand.dateKeys.length > 0
          ? demand.dateKeys
          : [getDateKey(new Date(demand.horarioInicio))]

      keys.forEach((dateKey) => {
        acc[dateKey] = [...(acc[dateKey] ?? []), demand]
      })

      return acc
    }, {})
  }, [filteredDemands])

  const selectedDateKey = getDateKey(selectedDate)
  const selectedDayDemands = demandsByDate[selectedDateKey] ?? []

  const handleChangeMonth = (direction: -1 | 1) => {
    setCurrentMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + direction, 1)
    )
  }

  const handleUpdateStatus = async (id: string, status: DemandStatus) => {
    setGlobalError("")
    setRequestWarning("")

    const currentDemand = demands.find((demand) => demand.id === id)

    if (!currentDemand) {
      return
    }

    try {
      const response = await apiUpdateStatus(id, status, currentDemand.version)

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

  const handleLogin = async (credentials: {
    role: "gestor" | "eletricista"
    name: string
    password: string
  }) => {
    setGlobalError("")
    setRequestWarning("")

    const nextSession = await apiLogin(credentials)
    const loadedDemands = await apiGetDemands()

    setSession(nextSession)
    setDemands(loadedDemands)
    setEditingDemand(null)

    if (nextSession.role === "eletricista") {
      setSelectedTechnician(nextSession.name)
      const today = new Date()
      setSelectedDate(today)
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))

      return
    }

    setSelectedTechnician("Todos")
  }

  const handleLogout = () => {
    void apiLogout().catch(() => null)
    setSession(null)
    setDemands([])
    setSelectedTechnician("Todos")
    setEditingDemand(null)
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

  if (isBooting) {
    return (
      <main className="grid min-h-svh place-items-center bg-slate-100 text-slate-700">
        Carregando SGDE...
      </main>
    )
  }

  if (!session) {
    return <LoginScreen technicians={technicianOptions} onLogin={handleLogin} />
  }

  const isElectrician = session.role === "eletricista"
  const isManager = session.role === "gestor"
  const selectableTechnicians = isElectrician ? [session.name] : technicians

  return (
    <main className="min-h-svh bg-slate-100 text-slate-950">
      <DashboardHero
        isManager={isManager}
        session={session}
        totalDemands={filteredDemands.length}
        onCreateDemand={() => {
          if (!isManager) return
          setIsCreateModalOpen(true)
        }}
        onLogout={handleLogout}
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
        {isElectrician ? (
          <>
            <div className="md:hidden">
              <DaySchedulePanel
                demands={selectedDayDemands}
                selectedDate={selectedDate}
                onSelectDemand={handleOpenScheduleEditor}
              />
            </div>

            <div className="hidden flex-col gap-6 md:flex">
              <DemandSummary
                statusTotals={statusTotals}
                totalDemands={filteredDemands.length}
              />
              <DemandCalendar
                calendarDays={calendarDays}
                currentMonth={currentMonth}
                demandsByDate={demandsByDate}
                isTechnicianFilterLocked
                selectedDateKey={selectedDateKey}
                selectedTechnician={selectedTechnician}
                technicians={selectableTechnicians}
                onChangeMonth={handleChangeMonth}
                onChangeTechnician={setSelectedTechnician}
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
        ) : (
          <>
            <DemandSummary
              statusTotals={statusTotals}
              totalDemands={filteredDemands.length}
            />
            <DemandCalendar
              calendarDays={calendarDays}
              currentMonth={currentMonth}
              demandsByDate={demandsByDate}
              selectedDateKey={selectedDateKey}
              selectedTechnician={selectedTechnician}
              technicians={selectableTechnicians}
              onChangeMonth={handleChangeMonth}
              onChangeTechnician={setSelectedTechnician}
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
          </>
        )}
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
    </main>
  )
}
