"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useSession } from "@/hooks/use-session"
import {
  buildCalendarDays,
  enumerateDateKeysLocal,
  getDateKey,
  toDateTimeLocalValue,
} from "@/lib/calendar"
import {
  apiCreateDemand,
  apiDeleteDemand,
  apiGetDemands,
  apiGetTechnicians,
  apiUpdateDescricao,
  apiUpdateSchedule,
  apiUpdateStatus,
} from "@/lib/api"
import {
  Demand,
  DemandStatus,
  matchesTechnicianDashboardFilter,
  parseDurationDisplayMinutes,
  sameParticipants,
  statusLabels,
  type SummaryDetailSegment,
  validateDemandDescricao,
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
  const [deletingDemand, setDeletingDemand] = useState<Demand | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [scheduleValue, setScheduleValue] = useState("")
  const [descricaoValue, setDescricaoValue] = useState("")
  const [observationValue, setObservationValue] = useState("")
  const [scheduleError, setScheduleError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
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
      } catch (error) {
        setDemands([])
        setGlobalError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as demandas. Tente recarregar a página."
        )
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
    const role = session?.role === "eletricista" ? "eletricista" : "gestor"
    const visibleDemands =
      selectedTechnician === "Todos"
        ? demands
        : demands.filter((demand) =>
            matchesTechnicianDashboardFilter(demand, selectedTechnician, role)
          )

    return [...visibleDemands].sort(
      (first, second) =>
        new Date(first.horarioInicio).getTime() -
        new Date(second.horarioInicio).getTime()
    )
  }, [demands, selectedTechnician, session?.role])

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

  const activeSummarySegment = useMemo((): SummaryDetailSegment | null => {
    if (summarySegment === null || summaryModalDemands.length === 0) {
      return null
    }
    return summarySegment
  }, [summarySegment, summaryModalDemands.length])

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
    if (isSaving) return
    setGlobalError("")
    setRequestWarning("")
    setIsSaving(true)

    const currentDemand = demands.find((demand) => demand.id === id)

    if (!currentDemand) {
      setIsSaving(false)
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
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateDemand = async (
    newDemand: Omit<Demand, "id" | "version" | "dateKeys" | "horarioFim">
  ) => {
    if (isSaving) return
    setGlobalError("")
    setRequestWarning("")
    setIsSaving(true)

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
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    void logout()
  }

  const handleOpenScheduleEditor = (demand: Demand) => {
    if (isSaving || isDeleting) return
    setEditingDemand(demand)
    setScheduleValue(toDateTimeLocalValue(demand.horarioInicio))
    setDescricaoValue(demand.descricao)
    setObservationValue(demand.observacoes)
    setScheduleError("")
  }

  const handleUpdateDescricao = async (
    id: string,
    descricao: string,
    version: number
  ) => {
    const response = await apiUpdateDescricao(id, descricao, version)
    const updatedDemand = response.data.demand

    setDemands((currentDemands) =>
      currentDemands.map((demand) =>
        demand.id === id ? updatedDemand : demand
      )
    )

    if (response.warnings.length > 0) {
      setRequestWarning(response.warnings[0].message)
    }

    return updatedDemand
  }

  const handleRequestDelete = useCallback(
    (demand: Demand) => {
      if (isSaving || isDeleting) return
      setDeletingDemand(demand)
    },
    [isDeleting, isSaving]
  )

  const handleConfirmDelete = async () => {
    if (!deletingDemand || isDeleting || isSaving) return

    const deletedId = deletingDemand.id
    const shouldCloseSummary =
      summarySegment !== null &&
      summaryModalDemands.filter((demand) => demand.id !== deletedId).length === 0

    setGlobalError("")
    setIsDeleting(true)

    try {
      await apiDeleteDemand(deletedId)
      setDemands((currentDemands) =>
        currentDemands.filter((demand) => demand.id !== deletedId)
      )
      if (editingDemand?.id === deletedId) {
        setEditingDemand(null)
      }
      if (shouldCloseSummary) {
        setSummarySegment(null)
      }
      setDeletingDemand(null)
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Falha ao excluir demanda"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdateSchedule = async (
    event: FormEvent<HTMLFormElement>,
    participantes: string[],
    duracaoPrevista: string
  ) => {
    event.preventDefault()

    if (!editingDemand || isSaving) {
      return
    }

    const nextSchedule = new Date(scheduleValue).toISOString()
    const durationMinutes = parseDurationDisplayMinutes(duracaoPrevista)
    const nextEndTime = durationMinutes
      ? new Date(new Date(scheduleValue).getTime() + durationMinutes * 60_000).toISOString()
      : editingDemand.horarioFim

    const truncateToMinute = (iso: string) => iso.slice(0, 16)
    const scheduleChanged = truncateToMinute(nextSchedule) !== truncateToMinute(editingDemand.horarioInicio)
    const durationChanged = truncateToMinute(nextEndTime) !== truncateToMinute(editingDemand.horarioFim)

    const trimmedDescricao = descricaoValue.trim()
    const trimmedObservacoes = observationValue.trim()
    const descricaoChanged = trimmedDescricao !== editingDemand.descricao
    const observacoesChanged = trimmedObservacoes !== editingDemand.observacoes
    const participantesChanged = !sameParticipants(
      participantes,
      editingDemand.participantes
    )
    const duracaoChanged = duracaoPrevista !== editingDemand.duracaoPrevista
    const scheduleFieldsChanged =
      scheduleChanged ||
      durationChanged ||
      duracaoChanged ||
      observacoesChanged ||
      participantesChanged

    if (descricaoChanged) {
      const descricaoError = validateDemandDescricao(trimmedDescricao)
      if (descricaoError) {
        setScheduleError(descricaoError)
        return
      }
    }

    if ((scheduleChanged || durationChanged) && !trimmedObservacoes) {
      setScheduleError(
        "Informe uma observação para justificar a alteração de dia, horário ou duração."
      )
      return
    }

    if (!descricaoChanged && !scheduleFieldsChanged) {
      setEditingDemand(null)
      return
    }

    setIsSaving(true)
    setGlobalError("")
    setRequestWarning("")

    let descricaoSaved = false

    try {
      let currentDemand = editingDemand

      if (descricaoChanged) {
        currentDemand = await handleUpdateDescricao(
          editingDemand.id,
          trimmedDescricao,
          editingDemand.version
        )
        descricaoSaved = true
      }

      if (scheduleFieldsChanged) {
        const response = await apiUpdateSchedule(currentDemand.id, {
          horarioInicio: nextSchedule,
          duracaoPrevista,
          observacoes: trimmedObservacoes,
          participantes,
          version: currentDemand.version,
        })

        const updatedDemand = response.data.demand

        setDemands((currentDemands) =>
          currentDemands.map((demand) =>
            demand.id === editingDemand.id ? updatedDemand : demand
          )
        )

        if (response.warnings.length > 0) {
          setRequestWarning(response.warnings[0].message)
        }
      }

      setEditingDemand(null)
    } catch (error) {
      const baseMessage =
        error instanceof Error ? error.message : "Falha ao atualizar demanda"
      setScheduleError(
        descricaoSaved
          ? `${baseMessage} A descrição já foi salva; confira o horário e tente novamente.`
          : baseMessage
      )

      try {
        const refreshed = await apiGetDemands()
        setDemands(refreshed)
        const latest = refreshed.find((d) => d.id === editingDemand.id)
        if (latest) {
          setEditingDemand(latest)
          setScheduleValue(toDateTimeLocalValue(latest.horarioInicio))
          setDescricaoValue(latest.descricao)
        }
      } catch {
        // keep stale data; the error message is already shown
      }
    } finally {
      setIsSaving(false)
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
          <div className="flex flex-col gap-6 md:hidden">
            {mobileMainView === "day" ? (
              <DemandCalendar
                calendarDays={calendarDays}
                currentMonth={currentMonth}
                demandsByDate={demandsByDate}
                isManager={isManager}
                isTechnicianFilterLocked={isElectrician}
                selectedDateKey={selectedDateKey}
                selectedTechnician={selectedTechnician}
                technicianFilterRole={isElectrician ? "eletricista" : "gestor"}
                technicians={selectableTechnicians}
                showCreateButton={isManager}
                onChangeMonth={handleChangeMonth}
                onChangeTechnician={setSelectedTechnician}
                onCreateDemand={
                  isManager ? () => setIsCreateModalOpen(true) : undefined
                }
                onDeleteDemand={handleRequestDelete}
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
                  isManager={isManager}
                  onDeleteDemand={handleRequestDelete}
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
              isManager={isManager}
              isTechnicianFilterLocked={isElectrician}
              selectedDateKey={selectedDateKey}
              selectedTechnician={selectedTechnician}
              technicianFilterRole={isElectrician ? "eletricista" : "gestor"}
              technicians={selectableTechnicians}
              showCreateButton={isManager}
              onChangeMonth={handleChangeMonth}
              onChangeTechnician={setSelectedTechnician}
              onCreateDemand={
                isManager ? () => setIsCreateModalOpen(true) : undefined
              }
              onDeleteDemand={handleRequestDelete}
              onSelectDate={setSelectedDate}
              onSelectDemand={handleOpenScheduleEditor}
            />
            <DaySchedulePanel
              demands={selectedDayDemands}
              isManager={isManager}
              selectedDate={selectedDate}
              onDeleteDemand={handleRequestDelete}
              onSelectDemand={handleOpenScheduleEditor}
            />
            <DemandDetailsList
              demands={filteredDemands}
              isManager={isManager}
              onDeleteDemand={handleRequestDelete}
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
          descricaoValue={descricaoValue}
          error={scheduleError}
          isSaving={isSaving}
          observationValue={observationValue}
          scheduleValue={scheduleValue}
          onClose={() => setEditingDemand(null)}
          onDescricaoChange={(value) => {
            setDescricaoValue(value)
            setScheduleError("")
          }}
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
          isSaving={isSaving}
          session={session}
          technicians={technicianOptions}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateDemand}
        />
      ) : null}

      <DemandSummaryDetailModal
        demands={summaryModalDemands}
        segment={activeSummarySegment}
        onEditSchedule={handleOpenScheduleEditor}
        onOpenChange={(open) => {
          if (!open) setSummarySegment(null)
        }}
      />

      <AlertDialog
        open={deletingDemand !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingDemand(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir demanda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a demanda{" "}
              <strong>{deletingDemand?.descricao}</strong>? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {isDeleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
