"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

/**
 * Fallback de erro de renderização. Mostra a mensagem na tela (um print dela já
 * ajuda a diagnosticar aparelhos antigos) e reporta ao Sentry.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Ocorreu um erro inesperado. Tente novamente; se continuar, envie um print desta tela ao suporte.
      </p>
      <pre className="bg-muted max-w-full overflow-auto rounded-md p-3 text-left text-xs">
        {error.name}: {error.message}
        {error.digest ? `\ndigest: ${error.digest}` : ""}
      </pre>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  )
}
