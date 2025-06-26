"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

export function useRealtimeBalances(userId: string) {
  const [balances, setBalances] = useState<any>({
    crypto: 0,
    euro: 0,
    cad: 0,
    usd: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchBalances = async () => {
    try {
      const [cryptoResult, euroResult, cadResult, usdResult] = await Promise.allSettled([
        supabase.from("crypto_balances").select("balance").eq("user_id", userId).single(),
        supabase.from("euro_balances").select("balance").eq("user_id", userId).single(),
        supabase.from("cad_balances").select("balance").eq("user_id", userId).single(),
        supabase.from("usd_balances").select("balance").eq("user_id", userId).single(),
      ])

      const newBalances = {
        crypto: cryptoResult.status === "fulfilled" ? Number(cryptoResult.value.data?.balance || 0) : 0,
        euro: euroResult.status === "fulfilled" ? Number(euroResult.value.data?.balance || 0) : 0,
        cad: cadResult.status === "fulfilled" ? Number(cadResult.value.data?.balance || 0) : 0,
        usd: usdResult.status === "fulfilled" ? Number(usdResult.value.data?.balance || 0) : 0,
      }

      setBalances(newBalances)
      console.log(`Updated balances for user ${userId}:`, newBalances)
    } catch (error) {
      console.error("Error fetching balances:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) return

    const channels: RealtimeChannel[] = []

    // Initial fetch
    fetchBalances()

    // Set up real-time subscriptions for each balance table
    const balanceTables = ["crypto_balances", "euro_balances", "cad_balances", "usd_balances"]

    balanceTables.forEach((table) => {
      const channel = supabase
        .channel(`${table}_changes_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: table,
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log(`Real-time update for ${table}:`, payload)
            fetchBalances() // Refetch all balances when any balance changes
          },
        )
        .subscribe()

      channels.push(channel)
    })

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel)
      })
    }
  }, [userId])

  return { balances, loading, refetch: fetchBalances }
}

export function useRealtimeTransactions(userId: string) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) throw error
      setTransactions(data || [])
      console.log(`Updated transactions for user ${userId}:`, data?.length || 0, "transactions")
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userId) return

    let channel: RealtimeChannel

    // Initial fetch
    fetchTransactions()

    // Set up real-time subscription
    channel = supabase
      .channel(`transactions_changes_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Real-time transaction update:", payload)
          fetchTransactions()
        },
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  return { transactions, loading, refetch: fetchTransactions }
}
