"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface RealtimeData {
  balances: {
    usd: number;
    euro: number;
    cad: number;
    crypto: number;
  };
  exchangeRates: {
    usd_to_eur: number;
    usd_to_cad: number;
    eur_to_usd: number;
    cad_to_usd: number;
  };
  cryptoPrices: {
    bitcoin: number;
    ethereum: number;
  };
  messages: any[];
  transactions: any[];
  loading: boolean;
  error: string | null;
}

export function useRealtimeData(): RealtimeData {
  const [data, setData] = useState<RealtimeData>({
    balances: { usd: 0, euro: 0, cad: 0, crypto: 0 },
    exchangeRates: {
      usd_to_eur: 0.85,
      usd_to_cad: 1.35,
      eur_to_usd: 1.18,
      cad_to_usd: 0.74,
    },
    cryptoPrices: { bitcoin: 45000, ethereum: 3000 },
    messages: [],
    transactions: [],
    loading: true,
    error: null,
  });

  const fetchBalances = async (userId: string) => {
    try {
      const [usdResult, euroResult, cadResult, cryptoResult] =
        await Promise.all([
          supabase
            .from("usd_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("euro_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("cad_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
          supabase
            .from("crypto_balances")
            .select("balance")
            .eq("user_id", userId)
            .single(),
        ]);

      return {
        usd: usdResult.data?.balance || 0,
        euro: euroResult.data?.balance || 0,
        cad: cadResult.data?.balance || 0,
        crypto: cryptoResult.data?.balance || 0,
      };
    } catch (error) {
      console.error("Error fetching balances:", error);
      return { usd: 0, euro: 0, cad: 0, crypto: 0 };
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .single();

      if (error) {
        console.error("Error fetching exchange rates:", error);
        return {
          usd_to_eur: 0.85,
          usd_to_cad: 1.35,
          eur_to_usd: 1.18,
          cad_to_usd: 0.74,
        };
      }

      return {
        usd_to_eur: data.usd_to_eur || 0.85,
        usd_to_cad: data.usd_to_cad || 1.35,
        eur_to_usd: data.eur_to_usd || 1.18,
        cad_to_usd: data.cad_to_usd || 0.74,
      };
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      return {
        usd_to_eur: 0.85,
        usd_to_cad: 1.35,
        eur_to_usd: 1.18,
        cad_to_usd: 0.74,
      };
    }
  };

  const fetchCryptoPrices = async () => {
    try {
      const { data, error } = await supabase
        .from("crypto_prices")
        .select("*")
        .single();

      if (error) {
        console.error("Error fetching crypto prices:", error);
        return { bitcoin: 45000, ethereum: 3000 };
      }

      return {
        bitcoin: data.bitcoin_price || 45000,
        ethereum: data.ethereum_price || 3000,
      };
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      return { bitcoin: 45000, ethereum: 3000 };
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching messages:", error.message || error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error("Error fetching messages:", error.message || error);
      return [];
    }
  };

  const fetchTransactions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching transactions:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  };

  const initializeData = async () => {
    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: "User not authenticated",
        }));
        return;
      }

      const [balances, exchangeRates, cryptoPrices, messages, transactions] =
        await Promise.all([
          fetchBalances(user.id),
          fetchExchangeRates(),
          fetchCryptoPrices(),
          fetchMessages(user.id),
          fetchTransactions(user.id),
        ]);

      setData({
        balances,
        exchangeRates,
        cryptoPrices,
        messages,
        transactions,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error("Error initializing data:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error.message || "Failed to load data",
      }));
    }
  };

  const setupRealtimeSubscriptions = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Subscribe to balance changes
    const balanceSubscription = supabase
      .channel("balance_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "usd_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "euro_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cad_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchBalances(user.id).then((balances) => {
            setData((prev) => ({ ...prev, balances }));
          });
        }
      )
      .subscribe();

    // Subscribe to exchange rate changes
    const exchangeRateSubscription = supabase
      .channel("exchange_rate_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exchange_rates",
        },
        () => {
          fetchExchangeRates().then((exchangeRates) => {
            setData((prev) => ({ ...prev, exchangeRates }));
          });
        }
      )
      .subscribe();

    // Subscribe to crypto price changes
    const cryptoPriceSubscription = supabase
      .channel("crypto_price_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_prices",
        },
        () => {
          fetchCryptoPrices().then((cryptoPrices) => {
            setData((prev) => ({ ...prev, cryptoPrices }));
          });
        }
      )
      .subscribe();

    // Subscribe to message changes
    const messageSubscription = supabase
      .channel("message_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_messages",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchMessages(user.id).then((messages) => {
            setData((prev) => ({ ...prev, messages }));
          });
        }
      )
      .subscribe();

    // Subscribe to transaction changes
    const transactionSubscription = supabase
      .channel("transaction_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTransactions(user.id).then((transactions) => {
            setData((prev) => ({ ...prev, transactions }));
          });
        }
      )
      .subscribe();

    return () => {
      balanceSubscription.unsubscribe();
      exchangeRateSubscription.unsubscribe();
      cryptoPriceSubscription.unsubscribe();
      messageSubscription.unsubscribe();
      transactionSubscription.unsubscribe();
    };
  };

  useEffect(() => {
    initializeData();
    const cleanup = setupRealtimeSubscriptions();

    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, []);

  return data;
}
