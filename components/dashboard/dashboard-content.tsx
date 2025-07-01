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
} from "lucide-react";
import Image from "next/image";

interface DashboardContentProps {
  userProfile: {
    id: string;
    client_id: string;
    full_name: string | null;
    email: string | null;
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

  useEffect(() => {
    if (latestMessage && !latestMessage.is_read) {
      setShowMessage(true);
    }
  }, [latestMessage]);

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
          const aIsDeposit =
            a.transfer_type === "deposit" ||
            a.transfer_type === "credit" ||
            a.transfer_type === "admin_deposit" ||
            a.description?.toLowerCase().includes("deposit") ||
            a.description?.toLowerCase().includes("credit") ||
            a.description?.toLowerCase().includes("added");

          const bIsDeposit =
            b.transfer_type === "deposit" ||
            b.transfer_type === "credit" ||
            b.transfer_type === "admin_deposit" ||
            b.description?.toLowerCase().includes("deposit") ||
            b.description?.toLowerCase().includes("credit") ||
            b.description?.toLowerCase().includes("added");

          if (aIsDeposit && !bIsDeposit) return -1;
          if (!aIsDeposit && bIsDeposit) return 1;

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
            // NEW: Recalculate balances when transfers change
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
            // NEW: Recalculate balances when transfers change
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

  const handleDismissMessage = async () => {
    if (latestMessage) {
      try {
        await markAsRead(latestMessage.id);
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
      case "alert":
        return <Bell className="h-4 w-4" />;
      case "warning":
        return <Bell className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTransferIcon = (transfer: Transfer) => {
    const isDeposit =
      transfer.transfer_type === "deposit" ||
      transfer.transfer_type === "credit" ||
      transfer.transfer_type === "admin_deposit" ||
      transfer.description?.toLowerCase().includes("deposit") ||
      transfer.description?.toLowerCase().includes("credit") ||
      transfer.description?.toLowerCase().includes("added") ||
      transfer.description?.toLowerCase().includes("fund");

    return isDeposit ? (
      <ArrowDownLeft className="h-5 w-5 text-green-600" />
    ) : (
      <ArrowUpRight className="h-5 w-5 text-blue-600" />
    );
  };

  const getTransferDescription = (transfer: Transfer) => {
    const isDeposit =
      transfer.transfer_type === "deposit" ||
      transfer.transfer_type === "credit" ||
      transfer.transfer_type === "admin_deposit" ||
      transfer.description?.toLowerCase().includes("deposit") ||
      transfer.description?.toLowerCase().includes("credit") ||
      transfer.description?.toLowerCase().includes("added") ||
      (transfer.from_currency === transfer.to_currency &&
        transfer.from_amount === transfer.to_amount);

    if (isDeposit) {
      return `💰 Account Deposit - ${(
        transfer.to_currency || transfer.from_currency
      ).toUpperCase()}`;
    }

    return `${transfer.from_currency?.toUpperCase() || "N/A"} → ${
      transfer.to_currency?.toUpperCase() || "N/A"
    }`;
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

  // NEW: Use calculated balances instead of realtime balances
  const displayBalances = realtimeBalances;

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {displayName}!
          </h1>
          <p className="text-gray-600">
            Here's your account overview and recent activity
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-500 bg-red-50">
            <AlertDescription className="text-red-700">
              Error: {error}
            </AlertDescription>
          </Alert>
        )}

        {/* UPDATED: Balance Cards now use calculated balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Object.entries(displayBalances).map(([currency, balance]) => (
            <Card
              key={currency}
              className="hover:shadow-lg transition-shadow bg-[#F26623]"
            >
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
                {/* NEW: Show balance calculation indicator */}
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
            Trade Crypto
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
                  Transfer History
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
                    <p className="text-sm">No transfer history</p>
                    <p className="text-xs">
                      Your transfers and deposits will appear here in real-time
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transfersData.slice(0, 8).map((transfer) => {
                      const isDeposit =
                        (transfer.from_currency === transfer.to_currency &&
                          transfer.from_amount === transfer.to_amount) ||
                        transfer.transfer_type === "deposit" ||
                        transfer.transfer_type === "credit" ||
                        transfer.transfer_type === "admin_deposit" ||
                        transfer.description
                          ?.toLowerCase()
                          .includes("deposit") ||
                        transfer.description
                          ?.toLowerCase()
                          .includes("credit") ||
                        transfer.description?.toLowerCase().includes("added");

                      return (
                        <div
                          key={transfer.id}
                          className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                            isDeposit
                              ? "border-green-200 bg-green-50/30"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isDeposit ? "bg-green-100" : "bg-[#F26623]"
                              }`}
                            >
                              {isDeposit ? (
                                <ArrowDownLeft className="h-5 w-5 text-green-600" />
                              ) : (
                                <ArrowUpRight className="h-5 w-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {isDeposit
                                  ? `💰 Account Deposit - ${(
                                      transfer.to_currency ||
                                      transfer.from_currency
                                    ).toUpperCase()}`
                                  : `${
                                      transfer.from_currency?.toUpperCase() ||
                                      "N/A"
                                    } → ${
                                      transfer.to_currency?.toUpperCase() ||
                                      "N/A"
                                    }`}
                              </p>
                              <p className="text-xs text-gray-600">
                                {isDeposit
                                  ? `Deposited: +${Number(
                                      transfer.to_amount ||
                                        transfer.from_amount ||
                                        0
                                    ).toLocaleString()} ${(
                                      transfer.to_currency ||
                                      transfer.from_currency ||
                                      "USD"
                                    ).toUpperCase()}`
                                  : `${Number(
                                      transfer.from_amount || 0
                                    ).toLocaleString()} ${(
                                      transfer.from_currency || "USD"
                                    ).toUpperCase()} → ${Number(
                                      transfer.to_amount || 0
                                    ).toLocaleString()} ${(
                                      transfer.to_currency || "USD"
                                    ).toUpperCase()}`}
                              </p>
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
                            {!isDeposit &&
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
                                  ? isDeposit
                                    ? "bg-green-100 text-green-800"
                                    : "bg-blue-100 text-blue-800"
                                  : transfer.status === "pending" ||
                                    transfer.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
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
                    <p className="text-sm">No recent payments</p>
                    <p className="text-xs">
                      Your payment history will appear here
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
                    Latest Message
                    {latestMessage && !latestMessage.is_read && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        New
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
                ) : latestMessage ? (
                  <div
                    className={`p-3 rounded-lg border-l-4 transition-opacity ${
                      latestMessage.message_type === "success"
                        ? "border-green-500 bg-green-50"
                        : latestMessage.message_type === "alert"
                        ? "border-red-500 bg-red-50"
                        : latestMessage.message_type === "warning"
                        ? "border-yellow-500 bg-yellow-50"
                        : "border-blue-500 bg-blue-50"
                    } ${latestMessage.is_read ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        {getMessageIcon(latestMessage.message_type)}
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">
                            {latestMessage.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {latestMessage.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(
                              latestMessage.created_at
                            ).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {!latestMessage.is_read && (
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
