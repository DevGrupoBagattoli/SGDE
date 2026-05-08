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
import { UserSession } from "@/lib/auth"
import { Demand, DemandStatus, mockDemands, statusLabels } from "@/lib/demands"

export function DemandsDashboard() {
  const [session, setSession] = useState<UserSession | null>(null)
  const [demands, setDemands] = useState<Demand[]>(() => mockDemands)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState("Todos")
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null)
  const [scheduleValue, setScheduleValue] = useState("")
  const [observationValue, setObservationValue] = useState("")
  const [scheduleError, setScheduleError] = useState("")
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(2026, 3, 1)
  )
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 3, 30))

  useEffect(() => {
    // TODO: Integrar com API GET para carregar demandas iniciais.
  }, [])

  const technicians = useMemo(
    () => [
      "Todos",
      ...Array.from(new Set(demands.map((demand) => demand.tecnico))),
    ],
    [demands]
  )

  const technicianOptions = useMemo(
    () => Array.from(new Set(demands.map((demand) => demand.tecnico))),
    [demands]
  )

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
      const dateKey = getDateKey(new Date(demand.horarioInicio))
      acc[dateKey] = [...(acc[dateKey] ?? []), demand]
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

  const handleUpdateStatus = (id: string, status: DemandStatus) => {
    // TODO: Integrar com API POST/PATCH.
    setDemands((currentDemands) =>
      currentDemands.map((demand) =>
        demand.id === id ? { ...demand, status } : demand
      )
    )
  }

  const handleCreateDemand = (newDemand: Omit<Demand, "id">) => {
    const createdDemand: Demand = {
      ...newDemand,
      id: crypto.randomUUID(),
    }
    const createdAt = new Date(createdDemand.horarioInicio)

    // TODO: Integrar com API POST para criar chamado.
    setDemands((currentDemands) => [...currentDemands, createdDemand])
    setSelectedDate(createdAt)
    setCurrentMonth(new Date(createdAt.getFullYear(), createdAt.getMonth(), 1))

    if (session?.role === "gestor" && selectedTechnician !== "Todos") {
      setSelectedTechnician(createdDemand.tecnico)
    }

    setIsCreateModalOpen(false)
  }

  const handleLogin = (nextSession: UserSession) => {
    setSession(nextSession)
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
    setSession(null)
    setSelectedTechnician("Todos")
    setEditingDemand(null)
  }

  const handleOpenScheduleEditor = (demand: Demand) => {
    setEditingDemand(demand)
    setScheduleValue(toDateTimeLocalValue(demand.horarioInicio))
    setObservationValue(demand.observacoes)
    setScheduleError("")
  }

  const handleUpdateSchedule = (
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

    // TODO: Integrar com API POST/PATCH.
    setDemands((currentDemands) =>
      currentDemands.map((demand) =>
        demand.id === editingDemand.id
          ? {
              ...demand,
              horarioInicio: nextSchedule,
              observacoes: observationValue.trim(),
              participantes,
              duracaoPrevista,
            }
          : demand
      )
    )
    setEditingDemand(null)
  }

  if (!session) {
    return <LoginScreen technicians={technicianOptions} onLogin={handleLogin} />
  }

  const isElectrician = session.role === "eletricista"
  const isManager = session.role === "gestor"
  const availableTechnicians = isElectrician ? [session.name] : technicians

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
                technicians={availableTechnicians}
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
              technicians={availableTechnicians}
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
