import * as Sentry from "@sentry/nextjs"

// Só captura de erros (sem tracing nem replay). Sem DSN, o Sentry fica desligado.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
