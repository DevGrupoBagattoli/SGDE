"use client"

import { useCallback, useMemo, useRef, useState } from "react"

import {
  apiReportAudit,
  apiReportAuditCsv,
  apiReportDemands,
  apiReportDemandsCsv,
  apiReportOccupation,
  apiReportProductivity,
  apiReportProductivityCsv,
} from "@/lib/api"
import { DemandStatus } from "@/lib/demands"
import {
  appendDateRangeParams,
  defaultReportDateInputs,
  paginateList,
  validateReportDateRange,
  type ReportAuditAction,
  type ReportAuditRow,
  type ReportDemandRow,
  type ReportOccupationTechnician,
  type ReportProductivityRow,
  type ReportTab,
} from "@/lib/reports"

export function useReportsPanel() {
  const defaults = useMemo(() => defaultReportDateInputs(), [])
  const [tab, setTab] = useState<ReportTab>("occupation")
  const [inicio, setInicio] = useState(defaults.inicio)
  const [fim, setFim] = useState(defaults.fim)
  const [tecnico, setTecnico] = useState("")
  const [statusFilter, setStatusFilter] = useState<DemandStatus[]>([])
  const [auditActions, setAuditActions] = useState<ReportAuditAction[]>([])
  const [ator, setAtor] = useState("")
  const [occupationTechnicians, setOccupationTechnicians] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")
  const [demands, setDemands] = useState<ReportDemandRow[]>([])
  const [demandsTotal, setDemandsTotal] = useState(0)
  const [productivity, setProductivity] = useState<ReportProductivityRow[]>([])
  const [audit, setAudit] = useState<ReportAuditRow[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [occupation, setOccupation] = useState<ReportOccupationTechnician[]>([])
  const [occupationDates, setOccupationDates] = useState<string[]>([])
  const [demandsPage, setDemandsPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [demandsLoaded, setDemandsLoaded] = useState(false)
  const [productivityLoaded, setProductivityLoaded] = useState(false)
  const [auditLoaded, setAuditLoaded] = useState(false)
  const [occupationLoaded, setOccupationLoaded] = useState(false)

  const dateRange = useMemo(() => ({ inicio, fim }), [inicio, fim])
  const applySeqRef = useRef(0)

  const demandsPaginated = useMemo(
    () => paginateList(demands, demandsPage),
    [demands, demandsPage]
  )

  const auditPaginated = useMemo(
    () => paginateList(audit, auditPage),
    [audit, auditPage]
  )

  const activeTabLoaded = useMemo(() => {
    if (tab === "demands") return demandsLoaded
    if (tab === "productivity") return productivityLoaded
    if (tab === "audit") return auditLoaded
    return occupationLoaded
  }, [tab, demandsLoaded, productivityLoaded, auditLoaded, occupationLoaded])

  const handleTabChange = useCallback((nextTab: ReportTab) => {
    setTab(nextTab)
    setError("")
  }, [])

  const resetAllLoaded = useCallback(() => {
    setDemandsLoaded(false)
    setProductivityLoaded(false)
    setAuditLoaded(false)
    setOccupationLoaded(false)
  }, [])

  const buildBaseParams = useCallback(() => {
    const params = new URLSearchParams()
    appendDateRangeParams(params, dateRange)
    return params
  }, [dateRange])

  const toggleStatus = useCallback((status: DemandStatus) => {
    setDemandsLoaded(false)
    setStatusFilter((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    )
  }, [])

  const toggleAuditAction = useCallback((acao: ReportAuditAction) => {
    setAuditLoaded(false)
    setAuditActions((current) =>
      current.includes(acao) ? current.filter((item) => item !== acao) : [...current, acao]
    )
  }, [])

  const toggleOccupationTechnician = useCallback((name: string) => {
    setOccupationLoaded(false)
    setOccupationTechnicians((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    )
  }, [])

  const loadDemands = useCallback(async () => {
    const params = buildBaseParams()
    if (tecnico.trim()) params.set("tecnico", tecnico.trim())
    statusFilter.forEach((status) => params.append("status", status))
    return apiReportDemands(params)
  }, [buildBaseParams, statusFilter, tecnico])

  const loadProductivity = useCallback(async () => {
    const params = buildBaseParams()
    return apiReportProductivity(params)
  }, [buildBaseParams])

  const loadAudit = useCallback(async () => {
    const params = buildBaseParams()
    if (tecnico.trim()) params.set("tecnico", tecnico.trim())
    if (ator.trim()) params.set("ator", ator.trim())
    auditActions.forEach((acao) => params.append("acao", acao))
    return apiReportAudit(params)
  }, [ator, auditActions, buildBaseParams, tecnico])

  const loadOccupation = useCallback(async () => {
    if (!inicio || !fim) {
      throw new Error("Informe data inicial e final para ocupação.")
    }
    const params = new URLSearchParams()
    appendDateRangeParams(params, dateRange)
    occupationTechnicians.forEach((name) => params.append("tecnico", name))
    return apiReportOccupation(params)
  }, [dateRange, inicio, fim, occupationTechnicians])

  const handleApply = useCallback(async () => {
    const dateError = validateReportDateRange(dateRange)
    if (dateError) {
      setError(dateError)
      return
    }

    const seq = ++applySeqRef.current
    setLoading(true)
    setError("")
    try {
      if (tab === "demands") {
        const data = await loadDemands()
        if (seq !== applySeqRef.current) return
        setDemands(data.demands)
        setDemandsTotal(data.total)
        setDemandsPage(1)
        setDemandsLoaded(true)
      } else if (tab === "productivity") {
        const data = await loadProductivity()
        if (seq !== applySeqRef.current) return
        setProductivity(data.technicians)
        setProductivityLoaded(true)
      } else if (tab === "audit") {
        const data = await loadAudit()
        if (seq !== applySeqRef.current) return
        setAudit(data.entries)
        setAuditTotal(data.total)
        setAuditPage(1)
        setAuditLoaded(true)
      } else {
        const data = await loadOccupation()
        if (seq !== applySeqRef.current) return
        setOccupation(data.technicians)
        setOccupationDates(data.dateRange)
        setOccupationLoaded(true)
      }
    } catch (err) {
      if (seq !== applySeqRef.current) return
      setError(err instanceof Error ? err.message : "Falha ao carregar relatório")
    } finally {
      if (seq === applySeqRef.current) setLoading(false)
    }
  }, [dateRange, loadAudit, loadDemands, loadOccupation, loadProductivity, tab])

  const handleExport = useCallback(async () => {
    const dateError = validateReportDateRange(dateRange)
    if (dateError) {
      setError(dateError)
      return
    }

    setExporting(true)
    setError("")
    try {
      const params = buildBaseParams()
      if (tab === "demands") {
        if (tecnico.trim()) params.set("tecnico", tecnico.trim())
        statusFilter.forEach((status) => params.append("status", status))
        await apiReportDemandsCsv(params)
      } else if (tab === "productivity") {
        await apiReportProductivityCsv(params)
      } else if (tab === "audit") {
        if (tecnico.trim()) params.set("tecnico", tecnico.trim())
        if (ator.trim()) params.set("ator", ator.trim())
        auditActions.forEach((acao) => params.append("acao", acao))
        await apiReportAuditCsv(params)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar CSV")
    } finally {
      setExporting(false)
    }
  }, [ator, auditActions, buildBaseParams, dateRange, statusFilter, tab, tecnico])

  const handleInicioChange = useCallback(
    (value: string) => {
      setInicio(value)
      resetAllLoaded()
    },
    [resetAllLoaded]
  )

  const handleFimChange = useCallback(
    (value: string) => {
      setFim(value)
      resetAllLoaded()
    },
    [resetAllLoaded]
  )

  const handleTecnicoChange = useCallback((value: string) => {
    setTecnico(value)
    setDemandsLoaded(false)
    setAuditLoaded(false)
  }, [])

  const handleAtorChange = useCallback((value: string) => {
    setAtor(value)
    setAuditLoaded(false)
  }, [])

  return {
    tab,
    setTab: handleTabChange,
    inicio,
    fim,
    tecnico,
    statusFilter,
    auditActions,
    ator,
    occupationTechnicians,
    loading,
    exporting,
    error,
    demands,
    demandsTotal,
    productivity,
    auditTotal,
    occupation,
    occupationDates,
    demandsLoaded,
    productivityLoaded,
    auditLoaded,
    occupationLoaded,
    demandsPaginated,
    auditPaginated,
    showExport: tab !== "occupation",
    canExport: tab !== "occupation" && activeTabLoaded,
    toggleStatus,
    toggleAuditAction,
    toggleOccupationTechnician,
    handleApply,
    handleExport,
    handleInicioChange,
    handleFimChange,
    handleTecnicoChange,
    handleAtorChange,
    setDemandsPage,
    setAuditPage,
  }
}
