"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpDown,
  Wallet,
} from "lucide-react";

export default function CryptoSection() {
  const [balances, setBalances] = useState({
    crypto: 0,
    usd: 0,
  });
  const [cryptoPrices, setCryptoPrices] = useState({
    bitcoin: 45000,
    ethereum: 3000,
  });
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchBalances();
    fetchTransactions();
    startPriceUpdates();
  }, []);

  const fetchBalances = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [cryptoRes, usdRes] = await Promise.all([
        supabase
          .from("crypto_balances")
          .select("balance")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("usd_balances")
          .select("balance")
          .eq("user_id", user.id)
          .single(),
      ]);

      setBalances({
        crypto: cryptoRes.data?.balance || 0,
        usd: usdRes.data?.balance || 0,
      });
    } catch (error) {
      console.error("Error fetching balances:", error);
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
        .in("transaction_type", ["crypto_buy", "crypto_sell"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const startPriceUpdates = () => {
    const updatePrices = () => {
      setCryptoPrices((prev) => ({
        bitcoin: Math.max(1000, prev.bitcoin + (Math.random() - 0.5) * 200),
        ethereum: Math.max(100, prev.ethereum + (Math.random() - 0.5) * 100),
      }));
    };

    const interval = setInterval(updatePrices, 3000);
    return () => clearInterval(interval);
  };

  const handleBuy = async () => {
    if (!buyAmount || Number.parseFloat(buyAmount) <= 0) {
      setMessage("Please enter a valid amount");
      return;
    }

    const amount = Number.parseFloat(buyAmount);
    const cost = amount * cryptoPrices.bitcoin;

    if (cost > balances.usd) {
      setMessage("Insufficient USD balance");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      // Update balances
      await Promise.all([
        supabase.from("crypto_balances").upsert({
          user_id: user.id,
          balance: balances.crypto + amount,
        }),
        supabase.from("usd_balances").upsert({
          user_id: user.id,
          balance: balances.usd - cost,
        }),
      ]);

      // Record transaction
      await supabase.from("transactions").insert({
        user_id: user.id,
        transaction_type: "crypto_buy",
        amount: amount,
        currency: "BTC",
        status: "completed",
        description: `Bought ${amount} BTC for $${cost.toFixed(2)}`,
      });

      setMessage(`Successfully bought ${amount} BTC for $${cost.toFixed(2)}`);
      setBuyAmount("");
      fetchBalances();
      fetchTransactions();
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    if (!sellAmount || Number.parseFloat(sellAmount) <= 0) {
      setMessage("Please enter a valid amount");
      return;
    }

    const amount = Number.parseFloat(sellAmount);

    if (amount > balances.crypto) {
      setMessage("Insufficient Bitcoin balance");
      return;
    }

    const proceeds = amount * cryptoPrices.bitcoin;

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      // Update balances
      await Promise.all([
        supabase.from("crypto_balances").upsert({
          user_id: user.id,
          balance: balances.crypto - amount,
        }),
        supabase.from("usd_balances").upsert({
          user_id: user.id,
          balance: balances.usd + proceeds,
        }),
      ]);

      // Record transaction
      await supabase.from("transactions").insert({
        user_id: user.id,
        transaction_type: "crypto_sell",
        amount: amount,
        currency: "BTC",
        status: "completed",
        description: `Sold ${amount} BTC for $${proceeds.toFixed(2)}`,
      });

      setMessage(`Successfully sold ${amount} BTC for $${proceeds.toFixed(2)}`);
      setSellAmount("");
      fetchBalances();
      fetchTransactions();
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Cryptocurrency Trading
          </h1>
          <p className="text-gray-600">
            Buy and sell Bitcoin with live market prices
          </p>
        </div>

        {message && (
          <Alert className="mb-6">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Coins className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="font-semibold">Bitcoin Balance</p>
                    <p className="text-sm text-gray-600">BTC</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    ₿{balances.crypto.toFixed(8)}
                  </p>
                  <p className="text-sm text-gray-600">
                    ≈ ${(balances.crypto * cryptoPrices.bitcoin).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-semibold">USD Balance</p>
                    <p className="text-sm text-gray-600">
                      Available for trading
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    ${balances.usd.toFixed(2)}
                  </p>
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
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-semibold">Bitcoin Price</p>
                    <p className="text-sm text-gray-600">Live market price</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    ${cryptoPrices.bitcoin.toLocaleString()}
                  </p>
                  <div className="flex items-center space-x-1 text-xs text-green-600 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>+2.4%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span>Buy Bitcoin</span>
              </CardTitle>
              <CardDescription>
                Purchase Bitcoin with your USD balance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="buy-amount">Amount (BTC)</Label>
                <Input
                  id="buy-amount"
                  type="number"
                  step="0.00000001"
                  placeholder="0.00000000"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                />
                {buyAmount && (
                  <p className="text-sm text-gray-600 mt-1">
                    Cost: $
                    {(
                      Number.parseFloat(buyAmount) * cryptoPrices.bitcoin
                    ).toFixed(2)}{" "}
                    USD
                  </p>
                )}
              </div>
              <Button onClick={handleBuy} disabled={loading} className="w-full">
                {loading ? "Processing..." : "Buy Bitcoin"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span>Sell Bitcoin</span>
              </CardTitle>
              <CardDescription>Convert your Bitcoin to USD</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sell-amount">Amount (BTC)</Label>
                <Input
                  id="sell-amount"
                  type="number"
                  step="0.00000001"
                  placeholder="0.00000000"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                />
                {sellAmount && (
                  <p className="text-sm text-gray-600 mt-1">
                    You'll receive: $
                    {(
                      Number.parseFloat(sellAmount) * cryptoPrices.bitcoin
                    ).toFixed(2)}{" "}
                    USD
                  </p>
                )}
              </div>
              <Button
                onClick={handleSell}
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                {loading ? "Processing..." : "Sell Bitcoin"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ArrowUpDown className="h-5 w-5" />
              <span>Recent Crypto Transactions</span>
            </CardTitle>
            <CardDescription>Your Bitcoin trading history</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No crypto transactions yet</p>
                <p className="text-sm">
                  Start trading to see your transaction history
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-gray-100">
                        {transaction.transaction_type === "crypto_buy" ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {transaction.transaction_type === "crypto_buy"
                            ? "Bitcoin Purchase"
                            : "Bitcoin Sale"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ₿{transaction.amount.toFixed(8)}
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
