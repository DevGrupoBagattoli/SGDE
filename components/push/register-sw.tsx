"use client"

import { useEffect } from "react"

/**
 * Registra o service worker (/sw.js) no cliente.
 * Falhas de registro são ignoradas de propósito: SW é melhoria progressiva
 * (PWA/push) e não deve impactar o funcionamento normal do app.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  return null
}
