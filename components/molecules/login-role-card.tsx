"use client"

import { FormEvent, ReactNode } from "react"
import { type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

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
    <Card className="rounded-3xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <form onSubmit={onSubmit}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-5 sm:p-6 pb-0 sm:pb-0">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl font-semibold text-slate-950">{title}</CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-500">
              {description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pb-0 sm:pb-0">
          <div className="mt-6 grid gap-4">{children}</div>
        </CardContent>

        <CardFooter className="p-5 sm:p-6">
          <Button className="mt-6 w-full" size="lg" type="submit">
            Entrar como {title.toLowerCase()}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
