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

import { ArrowLeftRight } from "lucide-react";

export default function TransfersSection() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any>({});
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    from_currency: "",
    to_currency: "",
    amount: "",
  });
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [estimatedAmount, setEstimatedAmount] = useState<number>(0);

  useEffect(() => {
    fetchTransfers();
    fetchBalances();
    fetchCurrencies();
  }, []);

  useEffect(() => {
    if (formData.from_currency && formData.to_currency && formData.amount) {
      calculateExchange();
    }
  }, [formData]);

  const fetchCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setCurrencies(data || []);
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  const calculateExchange = async () => {
    try {
      const { data, error } = await supabase.rpc("get_exchange_rate", {
        from_currency: formData.from_currency,
        to_currency: formData.to_currency,
      });

      if (error) throw error;

      const rate = Number(data) || 1;
      setExchangeRate(rate);
      setEstimatedAmount(Number(formData.amount) * rate);
    } catch (error) {
      console.error("Error calculating exchange rate:", error);
      setExchangeRate(1);
      setEstimatedAmount(Number(formData.amount));
    }
  };

  const fetchBalances = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const [cryptoResult, euroResult, cadResult, usdResult] =
          await Promise.all([
            supabase
              .from("crypto_balances")
              .select("balance")
              .eq("user_id", user.id)
              .single(),
            supabase
              .from("euro_balances")
              .select("balance")
              .eq("user_id", user.id)
              .single(),
            supabase
              .from("cad_balances")
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
          CRYPTO: cryptoResult.data?.balance || 0,
          EUR: euroResult.data?.balance || 0,
          CAD: cadResult.data?.balance || 0,
          USD: usdResult.data?.balance || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const fetchTransfers = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("transfers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTransfers(data || []);
      }
    } catch (error) {
      console.error("Error fetching transfers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get the correct table name for each currency
  const getTableName = (currencyCode: string) => {
    const tableMap: { [key: string]: string } = {
      CRYPTO: "crypto_balances",
      EUR: "euro_balances",
      CAD: "cad_balances",
      USD: "usd_balances",
    };
    return tableMap[currencyCode.toUpperCase()];
  };

  const executeTransfer = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const amount = Number.parseFloat(formData.amount);
      const fromCurrency = formData.from_currency.toUpperCase();
      const toCurrency = formData.to_currency.toUpperCase();

      // Check balance using the correct currency code
      const currentFromBalance = balances[fromCurrency] || 0;
      const currentToBalance = balances[toCurrency] || 0;

      if (currentFromBalance < amount) {
        alert("Insufficient balance");
        return;
      }

      const toAmount = estimatedAmount;

      // Create transfer record
      const { error: transferError } = await supabase.from("transfers").insert({
        user_id: user.id,
        from_currency: formData.from_currency,
        to_currency: formData.to_currency,
        from_amount: amount,
        to_amount: toAmount,
        exchange_rate: exchangeRate,
        status: "Completed",
      });

      if (transferError) throw transferError;

      // Get correct table names
      const fromTable = getTableName(fromCurrency);
      const toTable = getTableName(toCurrency);

      if (!fromTable || !toTable) {
        throw new Error("Invalid currency table mapping");
      }

      // Calculate new balances
      const newFromBalance = currentFromBalance - amount;
      const newToBalance = currentToBalance + toAmount;

      // Update balances in parallel
      const [fromUpdateResult, toUpdateResult] = await Promise.all([
        supabase
          .from(fromTable)
          .update({ balance: newFromBalance })
          .eq("user_id", user.id),
        supabase
          .from(toTable)
          .update({ balance: newToBalance })
          .eq("user_id", user.id),
      ]);

      // Check for errors in balance updates
      if (fromUpdateResult.error) {
        console.error("Error updating from balance:", fromUpdateResult.error);
        throw fromUpdateResult.error;
      }

      if (toUpdateResult.error) {
        console.error("Error updating to balance:", toUpdateResult.error);
        throw toUpdateResult.error;
      }

      // Add transaction records
      await supabase.from("transactions").insert([
        {
          user_id: user.id,
          type: "Transfer Out",
          amount: amount,
          currency: formData.from_currency,
          description: `Transfer to ${formData.to_currency}`,
          status: "Successful",
        },
        {
          user_id: user.id,
          type: "Transfer In",
          amount: toAmount,
          currency: formData.to_currency,
          description: `Transfer from ${formData.from_currency}`,
          status: "Successful",
        },
      ]);

      // Reset form
      setFormData({ from_currency: "", to_currency: "", amount: "" });
      setExchangeRate(1);
      setEstimatedAmount(0);

      // Refresh data
      await Promise.all([fetchTransfers(), fetchBalances()]);

      alert("Transfer completed successfully!");
    } catch (error: any) {
      console.error("Transfer error:", error);
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="p-6">Loading transfers...</div>;
  }

  return (
    <div className="p-8">
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #f26623 #f1f5f9;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f26623;
          border-radius: 4px;
          transition: background 0.2s ease;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e55a1f;
        }
      `}</style>

      <h2 className="text-3xl font-bold mb-8">Currency Transfers</h2>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column - Balances and Transfer Form */}
        <div className="xl:col-span-2 space-y-8">
          {/* Current Balances */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {currencies.slice(0, 4).map((currency) => (
              <Card key={currency.code} className="shadow-lg">
                <CardContent className="p-8 text-center">
                  <p className="text-lg text-gray-600 mb-2">{currency.name}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {currency.symbol}
                    {Number(
                      balances[currency.code.toUpperCase()] || 0
                    ).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Transfer Form */}
          <Card className="shadow-lg">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl">New Transfer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 p-8">
              <div className="grid grid-cols-3 gap-6 items-end">
                <div>
                  <Label className="text-lg font-medium mb-3 block">
                    From Currency
                  </Label>
                  <Select
                    value={formData.from_currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, from_currency: value })
                    }
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem
                          key={currency.code}
                          value={currency.code}
                          className="text-lg py-3"
                        >
                          {currency.symbol} {currency.name} ({currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-center">
                  <ArrowLeftRight className="w-8 h-8 mx-auto text-[#F26623] mb-2" />
                  <p className="text-sm text-gray-500">
                    Rate: {exchangeRate.toFixed(4)}
                  </p>
                </div>
                <div>
                  <Label className="text-lg font-medium mb-3 block">
                    To Currency
                  </Label>
                  <Select
                    value={formData.to_currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, to_currency: value })
                    }
                  >
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem
                          key={currency.code}
                          value={currency.code}
                          className="text-lg py-3"
                        >
                          {currency.symbol} {currency.name} ({currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-lg font-medium mb-3 block">
                    Amount to Transfer
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="h-12 text-lg"
                  />
                </div>
                <div>
                  <Label className="text-lg font-medium mb-3 block">
                    You Will Receive
                  </Label>
                  <Input
                    value={estimatedAmount.toFixed(2)}
                    readOnly
                    className="bg-gray-50 font-medium h-12 text-lg"
                  />
                </div>
              </div>
              <Button
                onClick={executeTransfer}
                disabled={
                  !formData.from_currency ||
                  !formData.to_currency ||
                  !formData.amount
                }
                className="w-full bg-[#F26623] hover:bg-[#E55A1F] h-14 text-lg font-semibold"
              >
                Execute Transfer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Transfer History */}
        <div className="xl:col-span-1">
          <Card className="shadow-lg h-fit">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl">Transfer History</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {transfers.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-lg">
                  No transfers yet
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="p-5 border rounded-lg space-y-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-base text-gray-900">
                          {transfer.from_currency} → {transfer.to_currency}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {Number(transfer.from_amount).toLocaleString()}{" "}
                          {transfer.from_currency} →{" "}
                          {Number(transfer.to_amount).toLocaleString()}{" "}
                          {transfer.to_currency}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                          {new Date(transfer.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">
                          {transfer.status}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 bg-white px-2 py-1 rounded">
                        Rate: {Number(transfer.exchange_rate).toFixed(4)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
