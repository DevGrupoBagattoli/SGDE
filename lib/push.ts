// Helpers de Web Push para uso no cliente (browser).
// Não importar em código server-side: depende de window/navigator/Notification.

/**
 * Navegador com suporte a service worker + Push API + Notification API.
 * Fora do browser (SSR) retorna false.
 */
export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window

/**
 * Converte a chave pública VAPID (base64url) no Uint8Array esperado pelo
 * `applicationServerKey`. Base64url troca "+" por "-" e "/" por "_" e pode
 * omitir o padding "=" — ambos os casos são normalizados aqui.
 */
export const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

/**
 * Pede permissão e cria a subscription de push no dispositivo atual.
 * Retorna `null` (sem throw) quando o navegador não suporta, a permissão não
 * foi concedida (ex.: PERMISSION_DENIED) ou não há service worker pronto.
 */
export const subscribeToPush = async (
  publicKey: string
): Promise<PushSubscriptionJSON | null> => {
  if (!isPushSupported()) {
    return null
  }

  const permission = await Notification.requestPermission()

  if (permission !== "granted") {
    return null
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  return subscription.toJSON()
}

/**
 * Remove a subscription do dispositivo no browser.
 * Retorna o endpoint removido (para o caller apagar a linha no servidor) ou
 * `null` quando não havia subscription ativa.
 */
export const unsubscribeFromPush = async (): Promise<string | null> => {
  if (!isPushSupported()) {
    return null
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    return null
  }

  const { endpoint } = subscription
  await subscription.unsubscribe()

  return endpoint
}

/**
 * Subscription ativa no browser (se existir) — usado pelo painel do sino para
 * decidir entre "Ativar notificações" e "Notificações ativas".
 * Usa `getRegistration()` (e não `.ready`) para não pendurar quando o service
 * worker não está registrado.
 */
export const getCurrentPushSubscription = async (): Promise<PushSubscriptionJSON | null> => {
  if (!isPushSupported()) {
    return null
  }

  const registration = await navigator.serviceWorker.getRegistration()

  if (!registration) {
    return null
  }

  const subscription = await registration.pushManager.getSubscription()

  return subscription ? subscription.toJSON() : null
}
