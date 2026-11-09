"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

/**
 * Último recurso: erro no layout raiz. Substitui o <html>, então não depende de
 * CSS, tema nem componentes do app.
 */
export default function GlobalError({
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
    <html lang="pt-BR">
      <body style={{ fontFamily: "sans-serif", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Algo deu errado</h1>
        <p style={{ fontSize: 14 }}>
          Tente novamente; se continuar, envie um print desta tela ao suporte.
        </p>
        <pre style={{ fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", background: "#eee", padding: 12 }}>
          {error.name}: {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
        </pre>
        <button onClick={reset} style={{ padding: "8px 16px" }}>
          Tentar novamente
        </button>
      </body>
    </html>
  )
}
