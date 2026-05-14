import Image from "next/image"
import { ClipboardList, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UserSession, roleLabels } from "@/lib/auth"

type DashboardHeroProps = {
  session: UserSession
  onMenuOpen?: () => void
}

export function DashboardHero({ session, onMenuOpen }: DashboardHeroProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
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

        <div className="flex shrink-0 items-center gap-2">
          <Image
            src="/bagattoli-tech-logo.png"
            alt="Bagattoli Tech"
            width={160}
            height={40}
            className="h-6 w-auto rounded-md sm:h-7 md:h-8"
          />
          {onMenuOpen ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0 border-slate-200 bg-white"
              aria-label="Abrir menu"
              onClick={onMenuOpen}
            >
              <Menu className="size-5 text-slate-800" />
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
