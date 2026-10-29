"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, BellRing, CheckCheck, Loader2, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNotifications } from "@/hooks/use-notifications"
import {
  apiGetVapidPublicKey,
  apiSubscribePush,
  apiUnsubscribePush,
  type NotificationDto,
} from "@/lib/api"
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push"
import { cn } from "@/lib/utils"

/**
 * Estado do fluxo de ativação (§8.3 do Doc):
 * unsupported → seção escondida; default → "Ativar notificações";
 * subscribed (granted + subscription) → "Notificações ativas" + "Desativar";
 * denied → instrução para liberar no navegador.
 */
type PushActivationState =
  | "checking"
  | "unsupported"
  | "default"
  | "subscribed"
  | "denied"

const formatRelativeTime = (isoDate: string): string => {
  const elapsedMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(elapsedMs / 60_000)

  if (minutes < 1) return "agora mesmo"
  if (minutes < 60) return `há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`

  const days = Math.floor(hours / 24)
  if (days === 1) return "há 1 dia"
  if (days < 30) return `há ${days} dias`

  return new Date(isoDate).toLocaleDateString("pt-BR")
}

export function NotificationsBell() {
  const router = useRouter()
  const {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markRead,
    readAll,
    ack,
  } = useNotifications()

  const [open, setOpen] = useState(false)
  const [pushState, setPushState] = useState<PushActivationState>("checking")
  const [isPushPending, setIsPushPending] = useState(false)
  const [actionError, setActionError] = useState("")
  const [pushError, setPushError] = useState("")
  const [pendingAckId, setPendingAckId] = useState<string | null>(null)

  const refreshPushState = useCallback(async () => {
    if (!isPushSupported()) {
      setPushState("unsupported")
      return
    }

    if (Notification.permission === "denied") {
      setPushState("denied")
      return
    }

    try {
      const subscription = await getCurrentPushSubscription()

      // A subscription é do navegador, não do usuário: reenvia para o servidor
      // vincular o dispositivo a quem está logado agora (troca de conta no mesmo aparelho).
      if (subscription?.endpoint && subscription.keys?.p256dh && subscription.keys.auth) {
        await apiSubscribePush({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          userAgent: navigator.userAgent,
        }).catch(() => {})
      }

      setPushState(subscription ? "subscribed" : "default")
    } catch {
      setPushState("default")
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setActionError("")

    if (nextOpen) {
      void loadNotifications()
      void refreshPushState()
    }
  }

  const handleNotificationClick = (notification: NotificationDto) => {
    setActionError("")
    void markRead(notification.id).catch(() => {
      setActionError("Não foi possível marcar a notificação como lida.")
    })
    setOpen(false)
    router.push(notification.data?.url || "/dashboard")
  }

  const handleAck = async (notification: NotificationDto) => {
    setActionError("")
    setPendingAckId(notification.id)
    try {
      await ack(notification.id)
    } catch {
      setActionError("Não foi possível confirmar a notificação. Tente novamente.")
    } finally {
      setPendingAckId(null)
    }
  }

  const handleReadAll = async () => {
    setActionError("")
    try {
      await readAll()
    } catch {
      setActionError("Não foi possível marcar as notificações como lidas.")
    }
  }

  const handleActivate = async () => {
    setPushError("")
    setIsPushPending(true)
    try {
      const { publicKey } = await apiGetVapidPublicKey()
      const subscription = await subscribeToPush(publicKey)

      if (
        !subscription?.endpoint ||
        !subscription.keys?.p256dh ||
        !subscription.keys.auth
      ) {
        // Permissão não concedida (ou subscription sem chaves): reavalia o
        // estado para refletir "denied"/"default" sem quebrar a UI.
        await refreshPushState()
        return
      }

      await apiSubscribePush({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        userAgent: navigator.userAgent,
      })

      setPushState("subscribed")
    } catch (error) {
      setPushError(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar as notificações neste dispositivo."
      )
      await refreshPushState()
    } finally {
      setIsPushPending(false)
    }
  }

  const handleDeactivate = async () => {
    setPushError("")
    setIsPushPending(true)
    try {
      const endpoint = await unsubscribeFromPush()

      if (endpoint) {
        try {
          await apiUnsubscribePush(endpoint)
        } catch {
          // Linha pode já ter sido removida no servidor (ex.: limpeza de
          // subscription expirada). O browser já está desativado — segue.
        }
      }

      setPushState("default")
    } catch (error) {
      setPushError(
        error instanceof Error
          ? error.message
          : "Não foi possível desativar as notificações neste dispositivo."
      )
    } finally {
      setIsPushPending(false)
    }
  }

  const showActivationSection =
    pushState !== "checking" && pushState !== "unsupported"

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="relative shrink-0 border-slate-200 bg-white"
          aria-label={
            unreadCount > 0
              ? `Notificações (${unreadCount} não lidas)`
              : "Notificações"
          }
        >
          {unreadCount > 0 ? (
            <BellRing className="size-4 text-slate-800" />
          ) : (
            <Bell className="size-4 text-slate-800" />
          )}
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] leading-4 font-semibold text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 min-w-80 p-1.5 sm:w-96 sm:min-w-96"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Notificações
          </span>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {unreadCount} não lida{unreadCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <div className="-mx-1.5 my-1.5 h-px bg-border/50" />

        {isLoading && notifications.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Carregando notificações…
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-500">
            Nenhuma notificação
          </div>
        ) : (
          <div className="flex max-h-[min(24rem,50svh)] flex-col overflow-y-auto overscroll-contain">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "rounded-2xl px-3 py-2.5",
                  notification.readAt === null && "bg-blue-50/70"
                )}
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col items-start gap-1 text-left"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      {notification.priority === "CRITICAL" ? (
                        <TriangleAlert
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-destructive"
                        />
                      ) : null}
                      {notification.title}
                    </span>
                    {notification.readAt === null ? (
                      <span
                        aria-hidden="true"
                        className="mt-1 size-2 shrink-0 rounded-full bg-blue-600"
                      />
                    ) : null}
                  </div>
                  <p className="w-full text-xs font-normal text-slate-600">
                    {notification.body}
                  </p>
                </button>
                <div className="flex w-full items-center justify-between gap-2 pt-0.5">
                  <span className="text-xs font-normal text-slate-400">
                    {formatRelativeTime(notification.createdAt)}
                  </span>
                  <button
                    type="button"
                    disabled={
                      notification.ackAt !== null ||
                      pendingAckId === notification.id
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      notification.ackAt
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                    onClick={() => void handleAck(notification)}
                  >
                    {notification.ackAt ? "Ciente ✓" : "Ciente"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {actionError ? (
          <p className="px-3 py-2 text-xs font-medium text-red-600">
            {actionError}
          </p>
        ) : null}

        <div className="-mx-1.5 my-1.5 h-px bg-border/50" />

        <button
          type="button"
          disabled={unreadCount === 0 || isLoading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-foreground/10 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => void handleReadAll()}
        >
          <CheckCheck className="size-4" />
          Marcar todas como lidas
        </button>

        {showActivationSection ? (
          <>
            <div className="-mx-1.5 my-1.5 h-px bg-border/50" />
            <div className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Notificações push neste dispositivo
            </div>
            <div className="px-3 pb-3">
              {pushState === "subscribed" ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-emerald-700">
                    ✓ Notificações ativas neste dispositivo
                  </span>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={isPushPending}
                    onClick={() => void handleDeactivate()}
                  >
                    {isPushPending ? "Desativando…" : "Desativar"}
                  </Button>
                </div>
              ) : pushState === "denied" ? (
                <p className="text-xs text-slate-600">
                  Notificações bloqueadas neste navegador. Libere as permissões de
                  notificações deste site nas configurações do navegador — no
                  Chrome/Edge:{" "}
                  <span className="font-medium">
                    chrome://settings/content/notifications
                  </span>{" "}
                  (digitado na barra de endereço); no Firefox: Configurações →
                  Privacidade e Segurança → Permissões → Notificações.
                </p>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={isPushPending}
                  onClick={() => void handleActivate()}
                >
                  {isPushPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <BellRing className="size-3.5" />
                  )}
                  {isPushPending ? "Ativando…" : "Ativar notificações"}
                </Button>
              )}

              {pushError ? (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {pushError}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
