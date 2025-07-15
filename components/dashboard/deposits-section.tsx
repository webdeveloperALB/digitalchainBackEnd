"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Wallet,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  Copy,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Deposit {
  id: string;
  user_id: string;
  currency: string;
  amount: number;
  method: string;
  reference_id: string;
  status: string;
  bank_details?: any;
  crypto_details?: any;
  created_at: string;
  updated_at: string;
  admin_notes?: string;
}

export default function ClientDepositsView() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  useEffect(() => {
    fetchDeposits();

    // Set up real-time subscription for deposits
    const subscription = supabase
      .channel("client_deposits_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposits",
        },
        (payload) => {
          console.log("Client deposit change received:", payload);
          fetchDeposits();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchDeposits = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("deposits")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setDeposits(data || []);
      }
    } catch (error) {
      console.error("Error fetching deposits:", error);
      setMessage({ type: "error", text: "Failed to load deposits" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: "success", text: "Copied to clipboard!" });
    setTimeout(() => setMessage(null), 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
      case "Completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "Pending Review":
      case "Pending Confirmation":
      case "Pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "Rejected":
      case "Failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
      case "Completed":
        return "text-green-600 bg-green-50 border-green-200";
      case "Pending Review":
      case "Pending Confirmation":
      case "Pending":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "Rejected":
      case "Failed":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto max-h-screen">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto max-h-screen">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">My Deposits</h2>
          <Badge variant="outline" className="text-sm">
            Real-time Updates
          </Badge>
        </div>

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

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Information:</strong> Deposits are processed by our admin
            team. You will see deposits appear here when they are processed for
            your account. All deposits are handled securely and will reflect in
            your balance once approved.
          </AlertDescription>
        </Alert>

        {/* Deposit History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="w-5 h-5 mr-2" />
              Deposit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Download className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">No deposits yet</h3>
                <p className="text-sm">
                  Deposits processed by our admin team will appear here
                  automatically.
                </p>
                <p className="text-xs mt-2 text-gray-400">
                  Contact support if you're expecting a deposit that hasn't
                  appeared.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="border rounded-lg p-6 space-y-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-bold text-xl">
                            {Number(deposit.amount).toLocaleString()}{" "}
                            {deposit.currency}
                          </h3>
                          <Badge
                            className={`text-sm ${getStatusColor(
                              deposit.status
                            )}`}
                          >
                            {getStatusIcon(deposit.status)}
                            <span className="ml-2">{deposit.status}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center text-gray-600">
                          {deposit.method === "Bank Transfer" ? (
                            <Building className="w-4 h-4 mr-2" />
                          ) : (
                            <Wallet className="w-4 h-4 mr-2" />
                          )}
                          <span className="font-medium">{deposit.method}</span>
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                          <p>Reference: {deposit.reference_id}</p>
                          <p>
                            Processed:{" "}
                            {new Date(deposit.created_at).toLocaleString()}
                          </p>
                          {deposit.updated_at !== deposit.created_at && (
                            <p>
                              Updated:{" "}
                              {new Date(deposit.updated_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(deposit.reference_id)}
                        className="shrink-0"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Ref
                      </Button>
                    </div>

                    {/* Bank Deposit Details */}
                    {deposit.bank_details && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                          <Building className="w-4 h-4 mr-2" />
                          Bank Transfer Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {deposit.bank_details.bank_name && (
                            <div>
                              <span className="font-medium text-blue-800">
                                Bank Name:
                              </span>
                              <p className="text-blue-700">
                                {deposit.bank_details.bank_name}
                              </p>
                            </div>
                          )}
                          {deposit.bank_details.account_holder_name && (
                            <div>
                              <span className="font-medium text-blue-800">
                                Account Holder:
                              </span>
                              <p className="text-blue-700">
                                {deposit.bank_details.account_holder_name}
                              </p>
                            </div>
                          )}
                          {deposit.bank_details.account_number && (
                            <div>
                              <span className="font-medium text-blue-800">
                                Account Number:
                              </span>
                              <p className="text-blue-700 font-mono">
                                ****
                                {deposit.bank_details.account_number.slice(-4)}
                              </p>
                            </div>
                          )}
                          {deposit.bank_details.routing_number && (
                            <div>
                              <span className="font-medium text-blue-800">
                                Routing Number:
                              </span>
                              <p className="text-blue-700 font-mono">
                                {deposit.bank_details.routing_number}
                              </p>
                            </div>
                          )}
                          {deposit.bank_details.swift_code && (
                            <div>
                              <span className="font-medium text-blue-800">
                                SWIFT Code:
                              </span>
                              <p className="text-blue-700 font-mono">
                                {deposit.bank_details.swift_code}
                              </p>
                            </div>
                          )}
                          {deposit.bank_details.iban && (
                            <div>
                              <span className="font-medium text-blue-800">
                                IBAN:
                              </span>
                              <p className="text-blue-700 font-mono">
                                {deposit.bank_details.iban}
                              </p>
                            </div>
                          )}
                          {deposit.bank_details.bank_address && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-blue-800">
                                Bank Address:
                              </span>
                              <p className="text-blue-700">
                                {deposit.bank_details.bank_address}
                              </p>
                            </div>
                          )}
                          {deposit.bank_details.wire_reference && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-blue-800">
                                Wire Reference:
                              </span>
                              <p className="text-blue-700 font-mono">
                                {deposit.bank_details.wire_reference}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Crypto Deposit Details */}
                    {deposit.crypto_details && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                          <Wallet className="w-4 h-4 mr-2" />
                          Cryptocurrency Transfer Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {deposit.crypto_details.cryptocurrency && (
                            <div>
                              <span className="font-medium text-purple-800">
                                Cryptocurrency:
                              </span>
                              <p className="text-purple-700 font-mono">
                                {deposit.crypto_details.cryptocurrency}
                              </p>
                            </div>
                          )}
                          {deposit.crypto_details.network && (
                            <div>
                              <span className="font-medium text-purple-800">
                                Network:
                              </span>
                              <p className="text-purple-700">
                                {deposit.crypto_details.network}
                              </p>
                            </div>
                          )}
                          {deposit.crypto_details.from_wallet && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-purple-800">
                                From Wallet:
                              </span>
                              <p className="text-purple-700 font-mono text-xs break-all">
                                {deposit.crypto_details.from_wallet}
                              </p>
                            </div>
                          )}
                          {deposit.crypto_details.to_wallet && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-purple-800">
                                To Wallet:
                              </span>
                              <p className="text-purple-700 font-mono text-xs break-all">
                                {deposit.crypto_details.to_wallet}
                              </p>
                            </div>
                          )}
                          {deposit.crypto_details.transaction_hash && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-purple-800">
                                Transaction Hash:
                              </span>
                              <p className="text-purple-700 font-mono text-xs break-all">
                                {deposit.crypto_details.transaction_hash}
                              </p>
                            </div>
                          )}
                          {deposit.crypto_details.block_confirmations && (
                            <div>
                              <span className="font-medium text-purple-800">
                                Confirmations:
                              </span>
                              <p className="text-purple-700">
                                {deposit.crypto_details.block_confirmations}
                              </p>
                            </div>
                          )}
                          {deposit.crypto_details.gas_fee && (
                            <div>
                              <span className="font-medium text-purple-800">
                                Gas Fee:
                              </span>
                              <p className="text-purple-700">
                                {deposit.crypto_details.gas_fee}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Admin Notes */}
                    {deposit.admin_notes && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Admin Notes:
                        </h4>
                        <p className="text-gray-700 text-sm">
                          {deposit.admin_notes}
                        </p>
                      </div>
                    )}

                    {/* Status Information */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-xs text-gray-500">
                        {deposit.status === "Approved" &&
                          "✅ Deposit approved and added to your balance"}
                        {deposit.status === "Pending Review" &&
                          "⏳ Deposit is being reviewed by our team"}
                        {deposit.status === "Pending Confirmation" &&
                          "⏳ Waiting for blockchain confirmation"}
                        {deposit.status === "Rejected" &&
                          "❌ Deposit was rejected - contact support"}
                        {deposit.status === "Failed" &&
                          "❌ Deposit failed - contact support"}
                      </div>
                      {deposit.status === "Approved" && (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-300"
                        >
                          Balance Updated
                        </Badge>
                      )}
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
