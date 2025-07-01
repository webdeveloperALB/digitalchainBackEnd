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
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Wallet,
  Network,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Add custom scrollbar hiding styles
const scrollbarHideStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* Internet Explorer 10+ */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;  /* Safari and Chrome */
  }
`;

// Inject styles into document head
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = scrollbarHideStyles;
  if (!document.head.querySelector("style[data-scrollbar-hide]")) {
    styleElement.setAttribute("data-scrollbar-hide", "true");
    document.head.appendChild(styleElement);
  }
}

interface CryptoTransaction {
  id: string;
  user_id: string;
  crypto_type: string;
  transaction_type: string;
  amount: number;
  price_per_unit: number;
  total_value: number;
  wallet_address: string;
  status: string;
  created_at: string;
}

export default function CryptoTransferSection() {
  const [cryptoTransactions, setCryptoTransactions] = useState<
    CryptoTransaction[]
  >([]);
  const [cryptoBalance, setCryptoBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<CryptoTransaction[]>(
    []
  );
  const [dismissedNotifications, setDismissedNotifications] = useState<
    string[]
  >([]);

  const [formData, setFormData] = useState({
    recipient_address: "",
    crypto_type: "",
    amount: "",
    fee: "",
    label: "",
  });

  const networks = [
    {
      value: "ETH",
      label: "Ethereum",
      symbol: "ETH",
      fee: "0.002",
      color: "bg-blue-500",
    },
    {
      value: "BSC",
      label: "Binance Smart Chain",
      symbol: "BNB",
      fee: "0.0005",
      color: "bg-yellow-500",
    },
    {
      value: "TRX",
      label: "Tron",
      symbol: "TRX",
      fee: "1.0",
      color: "bg-red-500",
    },
    {
      value: "BTC",
      label: "Bitcoin",
      symbol: "BTC",
      fee: "0.0001",
      color: "bg-orange-500",
    },
    {
      value: "MATIC",
      label: "Polygon",
      symbol: "MATIC",
      fee: "0.001",
      color: "bg-purple-500",
    },
    {
      value: "AVAX",
      label: "Avalanche",
      symbol: "AVAX",
      fee: "0.001",
      color: "bg-red-400",
    },
  ];

  useEffect(() => {
    fetchCryptoTransactions();
    fetchCryptoBalance();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    // Update pending transfers when transactions change
    const pending = cryptoTransactions.filter(
      (tx) => tx.status.toLowerCase() === "pending"
    );
    setPendingTransfers(pending);
  }, [cryptoTransactions]);

  const fetchCryptoBalance = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("crypto_balances")
          .select("balance")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;
        setCryptoBalance(Number(data?.balance) || 0);
      }
    } catch (error) {
      console.error("Error fetching crypto balance:", error);
    }
  };

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
          .eq("transaction_type", "Transfer")
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

  const setupRealtimeSubscription = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Subscribe to crypto transaction changes
    const transactionSubscription = supabase
      .channel("crypto_transaction_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Transaction status changed:", payload);
          fetchCryptoTransactions();

          // If a transaction was completed, show a notification
          if (
            payload.eventType === "UPDATE" &&
            payload.new.status === "Completed"
          ) {
            // Remove from dismissed notifications so it shows again
            setDismissedNotifications((prev) =>
              prev.filter((id) => id !== payload.new.id)
            );
          }
        }
      )
      .subscribe();

    // Subscribe to crypto balance changes
    const balanceSubscription = supabase
      .channel("crypto_balance_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crypto_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCryptoBalance();
        }
      )
      .subscribe();

    return () => {
      transactionSubscription.unsubscribe();
      balanceSubscription.unsubscribe();
    };
  };

  const handleNetworkChange = (cryptoType: string) => {
    const selectedNetwork = networks.find((n) => n.value === cryptoType);
    setFormData({
      ...formData,
      crypto_type: cryptoType,
      fee: selectedNetwork?.fee || "",
    });
  };

  const submitTransfer = async () => {
    try {
      setSubmitting(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User not authenticated");
        return;
      }

      const amount = Number.parseFloat(formData.amount);
      const fee = Number.parseFloat(formData.fee);
      const totalAmount = amount + fee;

      // Check if user has sufficient balance
      if (totalAmount > cryptoBalance) {
        alert("Insufficient crypto balance for this transfer");
        return;
      }

      // Use the database function to process transfer
      const { data, error } = await supabase.rpc("process_crypto_transfer", {
        p_user_id: user.id,
        p_crypto_type: formData.crypto_type,
        p_amount: amount,
        p_fee: fee,
        p_total_amount: totalAmount,
        p_wallet_address: formData.recipient_address,
        p_current_balance: cryptoBalance,
      });

      if (error) {
        console.error("Transfer processing error:", error);
        alert(`Error processing transfer: ${error.message}`);
        return;
      }

      // Update local state
      setCryptoBalance(cryptoBalance - totalAmount);

      // Add to general transactions for tracking
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "Crypto Transfer",
        amount: totalAmount,
        currency: "CRYPTO",
        description: `Transfer ${amount} ${
          formData.crypto_type
        } to ${formData.recipient_address.substring(0, 10)}...${
          formData.label ? ` - ${formData.label}` : ""
        }`,
        platform: "Digital Chain Bank Crypto",
        status: "Pending",
      });

      // Reset form and show success message
      setFormData({
        recipient_address: "",
        crypto_type: "",
        amount: "",
        fee: "",
        label: "",
      });
      setShowTransferForm(false);
      setShowSuccessMessage(true);

      // Refresh data
      fetchCryptoTransactions();
      fetchCryptoBalance();

      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccessMessage(false), 5000);
    } catch (error: any) {
      console.error("Submit transfer error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const dismissNotification = (transactionId: string) => {
    setDismissedNotifications((prev) => [...prev, transactionId]);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "completed":
        return "text-green-600 bg-green-50 border-green-200";
      case "failed":
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const selectedNetwork = networks.find(
    (n) => n.value === formData.crypto_type
  );
  const amount = Number.parseFloat(formData.amount) || 0;
  const fee = Number.parseFloat(formData.fee) || 0;
  const totalAmount = amount + fee;

  // Get active notifications (not dismissed)
  const activeNotifications = cryptoTransactions.filter(
    (tx) =>
      !dismissedNotifications.includes(tx.id) &&
      (tx.status.toLowerCase() === "pending" ||
        tx.status.toLowerCase() === "completed")
  );

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading crypto transfer data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-white scrollbar-hide">
      {/* Success Message - Fixed Position */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <Alert className="border-green-200 bg-green-50 shadow-lg max-w-md">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Transfer Request Submitted!</strong>
              <br />
              Your crypto transfer request has been received and is currently
              under review.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Persistent Status Notifications */}
      {activeNotifications.length > 0 && (
        <div className="fixed top-20 right-4 z-40 space-y-2 max-w-sm">
          {activeNotifications.slice(0, 3).map((transaction) => (
            <div
              key={transaction.id}
              className={`p-4 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300 ${
                transaction.status.toLowerCase() === "pending"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className="mt-0.5">
                    {transaction.status.toLowerCase() === "pending" ? (
                      <Clock className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        transaction.status.toLowerCase() === "pending"
                          ? "text-yellow-800"
                          : "text-green-800"
                      }`}
                    >
                      {transaction.status.toLowerCase() === "pending"
                        ? "Transfer Under Review"
                        : "Transfer Approved"}
                    </p>
                    <p
                      className={`text-xs ${
                        transaction.status.toLowerCase() === "pending"
                          ? "text-yellow-700"
                          : "text-green-700"
                      }`}
                    >
                      {Number(transaction.total_value).toLocaleString()} CRYPTO
                      to {transaction.wallet_address?.substring(0, 8)}...
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissNotification(transaction.id)}
                  className="h-6 w-6 p-0 hover:bg-transparent"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content - Scrollable */}
      <div className="p-6">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-gray-900">
                Crypto Transfer
              </h2>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-gray-500" />
                <p className="text-gray-600">
                  Available Balance:{" "}
                  <span className="font-semibold text-gray-900">
                    {cryptoBalance.toLocaleString()} CRYPTO
                  </span>
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowTransferForm(true)}
              className="bg-[#F26623] hover:bg-[#E55A1F] text-white px-6 py-2 h-auto"
              disabled={cryptoBalance <= 0}
            >
              <Send className="w-4 h-4 mr-2" />
              New Transfer
            </Button>
          </div>

          {/* Transfer Form - Inline when shown */}
          {showTransferForm && (
            <Card className="animate-in slide-in-from-top duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <Send className="w-6 h-6 text-[#F26623]" />
                  New Crypto Transfer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recipient Address */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Recipient Address *
                  </Label>
                  <Input
                    value={formData.recipient_address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        recipient_address: e.target.value,
                      })
                    }
                    placeholder="Enter wallet address (e.g., 0x1234...abcd)"
                    className="font-mono text-sm h-12"
                  />
                </div>

                {/* Network Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    Network *
                  </Label>
                  <Select
                    value={formData.crypto_type}
                    onValueChange={handleNetworkChange}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select blockchain network" />
                    </SelectTrigger>
                    <SelectContent>
                      {networks.map((network) => (
                        <SelectItem key={network.value} value={network.value}>
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-3 h-3 rounded-full ${network.color}`}
                            ></div>
                            <span>{network.label}</span>
                            <span className="text-gray-500">
                              ({network.symbol})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount and Fee */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Amount *</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.00000001"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        placeholder="0.00000000"
                        className="h-12 pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        CRYPTO
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Network Fee (Gas) *
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.00000001"
                        value={formData.fee}
                        onChange={(e) =>
                          setFormData({ ...formData, fee: e.target.value })
                        }
                        placeholder="0.00000000"
                        className="h-12 pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        CRYPTO
                      </div>
                    </div>
                  </div>
                </div>

                {/* Label/Note */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Label / Note (Optional)
                  </Label>
                  <Textarea
                    value={formData.label}
                    onChange={(e) =>
                      setFormData({ ...formData, label: e.target.value })
                    }
                    placeholder="Add a note for this transfer..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Transfer Summary */}
                {amount > 0 && fee > 0 && (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Transfer Summary
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Transfer Amount:
                        </span>
                        <span className="font-medium">
                          {amount.toLocaleString()} CRYPTO
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Network Fee:
                        </span>
                        <span className="font-medium">
                          {fee.toLocaleString()} CRYPTO
                        </span>
                      </div>
                      {selectedNetwork && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Network:
                          </span>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${selectedNetwork.color}`}
                            ></div>
                            <span className="font-medium">
                              {selectedNetwork.label}
                            </span>
                          </div>
                        </div>
                      )}
                      <hr className="my-2" />
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">
                          Total Amount:
                        </span>
                        <span className="text-lg font-bold text-[#F26623]">
                          {totalAmount.toLocaleString()} CRYPTO
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Insufficient Balance Warning */}
                {totalAmount > cryptoBalance && totalAmount > 0 && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      Insufficient balance. You need{" "}
                      {totalAmount.toLocaleString()} CRYPTO but only have{" "}
                      {cryptoBalance.toLocaleString()} CRYPTO available.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={submitTransfer}
                    className="bg-[#F26623] hover:bg-[#E55A1F] text-white h-12 px-8"
                    disabled={
                      !formData.recipient_address ||
                      !formData.crypto_type ||
                      !formData.amount ||
                      !formData.fee ||
                      submitting ||
                      totalAmount > cryptoBalance
                    }
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Transfer
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowTransferForm(false)}
                    disabled={submitting}
                    className="h-12 px-6"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transfer History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                Transfer History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cryptoTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">
                    No crypto transfers yet
                  </p>
                  <p className="text-gray-400 text-sm">
                    Your transfer history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cryptoTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transaction.status)}
                          <p className="font-medium text-gray-900">
                            Transfer to{" "}
                            {transaction.wallet_address?.substring(0, 10)}...
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span>Network: {transaction.crypto_type}</span>
                          <span>
                            Amount:{" "}
                            {Number(transaction.amount).toLocaleString()} CRYPTO
                          </span>
                          <span>
                            Total:{" "}
                            {Number(transaction.total_value).toLocaleString()}{" "}
                            CRYPTO
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-3 sm:mt-0">
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            -{Number(transaction.total_value).toLocaleString()}{" "}
                            CRYPTO
                          </p>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </div>
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
