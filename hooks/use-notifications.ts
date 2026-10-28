"use client"

import { useCallback, useEffect, useState } from "react"

import {
  apiAckNotification,
  apiGetNotifications,
  apiGetUnreadCount,
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
  type NotificationDto,
} from "@/lib/api"

const UNREAD_POLL_INTERVAL_MS = 60_000

/**
 * Estado do inbox de notificações do usuário logado.
 * O contador é atualizado por poll (60s), em foco de janela e por mensagem do
 * service worker (`NOTIFICATION_RECEIVED`); a lista completa é carregada sob
 * demanda (`loadNotifications`) quando o painel abre.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { unreadCount: count } = await apiGetUnreadCount()
      setUnreadCount(count)
    } catch {
      // Silencioso de propósito: o próximo poll/focus tenta de novo.
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiGetNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // Silencioso de propósito: mantém a última lista carregada.
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    // Primeira carga fora do corpo síncrono do efeito (regra
    // react-hooks/set-state-in-effect); os listeners abaixo cuidam das
    // atualizações seguintes.
    const initialRefresh = window.setTimeout(() => {
      void refreshUnreadCount()
    }, 0)

    const interval = window.setInterval(() => {
      void refreshUnreadCount()
    }, UNREAD_POLL_INTERVAL_MS)

    const handleFocus = () => {
      void refreshUnreadCount()
    }
    window.addEventListener("focus", handleFocus)

    // O service worker avisa as abas abertas quando um push chega.
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null
      if (data?.type === "NOTIFICATION_RECEIVED") {
        void refreshUnreadCount()
      }
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage)
    }

    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage
        )
      }
    }
  }, [refreshUnreadCount])

  const markRead = useCallback(
    async (id: string) => {
      const wasUnread = notifications.some(
        (notification) => notification.id === id && notification.readAt === null
      )

      await apiMarkNotificationRead(id)

      if (wasUnread) {
        setUnreadCount((current) => Math.max(0, current - 1))
      }

      const readAt = new Date().toISOString()
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id && notification.readAt === null
            ? { ...notification, readAt }
            : notification
        )
      )
    },
    [notifications]
  )

  const readAll = useCallback(async () => {
    const { updatedCount } = await apiMarkAllNotificationsRead()

    setUnreadCount((current) => Math.max(0, current - updatedCount))

    const readAt = new Date().toISOString()
    setNotifications((current) =>
      current.map((notification) =>
        notification.readAt === null
          ? { ...notification, readAt }
          : notification
      )
    )
  }, [])

  const ack = useCallback(
    async (id: string) => {
      const wasUnread = notifications.some(
        (notification) => notification.id === id && notification.readAt === null
      )

      await apiAckNotification(id)

      if (wasUnread) {
        setUnreadCount((current) => Math.max(0, current - 1))
      }

      const now = new Date().toISOString()
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                ackAt: notification.ackAt ?? now,
                readAt: notification.readAt ?? now,
              }
            : notification
        )
      )
    },
    [notifications]
  )

  return {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markRead,
    readAll,
    ack,
    refreshUnreadCount,
  }
}
