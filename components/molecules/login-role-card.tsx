"use client"

import { FormEvent, ReactNode } from "react"
import { type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type LoginRoleCardProps = {
  children: ReactNode
  description: string
  icon: LucideIcon
  title: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function LoginRoleCard({
  children,
  description,
  icon: Icon,
  title,
  onSubmit,
}: LoginRoleCardProps) {
  return (
    <form
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6"
      onSubmit={onSubmit}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">{children}</div>

      <Button className="mt-6 w-full" size="lg" type="submit">
        Entrar como {title.toLowerCase()}
      </Button>
    </form>
  )
}
