import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, ClipboardList, LogOut, Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UserSession, roleLabels } from "@/lib/auth"

type DashboardHeroProps = {
  isManager: boolean
  session: UserSession
  totalDemands?: number
  onCreateDemand?: () => void
  onLogout: () => void
}

export function DashboardHero({
  isManager,
  session,
  totalDemands,
  onCreateDemand,
  onLogout,
}: DashboardHeroProps) {
  const pathname = usePathname()
  const isUsersPage = pathname === "/dashboard/users"

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
            <ClipboardList className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-950 sm:text-lg">
              SGDE · Gestão de demandas elétricas
            </h1>
            <p className="truncate text-sm text-slate-500">
              {roleLabels[session.role]} · {session.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalDemands !== undefined && !isUsersPage ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
              <CalendarDays className="size-4 text-blue-600" />
              <span>{totalDemands} demandas</span>
            </div>
          ) : null}

          {isManager && isUsersPage ? (
            <Button className="h-9" variant="outline" asChild>
              <Link href="/dashboard">
                <CalendarDays className="size-4 mr-2" />
                Demandas
              </Link>
            </Button>
          ) : null}

          {isManager && !isUsersPage ? (
            <Button className="h-9" variant="outline" asChild>
              <Link href="/dashboard/users">
                <Users className="size-4 mr-2" />
                Usuários
              </Link>
            </Button>
          ) : null}

          {isManager && onCreateDemand && !isUsersPage ? (
            <Button className="h-9" type="button" onClick={onCreateDemand}>
              <Plus className="size-4 mr-2" />
              Novo chamado
            </Button>
          ) : null}

          <Button
            className="h-9"
            type="button"
            variant="outline"
            onClick={onLogout}
          >
            <LogOut className="size-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  )
}
