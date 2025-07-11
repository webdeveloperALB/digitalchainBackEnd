"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  Calculator,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Building2,
  Receipt,
  Banknote,
  ChevronRight,
} from "lucide-react";

interface Tax {
  id: string;
  client_id: string;
  user_id: string | null;
  tax_type: string;
  tax_name: string;
  tax_rate: number;
  tax_amount: number;
  taxable_income: number;
  tax_period: string;
  due_date: string | null;
  status: string;
  description: string | null;
  tax_year: number;
  is_active: boolean;
  is_estimated: boolean;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface TaxCardProps {
  userProfile: {
    id: string;
    client_id: string;
    full_name: string | null;
    email: string | null;
  };
  setActiveTab: (tab: string) => void;
}

export default function TaxCard({ userProfile, setActiveTab }: TaxCardProps) {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTaxOwed, setTotalTaxOwed] = useState(0);
  const [upcomingDue, setUpcomingDue] = useState<Tax | null>(null);

  useEffect(() => {
    fetchTaxes();
    setupTaxSubscription();
  }, [userProfile]);

  const fetchTaxes = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Query taxes using both user_id and client_id for comprehensive coverage
      const { data, error } = await supabase
        .from("taxes")
        .select("*")
        .or(`user_id.eq.${user.id},client_id.eq.${userProfile.client_id}`)
        .eq("is_active", true)
        .order("due_date", { ascending: true });

      if (error) {
        console.error("Error fetching taxes:", error);
        return;
      }

      const activeTaxes = data || [];
      setTaxes(activeTaxes);

      // Calculate total tax owed (pending + overdue)
      const totalOwed = activeTaxes
        .filter((tax) => tax.status === "pending" || tax.status === "overdue")
        .reduce((sum, tax) => sum + Number(tax.tax_amount), 0);
      setTotalTaxOwed(totalOwed);

      // Find next upcoming due date (only pending taxes with future due dates)
      const today = new Date();
      const upcoming = activeTaxes
        .filter((tax) => {
          if (tax.status !== "pending") return false;
          if (!tax.due_date) return false; // Filter out null due dates
          const dueDate = new Date(tax.due_date);
          return dueDate >= today;
        })
        .sort((a, b) => {
          // Both due_date values are guaranteed to be non-null here
          return (
            new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
          );
        })[0];

      setUpcomingDue(upcoming || null);
    } catch (error) {
      console.error("Error fetching taxes:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupTaxSubscription = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Set up real-time subscription for taxes table
    const subscription = supabase
      .channel(`taxes_realtime_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "taxes",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Tax change detected for user:", payload);
          fetchTaxes();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "taxes",
          filter: `client_id=eq.${userProfile.client_id}`,
        },
        (payload) => {
          console.log("Tax change detected for client:", payload);
          fetchTaxes();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const getTaxIcon = (taxType: string) => {
    switch (taxType) {
      case "income":
        return <DollarSign className="h-4 w-4" />;
      case "property":
        return <Building2 className="h-4 w-4" />;
      case "sales":
        return <Receipt className="h-4 w-4" />;
      case "capital_gains":
        return <TrendingUp className="h-4 w-4" />;
      case "corporate":
        return <Building2 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-3 w-3" />;
      case "pending":
        return <Clock className="h-3 w-3" />;
      case "overdue":
        return <AlertTriangle className="h-3 w-3" />;
      case "processing":
        return <Clock className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No due date";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getTaxPeriodDisplay = (period: string) => {
    switch (period) {
      case "yearly":
        return "Annual";
      case "quarterly":
        return "Quarterly";
      case "monthly":
        return "Monthly";
      default:
        return period.charAt(0).toUpperCase() + period.slice(1);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-gray-100 border-0 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Tax Overview</span>
          </div>
          <Badge className="bg-white/20 text-white border-white/30">
            {new Date().getFullYear()}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Tax Summary */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Tax Owed
                </p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(totalTaxOwed)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {
                    taxes.filter(
                      (tax) =>
                        tax.status === "pending" || tax.status === "overdue"
                    ).length
                  }{" "}
                  obligations
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Banknote className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          {upcomingDue && (
            <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Next Due</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {upcomingDue.tax_name}
                  </p>
                  <p className="text-sm text-orange-600 font-medium">
                    Due {formatDate(upcomingDue.due_date)}
                    {upcomingDue.due_date &&
                      getDaysUntilDue(upcomingDue.due_date) !== null &&
                      getDaysUntilDue(upcomingDue.due_date)! <= 30 && (
                        <span className="ml-1">
                          ({getDaysUntilDue(upcomingDue.due_date)} days)
                        </span>
                      )}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tax List */}
        <div className="space-y-3">
          <h4 className="font-semibold text-gray-800 flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            Active Tax Obligations
          </h4>

          {taxes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No active tax obligations</p>
              <p className="text-xs">Your tax information will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {taxes.slice(0, 5).map((tax) => (
                <div
                  key={tax.id}
                  className="bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        {getTaxIcon(tax.tax_type)}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-800">
                          {tax.tax_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(tax.tax_rate * 100).toFixed(2)}% •{" "}
                          {getTaxPeriodDisplay(tax.tax_period)}
                          {tax.is_estimated && (
                            <span className="ml-1 text-blue-600">
                              • Estimated
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-gray-800">
                        {formatCurrency(tax.tax_amount)}
                      </p>
                      <Badge
                        className={`text-xs ${getStatusColor(tax.status)}`}
                      >
                        {getStatusIcon(tax.status)}
                        <span className="ml-1 capitalize">{tax.status}</span>
                      </Badge>
                    </div>
                  </div>

                  {tax.due_date && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Due: {formatDate(tax.due_date)}</span>
                        <span>Tax Year: {tax.tax_year}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {taxes.length > 5 && (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-500">
                    +{taxes.length - 5} more tax obligations
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={() => setActiveTab("taxes")}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white"
        >
          <span>View All Tax Details</span>
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
