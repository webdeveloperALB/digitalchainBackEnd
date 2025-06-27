"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
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
} from "lucide-react";

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

  useEffect(() => {
    if (latestMessage && !latestMessage.is_read) {
      setShowMessage(true);
    }
  }, [latestMessage]);

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

  if (loading) {
    return (
      <div className="flex-1 p-8 bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
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
            Welcome back, {displayName}!
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
            <Card key={currency} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium capitalize">
                  {currency} Balance
                </CardTitle>
                {getBalanceIcon(currency)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(balance, currency)}
                </div>
                <p className="text-xs text-muted-foreground">
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
                    {exchangeRates.usd_to_eur.toFixed(4)}
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
                    {exchangeRates.usd_to_cad.toFixed(4)}
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
                    {exchangeRates.eur_to_usd.toFixed(4)}
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
                    {exchangeRates.cad_to_usd.toFixed(4)}
                  </span>
                  <TrendingUp className="h-4 w-4 ml-2 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Crypto Prices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bitcoin className="h-5 w-5 mr-2" />
                Cryptocurrency Prices
              </CardTitle>
              <CardDescription>
                Live cryptocurrency market prices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <Bitcoin className="h-4 w-4 mr-2" />
                  Bitcoin (BTC)
                </span>
                <div className="flex items-center">
                  <span className="font-mono">
                    ${cryptoPrices.bitcoin.toLocaleString()}
                  </span>
                  <ArrowUpRight className="h-4 w-4 ml-2 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <div className="h-4 w-4 mr-2 rounded-full bg-gray-600"></div>
                  Ethereum (ETH)
                </span>
                <div className="flex items-center">
                  <span className="font-mono">
                    ${cryptoPrices.ethereum.toLocaleString()}
                  </span>
                  <ArrowDownRight className="h-4 w-4 ml-2 text-red-500" />
                </div>
              </div>
            </CardContent>
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
