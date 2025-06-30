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

export default function DashboardContent({
  userProfile,
  setActiveTab,
}: DashboardContentProps) {
  const {
    balances,
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
  const [transfersData, setTransfersData] = useState<any[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);

  useEffect(() => {
    if (latestMessage && !latestMessage.is_read) {
      setShowMessage(true);
    }
  }, [latestMessage]);

  // Track loading state to prevent multiple loading screens
  useEffect(() => {
    if (loading && !loadingRef.current) {
      loadingRef.current = true;
    } else if (!loading && loadingRef.current) {
      loadingRef.current = false;
      setHasLoaded(true);
    }
  }, [loading]);

  // Fetch payments data
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

    // Set up real-time subscription for payments
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

  // Fetch transfers data
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("transfers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error("Error fetching transfers:", error);
          return;
        }

        setTransfersData(data || []);
      } catch (error) {
        console.error("Error fetching transfers:", error);
      } finally {
        setTransfersLoading(false);
      }
    };

    fetchTransfers();

    // Set up real-time subscription for transfers
    const setupTransfersSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const transfersSubscription = supabase
        .channel("transfers_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transfers",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchTransfers();
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
  }, []);

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

  const getMessageColor = (type: string) => {
    switch (type) {
      case "success":
        return "border-green-500 bg-green-50";
      case "alert":
        return "border-red-500 bg-red-50";
      case "warning":
        return "border-yellow-500 bg-yellow-50";
      default:
        return "border-blue-500 bg-blue-50";
    }
  };

  // Show skeleton loading instead of full-screen loading
  if (loading && !hasLoaded) {
    return (
      <div className="flex-1 p-8 bg-gray-50 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {/* Skeleton Header */}
          <div className="mb-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          {/* Skeleton Balance Cards */}
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
          {/* Skeleton Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-200 rounded animate-pulse"
              ></div>
            ))}
          </div>
          {/* Skeleton Cards */}
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

  // Safe access to userProfile properties
  const displayName = userProfile?.full_name || userProfile?.email || "User";

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {displayName}!
          </h1>
          <p className="text-gray-600">
            Here's your account overview and recent activity
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-500 bg-red-50">
            <AlertDescription className="text-red-700">
              Error: {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Object.entries(balances).map(([currency, balance]) => (
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

        {/* Updated Grid Layout - Left column takes 2/3, Right column takes 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - spans 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transaction History Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Transfers History
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
                    <p className="text-sm">No recent transfers</p>
                    <p className="text-xs">
                      Your transfer history will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transfersData.slice(0, 5).map((transfer) => (
                      <div
                        key={transfer.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-[#F26623] rounded-full flex items-center justify-center">
                            <Send className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {transfer.from_currency} → {transfer.to_currency}
                            </p>
                            <p className="text-xs text-gray-600">
                              {Number(transfer.from_amount).toLocaleString()}{" "}
                              {transfer.from_currency} →{" "}
                              {Number(transfer.to_amount).toLocaleString()}{" "}
                              {transfer.to_currency}
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
                          <p className="font-medium text-sm">
                            Rate: {Number(transfer.exchange_rate).toFixed(4)}
                          </p>
                          <Badge
                            className={`
    text-xs
    px-2
    rounded
    ${
      transfer.status === "Completed"
        ? "bg-green-100 text-green-800"
        : transfer.status === "Pending"
        ? "bg-yellow-100 text-yellow-800"
        : /* "Failed" */
          "bg-red-100 text-red-800"
    }
  `}
                          >
                            {transfer.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payments Card */}
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

          {/* Right Column - spans 1 column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Logo Card */}
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

            {/* Message Card */}
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

            {/* Phone Card - Separate */}
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
