// Service worker do SGDE — PWA / notificações push (Fase 1).
// Servido estaticamente em /sw.js (public/), escopo "/".
// Sem cache offline no MVP: o handler de fetch é no-op e existe apenas para
// atender ao requisito de instalabilidade do PWA no Chrome.

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", () => {})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    const parsed = event.data ? event.data.json() : {}
    if (parsed && typeof parsed === "object") {
      data = parsed
    }
  } catch {
    data = {} // push sem payload (ex.: DevTools) deve degradar graciosamente
  }

  const url = data.url || "/dashboard"

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "SGDE", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag, // substitui notificação anterior do mesmo evento/demanda
        data: { url },
        requireInteraction: Boolean(data.requireInteraction),
      })

      // Avisa abas abertas para atualizarem o contador do sino
      const windowClients = await self.clients.matchAll({ type: "window" })
      for (const client of windowClients) {
        client.postMessage({ type: "NOTIFICATION_RECEIVED" })
      }
    })()
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    (async () => {
      const url = event.notification.data?.url || "/dashboard"
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      const existing = windowClients.find((client) => client.url.includes(url))
      if (existing) {
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })()
  )
})
