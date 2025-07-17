"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import {
  ArrowDownLeft,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Bitcoin,
  Coins,
  Shield,
  Network,
  Hash,
  Wallet,
  TrendingUp,
  Eye,
  RefreshCw,
} from "lucide-react";

interface Deposit {
  id: string;
  user_id: string;
  transaction_type: string;
  currency: string;
  network?: string;
  amount: number;
  wallet_address?: string;
  transaction_hash?: string;
  status: string;
  created_at: string;
  confirmation_count?: number;
  required_confirmations?: number;
  metadata?: any;
}

interface BankDeposit {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  deposit_method: string;
  reference_number: string;
  created_at: string;
  processed_at?: string;
  metadata?: any;
}

export default function DepositsSection() {
  const [deposits, setDeposits] = useState<(Deposit | BankDeposit)[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // Real cryptocurrency configurations
  const cryptoConfigs = {
    BTC: {
      name: "Bitcoin",
      symbol: "₿",
      icon: Bitcoin,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
    },
    ETH: {
      name: "Ethereum",
      symbol: "Ξ",
      icon: Coins,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    USDT: {
      name: "Tether",
      symbol: "₮",
      icon: Shield,
      color: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
  };

  const networkLabels = {
    bitcoin: "Bitcoin Mainnet",
    "bitcoin-testnet": "Bitcoin Testnet",
    ethereum: "Ethereum Mainnet",
    "ethereum-goerli": "Ethereum Goerli",
    polygon: "Polygon",
    bsc: "Binance Smart Chain",
    tron: "Tron (TRC-20)",
  };

  useEffect(() => {
    fetchDeposits();

    // Set up real-time subscription for crypto deposits
    const cryptoSubscription = supabase
      .channel("crypto_deposits")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_transactions",
          filter: "transaction_type=eq.deposit",
        },
        () => {
          fetchDeposits();
        }
      )
      .subscribe();

    // Set up real-time subscription for bank deposits
    const bankSubscription = supabase
      .channel("bank_deposits")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposits",
        },
        () => {
          fetchDeposits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cryptoSubscription);
      supabase.removeChannel(bankSubscription);
    };
  }, []);

  const fetchDeposits = async () => {
    try {
      setRefreshing(true);

      // Fetch crypto deposits (BTC, ETH, USDT only)
      const { data: cryptoDeposits, error: cryptoError } = await supabase
        .from("crypto_transactions")
        .select("*")
        .eq("transaction_type", "deposit")
        .in("currency", ["BTC", "ETH", "USDT"])
        .order("created_at", { ascending: false });

      if (cryptoError) throw cryptoError;

      // Fetch traditional bank deposits
      const { data: bankDeposits, error: bankError } = await supabase
        .from("deposits")
        .select("*")
        .order("created_at", { ascending: false });

      if (bankError) throw bankError;

      // Combine and sort all deposits
      const allDeposits = [
        ...(cryptoDeposits || []).map((d) => ({
          ...d,
          deposit_type: "crypto",
        })),
        ...(bankDeposits || []).map((d) => ({ ...d, deposit_type: "bank" })),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setDeposits(allDeposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "processed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "processed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isCryptoDeposit = (deposit: any): deposit is Deposit => {
    return (
      deposit.transaction_type === "deposit" &&
      ["BTC", "ETH", "USDT"].includes(deposit.currency)
    );
  };

  const filteredDeposits = deposits.filter((deposit) => {
    const matchesSearch =
      deposit.currency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (isCryptoDeposit(deposit) &&
        deposit.wallet_address
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (isCryptoDeposit(deposit) &&
        deposit.transaction_hash
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (!isCryptoDeposit(deposit) &&
        (deposit as BankDeposit).reference_number
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || deposit.status === statusFilter;

    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "crypto" && isCryptoDeposit(deposit)) ||
      (typeFilter === "bank" && !isCryptoDeposit(deposit));

    return matchesSearch && matchesStatus && matchesType;
  });

  const formatAmount = (amount: number, currency: string) => {
    if (["BTC", "ETH", "USDT"].includes(currency)) {
      const config = cryptoConfigs[currency as keyof typeof cryptoConfigs];
      return `${config.symbol}${amount.toLocaleString(undefined, {
        minimumFractionDigits:
          currency === "BTC" ? 8 : currency === "ETH" ? 6 : 2,
        maximumFractionDigits:
          currency === "BTC" ? 8 : currency === "ETH" ? 6 : 2,
      })}`;
    }
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const truncateHash = (hash: string, length = 8) => {
    if (!hash) return "N/A";
    return `${hash.slice(0, length)}...${hash.slice(-length)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ArrowDownLeft className="h-5 w-5 mr-2" />
            Deposits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 border rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <ArrowDownLeft className="h-5 w-5 mr-2" />
            Deposits
            <Badge variant="outline" className="ml-3 text-xs">
              {filteredDeposits.length} total
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeposits}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by currency, address, hash, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="crypto">Crypto Only</SelectItem>
              <SelectItem value="bank">Bank Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Deposits List */}
        {filteredDeposits.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ArrowDownLeft className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No deposits found</p>
            <p className="text-sm">Try adjusting your search criteria</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDeposits.map((deposit) => {
              const isCrypto = isCryptoDeposit(deposit);

              if (isCrypto) {
                const config =
                  cryptoConfigs[deposit.currency as keyof typeof cryptoConfigs];
                const IconComponent = config?.icon || Bitcoin;

                return (
                  <div
                    key={deposit.id}
                    className={`border rounded-lg p-4 space-y-3 ${
                      config?.borderColor || "border-gray-200"
                    } ${config?.bgColor || "bg-gray-50"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center">
                          <IconComponent
                            className={`h-6 w-6 ${
                              config?.color || "text-gray-500"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-bold text-lg">
                              {formatAmount(deposit.amount, deposit.currency)}{" "}
                              {deposit.currency}
                            </h3>
                            <Badge className={getStatusColor(deposit.status)}>
                              {deposit.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {config?.name} Deposit
                            {deposit.network &&
                              ` • ${
                                networkLabels[
                                  deposit.network as keyof typeof networkLabels
                                ] || deposit.network
                              }`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusIcon(deposit.status)}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(deposit.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Crypto-specific details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {deposit.wallet_address && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-gray-600">
                            <Wallet className="h-3 w-3" />
                            <span className="font-medium">Wallet Address</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <code className="bg-white px-2 py-1 rounded text-xs font-mono">
                              {truncateHash(deposit.wallet_address, 12)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(deposit.wallet_address!)
                              }
                              className="h-6 w-6 p-0"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {deposit.transaction_hash && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-gray-600">
                            <Hash className="h-3 w-3" />
                            <span className="font-medium">
                              Transaction Hash
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <code className="bg-white px-2 py-1 rounded text-xs font-mono">
                              {truncateHash(deposit.transaction_hash, 12)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(deposit.transaction_hash!)
                              }
                              className="h-6 w-6 p-0"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {deposit.network && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-gray-600">
                            <Network className="h-3 w-3" />
                            <span className="font-medium">Network</span>
                          </div>
                          <div className="text-sm">
                            {networkLabels[
                              deposit.network as keyof typeof networkLabels
                            ] || deposit.network}
                          </div>
                        </div>
                      )}

                      {typeof deposit.confirmation_count !== "undefined" &&
                        typeof deposit.required_confirmations !==
                          "undefined" && (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1 text-gray-600">
                              <CheckCircle className="h-3 w-3" />
                              <span className="font-medium">Confirmations</span>
                            </div>
                            <div className="text-sm">
                              {deposit.confirmation_count} /{" "}
                              {deposit.required_confirmations}
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(
                                      (deposit.confirmation_count /
                                        deposit.required_confirmations) *
                                        100,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
              } else {
                // Bank deposit
                const bankDeposit = deposit as BankDeposit;
                return (
                  <div
                    key={bankDeposit.id}
                    className="border rounded-lg p-4 space-y-3 border-blue-200 bg-blue-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-white border-2 flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-bold text-lg">
                              {formatAmount(
                                bankDeposit.amount,
                                bankDeposit.currency
                              )}
                            </h3>
                            <Badge
                              className={getStatusColor(bankDeposit.status)}
                            >
                              {bankDeposit.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            Bank Deposit • {bankDeposit.deposit_method}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusIcon(bankDeposit.status)}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(bankDeposit.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Bank-specific details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Hash className="h-3 w-3" />
                          <span className="font-medium">Reference Number</span>
                        </div>
                        <code className="bg-white px-2 py-1 rounded text-xs font-mono">
                          {bankDeposit.reference_number}
                        </code>
                      </div>

                      {bankDeposit.processed_at && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-gray-600">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">Processed At</span>
                          </div>
                          <div className="text-sm">
                            {new Date(
                              bankDeposit.processed_at
                            ).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
