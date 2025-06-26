"use client";

import { useState, useEffect } from "react";
import {
  useRealtimeBalances,
  useRealtimeTransactions,
} from "@/hooks/use-realtime-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftRight,
  Download,
  CreditCard,
  Receipt,
  Bitcoin,
  Phone,
  Mail,
  Info,
  RefreshCw,
} from "lucide-react";

interface DashboardContentProps {
  userProfile: any;
}

export default function DashboardContent({
  userProfile,
}: DashboardContentProps) {
  const userId = userProfile?.id;
  const { balances, loading: balancesLoading } = useRealtimeBalances(userId);
  const { transactions, loading: transactionsLoading } =
    useRealtimeTransactions(userId);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Update timestamp when balances change
  useEffect(() => {
    setLastUpdated(new Date());
  }, [balances]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  const paymentCategories = [
    "Taxes – Pay your outstanding state or national tax obligations.",
    "Invoices – Settle pending bills or service-related invoices.",
    "Penalties & Fines – Clear any fines or penalties applied to your account.",
    "Government Fees – Pay administrative or registration-related fees.",
    "Utility Bills – Electricity, water, internet, and other monthly charges.",
    "Account Recovery Fee – Pay to unlock or reactivate frozen accounts.",
    "Transfer Fees – Cover costs related to outgoing or international transfers.",
  ];

  if (balancesLoading && transactionsLoading) {
    return (
      <div className="flex-1 p-6 bg-white overflow-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-white overflow-auto">
      {/* Header with real-time indicator */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {userProfile?.full_name || "Client Name"}
            </h2>
            <p className="text-gray-600">
              Client ID {userProfile?.client_id || "Loading..."}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center text-green-600 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Real-time Data
            </div>
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Balance Cards - REAL-TIME DATA */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-[#F26623] text-white">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-2">Crypto</h3>
            <p className="text-3xl font-bold">
              {Number(balances.crypto).toLocaleString()}
            </p>
            <p className="text-xs opacity-75 mt-1">BTC</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F26623] text-white">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-2">Euro</h3>
            <p className="text-3xl font-bold">
              €
              {Number(balances.euro).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-xs opacity-75 mt-1">EUR</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F26623] text-white">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-2">CAD</h3>
            <p className="text-3xl font-bold">
              $
              {Number(balances.cad).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-xs opacity-75 mt-1">CAD</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F26623] text-white">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-2">USD</h3>
            <p className="text-3xl font-bold">
              $
              {Number(balances.usd).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-xs opacity-75 mt-1">USD</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button className="bg-[#F26623] hover:bg-[#E55A1F] text-white">
          <ArrowLeftRight className="w-4 h-4 mr-2" />
          Transfers
        </Button>
        <Button className="bg-[#F26623] hover:bg-[#E55A1F] text-white">
          <Download className="w-4 h-4 mr-2" />
          Deposit
        </Button>
        <Button className="bg-[#F26623] hover:bg-[#E55A1F] text-white">
          <CreditCard className="w-4 h-4 mr-2" />
          Payments
        </Button>
        <Button className="bg-[#F26623] hover:bg-[#E55A1F] text-white">
          <Receipt className="w-4 h-4 mr-2" />
          Taxes
        </Button>
        <Button className="bg-[#F26623] hover:bg-[#E55A1F] text-white">
          <Bitcoin className="w-4 h-4 mr-2" />
          Crypto
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction History - REAL-TIME DATA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Transaction History
              <div className="flex items-center text-green-600 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" />
                Live
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#F26623] mx-auto mb-2"></div>
                <p className="text-gray-500 text-sm">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">No transactions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction, index) => (
                  <div
                    key={transaction.id || index}
                    className="flex justify-between items-center py-2 border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">{transaction.type}</p>
                      <p className="text-sm text-gray-600">
                        {transaction.description || "No description"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.platform || "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatAmount(transaction.amount, transaction.currency)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(transaction.created_at)}
                      </p>
                      <p
                        className={`text-xs ${
                          transaction.status === "Successful"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side Content */}
        <div className="space-y-6">
          {/* Digital Chain Bank Logo */}
          <Card>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-[#F26623] rounded-lg flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded transform rotate-45"></div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-[#F26623] mb-2">DIGITAL</h3>
              <p className="text-gray-600">Chain Bank</p>
              <div className="flex justify-center space-x-4 mt-4">
                <Button variant="ghost" size="icon" className="text-[#F26623]">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-[#F26623]">
                  <Mail className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-[#F26623]">
                  <Info className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Message Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <h4 className="font-medium">Account Status: Active</h4>
                <p className="text-sm text-gray-600">
                  Welcome {userProfile?.full_name || "User"}! Your account is
                  active and all services are available.
                </p>
                <p className="text-sm text-gray-600">
                  Your balances are updated in real-time. Any changes made to
                  your account will appear instantly.
                </p>
                <p className="text-sm font-medium text-green-600">
                  ✓ Real-time synchronization enabled
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payments Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Available Payment Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentCategories.map((category, index) => (
              <p key={index} className="text-sm text-gray-700 py-1">
                {category}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
