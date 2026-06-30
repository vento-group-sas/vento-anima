import { useCallback, useEffect, useState } from "react"
import * as Notifications from "expo-notifications"

import { supabase } from "@/lib/supabase"

export function useSupportUnreadCount(userId: string | null | undefined) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0)
      void Notifications.setBadgeCountAsync(0)
      return
    }

    try {
      const { data: tickets, error: ticketsError } = await supabase
        .from("support_tickets")
        .select("id")
        .neq("status", "closed")

      if (ticketsError) throw ticketsError

      const ticketIds = ((tickets as { id: string }[]) ?? []).map((ticket) => ticket.id)
      if (ticketIds.length === 0) {
        setUnreadCount(0)
        void Notifications.setBadgeCountAsync(0)
        return
      }

      const [readsResult, messagesResult] = await Promise.all([
        supabase
          .from("support_ticket_reads")
          .select("ticket_id, last_read_at, hidden_at")
          .eq("employee_id", userId)
          .in("ticket_id", ticketIds),
        supabase
          .from("support_messages")
          .select("ticket_id, author_id, created_at")
          .in("ticket_id", ticketIds)
          .neq("author_id", userId),
      ])

      if (readsResult.error) throw readsResult.error
      if (messagesResult.error) throw messagesResult.error

      const readsByTicket = new Map(
        ((readsResult.data as any[]) ?? []).map((row) => [row.ticket_id, row]),
      )
      const count = ((messagesResult.data as any[]) ?? []).filter((message) => {
        const read = readsByTicket.get(message.ticket_id)
        if (read?.hidden_at) return false
        const lastReadMs = read?.last_read_at ? new Date(read.last_read_at).getTime() : 0
        const messageMs = new Date(message.created_at).getTime()
        return Number.isFinite(messageMs) && messageMs > lastReadMs
      }).length

      setUnreadCount(count)
      void Notifications.setBadgeCountAsync(count)
    } catch (err) {
      console.warn("[SUPPORT] Unread count failed:", err)
    }
  }, [userId])

  useEffect(() => {
    void refreshUnreadCount()
  }, [refreshUnreadCount])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`support-unread-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => void refreshUnreadCount(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages" },
        () => void refreshUnreadCount(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_ticket_reads" },
        () => void refreshUnreadCount(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refreshUnreadCount, userId])

  return unreadCount
}
