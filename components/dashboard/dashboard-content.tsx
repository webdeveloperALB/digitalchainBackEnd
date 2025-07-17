"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { useLatestMessage } from "@/hooks/use-latest-message";
import { supabase } from "@/lib/supabase";
import {
  DollarSign,
  Euro,
  MapIcon as Maple,
  Bitcoin,
  Coins,
  Shield,
  MessageSquare,
  Bell,
  Activity,
  CreditCard,
  Send,
  Wallet,
  Info,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  User,
  FileText,
  Banknote,
} from "lucide-react";
import Image from "next/image";
import TaxCard from "../tax-card";

interface DashboardContentProps {
  userProfile: {
    id: string;
    client_id: string;
    full_name: string | null;
    email: string | null;
    created_at?: string;
  };
  setActiveTab: (tab: string) => void;
}

interface LatestMessage {
  id: string;
  client_id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  is_welcome?: boolean;
}

interface Payment {
  id: string;
  user_id: string;
  payment_type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  due_date?: string;
  created_at: string;
}

interface Transfer {
  id: string;
  user_id: string;
  client_id: string;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  status: string;
  transfer_type: string;
  description?: string;
  created_at: string;
}

interface AccountActivity {
  id: string;
  user_id: string;
  client_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  currency: string;
  display_amount: number;
  status: string;
  priority: string;
  is_read: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  metadata: any;
}

interface CombinedActivity {
  id: string;
  type: "transfer" | "account_activity";
  created_at: string;
  data: Transfer | AccountActivity;
}

interface WelcomeMessage {
  id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  is_welcome: boolean;
}

// Real cryptocurrency configurations
const cryptoConfigs = {
  BTC: {
    name: "Bitcoin",
    iconUrl:
      "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/btc.svg",
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    decimals: 8,
  },
  ETH: {
    name: "Ethereum",
    iconUrl:
      "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    decimals: 6,
  },
  USDT: {
    name: "Tether",
    iconUrl:
      "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdt.svg",
    color: "text-green-500",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    decimals: 2,
  },
};

export default function DashboardContent({
  userProfile,
  setActiveTab,
}: DashboardContentProps) {
  const {
    balances: realtimeBalances,
    exchangeRates,
    cryptoPrices,
    transactions,
    messages,
    loading,
    error,
  } = useRealtimeData();
  const { latestMessage, markAsRead } = useLatestMessage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const loadingRef = useRef(false);
  const [transfersData, setTransfersData] = useState<Transfer[]>([]);
  const [accountActivities, setAccountActivities] = useState<AccountActivity[]>(
    []
  );
  const [combinedActivities, setCombinedActivities] = useState<
    CombinedActivity[]
  >([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState<WelcomeMessage | null>(
    null
  );
  const [isNewUser, setIsNewUser] = useState(false);
  const [hasCheckedWelcome, setHasCheckedWelcome] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<
    LatestMessage | WelcomeMessage | null
  >(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(
    new Set()
  );
  // Add state for crypto balances
  const [cryptoBalances, setCryptoBalances] = useState<Record<string, number>>({
    BTC: 0,
    ETH: 0,
    USDT: 0,
  });

  // Fetch crypto balances from the correct table (newcrypto_balances)
  useEffect(() => {
    const fetchCryptoBalances = async () => {
      if (!userProfile?.id) return;

      try {
        console.log("Fetching crypto balances for user:", userProfile.id);

        const { data, error } = await supabase
          .from("newcrypto_balances")
          .select("btc_balance, eth_balance, usdt_balance")
          .eq("user_id", userProfile.id);

        if (error) {
          console.error("Error fetching crypto balances:", error);
          // Set default values on error
          setCryptoBalances({
            BTC: 0,
            ETH: 0,
            USDT: 0,
          });
          return;
        }

        console.log("Crypto balances data:", data);

        // Handle case where user might not have a record yet
        if (data && data.length > 0) {
          const userBalance = data[0];
          const balances = {
            BTC: Number(userBalance.btc_balance) || 0,
            ETH: Number(userBalance.eth_balance) || 0,
            USDT: Number(userBalance.usdt_balance) || 0,
          };

          console.log("Setting crypto balances:", balances);
          setCryptoBalances(balances);
        } else {
          // No record found, set all balances to 0
          console.log("No crypto balance record found, setting all to 0");
          setCryptoBalances({
            BTC: 0,
            ETH: 0,
            USDT: 0,
          });
        }
      } catch (error) {
        console.error("Error in fetchCryptoBalances:", error);
        // Set default values on any error
        setCryptoBalances({
          BTC: 0,
          ETH: 0,
          USDT: 0,
        });
      }
    };

    fetchCryptoBalances();

    // Set up real-time subscription for crypto balances
    const setupCryptoSubscription = () => {
      const subscription = supabase
        .channel(`newcrypto_balances_${userProfile.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "newcrypto_balances",
            filter: `user_id=eq.${userProfile.id}`,
          },
          (payload) => {
            console.log("Crypto balance change detected:", payload);
            fetchCryptoBalances();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanup = setupCryptoSubscription();
    return cleanup;
  }, [userProfile?.id]);

  // Check if user is new and create welcome message
  useEffect(() => {
    const checkNewUserAndCreateWelcome = async () => {
      if (!userProfile || hasCheckedWelcome) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Check if user was created in the last 24 hours
        const userCreatedAt = new Date(user.created_at);
        const now = new Date();
        const hoursDiff =
          (now.getTime() - userCreatedAt.getTime()) / (1000 * 60 * 60);
        const isRecentUser = hoursDiff <= 24;

        // Check if user has any existing transactions (indicating they're not new)
        const { data: existingTransfers } = await supabase
          .from("transfers")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        const { data: existingPayments } = await supabase
          .from("payments")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        // Check if welcome message already exists
        const { data: existingWelcome } = await supabase
          .from("messages")
          .select("*")
          .eq("client_id", userProfile.client_id)
          .eq("message_type", "welcome")
          .limit(1);

        const hasActivity =
          (existingTransfers && existingTransfers.length > 0) ||
          (existingPayments && existingPayments.length > 0);

        const shouldShowWelcome =
          isRecentUser && !hasActivity && !existingWelcome?.length;

        if (shouldShowWelcome) {
          setIsNewUser(true);
          // Create welcome message in database
          const welcomeData = {
            client_id: userProfile.client_id,
            title: "Welcome to Digital Chain Bank! 🎉",
            content: `Dear ${
              userProfile.full_name || "Valued Customer"
            }, welcome to Digital Chain Bank - your trusted partner in digital banking excellence. We're thrilled to have you join our growing family of satisfied customers. Your account is now active and ready for secure, fast, and reliable financial transactions. Explore our comprehensive banking services including multi-currency transfers, cryptocurrency management, and 24/7 customer support. Thank you for choosing Digital Chain Bank for your financial journey.`,
            message_type: "welcome",
            is_read: false,
            created_at: new Date().toISOString(),
          };

          // Insert welcome message into database
          const { data: insertedMessage, error: insertError } = await supabase
            .from("messages")
            .insert([welcomeData])
            .select();

          if (!insertError && insertedMessage && insertedMessage.length > 0) {
            setWelcomeMessage({
              ...insertedMessage[0],
              is_welcome: true,
            });
            setCurrentMessage({
              ...insertedMessage[0],
              is_welcome: true,
            });
            setShowMessage(true);
          } else {
            // Fallback to local welcome message if database insert fails
            const localWelcomeMessage = {
              id: "welcome-local",
              title: "Welcome to Digital Chain Bank! 🎉",
              content: `Dear ${
                userProfile.full_name || "Valued Customer"
              }, welcome to Digital Chain Bank - your trusted partner in digital banking excellence. We're thrilled to have you join our growing family of satisfied customers.`,
              message_type: "welcome",
              is_read: false,
              created_at: new Date().toISOString(),
              is_welcome: true,
            };
            setWelcomeMessage(localWelcomeMessage);
            setCurrentMessage(localWelcomeMessage);
            setShowMessage(true);
          }
        }
        setHasCheckedWelcome(true);
      } catch (error) {
        console.error("Error checking new user status:", error);
        setHasCheckedWelcome(true);
      }
    };

    checkNewUserAndCreateWelcome();
  }, [userProfile, hasCheckedWelcome]);

  // Handle regular messages
  useEffect(() => {
    // Only show regular messages if there's no welcome message or if the latest message is newer than welcome
    if (latestMessage && !latestMessage.is_read) {
      if (welcomeMessage) {
        // Check if the latest message is newer than the welcome message
        const latestMessageTime = new Date(latestMessage.created_at).getTime();
        const welcomeMessageTime = new Date(
          welcomeMessage.created_at
        ).getTime();

        // Only replace welcome message if admin message is newer
        if (latestMessageTime > welcomeMessageTime) {
          setWelcomeMessage(null); // Clear welcome message
          setCurrentMessage({ ...latestMessage, is_welcome: false });
          setShowMessage(true);
        }
      } else {
        setCurrentMessage({ ...latestMessage, is_welcome: false });
        setShowMessage(true);
      }
    }
  }, [latestMessage, welcomeMessage]);

  useEffect(() => {
    if (loading && !loadingRef.current) {
      loadingRef.current = true;
    } else if (!loading && loadingRef.current) {
      loadingRef.current = false;
      setHasLoaded(true);
    }
  }, [loading]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error("Error fetching payments:", error);
          return;
        }

        setPayments(data || []);
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        setPaymentsLoading(false);
      }
    };

    fetchPayments();

    const setupPaymentsSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const paymentsSubscription = supabase
        .channel("payments_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "payments",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchPayments();
          }
        )
        .subscribe();

      return () => {
        paymentsSubscription.unsubscribe();
      };
    };

    const cleanup = setupPaymentsSubscription();
    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, []);

  // Fetch transfers and account activities
  useEffect(() => {
    const fetchActivities = async () => {
      setActivitiesLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch transfers
        const { data: userTransfers, error: userError } = await supabase
          .from("transfers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (userError) {
          console.error("Error fetching user transfers:", userError);
        }

        const { data: clientTransfers } = await supabase
          .from("transfers")
          .select("*")
          .eq("client_id", userProfile.client_id)
          .order("created_at", { ascending: false })
          .limit(20);

        const allTransfers = [
          ...(userTransfers || []),
          ...(clientTransfers || []),
        ];
        const uniqueTransfers = allTransfers.filter(
          (transfer, index, self) =>
            index === self.findIndex((t) => t.id === transfer.id)
        );

        setTransfersData(uniqueTransfers);

        // Fetch account activities
        const { data: userActivities, error: activitiesError } = await supabase
          .from("account_activities")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(20);

        if (activitiesError) {
          console.error("Error fetching account activities:", activitiesError);
        }

        const { data: clientActivities } = await supabase
          .from("account_activities")
          .select("*")
          .eq("client_id", userProfile.client_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(20);

        const allActivities = [
          ...(userActivities || []),
          ...(clientActivities || []),
        ];
        const uniqueActivities = allActivities.filter(
          (activity, index, self) =>
            index === self.findIndex((a) => a.id === activity.id)
        );

        setAccountActivities(uniqueActivities);

        // Combine and sort all activities
        const combined: CombinedActivity[] = [
          ...uniqueTransfers.map((transfer) => ({
            id: transfer.id,
            type: "transfer" as const,
            created_at: transfer.created_at,
            data: transfer,
          })),
          ...uniqueActivities.map((activity) => ({
            id: activity.id,
            type: "account_activity" as const,
            created_at: activity.created_at,
            data: activity,
          })),
        ];

        // Sort by created_at descending, with admin credits prioritized
        const sortedCombined = combined.sort((a, b) => {
          if (a.type === "transfer" && b.type === "transfer") {
            const aIsCredit = isAdminCredit(a.data as Transfer);
            const bIsCredit = isAdminCredit(b.data as Transfer);
            if (aIsCredit && !bIsCredit) return -1;
            if (!aIsCredit && bIsCredit) return 1;
          }
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });

        setCombinedActivities(sortedCombined);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setActivitiesLoading(false);
      }
    };

    fetchActivities();

    const setupSubscriptions = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Transfers subscription
      const transfersSubscription = supabase
        .channel(`transfers_realtime_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transfers",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("User transfer change detected:", payload);
            fetchActivities();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transfers",
            filter: `client_id=eq.${userProfile.client_id}`,
          },
          (payload) => {
            console.log("Client transfer change detected:", payload);
            fetchActivities();
          }
        )
        .subscribe();

      // Account activities subscription
      const activitiesSubscription = supabase
        .channel(`account_activities_realtime_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "account_activities",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("User account activity change detected:", payload);
            fetchActivities();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "account_activities",
            filter: `client_id=eq.${userProfile.client_id}`,
          },
          (payload) => {
            console.log("Client account activity change detected:", payload);
            fetchActivities();
          }
        )
        .subscribe();

      return () => {
        transfersSubscription.unsubscribe();
        activitiesSubscription.unsubscribe();
      };
    };

    const cleanup = setupSubscriptions();
    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [userProfile.client_id]);

  useEffect(() => {
    const checkForNewAdminMessages = async () => {
      if (!welcomeMessage || !userProfile) return;

      try {
        const { data: newerMessages } = await supabase
          .from("messages")
          .select("*")
          .eq("client_id", userProfile.client_id)
          .neq("message_type", "welcome")
          .gt("created_at", welcomeMessage.created_at)
          .order("created_at", { ascending: false })
          .limit(1);

        if (newerMessages && newerMessages.length > 0) {
          // There's a newer admin message, welcome message should step aside
          console.log(
            "Newer admin message found, welcome message will be replaced"
          );
          setCurrentMessage({ ...newerMessages[0], is_welcome: false });
        }
      } catch (error) {
        console.error("Error checking for newer messages:", error);
      }
    };

    checkForNewAdminMessages();
  }, [welcomeMessage, userProfile, latestMessage]);

  const handleDismissMessage = async () => {
    if (welcomeMessage) {
      try {
        if (welcomeMessage.id !== "welcome-local") {
          await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("id", welcomeMessage.id);
        }
        // Don't clear welcome message, just mark as read
        setWelcomeMessage({ ...welcomeMessage, is_read: true });
        setCurrentMessage({ ...welcomeMessage, is_read: true });
        setShowMessage(false);
      } catch (error) {
        console.error("Error marking welcome message as read:", error);
      }
    } else if (latestMessage) {
      try {
        await markAsRead(latestMessage.id);
        setCurrentMessage(null);
        setShowMessage(false);
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      usd: "$",
      euro: "€",
      cad: "C$",
      BTC: "₿",
      ETH: "Ξ",
      USDT: "₮",
    };
    return `${symbols[currency] || "$"}${amount.toLocaleString(undefined, {
      minimumFractionDigits: currency === "BTC" || currency === "ETH" ? 8 : 2,
      maximumFractionDigits: currency === "BTC" || currency === "ETH" ? 8 : 2,
    })}`;
  };

  const getBalanceIcon = (currency: string) => {
    switch (currency) {
      case "usd":
        return <DollarSign className="h-4 w-4" />;
      case "euro":
        return <Euro className="h-4 w-4" />;
      case "cad":
        return <Maple className="h-4 w-4" />;
      case "BTC":
        return <span className="text-orange-600 font-bold text-lg">₿</span>;
      case "ETH":
        return <span className="text-blue-600 font-bold text-lg">Ξ</span>;
      case "USDT":
        return <span className="text-green-600 font-bold text-lg">₮</span>;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "welcome":
        return <Sparkles className="h-4 w-4" />;
      case "alert":
        return <Bell className="h-4 w-4" />;
      case "warning":
        return <Bell className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // Enhanced function to identify admin actions
  const isAdminCredit = (transfer: Transfer) => {
    return (
      transfer.transfer_type === "admin_deposit" ||
      transfer.transfer_type === "admin_debit" ||
      transfer.transfer_type === "admin_balance_adjustment" ||
      transfer.transfer_type === "admin_crypto_deposit" ||
      transfer.transfer_type === "admin_crypto_debit" ||
      transfer.transfer_type === "admin_crypto_adjustment" ||
      transfer.description?.toLowerCase().includes("account credit") ||
      transfer.description?.toLowerCase().includes("account debit") ||
      transfer.description?.toLowerCase().includes("administrative") ||
      transfer.description?.toLowerCase().includes("balance adjustment") ||
      transfer.description?.toLowerCase().includes("crypto credit") ||
      transfer.description?.toLowerCase().includes("crypto debit")
    );
  };

  const isAdminDebit = (transfer: Transfer) => {
    return (
      transfer.transfer_type === "admin_debit" ||
      transfer.transfer_type === "admin_crypto_debit" ||
      transfer.description?.toLowerCase().includes("account debit") ||
      transfer.description?.toLowerCase().includes("crypto debit") ||
      transfer.description?.toLowerCase().includes("debited from your account")
    );
  };

  const isRegularDeposit = (transfer: Transfer) => {
    return (
      !isAdminCredit(transfer) &&
      (transfer.transfer_type === "deposit" ||
        transfer.transfer_type === "credit" ||
        transfer.description?.toLowerCase().includes("deposit") ||
        transfer.description?.toLowerCase().includes("credit") ||
        transfer.description?.toLowerCase().includes("added") ||
        transfer.description?.toLowerCase().includes("fund"))
    );
  };

  const getActivityIcon = (activity: CombinedActivity) => {
    if (activity.type === "account_activity") {
      const accountActivity = activity.data as AccountActivity;
      switch (accountActivity.activity_type) {
        case "admin_notification":
          return <Building2 className="h-5 w-5" />;
        case "system_update":
          return <Activity className="h-5 w-5" />;
        case "security_alert":
          return <AlertTriangle className="h-5 w-5" />;
        case "account_notice":
          return <Info className="h-5 w-5" />;
        case "service_announcement":
          return <Send className="h-5 w-5" />;
        case "account_credit":
          return <Banknote className="h-5 w-5" />;
        case "account_debit":
          return <Banknote className="h-5 w-5" />;
        case "wire_transfer":
          return <ArrowUpRight className="h-5 w-5" />;
        case "fraud_alert":
          return <Shield className="h-5 w-5" />;
        case "statement_ready":
          return <FileText className="h-5 w-5" />;
        default:
          return <Bell className="h-5 w-5" />;
      }
    } else {
      const transfer = activity.data as Transfer;
      if (isAdminCredit(transfer)) {
        if (isAdminDebit(transfer)) {
          return <AlertTriangle className="h-5 w-5" />;
        }
        return <Building2 className="h-5 w-5" />;
      }
      if (isRegularDeposit(transfer)) {
        return <ArrowDownLeft className="h-5 w-5" />;
      }
      return <ArrowUpRight className="h-5 w-5" />;
    }
  };

  const getActivityDescription = (activity: CombinedActivity) => {
    if (activity.type === "account_activity") {
      const accountActivity = activity.data as AccountActivity;
      return accountActivity.title;
    } else {
      const transfer = activity.data as Transfer;
      // Admin actions - show professional banking messages
      if (
        transfer.transfer_type === "admin_deposit" ||
        transfer.transfer_type === "admin_crypto_deposit"
      ) {
        return "Account Credit";
      }
      if (
        transfer.transfer_type === "admin_debit" ||
        transfer.transfer_type === "admin_crypto_debit"
      ) {
        return "Account Debit";
      }
      if (
        transfer.transfer_type === "admin_balance_adjustment" ||
        transfer.transfer_type === "admin_crypto_adjustment"
      ) {
        return "Balance Adjustment";
      }
      // Check description for admin actions
      if (
        transfer.description?.toLowerCase().includes("account credit") ||
        transfer.description?.toLowerCase().includes("crypto credit")
      ) {
        return "Account Credit";
      }
      if (
        transfer.description?.toLowerCase().includes("account debit") ||
        transfer.description?.toLowerCase().includes("crypto debit")
      ) {
        return "Account Debit";
      }
      if (transfer.description?.toLowerCase().includes("administrative")) {
        return "Administrative Transaction";
      }
      // Regular deposits
      if (isRegularDeposit(transfer)) {
        return `Account Deposit - ${(
          transfer.to_currency || transfer.from_currency
        ).toUpperCase()}`;
      }
      // Regular transfers
      return `${transfer.from_currency?.toUpperCase() || "N/A"} → ${
        transfer.to_currency?.toUpperCase() || "N/A"
      }`;
    }
  };

  const getActivityAmount = (activity: CombinedActivity) => {
    if (activity.type === "account_activity") {
      const accountActivity = activity.data as AccountActivity;
      if (
        accountActivity.display_amount &&
        accountActivity.display_amount !== 0
      ) {
        const sign = accountActivity.display_amount > 0 ? "+" : "";
        return `${sign}${Number(
          accountActivity.display_amount
        ).toLocaleString()} ${accountActivity.currency.toUpperCase()}`;
      }
      return null;
    } else {
      const transfer = activity.data as Transfer;
      if (
        transfer.transfer_type === "admin_deposit" ||
        transfer.transfer_type === "admin_crypto_deposit"
      ) {
        return `+${Number(transfer.from_amount || 0).toLocaleString()} ${(
          transfer.from_currency || "USD"
        ).toUpperCase()}`;
      }
      if (
        transfer.transfer_type === "admin_debit" ||
        transfer.transfer_type === "admin_crypto_debit"
      ) {
        return `-${Number(transfer.from_amount || 0).toLocaleString()} ${(
          transfer.from_currency || "USD"
        ).toUpperCase()}`;
      }
      if (
        transfer.transfer_type === "admin_balance_adjustment" ||
        transfer.transfer_type === "admin_crypto_adjustment"
      ) {
        return `${Number(transfer.to_amount || 0).toLocaleString()} ${(
          transfer.to_currency || "USD"
        ).toUpperCase()}`;
      }
      // Check description for admin actions
      if (
        transfer.description?.toLowerCase().includes("credited to your account")
      ) {
        const match = transfer.description.match(
          /(\d+(?:,\d{3})*(?:\.\d{2})?)/
        );
        const amount = match ? match[1] : transfer.from_amount;
        return `+${amount} ${(transfer.from_currency || "USD").toUpperCase()}`;
      }
      if (
        transfer.description
          ?.toLowerCase()
          .includes("debited from your account")
      ) {
        const match = transfer.description.match(
          /(\d+(?:,\d{3})*(?:\.\d{2})?)/
        );
        const amount = match ? match[1] : transfer.from_amount;
        return `-${amount} ${(transfer.from_currency || "USD").toUpperCase()}`;
      }
      // Regular deposits
      if (isRegularDeposit(transfer)) {
        return `+${Number(
          transfer.to_amount || transfer.from_amount || 0
        ).toLocaleString()} ${(
          transfer.to_currency ||
          transfer.from_currency ||
          "USD"
        ).toUpperCase()}`;
      }
      // Regular transfers
      return `${Number(transfer.from_amount || 0).toLocaleString()} ${(
        transfer.from_currency || "USD"
      ).toUpperCase()} → ${Number(transfer.to_amount || 0).toLocaleString()} ${(
        transfer.to_currency || "USD"
      ).toUpperCase()}`;
    }
  };

  const getActivityColor = (activity: CombinedActivity) => {
    // Use neutral colors with #F26623 accent
    return "border-gray-200 bg-gray-50/30 hover:border-[#F26623]/30";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-[#F26623] text-white border-[#F26623]";
      case "high":
        return "bg-[#F26623]/20 text-[#F26623] border-[#F26623]/30";
      case "normal":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "low":
        return "bg-gray-50 text-gray-600 border-gray-100";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const toggleActivityExpansion = (activityId: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(activityId)) {
      newExpanded.delete(activityId);
    } else {
      newExpanded.add(activityId);
    }
    setExpandedActivities(newExpanded);
  };

  if (loading && !hasLoaded) {
    return (
      <div className="flex-1 p-3 sm:p-6 lg:p-8 bg-gray-50 overflow-auto [@media(max-width:500px)]:pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8 animate-pulse">
            <div className="h-6 sm:h-8 bg-gray-200 rounded w-2/3 sm:w-1/3 mb-2"></div>
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 sm:w-1/2"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white p-4 sm:p-6 rounded-lg shadow animate-pulse"
              >
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2 mb-3 sm:mb-4"></div>
                <div className="h-6 sm:h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 sm:h-16 bg-gray-200 rounded animate-pulse"
              ></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white p-4 sm:p-6 rounded-lg shadow animate-pulse"
              >
                <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex justify-between">
                      <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayName = userProfile?.full_name || userProfile?.email || "User";

  return (
    <div className="flex-1 p-3 sm:p-6 lg:p-8 bg-gray-50 overflow-auto [@media(max-width:500px)]:pt-16">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
            Welcome, {displayName}!
            {isNewUser && (
              <Sparkles className="inline-block ml-2 h-5 w-5 sm:h-6 sm:w-6 text-[#F26623]" />
            )}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            {isNewUser
              ? "Thank you for joining Digital Chain Bank! Here's your new account overview"
              : "Here's your account overview and recent activity"}
          </p>
        </div>

        {error && (
          <Alert className="mb-4 sm:mb-6 border-red-500 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">
              Error: {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Balance Cards - Traditional currencies on top row, crypto on bottom row */}
        <div className="space-y-3 sm:space-y-6 mb-6 sm:mb-8">
          {/* Traditional Currency Cards - USD, EUR, CAD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {realtimeBalances &&
              Object.entries(realtimeBalances)
                .filter(([currency]) =>
                  ["usd", "euro", "cad"].includes(currency)
                )
                .map(([currency, balance]) => (
                  <Card
                    key={currency}
                    className="hover:shadow-lg transition-shadow bg-[#F26623] relative overflow-hidden"
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm text-white font-medium capitalize">
                        {currency === "usd"
                          ? "USD"
                          : currency === "euro"
                          ? "EUR"
                          : "CAD"}{" "}
                        Balance
                      </CardTitle>
                      {React.cloneElement(getBalanceIcon(currency), {
                        className: "text-white w-4 h-4 sm:w-5 sm:h-5",
                      })}
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                        {formatCurrency(balance, currency)}
                      </div>
                      <p className="text-xs text-muted-foreground text-white mt-1">{`${currency.toUpperCase()} account`}</p>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* Crypto Currency Cards - BTC, ETH, USDT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {["BTC", "ETH", "USDT"].map((cryptoCurrency) => {
              const balance = cryptoBalances[cryptoCurrency] || 0;
              const config =
                cryptoConfigs[cryptoCurrency as keyof typeof cryptoConfigs];
              const IconComponent = config.iconUrl;

              return (
                <Card
                  key={cryptoCurrency}
                  className={`hover:shadow-lg transition-shadow relative overflow-hidden ${config.bgColor} ${config.borderColor} border-2`}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                    <CardTitle
                      className={`text-xs sm:text-sm font-medium ${config.color}`}
                    >
                      {config.name}
                    </CardTitle>
                    <Image
                      src={config.iconUrl}
                      alt={`${config.name} icon`}
                      width={36}
                      height={36}
                      className={`w-8 h-8 sm:w-8 sm:h-8 ${config.color}`}
                    />
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div
                      className={`text-lg sm:text-xl lg:text-2xl font-bold ${config.color}`}
                    >
                      {formatCurrency(balance, cryptoCurrency)}
                    </div>
                    <p className={`text-xs mt-1 ${config.color} opacity-70`}>
                      {cryptoCurrency} wallet
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Button
            onClick={() => setActiveTab("transfers")}
            className="h-12 sm:h-16 bg-[#F26623] hover:bg-[#E55A1F] text-white text-sm sm:text-base"
          >
            <Send className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Transfer Money
          </Button>
          <Button
            onClick={() => setActiveTab("deposit")}
            variant="outline"
            className="h-12 sm:h-16 text-sm sm:text-base"
          >
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Deposit Funds
          </Button>
          <Button
            onClick={() => setActiveTab("crypto")}
            variant="outline"
            className="h-12 sm:h-16 text-sm sm:text-base"
          >
            <Bitcoin className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Crypto Trading
          </Button>
          <Button
            onClick={() => setActiveTab("card")}
            variant="outline"
            className="h-12 sm:h-16 text-sm sm:text-base"
          >
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Manage Cards
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-[#F5F0F0] border-b p-4 sm:p-6">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-[#F26623]" />
                  Account Activity
                  <Badge
                    variant="outline"
                    className="ml-2 text-xs bg-[#F26623] text-white border-[#F26623]"
                  >
                    Real-time
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activitiesLoading ? (
                  <div className="space-y-2 p-4 sm:p-6">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="py-2 border-b border-gray-100 animate-pulse"
                      >
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : combinedActivities.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-gray-500 p-4 sm:p-6">
                    <Send className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm">
                      {isNewUser
                        ? "Welcome! Your first transaction will appear here"
                        : "No account activity"}
                    </p>
                    <p className="text-xs mt-1">
                      {isNewUser
                        ? "Start by making a deposit or transfer to see your activity"
                        : "Your transactions will appear here in real-time"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {combinedActivities.slice(0, 8).map((activity) => {
                      const isExpanded = expandedActivities.has(activity.id);
                      const activityData = activity.data;
                      const hasDescription =
                        activity.type === "account_activity"
                          ? (activityData as AccountActivity).description
                          : (activityData as Transfer).description;
                      const description =
                        activity.type === "account_activity"
                          ? (activityData as AccountActivity).description
                          : (activityData as Transfer).description;
                      const shouldShowExpand =
                        description && description.length > 100;

                      return (
                        <div
                          key={activity.id}
                          className={`transition-all duration-200 hover:bg-gray-50/50 ${getActivityColor(
                            activity
                          )} border-l-4 hover:border-l-[#F26623]`}
                        >
                          <div className="p-3 sm:p-4 lg:p-6">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start space-x-3 flex-1 min-w-0">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 border-2 border-gray-100">
                                  {React.cloneElement(
                                    getActivityIcon(activity),
                                    {
                                      className:
                                        "h-4 w-4 sm:h-5 sm:w-5 text-[#F26623]",
                                    }
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2 sm:mb-3">
                                    <h4 className="font-bold text-sm sm:text-base lg:text-lg text-gray-900 leading-tight">
                                      {getActivityDescription(activity)}
                                    </h4>
                                    {activity.type === "account_activity" && (
                                      <Badge
                                        className={`text-xs font-medium border mt-1 sm:mt-0 self-start ${getPriorityColor(
                                          (activityData as AccountActivity)
                                            .priority
                                        )}`}
                                      >
                                        {(
                                          activityData as AccountActivity
                                        ).priority.toUpperCase()}
                                      </Badge>
                                    )}
                                  </div>
                                  {getActivityAmount(activity) && (
                                    <div className="flex items-center space-x-2 mb-2 sm:mb-3">
                                      <Banknote className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                                      <span
                                        className={`font-bold text-sm sm:text-base lg:text-lg ${
                                          activity.type === "account_activity"
                                            ? (activityData as AccountActivity)
                                                .display_amount > 0
                                              ? "text-[#F26623]"
                                              : "text-gray-600"
                                            : getActivityAmount(
                                                activity
                                              )?.startsWith("+")
                                            ? "text-[#F26623]"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        {getActivityAmount(activity)}
                                      </span>
                                    </div>
                                  )}
                                  {hasDescription && (
                                    <div className="mb-3 sm:mb-4">
                                      <div
                                        className={`text-xs sm:text-sm text-gray-700 leading-relaxed ${
                                          !isExpanded && shouldShowExpand
                                            ? "line-clamp-3"
                                            : ""
                                        }`}
                                      >
                                        {description
                                          ?.split("\n")
                                          .map((line, index) => (
                                            <div
                                              key={index}
                                              className={
                                                index > 0 ? "mt-2" : ""
                                              }
                                            >
                                              {line}
                                            </div>
                                          ))}
                                      </div>
                                      {shouldShowExpand && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            toggleActivityExpansion(activity.id)
                                          }
                                          className="mt-2 text-[#F26623] hover:text-[#F26623] hover:bg-[#F26623]/10 p-0 h-auto font-medium text-xs sm:text-sm"
                                        >
                                          {isExpanded ? (
                                            <>
                                              <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                              Show Less
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                              Read More
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-1 sm:space-y-0 text-xs text-gray-500">
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-3 w-3" />
                                      <span className="font-medium">
                                        {new Date(
                                          activity.created_at
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}{" "}
                                        at{" "}
                                        {new Date(
                                          activity.created_at
                                        ).toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    {activity.type === "account_activity" &&
                                      (activityData as AccountActivity)
                                        .expires_at && (
                                        <div className="flex items-center space-x-1">
                                          <Calendar className="h-3 w-3" />
                                          <span>
                                            Expires:{" "}
                                            {new Date(
                                              (
                                                activityData as AccountActivity
                                              ).expires_at!
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                      )}
                                    {activity.type === "account_activity" &&
                                      (activityData as AccountActivity)
                                        .created_by && (
                                        <div className="flex items-center space-x-1">
                                          <User className="h-3 w-3" />
                                          <span>Admin</span>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                                {activity.type === "transfer" &&
                                  !isAdminCredit(activity.data as Transfer) &&
                                  !isRegularDeposit(
                                    activity.data as Transfer
                                  ) &&
                                  (activity.data as Transfer).exchange_rate &&
                                  (activity.data as Transfer).exchange_rate !==
                                    1.0 && (
                                    <div className="text-xs text-gray-500 text-right">
                                      <span className="font-medium">
                                        Rate:{" "}
                                      </span>
                                      {Number(
                                        (activity.data as Transfer)
                                          .exchange_rate
                                      ).toFixed(4)}
                                    </div>
                                  )}
                                <Badge className="text-xs px-2 sm:px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                  {activity.type === "account_activity"
                                    ? "Active"
                                    : (activity.data as Transfer).status ||
                                      "Completed"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center text-base sm:text-lg">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                {paymentsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="py-2 border-b border-gray-100 animate-pulse"
                      >
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-2 sm:h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <CreditCard className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm">
                      {isNewUser ? "No payments yet" : "No recent payments"}
                    </p>
                    <p className="text-xs mt-1">
                      {isNewUser
                        ? "Your payment history will appear here once you start making transactions"
                        : "Your payment history will appear here"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.slice(0, 6).map((payment) => (
                      <div
                        key={payment.id}
                        className="py-2 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium block truncate">
                              {payment.payment_type}
                            </span>
                            <span className="text-xs text-gray-600 block truncate">
                              {payment.description || "Payment transaction"}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <span className="text-sm font-medium block">
                              {formatCurrency(payment.amount, payment.currency)}
                            </span>
                            <Badge
                              variant={
                                payment.status === "completed"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs mt-1"
                            >
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            {/* Tax Card - Replacing the Logo Card */}
            <TaxCard userProfile={userProfile} setActiveTab={setActiveTab} />

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                  <div className="flex items-center min-w-0">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                    <span className="truncate">
                      {currentMessage ? "Messages" : "Latest Message"}
                    </span>
                    {currentMessage &&
                      (!currentMessage.is_read ||
                        (welcomeMessage &&
                          currentMessage.id === welcomeMessage.id)) && (
                        <Badge
                          variant={
                            welcomeMessage &&
                            currentMessage.id === welcomeMessage.id
                              ? "default"
                              : "destructive"
                          }
                          className={`ml-2 text-xs flex-shrink-0 ${
                            welcomeMessage &&
                            currentMessage.id === welcomeMessage.id
                              ? "bg-[#F26623]"
                              : ""
                          }`}
                        >
                          {welcomeMessage &&
                          currentMessage.id === welcomeMessage.id
                            ? currentMessage.is_read
                              ? "Welcome"
                              : "Welcome!"
                            : "New"}
                        </Badge>
                      )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                {loading ? (
                  <div className="p-3 rounded-lg bg-gray-100 animate-pulse">
                    <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ) : currentMessage ? (
                  <div
                    className={`p-3 sm:p-4 rounded-lg border-l-4 transition-opacity ${
                      currentMessage.message_type === "welcome"
                        ? "border-[#F26623] bg-gradient-to-r from-orange-50 to-yellow-50"
                        : currentMessage.message_type === "success"
                        ? "border-green-500 bg-green-50"
                        : currentMessage.message_type === "alert"
                        ? "border-red-500 bg-red-50"
                        : currentMessage.message_type === "warning"
                        ? "border-yellow-500 bg-yellow-50"
                        : "border-blue-500 bg-blue-50"
                    } ${currentMessage.is_read ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getMessageIcon(currentMessage.message_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">
                            {currentMessage.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                            {currentMessage.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(
                              currentMessage.created_at
                            ).toLocaleTimeString()}
                          </p>
                          {welcomeMessage &&
                            currentMessage.id === welcomeMessage.id && (
                              <div className="mt-3 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => setActiveTab("support")}
                                  className="bg-[#F26623] hover:bg-[#E55A1F] text-white text-xs"
                                >
                                  <Shield className="h-3 w-3 mr-1" />
                                  Get Support
                                </Button>
                                {!currentMessage.is_read && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleDismissMessage}
                                    className="text-xs bg-transparent"
                                  >
                                    Mark as Read
                                  </Button>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                      {!currentMessage.is_read && !welcomeMessage && (
                        <div className="w-2 h-2 bg-[#F26623] rounded-full mt-1 flex-shrink-0"></div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                    <p className="text-sm">No messages</p>
                    <p className="text-xs mt-1">
                      Your notifications will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex justify-center items-center p-4 sm:p-6">
              <Image
                src="/db/1.png"
                alt="Mobile Banking Card"
                width={200}
                height={300}
                className="object-contain max-w-full h-auto"
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
