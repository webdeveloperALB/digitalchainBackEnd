"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { useLatestMessage } from "@/hooks/use-latest-message";
import {
  DollarSign,
  Euro,
  MapIcon as Maple,
  Bitcoin,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Bell,
  X,
  ArrowUpRight,
  ArrowDownRight,
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

export default function DashboardContent({
  userProfile,
  setActiveTab,
}: DashboardContentProps) {
  const {
    balances,
    exchangeRates,
    cryptoPrices,
    transactions,
    loading,
    error,
  } = useRealtimeData();
  const { latestMessage, markAsRead } = useLatestMessage();
  const [showMessage, setShowMessage] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const loadingRef = useRef(false);

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

        {/* Latest Message Alert */}
        {showMessage && latestMessage && (
          <Alert
            className={`mb-6 ${getMessageColor(latestMessage.message_type)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                {getMessageIcon(latestMessage.message_type)}
                <div>
                  <h4 className="font-semibold">{latestMessage.title}</h4>
                  <AlertDescription className="mt-1">
                    {latestMessage.content}
                  </AlertDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismissMessage}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        )}

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Exchange Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Live Exchange Rates
              </CardTitle>
              <CardDescription>
                Real-time currency exchange rates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  USD to EUR
                </span>
                <div className="flex items-center">
                  <span className="font-mono">
                    {exchangeRates.usd_to_eur?.toFixed(4) || "0.0000"}
                  </span>
                  <TrendingUp className="h-4 w-4 ml-2 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  USD to CAD
                </span>
                <div className="flex items-center">
                  <span className="font-mono">
                    {exchangeRates.usd_to_cad?.toFixed(4) || "0.0000"}
                  </span>
                  <TrendingDown className="h-4 w-4 ml-2 text-red-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <Euro className="h-4 w-4 mr-2" />
                  EUR to USD
                </span>
                <div className="flex items-center">
                  <span className="font-mono">
                    {exchangeRates.eur_to_usd?.toFixed(4) || "0.0000"}
                  </span>
                  <TrendingUp className="h-4 w-4 ml-2 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <Maple className="h-4 w-4 mr-2" />
                  CAD to USD
                </span>
                <div className="flex items-center">
                  <span className="font-mono">
                    {exchangeRates.cad_to_usd?.toFixed(4) || "0.0000"}
                  </span>
                  <TrendingUp className="h-4 w-4 ml-2 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#F5F0F0] rounded-xl overflow-visible">
            {/* Logo centered at the top */}
            <CardContent className="pt-6 pb-2 flex justify-center">
              <Image
                src="/logo.svg"
                alt="Digital Chain Bank Logo"
                width={140}
                height={40}
                className="object-contain"
              />
            </CardContent>

            {/* Icons along the bottom */}
            <CardFooter className="pb-6 flex justify-around text-[#F26623]">
              <Phone className="w-6 h-6" />
              <Mail className="w-6 h-6" />
              <Info className="w-6 h-6" />
            </CardFooter>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest account activity</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent transactions</p>
                <p className="text-sm">
                  Your transaction history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.slice(0, 5).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-[#F26623] rounded-full flex items-center justify-center">
                        <Activity className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {transaction.transaction_type}
                        </p>
                        <p className="text-sm text-gray-600">
                          {transaction.description || "Transaction"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(
                          transaction.amount,
                          transaction.currency
                        )}
                      </p>
                      <Badge
                        variant={
                          transaction.status === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
