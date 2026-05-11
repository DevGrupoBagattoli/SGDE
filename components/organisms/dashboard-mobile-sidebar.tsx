"use client"

import Link from "next/link"
import {
  CalendarDays,
  ClipboardList,
  List,
  LogOut,
  Users,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DashboardMobileMainView = "day" | "list"

type DashboardNavDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogout: () => void
  /** Demandas: navegação do dashboard. Users: atalhos da página de usuários */
  layout: "demands" | "users"
  isManager: boolean
  totalDemands?: number
  view: DashboardMobileMainView
  onViewChange: (view: DashboardMobileMainView) => void
}

export function DashboardMobileSidebar({
  open,
  onOpenChange,
  onLogout,
  layout,
  isManager,
  totalDemands,
  view,
  onViewChange,
}: DashboardNavDrawerProps) {
  if (!open) {
    return null
  }

  const select = (next: DashboardMobileMainView) => {
    onViewChange(next)
    onOpenChange(false)
  }

  const logout = () => {
    onOpenChange(false)
    onLogout()
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
        aria-label="Fechar menu"
        onClick={() => onOpenChange(false)}
      />

      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl"
        aria-label="Menu do sistema"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClipboardList className="size-4 text-slate-600" />
            SGDE
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="Fechar menu"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {layout === "demands" ? (
            <>
              <div className="md:hidden flex flex-col gap-1">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors",
                    view === "day"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                  onClick={() => select("day")}
                >
                  <CalendarDays
                    className={cn(
                      "size-5 shrink-0",
                      view === "day" ? "text-white" : "text-blue-600",
                    )}
                  />
                  Agenda do dia
                </button>

                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors",
                    view === "list"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                  onClick={() => select("list")}
                >
                  <List
                    className={cn(
                      "size-5 shrink-0",
                      view === "list" ? "text-white" : "text-slate-600",
                    )}
                  />
                  Lista completa
                </button>
              </div>

              {totalDemands !== undefined ? (
                <div className="mt-1 flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700">
                  <CalendarDays className="size-4 shrink-0 text-blue-600" />
                  <span>
                    {totalDemands} demanda{totalDemands === 1 ? "" : "s"}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => onOpenChange(false)}
            >
              <CalendarDays className="size-5 shrink-0 text-blue-600" />
              Demandas
            </Link>
          )}

          {isManager && layout === "demands" ? (
            <Link
              href="/dashboard/users"
              className="mt-1 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              onClick={() => onOpenChange(false)}
            >
              <Users className="size-5 shrink-0 text-slate-600" />
              Usuários
            </Link>
          ) : null}

          <div className="mt-auto border-t border-slate-100 pt-3">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-800"
              onClick={logout}
            >
              <LogOut className="size-5 shrink-0" />
              Sair
            </button>
          </div>
        </nav>
      </aside>
    </>
  )
}
