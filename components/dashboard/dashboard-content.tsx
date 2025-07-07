"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  MessageSquare,
  Bell,
  Activity,
  CreditCard,
  Send,
  Wallet,
  Phone,
  Mail,
  Info,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  AlertTriangle,
  Sparkles,
  Gift,
  Shield,
} from "lucide-react";
import Image from "next/image";

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
  is_welcome?: boolean; // Make this optional
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

interface WelcomeMessage {
  id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  is_welcome: boolean;
}

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
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState<WelcomeMessage | null>(
    null
  );
  const [isNewUser, setIsNewUser] = useState(false);
  const [hasCheckedWelcome, setHasCheckedWelcome] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<
    LatestMessage | WelcomeMessage | null
  >(null);

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
            .select()
            .single();

          if (!insertError && insertedMessage) {
            setWelcomeMessage({
              ...insertedMessage,
              is_welcome: true,
            });
            setCurrentMessage({
              ...insertedMessage,
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

  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userTransfers, error: userError } = await supabase
          .from("transfers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (userError) {
          console.error("Error fetching user transfers:", userError);
          const { data: clientTransfers, error: clientError } = await supabase
            .from("transfers")
            .select("*")
            .eq("client_id", userProfile.client_id)
            .order("created_at", { ascending: false })
            .limit(20);

          if (clientError) {
            console.error("Error fetching client transfers:", clientError);
            return;
          }

          setTransfersData(clientTransfers || []);
          return;
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

        const sortedTransfers = uniqueTransfers.sort((a, b) => {
          const aIsCredit = isAdminCredit(a);
          const bIsCredit = isAdminCredit(b);
          if (aIsCredit && !bIsCredit) return -1;
          if (!aIsCredit && bIsCredit) return 1;
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });

        setTransfersData(sortedTransfers);
      } catch (error) {
        console.error("Error fetching transfers:", error);
      } finally {
        setTransfersLoading(false);
      }
    };

    fetchTransfers();

    const setupTransfersSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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
            fetchTransfers();
            setTimeout(() => {}, 1000);
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
            fetchTransfers();
            setTimeout(() => {}, 1000);
          }
        )
        .subscribe();

      return () => {
        transfersSubscription.unsubscribe();
      };
    };

    const cleanup = setupTransfersSubscription();
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
    const symbols = {
      usd: "$",
      euro: "€",
      cad: "C$",
      crypto: "₿",
    };
    return `${
      symbols[currency as keyof typeof symbols] || "$"
    }${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
      case "crypto":
        return <Bitcoin className="h-4 w-4" />;
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
      transfer.description?.toLowerCase().includes("account credit") ||
      transfer.description?.toLowerCase().includes("account debit") ||
      transfer.description?.toLowerCase().includes("administrative") ||
      transfer.description?.toLowerCase().includes("balance adjustment")
    );
  };

  const isAdminDebit = (transfer: Transfer) => {
    return (
      transfer.transfer_type === "admin_debit" ||
      transfer.description?.toLowerCase().includes("account debit") ||
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

  const getTransferIcon = (transfer: Transfer) => {
    if (isAdminCredit(transfer)) {
      if (isAdminDebit(transfer)) {
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      }
      return <Building2 className="h-5 w-5 text-blue-600" />;
    }
    if (isRegularDeposit(transfer)) {
      return <ArrowDownLeft className="h-5 w-5 text-green-600" />;
    }
    return <ArrowUpRight className="h-5 w-5 text-gray-600" />;
  };

  const getTransferDescription = (transfer: Transfer) => {
    // Admin actions - show professional banking messages
    if (transfer.transfer_type === "admin_deposit") {
      return "Account Credit";
    }
    if (transfer.transfer_type === "admin_debit") {
      return "Account Debit";
    }
    if (transfer.transfer_type === "admin_balance_adjustment") {
      return "Balance Adjustment";
    }

    // Check description for admin actions
    if (transfer.description?.toLowerCase().includes("account credit")) {
      return "Account Credit";
    }
    if (transfer.description?.toLowerCase().includes("account debit")) {
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
  };

  const getTransferAmount = (transfer: Transfer) => {
    if (transfer.transfer_type === "admin_deposit") {
      return `+${Number(transfer.from_amount || 0).toLocaleString()} ${(
        transfer.from_currency || "USD"
      ).toUpperCase()}`;
    }
    if (transfer.transfer_type === "admin_debit") {
      return `-${Number(transfer.from_amount || 0).toLocaleString()} ${(
        transfer.from_currency || "USD"
      ).toUpperCase()}`;
    }
    if (transfer.transfer_type === "admin_balance_adjustment") {
      return `${Number(transfer.to_amount || 0).toLocaleString()} ${(
        transfer.to_currency || "USD"
      ).toUpperCase()}`;
    }

    // Check description for admin actions
    if (
      transfer.description?.toLowerCase().includes("credited to your account")
    ) {
      const match = transfer.description.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      const amount = match ? match[1] : transfer.from_amount;
      return `+${amount} ${(transfer.from_currency || "USD").toUpperCase()}`;
    }
    if (
      transfer.description?.toLowerCase().includes("debited from your account")
    ) {
      const match = transfer.description.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)/);
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
  };

  if (loading && !hasLoaded) {
    return (
      <div className="flex-1 p-8 bg-gray-50 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-lg shadow animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-200 rounded animate-pulse"
              ></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-lg shadow animate-pulse"
              >
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
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
  const displayBalances = realtimeBalances;

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {displayName}!
            {isNewUser && (
              <Sparkles className="inline-block ml-2 h-6 w-6 text-[#F26623]" />
            )}
          </h1>
          <p className="text-gray-600">
            {isNewUser
              ? "Thank you for joining Digital Chain Bank! Here's your new account overview"
              : "Here's your account overview and recent activity"}
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-500 bg-red-50">
            <AlertDescription className="text-red-700">
              Error: {error}
            </AlertDescription>
          </Alert>
        )}

        {/* New User Welcome Banner */}
        {isNewUser && (
          <Alert className="mb-6 border-[#F26623] bg-gradient-to-r from-orange-50 to-yellow-50">
            <Gift className="h-4 w-4 text-[#F26623]" />
            <AlertDescription className="text-gray-800">
              <strong>Welcome Bonus!</strong> As a new Digital Chain Bank
              customer, you're eligible for premium features and dedicated
              support.
              <Button
                variant="link"
                className="p-0 ml-2 text-[#F26623] font-semibold"
                onClick={() => setActiveTab("support")}
              >
                Learn more →
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Object.entries(displayBalances).map(([currency, balance]) => (
            <Card
              key={currency}
              className="hover:shadow-lg transition-shadow bg-[#F26623] relative overflow-hidden"
            >
              {isNewUser && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-white text-[#F26623] text-xs">
                    New!
                  </Badge>
                </div>
              )}
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm text-white font-medium capitalize">
                  {currency} Balance
                </CardTitle>
                {React.cloneElement(getBalanceIcon(currency), {
                  className: "text-white w-5 h-5",
                })}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(balance, currency)}
                </div>
                <p className="text-xs text-muted-foreground text-white">
                  {currency === "crypto"
                    ? "Bitcoin equivalent"
                    : `${currency.toUpperCase()} account`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Button
            onClick={() => setActiveTab("transfers")}
            className="h-16 bg-[#F26623] hover:bg-[#E55A1F] text-white"
          >
            <Send className="h-5 w-5 mr-2" />
            Transfer Money
          </Button>
          <Button
            onClick={() => setActiveTab("deposit")}
            variant="outline"
            className="h-16"
          >
            <Wallet className="h-5 w-5 mr-2" />
            Deposit Funds
          </Button>
          <Button
            onClick={() => setActiveTab("crypto")}
            variant="outline"
            className="h-16"
          >
            <Bitcoin className="h-5 w-5 mr-2" />
            Withdrawl Crypto
          </Button>
          <Button
            onClick={() => setActiveTab("card")}
            variant="outline"
            className="h-16"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Manage Cards
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Account Activity
                  <Badge variant="outline" className="ml-2 text-xs">
                    Real-time
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {transfersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="py-2 border-b border-gray-100 animate-pulse"
                      >
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : transfersData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      {isNewUser
                        ? "Welcome! Your first transaction will appear here"
                        : "No account activity"}
                    </p>
                    <p className="text-xs">
                      {isNewUser
                        ? "Start by making a deposit or transfer to see your activity"
                        : "Your transactions will appear here in real-time"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transfersData.slice(0, 8).map((transfer) => {
                      const isCredit =
                        isAdminCredit(transfer) && !isAdminDebit(transfer);
                      const isDebit = isAdminDebit(transfer);
                      const isAdjustment =
                        transfer.transfer_type === "admin_balance_adjustment";
                      const isRegularDep = isRegularDeposit(transfer);

                      return (
                        <div
                          key={transfer.id}
                          className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                            isCredit
                              ? "border-blue-200 bg-blue-50/30"
                              : isDebit
                              ? "border-orange-200 bg-orange-50/30"
                              : isAdjustment
                              ? "border-purple-200 bg-purple-50/30"
                              : isRegularDep
                              ? "border-green-200 bg-green-50/30"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isCredit
                                  ? "bg-blue-100"
                                  : isDebit
                                  ? "bg-orange-100"
                                  : isAdjustment
                                  ? "bg-purple-100"
                                  : isRegularDep
                                  ? "bg-green-100"
                                  : "bg-gray-100"
                              }`}
                            >
                              {getTransferIcon(transfer)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {getTransferDescription(transfer)}
                              </p>
                              <p className="text-xs text-gray-600">
                                {getTransferAmount(transfer)}
                              </p>
                              {transfer.description && (
                                <p className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                                  {transfer.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-400">
                                {new Date(
                                  transfer.created_at
                                ).toLocaleDateString()}{" "}
                                at{" "}
                                {new Date(
                                  transfer.created_at
                                ).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {!isAdminCredit(transfer) &&
                              !isRegularDeposit(transfer) &&
                              transfer.exchange_rate &&
                              transfer.exchange_rate !== 1.0 && (
                                <p className="font-medium text-sm mb-1">
                                  Rate:{" "}
                                  {Number(transfer.exchange_rate).toFixed(4)}
                                </p>
                              )}
                            <Badge
                              className={`text-xs px-2 rounded ${
                                transfer.status === "completed" ||
                                transfer.status === "Completed"
                                  ? isCredit
                                    ? "bg-blue-100 text-blue-800"
                                    : isDebit
                                    ? "bg-orange-100 text-orange-800"
                                    : isAdjustment
                                    ? "bg-purple-100 text-purple-800"
                                    : isRegularDep
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800" 
                                  : "bg-gray-100 text-gray-800" 
                              }`}
                            >
                              {transfer.status || "Completed"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {paymentsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="py-2 border-b border-gray-100 animate-pulse"
                      >
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      {isNewUser ? "No payments yet" : "No recent payments"}
                    </p>
                    <p className="text-xs">
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
                          <div className="flex-1">
                            <span className="text-sm font-medium">
                              {payment.payment_type}
                            </span>
                            <span className="text-xs text-gray-600 block">
                              {payment.description || "Payment transaction"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium">
                              {formatCurrency(payment.amount, payment.currency)}
                            </span>
                            <Badge
                              variant={
                                payment.status === "completed"
                                  ? "default"
                                  : "secondary"
                              }
                              className="ml-2 text-xs"
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

          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-[#F5F0F0] rounded-xl overflow-visible flex flex-col justify-center items-center">
              <CardContent className="p-6 flex justify-center items-center">
                <Image
                  src="/logo.svg"
                  alt="Digital Chain Bank Logo"
                  width={140}
                  height={40}
                  className="object-contain"
                />
              </CardContent>
              <CardFooter className="p-0 flex space-x-6 text-[#F26623] pb-6">
                <Phone className="w-6 h-6" />
                <Mail className="w-6 h-6" />
                <Info className="w-6 h-6" />
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    {currentMessage ? "Welcome Message" : "Latest Message"}
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
                          className={`ml-2 text-xs ${
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
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="p-3 rounded-lg bg-gray-100 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ) : currentMessage ? (
                  <div
                    className={`p-4 rounded-lg border-l-4 transition-opacity ${
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
                      <div className="flex items-start space-x-2">
                        {getMessageIcon(currentMessage.message_type)}
                        <div className="flex-1">
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
                              <div className="mt-3 flex space-x-2">
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
                        <div className="w-2 h-2 bg-[#F26623] rounded-full mt-1"></div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No messages</p>
                    <p className="text-xs">
                      Your notifications will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex justify-center items-center p-6">
              <Image
                src="/db/1.png"
                alt="Mobile Banking Card"
                width={200}
                height={300}
                className="object-contain"
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
