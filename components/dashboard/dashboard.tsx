"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRealtimeData } from "@/hooks/use-realtime-data"
import { useLatestMessage } from "@/hooks/use-latest-message"
import {
  DollarSign,
  Euro,
  Banknote,
  Coins,
  TrendingUp,
  ArrowUpRight,
  MessageSquare,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react"

export interface DashboardContentProps {
  userProfile: {
    id: string
    full_name: string | null
    email: string | null
    client_id: string | null
  }
  setActiveTab: (tab: string) => void
}

export default function DashboardContent({ userProfile, setActiveTab }: DashboardContentProps) {
  const { balances, messages, transactions, exchangeRates, cryptoPrices, loading, error } = useRealtimeData()
  const { latestMessage, markAsRead } = useLatestMessage()

  const [showAllMessages, setShowAllMessages] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "alert":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getTransactionIcon = (type: string) => {
    if (type === "transfer") {
      return <ArrowUpRight className="h-5 w-5 text-blue-600" />
    } else if (type && type.includes("crypto")) {
      return <Coins className="h-5 w-5 text-orange-600" />
    } else {
      return <DollarSign className="h-5 w-5 text-green-600" />
    }
  }

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await markAsRead(messageId)
    } catch (error) {
      console.error("Error marking message as read:", error)
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-white">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-white">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {userProfile.full_name || userProfile.email || "User"}!
          </h1>
          <p className="text-gray-600">Here's your account overview and recent activity</p>
        </div>

        {/* Latest Message Alert */}
        {latestMessage && (
          <Card className="mb-8 border-l-4 border-l-[#F26623]">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getMessageIcon(latestMessage.message_type)}
                  <div>
                    <h4 className="font-semibold text-gray-900">{latestMessage.title}</h4>
                    <p className="text-gray-600 mt-1">{latestMessage.content}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(latestMessage.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleMarkAsRead(latestMessage.id)} className="ml-4">
                  Mark as Read
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-[#F26623]" />
                  <div>
                    <p className="font-semibold">USD Balance</p>
                    <p className="text-sm text-gray-600">US Dollar</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${balances.usd.toFixed(2)}</p>
                  <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Euro className="h-8 w-8 text-[#F26623]" />
                  <div>
                    <p className="font-semibold">EUR Balance</p>
                    <p className="text-sm text-gray-600">Euro</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">€{balances.euro.toFixed(2)}</p>
                  <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Banknote className="h-8 w-8 text-[#F26623]" />
                  <div>
                    <p className="font-semibold">CAD Balance</p>
                    <p className="text-sm text-gray-600">Canadian Dollar</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">C${balances.cad.toFixed(2)}</p>
                  <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Coins className="h-8 w-8 text-[#F26623]" />
                  <div>
                    <p className="font-semibold">Bitcoin</p>
                    <p className="text-sm text-gray-600">BTC</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">₿{balances.crypto.toFixed(8)}</p>
                  <p className="text-xs text-gray-600">≈ ${(balances.crypto * cryptoPrices.bitcoin).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Market Data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Live Exchange Rates</span>
                <div className="flex items-center space-x-1 text-sm text-green-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Live</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">USD → EUR</span>
                  <span className="font-bold">€{exchangeRates.usd_to_eur.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">USD → CAD</span>
                  <span className="font-bold">C${exchangeRates.usd_to_cad.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">EUR → USD</span>
                  <span className="font-bold">${exchangeRates.eur_to_usd.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">CAD → USD</span>
                  <span className="font-bold">${exchangeRates.cad_to_usd.toFixed(4)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Cryptocurrency Prices</span>
                <div className="flex items-center space-x-1 text-sm text-green-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Live</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">₿</span>
                    </div>
                    <span className="font-medium">Bitcoin</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">${cryptoPrices.bitcoin.toLocaleString()}</span>
                    <div className="flex items-center space-x-1 text-xs text-green-600">
                      <TrendingUp className="w-3 h-3" />
                      <span>+2.4%</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">Ξ</span>
                    </div>
                    <span className="font-medium">Ethereum</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">${cryptoPrices.ethereum.toLocaleString()}</span>
                    <div className="flex items-center space-x-1 text-xs text-green-600">
                      <TrendingUp className="w-3 h-3" />
                      <span>+1.8%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Messages and Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Recent Messages</span>
                </div>
                {messages.length > 3 && (
                  <Button variant="outline" size="sm" onClick={() => setShowAllMessages(!showAllMessages)}>
                    {showAllMessages ? "Show Less" : "Show All"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No messages yet</p>
              ) : (
                <div className="space-y-4">
                  {(showAllMessages ? messages : messages.slice(0, 3)).map((message) => (
                    <div key={message.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      {getMessageIcon(message.message_type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{message.title}</h4>
                          {!message.is_read && (
                            <Badge variant="secondary" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{message.content}</p>
                        <p className="text-xs text-gray-500 mt-2">{new Date(message.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Recent Transactions</span>
                </div>
                {transactions.length > 5 && (
                  <Button variant="outline" size="sm" onClick={() => setShowAllTransactions(!showAllTransactions)}>
                    {showAllTransactions ? "Show Less" : "Show All"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No transactions yet</p>
              ) : (
                <div className="space-y-4">
                  {(showAllTransactions ? transactions : transactions.slice(0, 5)).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getTransactionIcon(transaction.transaction_type || "")}
                        <div>
                          <p className="font-medium capitalize">
                            {(transaction.transaction_type || "").replace("_", " ")}
                          </p>
                          <p className="text-sm text-gray-600">{new Date(transaction.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
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
    </div>
  )
}
