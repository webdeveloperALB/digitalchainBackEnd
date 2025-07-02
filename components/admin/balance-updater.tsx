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

export default function BalanceUpdater() {
  const [userId, setUserId] = useState("");
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState("add"); // 'add', 'subtract', or 'set'

  const updateBalance = async () => {
    if (!userId || !currency || !amount) {
      setMessage("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const tableName = `${currency.toLowerCase()}_balances`;
      const amountValue = Number.parseFloat(amount);

      if (operation === "set") {
        // Set balance to exact amount (original behavior)
        const { error } = await supabase
          .from(tableName)
          .update({ balance: amountValue })
          .eq("user_id", userId);

        if (error) throw error;

        // Create transfer record for set operation
        try {
          const transferData = {
            user_id: userId,
            from_currency: currency.toLowerCase(),
            to_currency: currency.toLowerCase(),
            from_amount: amountValue,
            to_amount: amountValue,
            exchange_rate: 1.0,
            status: "completed",
          };

          console.log("Creating transfer record:", transferData);

          const { error: transferError } = await supabase
            .from("transfers")
            .insert(transferData);

          if (transferError) {
            console.error("Transfer error details:", transferError);
            // Don't throw here, just log the error
          }
        } catch (transferErr) {
          console.error("Error creating transfer record:", transferErr);
        }

        setMessage(`Successfully set ${currency} balance to ${amount}`);
      } else {
        // Get current balance first
        const { data: currentData, error: fetchError } = await supabase
          .from(tableName)
          .select("balance")
          .eq("user_id", userId)
          .single();

        if (fetchError) {
          // If no record exists, create one
          if (fetchError.code === "PGRST116") {
            const newBalance = operation === "add" ? amountValue : 0;

            const { error: insertError } = await supabase
              .from(tableName)
              .insert({
                user_id: userId,
                balance: newBalance,
              });

            if (insertError) throw insertError;

            // Create transfer record for new account
            try {
              const transferData = {
                user_id: userId,
                from_currency: currency.toLowerCase(),
                to_currency: currency.toLowerCase(),
                from_amount: newBalance,
                to_amount: newBalance,
                exchange_rate: 1.0,
                status: "completed",
              };

              console.log(
                "Creating transfer record for new account:",
                transferData
              );

              const { error: transferError } = await supabase
                .from("transfers")
                .insert(transferData);

              if (transferError) {
                console.error("Transfer error details:", transferError);
              }
            } catch (transferErr) {
              console.error("Error creating transfer record:", transferErr);
            }

            setMessage(`Created new ${currency} balance: ${newBalance}`);
          } else {
            throw fetchError;
          }
        } else {
          // Update existing balance
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

          // Create transfer record for balance update
          try {
            const transferData = {
              user_id: userId,
              from_currency: currency.toLowerCase(),
              to_currency: currency.toLowerCase(),
              from_amount: operation === "add" ? amountValue : currentBalance,
              to_amount: operation === "add" ? newBalance : amountValue,
              exchange_rate: 1.0,
              status: "completed",
            };

            console.log(
              "Creating transfer record for balance update:",
              transferData
            );

            const { error: transferError } = await supabase
              .from("transfers")
              .insert(transferData);

            if (transferError) {
              console.error("Transfer error details:", transferError);
              console.error("Transfer error code:", transferError.code);
              console.error("Transfer error message:", transferError.message);
            } else {
              console.log("Transfer record created successfully");
            }
          } catch (transferErr) {
            console.error("Error creating transfer record:", transferErr);
          }

          setMessage(
            `Successfully ${
              operation === "add" ? "added" : "subtracted"
            } ${amount} ${
              operation === "add" ? "to" : "from"
            } ${currency} balance. New balance: ${newBalance}`
          );
        }
      }

      // Clear form
      setUserId("");
      setCurrency("");
      setAmount("");
    } catch (error: any) {
      console.error("Main error:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Update User Balance (Admin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={operation} onValueChange={setOperation} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="add">Add Funds</TabsTrigger>
            <TabsTrigger value="subtract">Remove Funds</TabsTrigger>
            <TabsTrigger value="set">Set Balance</TabsTrigger>
          </TabsList>
          <TabsContent value="add" className="space-y-4 mt-4">
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
              💰 Add funds to existing balance (will appear in transfer history)
            </div>
          </TabsContent>
          <TabsContent value="subtract" className="space-y-4 mt-4">
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              💸 Remove funds from existing balance (will appear in transfer
              history)
            </div>
          </TabsContent>
          <TabsContent value="set" className="space-y-4 mt-4">
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
              🔧 Set exact balance amount (will appear in transfer history)
            </div>
          </TabsContent>
        </Tabs>

        <div>
          <Label htmlFor="userId">User ID</Label>
          <Input
            id="userId"
            placeholder="Enter user UUID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crypto">Crypto</SelectItem>
              <SelectItem value="euro">Euro</SelectItem>
              <SelectItem value="cad">CAD</SelectItem>
              <SelectItem value="usd">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <Button
          onClick={updateBalance}
          disabled={loading}
          className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
        >
          {loading
            ? "Updating..."
            : operation === "add"
            ? "Add Funds"
            : operation === "subtract"
            ? "Remove Funds"
            : "Set Balance"}
        </Button>

        {message && (
          <p
            className={`text-sm ${
              message.includes("Error") ? "text-red-600" : "text-green-600"
            }`}
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
