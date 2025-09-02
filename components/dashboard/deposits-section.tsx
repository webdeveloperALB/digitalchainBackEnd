"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  MapPin,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserProfile {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

interface DepositsSectionProps {
  userProfile: UserProfile;
}

interface Deposit {
  id: number;
  created_at: string;
  thType: string;
  thDetails: string;
  thPoi: string;
  thStatus: string;
  uuid: string;
  thEmail: string;
}

export default function ClientDepositsView({
  userProfile,
}: DepositsSectionProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  useEffect(() => {
    if (userProfile?.id) {
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
            filter: `uuid=eq.${userProfile.id}`,
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
    }
  }, [userProfile?.id]);

  const fetchDeposits = async () => {
    if (!userProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from("deposits")
        .select("*")
        .eq("uuid", userProfile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeposits(data || []);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      setMessage({ type: "error", text: "Failed to load transaction history" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "successful":
      case "completed":
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "pending":
      case "processing":
      case "under review":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "failed":
      case "rejected":
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "successful":
      case "completed":
      case "approved":
        return "text-green-600 bg-green-50 border-green-200";
      case "pending":
      case "processing":
      case "under review":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "failed":
      case "rejected":
      case "cancelled":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "external deposit":
      case "deposit":
        return <Download className="w-4 h-4 text-blue-600" />;
      case "withdrawal":
        return <Building className="w-4 h-4 text-purple-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto max-h-screen">
        <div className="p-3 sm:p-4 md:p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/2 sm:w-1/4"></div>
            <div className="h-24 sm:h-32 bg-gray-200 rounded"></div>
            <div className="h-48 sm:h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto max-h-screen">
      <div className="p-4 pt-20 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          <h2 className="text-xl sm:text-2xl font-bold">Transaction History</h2>
          <Badge variant="outline" className="text-xs sm:text-sm w-fit">
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
              className={`text-sm ${
                message.type === "error" ? "text-red-700" : "text-green-700"
              }`}
            >
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <AlertDescription className="text-sm">
            <strong>Information:</strong> Transaction history shows all
            financial activities processed for your account. Transactions are
            monitored and processed by regulatory authorities for compliance
            purposes.
          </AlertDescription>
        </Alert>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {deposits.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-500">
                <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-30" />
                <h3 className="text-base sm:text-lg font-medium mb-2">
                  No transaction history
                </h3>
                <p className="text-sm px-4">
                  Transaction records will appear here when activities are
                  processed for your account.
                </p>
                <p className="text-xs mt-2 text-gray-400 px-4">
                  Contact support if you have questions about your account
                  activity.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="border rounded-lg p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(deposit.thType)}
                            <h3 className="font-bold text-lg sm:text-xl break-words">
                              {deposit.thType}
                            </h3>
                          </div>
                          <Badge
                            className={`text-xs sm:text-sm w-fit ${getStatusColor(
                              deposit.thStatus
                            )}`}
                          >
                            {getStatusIcon(deposit.thStatus)}
                            <span className="ml-2">{deposit.thStatus}</span>
                          </Badge>
                        </div>

                        <div className="text-xs sm:text-sm text-gray-500">
                          <p>
                            Processed:{" "}
                            {new Date(deposit.created_at).toLocaleString()}
                          </p>
                          {deposit.thEmail && (
                            <p className="break-words">
                              Email: {deposit.thEmail}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="bg-[#F26623] border border-orange-200 rounded-lg p-3 sm:p-4">
                      <h4 className="font-semibold text-white mb-3 flex items-center text-sm sm:text-base">
                        <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                        Transaction Details
                      </h4>
                      <div className="space-y-3">
                        <div className="break-words">
                          <span className="font-medium text-white block mb-1">
                            Description:
                          </span>
                          <p className="text-white text-xs sm:text-sm leading-relaxed">
                            {deposit.thDetails}
                          </p>
                        </div>

                        {deposit.thPoi && (
                          <div className="break-words">
                            <span className="font-medium text-white block mb-1 flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              Point of Interest:
                            </span>
                            <p className="text-white text-xs sm:text-sm">
                              {deposit.thPoi}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Information */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
                      <div className="text-xs text-gray-500 break-words">
                        {deposit.thStatus.toLowerCase() === "successful" &&
                          "✅ Transaction completed successfully"}
                        {deposit.thStatus.toLowerCase() === "pending" &&
                          "⏳ Transaction is being processed"}
                        {deposit.thStatus.toLowerCase() === "failed" &&
                          "❌ Transaction failed - contact support"}
                        {!["successful", "pending", "failed"].includes(
                          deposit.thStatus.toLowerCase()
                        ) && `Status: ${deposit.thStatus}`}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs w-fit text-gray-600 border-gray-300"
                      >
                        ID: {deposit.id}
                      </Badge>
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
