"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bitcoin, TrendingUp } from "lucide-react";

export default function CryptoSection() {
  const [cryptoTransactions, setCryptoTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [formData, setFormData] = useState({
    crypto_type: "",
    transaction_type: "",
    amount: "",
    price_per_unit: "",
  });

  const cryptoTypes = [
    { id: "BTC", name: "Bitcoin", price: 45000 },
    { id: "ETH", name: "Ethereum", price: 3200 },
    { id: "ADA", name: "Cardano", price: 0.45 },
    { id: "DOT", name: "Polkadot", price: 7.2 },
  ];

  useEffect(() => {
    fetchCryptoTransactions();
  }, []);

  const fetchCryptoTransactions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("crypto_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCryptoTransactions(data || []);
      }
    } catch (error) {
      console.error("Error fetching crypto transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const executeTrade = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const amount = Number.parseFloat(formData.amount);
        const pricePerUnit = Number.parseFloat(formData.price_per_unit);
        const totalValue = amount * pricePerUnit;

        const { error } = await supabase.from("crypto_transactions").insert({
          user_id: user.id,
          crypto_type: formData.crypto_type,
          transaction_type: formData.transaction_type,
          amount: amount,
          price_per_unit: pricePerUnit,
          total_value: totalValue,
          status: "Completed",
          wallet_address: `${formData.crypto_type.toLowerCase()}1${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        });

        if (error) throw error;

        // Add to general transactions
        await supabase.from("transactions").insert({
          user_id: user.id,
          type: `Crypto ${formData.transaction_type}`,
          amount: totalValue,
          currency: "EUR",
          description: `${formData.transaction_type} ${amount} ${formData.crypto_type}`,
          platform: "Digital Chain Bank Crypto",
          status: "Successful",
        });

        setFormData({
          crypto_type: "",
          transaction_type: "",
          amount: "",
          price_per_unit: "",
        });
        setShowTradeForm(false);
        fetchCryptoTransactions();
        alert("Crypto transaction completed successfully!");
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="p-6">Loading crypto data...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cryptocurrency</h2>
        <Button
          onClick={() => setShowTradeForm(true)}
          className="bg-[#F26623] hover:bg-[#E55A1F]"
        >
          <Bitcoin className="w-4 h-4 mr-2" />
          New Trade
        </Button>
      </div>

      {/* Crypto Prices */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cryptoTypes.map((crypto) => (
          <Card key={crypto.id}>
            <CardContent className="p-4 text-center">
              <Bitcoin className="w-8 h-8 mx-auto mb-2 text-[#F26623]" />
              <p className="font-medium">{crypto.name}</p>
              <p className="text-sm text-gray-600">{crypto.id}</p>
              <p className="text-lg font-bold">
                ${crypto.price.toLocaleString()}
              </p>
              <div className="flex items-center justify-center mt-1">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-500">+2.5%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showTradeForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Crypto Trade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cryptocurrency</Label>
                <Select
                  value={formData.crypto_type}
                  onValueChange={(value) => {
                    const crypto = cryptoTypes.find((c) => c.id === value);
                    setFormData({
                      ...formData,
                      crypto_type: value,
                      price_per_unit: crypto?.price.toString() || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select crypto" />
                  </SelectTrigger>
                  <SelectContent>
                    {cryptoTypes.map((crypto) => (
                      <SelectItem key={crypto.id} value={crypto.id}>
                        {crypto.name} ({crypto.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Transaction Type</Label>
                <Select
                  value={formData.transaction_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, transaction_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Buy">Buy</SelectItem>
                    <SelectItem value="Sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.00000001"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="0.00000000"
                />
              </div>
              <div>
                <Label>Price per Unit (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price_per_unit}
                  onChange={(e) =>
                    setFormData({ ...formData, price_per_unit: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            {formData.amount && formData.price_per_unit && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-xl font-bold">
                  €
                  {(
                    Number.parseFloat(formData.amount) *
                    Number.parseFloat(formData.price_per_unit)
                  ).toLocaleString()}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={executeTrade}
                className="bg-[#F26623] hover:bg-[#E55A1F]"
              >
                Execute Trade
              </Button>
              <Button variant="outline" onClick={() => setShowTradeForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Crypto Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {cryptoTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No crypto transactions yet
            </p>
          ) : (
            <div className="space-y-4">
              {cryptoTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex justify-between items-center p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {transaction.transaction_type} {transaction.crypto_type}
                    </p>
                    <p className="text-sm text-gray-600">
                      Amount: {Number(transaction.amount).toLocaleString()}{" "}
                      {transaction.crypto_type}
                    </p>
                    <p className="text-sm text-gray-600">
                      Price: €
                      {Number(transaction.price_per_unit).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      €{Number(transaction.total_value).toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600">
                      {transaction.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
