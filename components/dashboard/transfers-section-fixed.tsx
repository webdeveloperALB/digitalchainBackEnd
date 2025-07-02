"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeData } from "@/hooks/use-realtime-data";
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

// Define currency type
interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export default function TransfersSection() {
  const { balances, exchangeRates, loading, error } = useRealtimeData();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [formData, setFormData] = useState({
    from_currency: "",
    to_currency: "",
    amount: "",
  });
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [estimatedAmount, setEstimatedAmount] = useState<number>(0);

  useEffect(() => {
    console.log("Component mounted, fetching data...");
    fetchTransfers();
    fetchCurrencies();
  }, []);

  useEffect(() => {
    console.log("Currencies updated:", currencies);
  }, [currencies]);

  useEffect(() => {
    if (formData.from_currency && formData.to_currency && formData.amount) {
      calculateExchange();
    }
  }, [formData, exchangeRates]);

  const fetchCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (error) {
        console.warn(
          "Database fetch failed, using fallback currencies:",
          error
        );
        throw error;
      }

      if (data && data.length > 0) {
        setCurrencies(data);
      } else {
        throw new Error("No currencies found in database");
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
      // Always set fallback currencies if database fetch fails
      const fallbackCurrencies = [
        { code: "USD", name: "US Dollar", symbol: "$" },
        { code: "EUR", name: "Euro", symbol: "€" },
        { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
        { code: "CRYPTO", name: "Crypto", symbol: "₿" },
      ];
      console.log("Setting fallback currencies:", fallbackCurrencies);
      setCurrencies(fallbackCurrencies);
    }
  };

  const calculateExchange = () => {
    const fromCurrency = formData.from_currency.toLowerCase();
    const toCurrency = formData.to_currency.toLowerCase();
    const amount = Number(formData.amount);

    if (!amount || fromCurrency === toCurrency) {
      setExchangeRate(1);
      setEstimatedAmount(amount);
      return;
    }

    let rate = 1;

    // Use real-time exchange rates
    if (fromCurrency === "usd" && toCurrency === "eur") {
      rate = exchangeRates.usd_to_eur;
    } else if (fromCurrency === "usd" && toCurrency === "cad") {
      rate = exchangeRates.usd_to_cad;
    } else if (fromCurrency === "eur" && toCurrency === "usd") {
      rate = exchangeRates.eur_to_usd;
    } else if (fromCurrency === "cad" && toCurrency === "usd") {
      rate = exchangeRates.cad_to_usd;
    } else if (fromCurrency === "eur" && toCurrency === "cad") {
      rate = exchangeRates.eur_to_usd * exchangeRates.usd_to_cad;
    } else if (fromCurrency === "cad" && toCurrency === "eur") {
      rate = exchangeRates.cad_to_usd * exchangeRates.usd_to_eur;
    }

    setExchangeRate(rate);
    setEstimatedAmount(amount * rate);
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
    }
  };

  // Helper function to get the correct table name for each currency
  const getTableName = (currencyCode: string) => {
    const tableMap: { [key: string]: string } = {
      USD: "usd_balances",
      EUR: "euro_balances",
      EURO: "euro_balances",
      CAD: "cad_balances",
      CRYPTO: "crypto_balances",
    };
    return tableMap[currencyCode.toUpperCase()];
  };

  // Helper function to get balance key for real-time data
  const getBalanceKey = (currencyCode: string): keyof typeof balances => {
    const keyMap: { [key: string]: keyof typeof balances } = {
      USD: "usd",
      EUR: "euro",
      EURO: "euro",
      CAD: "cad",
      CRYPTO: "crypto",
    };
    return keyMap[currencyCode.toUpperCase()] || "usd";
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

      // Get current balances from real-time data
      const fromBalanceKey = getBalanceKey(fromCurrency);
      const toBalanceKey = getBalanceKey(toCurrency);

      const currentFromBalance = balances[fromBalanceKey] || 0;
      const currentToBalance = balances[toBalanceKey] || 0;

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

      // Refresh transfers (balances will update automatically via real-time)
      await fetchTransfers();

      alert("Transfer completed successfully!");
    } catch (error: any) {
      console.error("Transfer error:", error);
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="p-6">Loading transfers...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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

      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Currency Transfers
      </h2>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content - Left Side */}
        <div className="flex-1 space-y-6">
          {/* Current Balances */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">US Dollar</p>
                <p className="text-xl font-semibold text-gray-900">
                  ${Number(balances.usd || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Euro</p>
                <p className="text-xl font-semibold text-gray-900">
                  €{Number(balances.euro || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Canadian Dollar</p>
                <p className="text-xl font-semibold text-gray-900">
                  C${Number(balances.cad || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">Crypto</p>
                <p className="text-xl font-semibold text-gray-900">
                  ₿{Number(balances.crypto || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Transfer Form */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-800">
                New Transfer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Currency Selection Row */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                  <Label className="text-sm font-medium mb-2 block text-gray-700">
                    From Currency
                  </Label>
                  <Select
                    value={formData.from_currency}
                    onValueChange={(value) => {
                      console.log("From currency selected:", value);
                      setFormData({ ...formData, from_currency: value });
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem
                          key={currency.code}
                          value={currency.code}
                          className="py-2"
                        >
                          {currency.symbol} {currency.name} ({currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col items-center justify-center px-4 py-2">
                  <ArrowLeftRight className="w-6 h-6 text-[#F26623] mb-1" />
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    Rate: {exchangeRate.toFixed(4)}
                  </p>
                </div>

                <div className="flex-1 w-full">
                  <Label className="text-sm font-medium mb-2 block text-gray-700">
                    To Currency
                  </Label>
                  <Select
                    value={formData.to_currency}
                    onValueChange={(value) => {
                      console.log("To currency selected:", value);
                      setFormData({ ...formData, to_currency: value });
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem
                          key={currency.code}
                          value={currency.code}
                          className="py-2"
                        >
                          {currency.symbol} {currency.name} ({currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount Input Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block text-gray-700">
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
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block text-gray-700">
                    You Will Receive
                  </Label>
                  <Input
                    value={estimatedAmount.toFixed(2)}
                    readOnly
                    className="bg-gray-50 font-medium h-10"
                  />
                </div>
              </div>

              <Button
                onClick={executeTransfer}
                disabled={
                  !formData.from_currency ||
                  !formData.to_currency ||
                  !formData.amount ||
                  loading
                }
                className="w-full bg-[#F26623] hover:bg-[#E55A1F] h-11 font-semibold"
              >
                Execute Transfer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Transfer History - Right Side */}
        <div className="w-full lg:w-80 xl:w-96">
          <Card className="border border-gray-200 shadow-sm h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-800">
                Transfer History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {transfers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No transfers yet
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                  {transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="p-4 border border-gray-100 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            {transfer.from_currency} → {transfer.to_currency}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {Number(transfer.from_amount).toLocaleString()}{" "}
                            {transfer.from_currency} →{" "}
                            {Number(transfer.to_amount).toLocaleString()}{" "}
                            {transfer.to_currency}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                          {transfer.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>
                          {new Date(transfer.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          Rate: {Number(transfer.exchange_rate).toFixed(4)}
                        </span>
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
  );
}
