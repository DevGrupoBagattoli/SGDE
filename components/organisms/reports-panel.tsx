"use client"

import { ReportAuditSection } from "@/components/organisms/report-audit-section"
import { ReportDemandsSection } from "@/components/organisms/report-demands-section"
import { ReportFilters } from "@/components/organisms/report-filters"
import { ReportOccupationSection } from "@/components/organisms/report-occupation-section"
import { ReportProductivitySection } from "@/components/organisms/report-productivity-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useReportsPanel } from "@/hooks/use-reports-panel"
import type { ReportTab } from "@/lib/reports"

type ReportsPanelProps = {
  technicians: string[]
}

export function ReportsPanel({ technicians }: ReportsPanelProps) {
  const panel = useReportsPanel()

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="text-xl font-semibold text-slate-900">Relatórios</h2>
        <p className="mt-1 text-sm text-slate-500">
          Consultas para decisão operacional — exporte para análise detalhada em planilha.
        </p>
      </div>

      <Tabs
        value={panel.tab}
        onValueChange={(value) => panel.setTab(value as ReportTab)}
        className="gap-0"
      >
        <div className="overflow-x-auto border-b border-slate-100 px-3 py-3 sm:px-4">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-slate-100 p-1 sm:min-w-0">
            <TabsTrigger value="occupation" className="text-xs sm:text-sm">
              Ocupação
            </TabsTrigger>
            <TabsTrigger value="demands" className="text-xs sm:text-sm">
              Demandas
            </TabsTrigger>
            <TabsTrigger value="productivity" className="text-xs sm:text-sm">
              Produtividade
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs sm:text-sm">
              Auditoria
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <ReportFilters
            tab={panel.tab}
            technicians={technicians}
            inicio={panel.inicio}
            fim={panel.fim}
            tecnico={panel.tecnico}
            statusFilter={panel.statusFilter}
            auditActions={panel.auditActions}
            ator={panel.ator}
            occupationTechnicians={panel.occupationTechnicians}
            loading={panel.loading}
            exporting={panel.exporting}
            showExport={panel.showExport}
            canExport={panel.canExport}
            onInicioChange={panel.handleInicioChange}
            onFimChange={panel.handleFimChange}
            onTecnicoChange={panel.handleTecnicoChange}
            onAtorChange={panel.handleAtorChange}
            onToggleStatus={panel.toggleStatus}
            onToggleAuditAction={panel.toggleAuditAction}
            onToggleOccupationTechnician={panel.toggleOccupationTechnician}
            onApply={() => void panel.handleApply()}
            onExport={() => void panel.handleExport()}
          />

          {panel.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {panel.error}
            </div>
          ) : null}

          <TabsContent value="occupation" className="mt-0">
            <ReportOccupationSection
              loaded={panel.occupationLoaded}
              technicians={panel.occupation}
              dateRange={panel.occupationDates}
            />
          </TabsContent>

          <TabsContent value="demands" className="mt-0">
            <ReportDemandsSection
              loaded={panel.demandsLoaded}
              total={panel.demandsTotal}
              demands={panel.demands}
              paginated={panel.demandsPaginated}
              onPageChange={panel.setDemandsPage}
            />
          </TabsContent>

          <TabsContent value="productivity" className="mt-0">
            <ReportProductivitySection
              loaded={panel.productivityLoaded}
              rows={panel.productivity}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-0">
            <ReportAuditSection
              loaded={panel.auditLoaded}
              total={panel.auditTotal}
              paginated={panel.auditPaginated}
              onPageChange={panel.setAuditPage}
            />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  )
}
