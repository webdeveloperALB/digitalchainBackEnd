"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import {
  Plus,
  Loader2,
  AlertTriangle,
  Users,
  Bitcoin,
  Coins,
  TrendingUp,
  Shield,
  Clock,
  Hash,
  Network,
  Wallet,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  created_at: string;
}

interface CryptoDeposit {
  id: string;
  user_id: string;
  currency: string;
  network: string;
  amount: number;
  wallet_address: string;
  transaction_hash: string | null;
  status: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function AdminCryptoDepositCreator() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("BTC");
  const [network, setNetwork] = useState<string>("bitcoin");
  const [amount, setAmount] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [autoApprove, setAutoApprove] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [recentDeposits, setRecentDeposits] = useState<CryptoDeposit[]>([]);

  // Real cryptocurrency configurations
  const cryptoConfigs = {
    BTC: {
      name: "Bitcoin",
      symbol: "₿",
      networks: [
        { value: "bitcoin", label: "Bitcoin Mainnet", confirmations: 3 },
        {
          value: "bitcoin-testnet",
          label: "Bitcoin Testnet",
          confirmations: 1,
        },
      ],
      decimals: 8,
      minAmount: 0.00001,
      icon: Bitcoin,
      color: "text-orange-500",
    },
    ETH: {
      name: "Ethereum",
      symbol: "Ξ",
      networks: [
        { value: "ethereum", label: "Ethereum Mainnet", confirmations: 12 },
        {
          value: "ethereum-goerli",
          label: "Ethereum Goerli",
          confirmations: 3,
        },
        { value: "polygon", label: "Polygon", confirmations: 20 },
        { value: "bsc", label: "Binance Smart Chain", confirmations: 15 },
      ],
      decimals: 18,
      minAmount: 0.001,
      icon: Coins,
      color: "text-blue-500",
    },
    USDT: {
      name: "Tether",
      symbol: "₮",
      networks: [
        { value: "ethereum", label: "Ethereum (ERC-20)", confirmations: 12 },
        { value: "tron", label: "Tron (TRC-20)", confirmations: 19 },
        {
          value: "bsc",
          label: "Binance Smart Chain (BEP-20)",
          confirmations: 15,
        },
        { value: "polygon", label: "Polygon", confirmations: 20 },
      ],
      decimals: 6,
      minAmount: 1,
      icon: Shield,
      color: "text-green-500",
    },
  };

  useEffect(() => {
    fetchUsers();
    fetchRecentDeposits();
  }, []);

  useEffect(() => {
    // Reset network when currency changes
    const config = cryptoConfigs[currency as keyof typeof cryptoConfigs];
    if (config && config.networks.length > 0) {
      setNetwork(config.networks[0].value);
    }
  }, [currency]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, full_name, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setMessage({ type: "error", text: "Failed to load users" });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchRecentDeposits = async () => {
    try {
      const { data, error } = await supabase
        .from("crypto_transactions")
        .select("*")
        .eq("transaction_type", "deposit")
        .in("currency", ["BTC", "ETH", "USDT"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch user details for each deposit
      const depositsWithUserInfo = await Promise.all(
        (data || []).map(async (deposit) => {
          const { data: userData } = await supabase
            .from("users")
            .select("email, first_name, last_name, full_name")
            .eq("id", deposit.user_id)
            .single();

          return {
            ...deposit,
            user_email: userData?.email,
            user_name:
              userData?.full_name ||
              `${userData?.first_name || ""} ${
                userData?.last_name || ""
              }`.trim(),
          };
        })
      );

      setRecentDeposits(depositsWithUserInfo);
    } catch (error) {
      console.error("Error fetching recent deposits:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedUserId || !currency || !network || !amount || !walletAddress) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    const config = cryptoConfigs[currency as keyof typeof cryptoConfigs];
    const amountNum = Number.parseFloat(amount);

    if (amountNum < config.minAmount) {
      setMessage({
        type: "error",
        text: `Minimum amount for ${currency} is ${config.minAmount} ${currency}`,
      });
      return;
    }

    setLoading(true);

    try {
      // Create crypto transaction record
      const transactionData = {
        user_id: selectedUserId,
        transaction_type: "deposit",
        currency: currency,
        network: network,
        amount: amountNum,
        wallet_address: walletAddress,
        transaction_hash: transactionHash || null,
        status: autoApprove ? "completed" : "pending",
        fee_amount: 0,
        exchange_rate: 1,
        usd_amount: 0, // This would be calculated based on current rates
        confirmation_count: autoApprove
          ? config.networks.find((n) => n.value === network)?.confirmations || 0
          : 0,
        required_confirmations:
          config.networks.find((n) => n.value === network)?.confirmations || 0,
        metadata: {
          created_by_admin: true,
          auto_approved: autoApprove,
          network_info: config.networks.find((n) => n.value === network),
        },
      };

      const { data: transactionResult, error: transactionError } =
        await supabase
          .from("crypto_transactions")
          .insert([transactionData])
          .select()
          .single();

      if (transactionError) throw transactionError;

      // If auto-approved, update user's crypto balance
      if (autoApprove) {
        // Check if user has existing balance for this currency
        const { data: existingBalance } = await supabase
          .from("newcrypto_balances")
          .select("*")
          .eq("user_id", selectedUserId)
          .eq("currency", currency)
          .single();

        if (existingBalance) {
          // Update existing balance
          const { error: updateError } = await supabase
            .from("newcrypto_balances")
            .update({
              balance: existingBalance.balance + amountNum,
              last_updated: new Date().toISOString(),
            })
            .eq("user_id", selectedUserId)
            .eq("currency", currency);
        } else {
          // Create new balance record
          const { error: insertError } = await supabase
            .from("newcrypto_balances")
            .insert([
              {
                user_id: selectedUserId,
                currency: currency,
                balance: amountNum,
                network: network,
                wallet_address: walletAddress,
                last_updated: new Date().toISOString(),
              },
            ]);

          if (insertError) throw insertError;
        }

        // Create account activity
        const selectedUser = users.find((u) => u.id === selectedUserId);
        const { error: activityError } = await supabase
          .from("account_activities")
          .insert([
            {
              user_id: selectedUserId,
              client_id: `DCB${selectedUserId.slice(0, 6)}`,
              activity_type: "account_credit",
              title: `${currency} Deposit Confirmed`,
              description: `Your ${currency} deposit of ${
                config.symbol
              }${amountNum} has been confirmed and credited to your account.\n\nTransaction Details:\n• Amount: ${
                config.symbol
              }${amountNum} ${currency}\n• Network: ${
                config.networks.find((n) => n.value === network)?.label
              }\n• Wallet: ${walletAddress}\n• Transaction Hash: ${
                transactionHash || "Pending"
              }\n• Status: Completed\n\nYour ${currency} balance has been updated accordingly.`,
              currency: currency,
              display_amount: amountNum,
              status: "active",
              priority: "high",
              is_read: false,
              created_by: "Admin System",
              metadata: {
                transaction_id: transactionResult.id,
                crypto_deposit: true,
                network: network,
              },
            },
          ]);

        if (activityError) throw activityError;
      }

      setMessage({
        type: "success",
        text: `${currency} deposit ${
          autoApprove ? "created and approved" : "created successfully"
        }`,
      });

      // Reset form
      setSelectedUserId("");
      setAmount("");
      setWalletAddress("");
      setTransactionHash("");
      setAutoApprove(false);

      // Refresh recent deposits
      await fetchRecentDeposits();
    } catch (error) {
      console.error("Error creating crypto deposit:", error);
      setMessage({
        type: "error",
        text: `Failed to create deposit: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedConfig = cryptoConfigs[currency as keyof typeof cryptoConfigs];
  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center">
            <Bitcoin className="h-6 w-6 mr-3 text-blue-600" />
            Crypto Deposit Creator
            <Badge variant="outline" className="ml-3 text-xs">
              BTC • ETH • USDT
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {message && (
            <Alert
              className={
                message.type === "error"
                  ? "border-red-500 bg-red-50"
                  : "border-green-500 bg-green-50"
              }
            >
              <AlertDescription
                className={
                  message.type === "error" ? "text-red-700" : "text-green-700"
                }
              >
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Select User *</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Choose user for deposit" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {usersLoading ? (
                      <div className="p-4 text-center">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        <p className="text-sm text-gray-500 mt-2">
                          Loading users...
                        </p>
                      </div>
                    ) : (
                      users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">
                                {user.full_name ||
                                  `${user.first_name || ""} ${
                                    user.last_name || ""
                                  }`.trim() ||
                                  user.email}
                              </div>
                              <div className="text-xs text-gray-500">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Cryptocurrency Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Cryptocurrency *
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(cryptoConfigs).map(([key, config]) => {
                      const IconComponent = config.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center space-x-3">
                            <IconComponent
                              className={`h-5 w-5 ${config.color}`}
                            />
                            <div>
                              <div className="font-medium">
                                {config.name} ({key})
                              </div>
                              <div className="text-xs text-gray-500">
                                Min: {config.minAmount} {key} •{" "}
                                {config.decimals} decimals
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Network Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Network *</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedConfig?.networks.map((net) => (
                      <SelectItem key={net.value} value={net.value}>
                        <div className="flex items-center space-x-2">
                          <Network className="h-4 w-4 text-blue-500" />
                          <div>
                            <div className="font-medium">{net.label}</div>
                            <div className="text-xs text-gray-500">
                              {net.confirmations} confirmations required
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Amount ({currency}) *
                  {selectedConfig && (
                    <span className="text-xs text-gray-500 ml-2">
                      Min: {selectedConfig.minAmount} {currency}
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    step={`0.${"0".repeat(selectedConfig?.decimals - 1 || 7)}1`}
                    min={selectedConfig?.minAmount || 0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Enter ${currency} amount`}
                    className="h-12 pl-8"
                    required
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {selectedConfig?.symbol}
                  </div>
                </div>
              </div>

              {/* Wallet Address */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-semibold">
                  Wallet Address *
                </Label>
                <div className="relative">
                  <Input
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder={`Enter ${currency} wallet address`}
                    className="h-12 pl-10 font-mono text-sm"
                    required
                  />
                  <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Transaction Hash */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-semibold">
                  Transaction Hash (Optional)
                </Label>
                <div className="relative">
                  <Input
                    value={transactionHash}
                    onChange={(e) => setTransactionHash(e.target.value)}
                    placeholder="Enter blockchain transaction hash (if available)"
                    className="h-12 pl-10 font-mono text-sm"
                  />
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Auto-approve option */}
            <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <Checkbox
                id="auto-approve"
                checked={autoApprove}
                onCheckedChange={(checked) => setAutoApprove(checked === true)}
                title="Auto-approve this deposit and immediately credit the user's balance"
              />
              <div className="flex-1">
                <Label
                  htmlFor="auto-approve"
                  className="text-sm font-medium cursor-pointer"
                >
                  Auto-approve deposit
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  This will immediately credit the user's balance and mark the
                  deposit as completed
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>

            {/* Preview */}
            {selectedUser && amount && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm mb-2 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
                  Deposit Preview
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">User:</span>
                    <span className="font-medium">
                      {selectedUser.full_name ||
                        `${selectedUser.first_name || ""} ${
                          selectedUser.last_name || ""
                        }`.trim() ||
                        selectedUser.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">
                      {selectedConfig?.symbol}
                      {amount} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Network:</span>
                    <span className="font-medium">
                      {
                        selectedConfig?.networks.find(
                          (n) => n.value === network
                        )?.label
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge
                      variant={autoApprove ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {autoApprove ? "Auto-approved" : "Pending Review"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !selectedUserId || !amount || !walletAddress}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating Deposit...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 mr-2" />
                  Create {currency} Deposit
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Deposits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Recent Crypto Deposits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentDeposits.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bitcoin className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">No recent crypto deposits</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDeposits.map((deposit) => {
                const config =
                  cryptoConfigs[deposit.currency as keyof typeof cryptoConfigs];
                const IconComponent = config?.icon || Bitcoin;
                return (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <IconComponent
                          className={`h-5 w-5 ${
                            config?.color || "text-blue-500"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {config?.symbol}
                          {deposit.amount} {deposit.currency}
                        </div>
                        <div className="text-xs text-gray-500">
                          {deposit.user_name || deposit.user_email} •{" "}
                          {deposit.network}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          deposit.status === "completed"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {deposit.status}
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(deposit.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
