"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Euro,
  Bitcoin,
  Coins,
  Banknote,
  TrendingUp,
  TrendingDown,
  Settings,
} from "lucide-react";

export default function EnhancedBalanceUpdater() {
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState("add");

  const currencies = [
    {
      value: "usd",
      label: "US Dollar",
      symbol: "$",
      icon: DollarSign,
      color: "bg-green-500",
      step: "0.01",
      table: "usd_balances",
    },
    {
      value: "euro",
      label: "Euro",
      symbol: "€",
      icon: Euro,
      color: "bg-blue-500",
      step: "0.01",
      table: "euro_balances",
    },
    {
      value: "cad",
      label: "Canadian Dollar",
      symbol: "C$",
      icon: Banknote,
      color: "bg-red-500",
      step: "0.01",
      table: "cad_balances",
    },
    {
      value: "BTC",
      label: "Bitcoin",
      symbol: "₿",
      icon: Bitcoin,
      color: "bg-orange-500",
      step: "0.00000001",
      table: "newcrypto_balances",
      column: "btc_balance",
    },
    {
      value: "ETH",
      label: "Ethereum",
      symbol: "Ξ",
      icon: Coins,
      color: "bg-blue-600",
      step: "0.00000001",
      table: "newcrypto_balances",
      column: "eth_balance",
    },
    {
      value: "USDT",
      label: "Tether USD",
      symbol: "$",
      icon: DollarSign,
      color: "bg-green-600",
      step: "0.000001",
      table: "newcrypto_balances",
      column: "usdt_balance",
    },
  ];

  const getUserByEmail = async (email: string) => {
    try {
      console.log("Fetching user by email:", email);
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (error) {
        console.error("User fetch error:", error);
        return { success: false, error };
      }

      console.log("User found:", data);
      return { success: true, data };
    } catch (err) {
      console.error("User fetch exception:", err);
      return { success: false, error: err };
    }
  };

  const createTransferRecord = async (transferData: any) => {
    try {
      console.log("Creating transfer record:", transferData);
      const { data, error } = await supabase
        .from("transfers")
        .insert(transferData)
        .select();

      if (error) {
        console.error("Transfer creation error:", error);
        return { success: false, error };
      }

      console.log("Transfer created successfully:", data);
      return { success: true, data };
    } catch (err) {
      console.error("Transfer creation exception:", err);
      return { success: false, error: err };
    }
  };

  const updateBalance = async () => {
    if (!email || !currency || !amount) {
      setMessage("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const userResult = await getUserByEmail(email);
      if (!userResult.success || !userResult.data) {
        throw new Error("User not found with this email address");
      }

      const userId = userResult.data.id;
      const selectedCurrency = currencies.find((c) => c.value === currency);
      const amountValue = Number.parseFloat(amount);

      if (!selectedCurrency) {
        throw new Error("Invalid currency selected");
      }

      // Handle crypto currencies differently
      if (["BTC", "ETH", "USDT"].includes(currency)) {
        try {
          const { data, error } = await supabase.rpc("update_crypto_balance", {
            p_user_id: userId,
            p_crypto_type: currency,
            p_amount: amountValue,
            p_operation: operation,
          });

          if (error) throw error;

          // Create transfer record for crypto
          const transferData = {
            user_id: userId,
            client_id: userId,
            from_currency: currency.toLowerCase(),
            to_currency: currency.toLowerCase(),
            from_amount: amountValue,
            to_amount: amountValue,
            exchange_rate: 1.0,
            status: "completed",
            transfer_type:
              operation === "add"
                ? "admin_crypto_deposit"
                : operation === "subtract"
                ? "admin_crypto_debit"
                : "admin_crypto_adjustment",
            description:
              operation === "add"
                ? `Crypto Credit - ${amountValue.toFixed(
                    8
                  )} ${currency} has been deposited to your account`
                : operation === "subtract"
                ? `Crypto Debit - ${amountValue.toFixed(
                    8
                  )} ${currency} has been debited from your account`
                : `Crypto Balance Adjustment - Account balance set to ${amountValue.toFixed(
                    8
                  )} ${currency}`,
          };

          const transferResult = await createTransferRecord(transferData);

          if (transferResult.success) {
            setMessage(
              `✅ Successfully ${
                operation === "add"
                  ? "added"
                  : operation === "subtract"
                  ? "subtracted"
                  : "set"
              } ${amount} ${currency} ${
                operation === "add"
                  ? "to"
                  : operation === "subtract"
                  ? "from"
                  : "for"
              } ${email} and logged to activity`
            );
          } else {
            setMessage(
              `⚠️ ${currency} balance updated but activity logging failed`
            );
          }
        } catch (error: any) {
          throw new Error(`Crypto balance update failed: ${error.message}`);
        }
      } else {
        // Handle traditional currencies (USD, EUR, CAD)
        const tableName = selectedCurrency.table;

        if (operation === "set") {
          const { error } = await supabase
            .from(tableName)
            .update({ balance: amountValue })
            .eq("user_id", userId);

          if (error) throw error;

          const transferData = {
            user_id: userId,
            client_id: userId,
            from_currency: currency.toLowerCase(),
            to_currency: currency.toLowerCase(),
            from_amount: amountValue,
            to_amount: amountValue,
            exchange_rate: 1.0,
            status: "completed",
            transfer_type: "admin_balance_adjustment",
            description: `Administrative Balance Adjustment - Account balance set to ${amountValue.toLocaleString()} ${currency.toUpperCase()}`,
          };

          const transferResult = await createTransferRecord(transferData);
          if (transferResult.success) {
            setMessage(
              `✅ Successfully set ${currency} balance to ${amount} for ${email} and logged to activity`
            );
          } else {
            setMessage(
              `⚠️ Balance updated to ${amount} for ${email} but activity logging failed`
            );
          }
        } else {
          // Get current balance first
          const { data: currentData, error: fetchError } = await supabase
            .from(tableName)
            .select("balance")
            .eq("user_id", userId)
            .single();

          if (fetchError) {
            if (fetchError.code === "PGRST116") {
              const newBalance = operation === "add" ? amountValue : 0;
              const { error: insertError } = await supabase
                .from(tableName)
                .insert({
                  user_id: userId,
                  balance: newBalance,
                });

              if (insertError) throw insertError;

              const transferData = {
                user_id: userId,
                client_id: userId,
                from_currency: currency.toLowerCase(),
                to_currency: currency.toLowerCase(),
                from_amount: newBalance,
                to_amount: newBalance,
                exchange_rate: 1.0,
                status: "completed",
                transfer_type:
                  operation === "add" ? "admin_deposit" : "admin_debit",
                description:
                  operation === "add"
                    ? `Account Credit - ${newBalance.toLocaleString()} ${currency.toUpperCase()} has been deposited to your account`
                    : `Account Setup - New ${currency.toUpperCase()} account created`,
              };

              const transferResult = await createTransferRecord(transferData);
              if (transferResult.success) {
                setMessage(
                  `✅ Created new ${currency} balance: ${newBalance} for ${email} and logged to activity`
                );
              } else {
                setMessage(
                  `⚠️ Created new ${currency} balance: ${newBalance} for ${email} but activity logging failed`
                );
              }
            } else {
              throw fetchError;
            }
          } else {
            const currentBalance = currentData.balance || 0;
            const newBalance =
              operation === "add"
                ? currentBalance + amountValue
                : Math.max(0, currentBalance - amountValue);

            const { error: updateError } = await supabase
              .from(tableName)
              .update({ balance: newBalance })
              .eq("user_id", userId);

            if (updateError) throw updateError;

            const transferData = {
              user_id: userId,
              client_id: userId,
              from_currency: currency.toLowerCase(),
              to_currency: currency.toLowerCase(),
              from_amount: operation === "add" ? amountValue : currentBalance,
              to_amount: operation === "add" ? newBalance : amountValue,
              exchange_rate: 1.0,
              status: "completed",
              transfer_type:
                operation === "add" ? "admin_deposit" : "admin_debit",
              description:
                operation === "add"
                  ? `Account Credit - ${amountValue.toLocaleString()} ${currency.toUpperCase()} has been deposited to your account`
                  : `Account Debit - ${amountValue.toLocaleString()} ${currency.toUpperCase()} has been debited from your account`,
            };

            const transferResult = await createTransferRecord(transferData);
            if (transferResult.success) {
              setMessage(
                `✅ Successfully ${
                  operation === "add" ? "added" : "subtracted"
                } ${amount} ${
                  operation === "add" ? "to" : "from"
                } ${currency} balance for ${email}. New balance: ${newBalance}. Activity logged.`
              );
            } else {
              setMessage(
                `⚠️ Successfully ${
                  operation === "add" ? "added" : "subtracted"
                } ${amount} ${
                  operation === "add" ? "to" : "from"
                } ${currency} balance for ${email}. New balance: ${newBalance}. Activity logging failed.`
              );
            }
          }
        }
      }

      // Clear form
      setEmail("");
      setCurrency("");
      setAmount("");
    } catch (error: any) {
      console.error("Main error:", error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedCurrency = currencies.find((c) => c.value === currency);
  const IconComponent = selectedCurrency?.icon || DollarSign;

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-[#F26623]" />
          Enhanced Balance Updater (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-green-500 bg-green-50">
          <AlertDescription className="text-green-700">
            ✅ Balance updates and transfer history logging are both active.
            Admin actions will appear in user dashboards with proper crypto
            support.
          </AlertDescription>
        </Alert>

        <Tabs value={operation} onValueChange={setOperation} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="add" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Add Funds
            </TabsTrigger>
            <TabsTrigger value="subtract" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Remove Funds
            </TabsTrigger>
            <TabsTrigger value="set" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Set Balance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4 mt-4">
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
              💰 Add funds to existing balance (will appear as "Account Credit"
              in transfer history)
            </div>
          </TabsContent>

          <TabsContent value="subtract" className="space-y-4 mt-4">
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              💸 Remove funds from existing balance (will appear as "Account
              Debit" in transfer history)
            </div>
          </TabsContent>

          <TabsContent value="set" className="space-y-4 mt-4">
            <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
              🔧 Set exact balance amount (will appear as "Balance Adjustment"
              in transfer history)
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              User Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter user email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="currency" className="text-sm font-medium">
              Currency
            </Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Traditional Currencies
                </div>
                {currencies
                  .filter((c) => !["BTC", "ETH", "USDT"].includes(c.value))
                  .map((curr) => {
                    const IconComponent = curr.icon;
                    return (
                      <SelectItem key={curr.value} value={curr.value}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full ${curr.color} flex items-center justify-center`}
                          >
                            <IconComponent className="w-3 h-3 text-white" />
                          </div>
                          <span>{curr.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {curr.symbol}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}

                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t mt-2 pt-2">
                  Cryptocurrencies
                </div>
                {currencies
                  .filter((c) => ["BTC", "ETH", "USDT"].includes(c.value))
                  .map((curr) => {
                    const IconComponent = curr.icon;
                    return (
                      <SelectItem key={curr.value} value={curr.value}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full ${curr.color} flex items-center justify-center`}
                          >
                            <IconComponent className="w-3 h-3 text-white" />
                          </div>
                          <span>{curr.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {curr.symbol}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount" className="text-sm font-medium">
              Amount
              {selectedCurrency && (
                <span className="text-gray-500 ml-2">
                  ({selectedCurrency.symbol} {selectedCurrency.value})
                </span>
              )}
            </Label>
            <div className="relative mt-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                {selectedCurrency && (
                  <div
                    className={`w-5 h-5 rounded-full ${selectedCurrency.color} flex items-center justify-center`}
                  >
                    <IconComponent className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <Input
                id="amount"
                type="number"
                step={selectedCurrency?.step || "0.01"}
                placeholder={`Enter amount${
                  selectedCurrency
                    ? ` (${selectedCurrency.step} precision)`
                    : ""
                }`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${selectedCurrency ? "pl-12" : ""} font-mono`}
              />
            </div>
            {selectedCurrency &&
              ["BTC", "ETH", "USDT"].includes(selectedCurrency.value) && (
                <p className="text-xs text-gray-500 mt-1">
                  Cryptocurrency precision: {selectedCurrency.step}{" "}
                  {selectedCurrency.value}
                </p>
              )}
          </div>
        </div>

        <Button
          onClick={updateBalance}
          disabled={loading || !email || !currency || !amount}
          className="w-full bg-[#F26623] hover:bg-[#E55A1F] h-12 text-lg font-semibold"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              {operation === "add" && <TrendingUp className="h-5 w-5 mr-2" />}
              {operation === "subtract" && (
                <TrendingDown className="h-5 w-5 mr-2" />
              )}
              {operation === "set" && <Settings className="h-5 w-5 mr-2" />}
              {operation === "add"
                ? "Credit Account"
                : operation === "subtract"
                ? "Debit Account"
                : "Adjust Balance"}
            </>
          )}
        </Button>

        {message && (
          <div
            className={`text-sm p-3 rounded-lg border ${
              message.includes("❌")
                ? "text-red-600 bg-red-50 border-red-200"
                : message.includes("⚠️")
                ? "text-yellow-600 bg-yellow-50 border-yellow-200"
                : "text-green-600 bg-green-50 border-green-200"
            }`}
          >
            {message}
          </div>
        )}

        {selectedCurrency && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 mb-2">
              Selected Currency Info
            </h4>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div
                className={`w-8 h-8 rounded-full ${selectedCurrency.color} flex items-center justify-center`}
              >
                <IconComponent className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-medium">{selectedCurrency.label}</p>
                <p className="text-xs">
                  Symbol: {selectedCurrency.symbol} | Precision:{" "}
                  {selectedCurrency.step} |
                  {["BTC", "ETH", "USDT"].includes(selectedCurrency.value)
                    ? "Cryptocurrency"
                    : "Traditional Currency"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
