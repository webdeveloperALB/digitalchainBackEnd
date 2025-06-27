"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Balances {
  usd: number;
  euro: number;
  cad: number;
  crypto: number;
}

interface ExchangeRates {
  usd_to_eur: number;
  usd_to_cad: number;
  eur_to_usd: number;
  cad_to_usd: number;
}

interface CryptoPrices {
  bitcoin: number;
  ethereum: number;
}

interface Message {
  id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
}

interface Transaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
}

export function useRealtimeData() {
  const [balances, setBalances] = useState<Balances>({
    usd: 0,
    euro: 0,
    cad: 0,
    crypto: 0,
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    usd_to_eur: 0.85,
    usd_to_cad: 1.35,
    eur_to_usd: 1.18,
    cad_to_usd: 0.74,
  });
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrices>({
    bitcoin: 45000,
    ethereum: 3000,
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeData();
    setupRealtimeSubscriptions();
  }, []);

  const initializeData = async () => {
    try {
      await Promise.all([
        fetchBalances(),
        fetchMessages(),
        fetchTransactions(),
        fetchExchangeRates(),
        fetchCryptoPrices(),
      ]);
    } catch (err: any) {
      console.error("Error initializing data:", err.message || err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Subscribe to balance changes
      const balanceChannel = supabase
        .channel("balance-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "usd_balances",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchBalances()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "euro_balances",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchBalances()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cad_balances",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchBalances()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "crypto_balances",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchBalances()
        )
        .subscribe();

      // Subscribe to message changes
      const messageChannel = supabase
        .channel("message-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_messages",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchMessages()
        )
        .subscribe();

      // Subscribe to transaction changes
      const transactionChannel = supabase
        .channel("transaction-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchTransactions()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(balanceChannel);
        supabase.removeChannel(messageChannel);
        supabase.removeChannel(transactionChannel);
      };
    } catch (err: any) {
      console.error("Error setting up subscriptions:", err.message || err);
    }
  };

  const fetchBalances = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [usdResult, euroResult, cadResult, cryptoResult] =
        await Promise.all([
          supabase
            .from("usd_balances")
            .select("balance")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("euro_balances")
            .select("balance")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("cad_balances")
            .select("balance")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("crypto_balances")
            .select("balance")
            .eq("user_id", user.id)
            .single(),
        ]);

      setBalances({
        usd: usdResult.data?.balance || 0,
        euro: euroResult.data?.balance || 0,
        cad: cadResult.data?.balance || 0,
        crypto: cryptoResult.data?.balance || 0,
      });
    } catch (err: any) {
      console.error("Error fetching balances:", err.message || err);
    }
  };

  const fetchMessages = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("user_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching messages:", error.message || error);
        return;
      }

      setMessages(data || []);
    } catch (err: any) {
      console.error("Error in fetchMessages:", err.message || err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching transactions:", error.message || error);
        return;
      }

      setTransactions(data || []);
    } catch (err: any) {
      console.error("Error in fetchTransactions:", err.message || err);
    }
  };

  const fetchExchangeRates = async () => {
    // Simulate live exchange rates with small random variations
    const baseRates = {
      usd_to_eur: 0.85,
      usd_to_cad: 1.35,
      eur_to_usd: 1.18,
      cad_to_usd: 0.74,
    };

    const variation = () => (Math.random() - 0.5) * 0.02; // ±1% variation

    setExchangeRates({
      usd_to_eur: baseRates.usd_to_eur + variation(),
      usd_to_cad: baseRates.usd_to_cad + variation(),
      eur_to_usd: baseRates.eur_to_usd + variation(),
      cad_to_usd: baseRates.cad_to_usd + variation(),
    });
  };

  const fetchCryptoPrices = async () => {
    // Simulate live crypto prices with random variations
    const basePrices = {
      bitcoin: 45000,
      ethereum: 3000,
    };

    const variation = () => (Math.random() - 0.5) * 0.1; // ±5% variation

    setCryptoPrices({
      bitcoin: Math.round(basePrices.bitcoin * (1 + variation())),
      ethereum: Math.round(basePrices.ethereum * (1 + variation())),
    });
  };

  // Update exchange rates and crypto prices every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchExchangeRates();
      fetchCryptoPrices();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    balances,
    exchangeRates,
    cryptoPrices,
    messages,
    transactions,
    loading,
    error,
    refetch: initializeData,
  };
}
