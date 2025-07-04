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
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623]"></div>
        <span className="ml-3 text-slate-600">Loading transfers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center bg-red-50 p-6 rounded-lg border border-red-200">
          <div className="text-red-600 text-lg font-semibold">Error</div>
          <div className="text-red-500 mt-2">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gradient-to-br from-slate-50 to-slate-100">
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
        .balance-card {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          transition: all 0.3s ease;
          border: 1px solid #e2e8f0;
        }
        .balance-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
          border-color: #f26623;
        }
        .transfer-form {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }
        .history-card {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }
        .transfer-item {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          transition: all 0.3s ease;
        }
        .transfer-item:hover {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          transform: translateX(2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .currency-badge {
          background: linear-gradient(135deg, #f26623 0%, #e55a1f 100%);
          box-shadow: 0 2px 8px rgba(242, 102, 35, 0.3);
        }
      `}</style>

      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-1">
          Currency Transfers
        </h2>
        <p className="text-slate-600">
          Seamlessly exchange between your currencies
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Main Content - Left Side */}
        <div className="flex-1 space-y-6">
          {/* Current Balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="balance-card">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-lg font-bold">$</span>
                </div>
                <p className="text-xs text-slate-600 mb-1 font-medium">
                  US Dollar
                </p>
                <p className="text-xl font-bold text-slate-800">
                  ${Number(balances.usd || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="balance-card">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-lg font-bold">€</span>
                </div>
                <p className="text-xs text-slate-600 mb-1 font-medium">Euro</p>
                <p className="text-xl font-bold text-slate-800">
                  €{Number(balances.euro || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="balance-card">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-lg font-bold">C$</span>
                </div>
                <p className="text-xs text-slate-600 mb-1 font-medium">
                  Canadian Dollar
                </p>
                <p className="text-xl font-bold text-slate-800">
                  C${Number(balances.cad || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="balance-card">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white text-lg font-bold">₿</span>
                </div>
                <p className="text-xs text-slate-600 mb-1 font-medium">
                  Crypto
                </p>
                <p className="text-xl font-bold text-slate-800">
                  ₿{Number(balances.crypto || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Transfer Form */}
          <Card className="transfer-form">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-lg flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4 text-white" />
                </div>
                New Transfer
              </CardTitle>
              <p className="text-slate-600 text-sm mt-1">
                Exchange currencies at real-time rates
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Currency Selection Row */}
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="flex-1 w-full">
                  <Label className="text-sm font-semibold mb-3 block text-slate-700">
                    From Currency
                  </Label>
                  <Select
                    value={formData.from_currency}
                    onValueChange={(value) => {
                      console.log("From currency selected:", value);
                      setFormData({ ...formData, from_currency: value });
                    }}
                  >
                    <SelectTrigger className="h-12 w-full border-slate-300 hover:border-[#F26623] transition-colors">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem
                          key={currency.code}
                          value={currency.code}
                          className="py-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{currency.symbol}</span>
                            <span className="font-medium">{currency.name}</span>
                            <span className="text-slate-500">
                              ({currency.code})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col items-center justify-center px-6 py-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-full flex items-center justify-center mb-2">
                    <ArrowLeftRight className="w-6 h-6 text-white" />
                  </div>
                  <div className="currency-badge text-white px-3 py-1 rounded-full text-sm font-medium">
                    {exchangeRate.toFixed(4)}
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <Label className="text-sm font-semibold mb-3 block text-slate-700">
                    To Currency
                  </Label>
                  <Select
                    value={formData.to_currency}
                    onValueChange={(value) => {
                      console.log("To currency selected:", value);
                      setFormData({ ...formData, to_currency: value });
                    }}
                  >
                    <SelectTrigger className="h-12 w-full border-slate-300 hover:border-[#F26623] transition-colors">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem
                          key={currency.code}
                          value={currency.code}
                          className="py-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{currency.symbol}</span>
                            <span className="font-medium">{currency.name}</span>
                            <span className="text-slate-500">
                              ({currency.code})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount Input Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-semibold mb-3 block text-slate-700">
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
                    className="h-12 text-lg border-slate-300 hover:border-[#F26623] focus:border-[#F26623] transition-colors"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-3 block text-slate-700">
                    You Will Receive
                  </Label>
                  <Input
                    value={estimatedAmount.toFixed(2)}
                    readOnly
                    className="h-12 text-lg font-semibold bg-gradient-to-r from-slate-50 to-slate-100 border-slate-300 text-slate-800"
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
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D4501B] transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Execute Transfer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Transfer History - Right Side */}
        <div className="w-full xl:w-96">
          <Card className="history-card sticky top-8">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">📊</span>
                </div>
                Transfer History
              </CardTitle>
              <p className="text-slate-600 mt-2">Your recent transactions</p>
            </CardHeader>
            <CardContent className="p-6">
              {transfers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-slate-500 text-2xl">📋</span>
                  </div>
                  <p className="text-slate-500 text-lg">No transfers yet</p>
                  <p className="text-slate-400 text-sm mt-2">
                    Your transfer history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                  {transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="transfer-item p-5 rounded-xl"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-slate-800">
                              {transfer.from_currency}
                            </span>
                            <ArrowLeftRight className="w-4 h-4 text-[#F26623]" />
                            <span className="font-bold text-slate-800">
                              {transfer.to_currency}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium">
                              {Number(transfer.from_amount).toLocaleString()}
                            </span>
                            <span className="mx-1">→</span>
                            <span className="font-medium">
                              {Number(transfer.to_amount).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                          {transfer.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">
                          {new Date(transfer.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded">
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
