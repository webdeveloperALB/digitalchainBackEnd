"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  Plus,
  Trash2,
  Edit,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  DollarSign,
  Euro,
  MapIcon as Maple,
  Bitcoin,
  Coins,
  Shield,
  Building2,
  Info,
  Send,
  Banknote,
  FileText,
  ArrowUpRight,
} from "lucide-react";

interface ActivityManagerProps {
  userProfile: {
    id: string;
    client_id: string;
    full_name: string | null;
    email: string | null;
  };
}

interface AccountActivity {
  id: string;
  user_id: string;
  client_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  currency: string;
  display_amount: number;
  status: string;
  priority: string;
  is_read: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  metadata: any;
}

interface Transfer {
  id: string;
  user_id: string;
  client_id: string;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  exchange_rate: number;
  status: string;
  transfer_type: string;
  description?: string;
  created_at: string;
}

interface CombinedActivity {
  id: string;
  type: "transfer" | "account_activity";
  created_at: string;
  data: Transfer | AccountActivity;
}

// Define allowed currencies - only USD, EUR, CAD, BTC, ETH, USDT
const ALLOWED_CURRENCIES = {
  traditional: [
    { value: "usd", label: "USD", symbol: "$", icon: DollarSign },
    { value: "euro", label: "EUR", symbol: "€", icon: Euro },
    { value: "cad", label: "CAD", symbol: "C$", icon: Maple },
  ],
  crypto: [
    { value: "BTC", label: "Bitcoin", symbol: "₿", icon: Bitcoin },
    { value: "ETH", label: "Ethereum", symbol: "Ξ", icon: Coins },
    { value: "USDT", label: "Tether", symbol: "₮", icon: Shield },
  ],
};

const ALL_CURRENCIES = [
  ...ALLOWED_CURRENCIES.traditional,
  ...ALLOWED_CURRENCIES.crypto,
];

const ACTIVITY_TYPES = [
  { value: "admin_notification", label: "Admin Notification" },
  { value: "system_update", label: "System Update" },
  { value: "security_alert", label: "Security Alert" },
  { value: "account_notice", label: "Account Notice" },
  { value: "service_announcement", label: "Service Announcement" },
  { value: "account_credit", label: "Account Credit" },
  { value: "account_debit", label: "Account Debit" },
  { value: "wire_transfer", label: "Wire Transfer" },
  { value: "fraud_alert", label: "Fraud Alert" },
  { value: "statement_ready", label: "Statement Ready" },
];

const PRIORITY_LEVELS = [
  { value: "low", label: "Low", color: "bg-gray-100 text-gray-800" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-800" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800" },
];

export default function ActivityManager({ userProfile }: ActivityManagerProps) {
  const [activities, setActivities] = useState<AccountActivity[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [combinedActivities, setCombinedActivities] = useState<
    CombinedActivity[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingActivity, setEditingActivity] =
    useState<AccountActivity | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    activity_type: "",
    title: "",
    description: "",
    currency: "usd",
    display_amount: "",
    priority: "normal",
    expires_at: "",
  });

  // Fetch activities and transfers
  useEffect(() => {
    fetchActivities();
    fetchTransfers();
  }, [userProfile.id]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("account_activities")
        .select("*")
        .or(
          `user_id.eq.${userProfile.id},client_id.eq.${userProfile.client_id}`
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter activities to only include allowed currencies
      const filteredActivities = (data || []).filter((activity) =>
        ALL_CURRENCIES.some((currency) => currency.value === activity.currency)
      );

      setActivities(filteredActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      setError("Failed to fetch activities");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const { data, error } = await supabase
        .from("transfers")
        .select("*")
        .or(
          `user_id.eq.${userProfile.id},client_id.eq.${userProfile.client_id}`
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filter transfers to only include allowed currencies
      const filteredTransfers = (data || []).filter(
        (transfer) =>
          ALL_CURRENCIES.some(
            (currency) => currency.value === transfer.from_currency
          ) ||
          ALL_CURRENCIES.some(
            (currency) => currency.value === transfer.to_currency
          )
      );

      setTransfers(filteredTransfers);

      // Combine activities and transfers
      const combined: CombinedActivity[] = [
        ...activities.map((activity) => ({
          id: activity.id,
          type: "account_activity" as const,
          created_at: activity.created_at,
          data: activity,
        })),
        ...filteredTransfers.map((transfer) => ({
          id: transfer.id,
          type: "transfer" as const,
          created_at: transfer.created_at,
          data: transfer,
        })),
      ];

      // Sort by created_at descending
      const sortedCombined = combined.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setCombinedActivities(sortedCombined);
    } catch (error) {
      console.error("Error fetching transfers:", error);
    }
  };

  // Update combined activities when activities change
  useEffect(() => {
    const combined: CombinedActivity[] = [
      ...activities.map((activity) => ({
        id: activity.id,
        type: "account_activity" as const,
        created_at: activity.created_at,
        data: activity,
      })),
      ...transfers.map((transfer) => ({
        id: transfer.id,
        type: "transfer" as const,
        created_at: transfer.created_at,
        data: transfer,
      })),
    ];

    const sortedCombined = combined.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setCombinedActivities(sortedCombined);
  }, [activities, transfers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const activityData = {
        user_id: userProfile.id,
        client_id: userProfile.client_id,
        activity_type: formData.activity_type,
        title: formData.title,
        description: formData.description || null,
        currency: formData.currency,
        display_amount: formData.display_amount
          ? Number.parseFloat(formData.display_amount)
          : 0,
        status: "active",
        priority: formData.priority,
        is_read: false,
        created_by: userProfile.id,
        expires_at: formData.expires_at || null,
        metadata: {},
      };

      if (editingActivity) {
        const { error } = await supabase
          .from("account_activities")
          .update(activityData)
          .eq("id", editingActivity.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("account_activities")
          .insert([activityData]);

        if (error) throw error;
      }

      // Reset form
      setFormData({
        activity_type: "",
        title: "",
        description: "",
        currency: "usd",
        display_amount: "",
        priority: "normal",
        expires_at: "",
      });
      setIsCreating(false);
      setEditingActivity(null);
      fetchActivities();
    } catch (error) {
      console.error("Error saving activity:", error);
      setError("Failed to save activity");
    }
  };

  const handleEdit = (activity: AccountActivity) => {
    setEditingActivity(activity);
    setFormData({
      activity_type: activity.activity_type,
      title: activity.title,
      description: activity.description || "",
      currency: activity.currency,
      display_amount: activity.display_amount.toString(),
      priority: activity.priority,
      expires_at: activity.expires_at ? activity.expires_at.split("T")[0] : "",
    });
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;

    try {
      const { error } = await supabase
        .from("account_activities")
        .delete()
        .eq("id", id);

      if (error) throw error;

      fetchActivities();
    } catch (error) {
      console.error("Error deleting activity:", error);
      setError("Failed to delete activity");
    }
  };

  const toggleStatus = async (activity: AccountActivity) => {
    try {
      const newStatus = activity.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("account_activities")
        .update({ status: newStatus })
        .eq("id", activity.id);

      if (error) throw error;

      fetchActivities();
    } catch (error) {
      console.error("Error updating status:", error);
      setError("Failed to update status");
    }
  };

  const getActivityIcon = (activity: CombinedActivity) => {
    if (activity.type === "account_activity") {
      const accountActivity = activity.data as AccountActivity;
      switch (accountActivity.activity_type) {
        case "admin_notification":
          return <Building2 className="h-5 w-5" />;
        case "system_update":
          return <Activity className="h-5 w-5" />;
        case "security_alert":
          return <AlertTriangle className="h-5 w-5" />;
        case "account_notice":
          return <Info className="h-5 w-5" />;
        case "service_announcement":
          return <Send className="h-5 w-5" />;
        case "account_credit":
          return <Banknote className="h-5 w-5" />;
        case "account_debit":
          return <Banknote className="h-5 w-5" />;
        case "wire_transfer":
          return <ArrowUpRight className="h-5 w-5" />;
        case "fraud_alert":
          return <Shield className="h-5 w-5" />;
        case "statement_ready":
          return <FileText className="h-5 w-5" />;
        default:
          return <Bell className="h-5 w-5" />;
      }
    } else {
      return <ArrowUpRight className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    const priorityConfig = PRIORITY_LEVELS.find((p) => p.value === priority);
    return priorityConfig?.color || "bg-gray-100 text-gray-800";
  };

  const getCurrencyIcon = (currency: string) => {
    const currencyConfig = ALL_CURRENCIES.find((c) => c.value === currency);
    if (currencyConfig) {
      const IconComponent = currencyConfig.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    return <DollarSign className="h-4 w-4" />;
  };

  const getCurrencySymbol = (currency: string) => {
    const currencyConfig = ALL_CURRENCIES.find((c) => c.value === currency);
    return currencyConfig?.symbol || "$";
  };

  const formatAmount = (amount: number, currency: string) => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: currency === "BTC" || currency === "ETH" ? 8 : 2,
      maximumFractionDigits: currency === "BTC" || currency === "ETH" ? 8 : 2,
    })}`;
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 bg-gray-50 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Activity className="h-8 w-8 mr-3 text-[#F26623]" />
                Activity Manager
              </h1>
              <p className="text-gray-600 mt-2">
                Manage account activities for{" "}
                {userProfile.full_name || userProfile.email}
              </p>
              <div className="flex items-center space-x-4 mt-2">
                <Badge variant="outline" className="text-xs">
                  Supported: USD, EUR, CAD, BTC, ETH, USDT
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs bg-[#F26623] text-white border-[#F26623]"
                >
                  {combinedActivities.length} Total Activities
                </Badge>
              </div>
            </div>
            <Button
              onClick={() => {
                setIsCreating(!isCreating);
                setEditingActivity(null);
                setFormData({
                  activity_type: "",
                  title: "",
                  description: "",
                  currency: "usd",
                  display_amount: "",
                  priority: "normal",
                  expires_at: "",
                });
              }}
              className="bg-[#F26623] hover:bg-[#E55A1F] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? "Cancel" : "Create Activity"}
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-500 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {isCreating && (
          <Card className="mb-8 border-[#F26623] shadow-lg">
            <CardHeader className="bg-[#F5F0F0]">
              <CardTitle className="text-[#F26623]">
                {editingActivity ? "Edit Activity" : "Create New Activity"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="activity_type">Activity Type</Label>
                    <Select
                      value={formData.activity_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, activity_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select activity type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_LEVELS.map((priority) => (
                          <SelectItem
                            key={priority.value}
                            value={priority.value}
                          >
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-2 h-2 rounded-full ${priority.color}`}
                              ></div>
                              <span>{priority.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Activity title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Activity description (optional)"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) =>
                        setFormData({ ...formData, currency: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Traditional Currencies
                        </div>
                        {ALLOWED_CURRENCIES.traditional.map((currency) => {
                          const IconComponent = currency.icon;
                          return (
                            <SelectItem
                              key={currency.value}
                              value={currency.value}
                            >
                              <div className="flex items-center space-x-2">
                                <IconComponent className="h-4 w-4" />
                                <span>
                                  {currency.label} ({currency.symbol})
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t mt-2 pt-2">
                          Cryptocurrencies
                        </div>
                        {ALLOWED_CURRENCIES.crypto.map((currency) => {
                          const IconComponent = currency.icon;
                          return (
                            <SelectItem
                              key={currency.value}
                              value={currency.value}
                            >
                              <div className="flex items-center space-x-2">
                                <IconComponent className="h-4 w-4" />
                                <span>
                                  {currency.label} ({currency.symbol})
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs ml-auto"
                                >
                                  Crypto
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="display_amount">Display Amount</Label>
                    <Input
                      id="display_amount"
                      type="number"
                      step="0.01"
                      value={formData.display_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          display_amount: e.target.value,
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
                  <Input
                    id="expires_at"
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) =>
                      setFormData({ ...formData, expires_at: e.target.value })
                    }
                  />
                </div>

                <div className="flex space-x-4">
                  <Button
                    type="submit"
                    className="bg-[#F26623] hover:bg-[#E55A1F] text-white"
                  >
                    {editingActivity ? "Update Activity" : "Create Activity"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingActivity(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg">
          <CardHeader className="bg-[#F5F0F0] border-b">
            <CardTitle className="flex items-center text-lg">
              <Activity className="h-5 w-5 mr-2 text-[#F26623]" />
              All Activities & Transfers
              <Badge
                variant="outline"
                className="ml-2 text-xs bg-[#F26623] text-white border-[#F26623]"
              >
                {combinedActivities.length} items
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {combinedActivities.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activities found</p>
                <p className="text-sm mt-1">
                  Create your first activity to get started
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {combinedActivities.map((activity) => {
                  const isAccountActivity =
                    activity.type === "account_activity";
                  const activityData = activity.data as AccountActivity;
                  const transferData = activity.data as Transfer;

                  return (
                    <div
                      key={activity.id}
                      className="p-6 hover:bg-gray-50 transition-colors border-l-4 border-transparent hover:border-[#F26623]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border-2 border-gray-100">
                            {React.cloneElement(getActivityIcon(activity), {
                              className: "h-5 w-5 text-[#F26623]",
                            })}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-gray-900">
                                {isAccountActivity
                                  ? activityData.title
                                  : `Transfer: ${transferData.from_currency?.toUpperCase()} → ${transferData.to_currency?.toUpperCase()}`}
                              </h3>
                              {isAccountActivity && (
                                <Badge
                                  className={`text-xs ${getPriorityColor(
                                    activityData.priority
                                  )}`}
                                >
                                  {activityData.priority.toUpperCase()}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  isAccountActivity
                                    ? activityData.status === "active"
                                      ? "default"
                                      : "secondary"
                                    : "default"
                                }
                                className="text-xs"
                              >
                                {isAccountActivity
                                  ? activityData.status
                                  : transferData.status || "completed"}
                              </Badge>
                            </div>

                            {isAccountActivity && activityData.description && (
                              <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                                {activityData.description}
                              </p>
                            )}

                            {isAccountActivity &&
                              activityData.display_amount !== 0 && (
                                <div className="flex items-center space-x-2 mb-3">
                                  {getCurrencyIcon(activityData.currency)}
                                  <span className="font-semibold text-lg text-[#F26623]">
                                    {activityData.display_amount > 0 ? "+" : ""}
                                    {formatAmount(
                                      activityData.display_amount,
                                      activityData.currency
                                    )}
                                  </span>
                                </div>
                              )}

                            {!isAccountActivity && (
                              <div className="flex items-center space-x-4 mb-3">
                                <div className="flex items-center space-x-2">
                                  {getCurrencyIcon(transferData.from_currency)}
                                  <span className="font-medium">
                                    {formatAmount(
                                      transferData.from_amount,
                                      transferData.from_currency
                                    )}
                                  </span>
                                </div>
                                <ArrowUpRight className="h-4 w-4 text-gray-400" />
                                <div className="flex items-center space-x-2">
                                  {getCurrencyIcon(transferData.to_currency)}
                                  <span className="font-medium">
                                    {formatAmount(
                                      transferData.to_amount,
                                      transferData.to_currency
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center space-x-6 text-xs text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  {new Date(
                                    activity.created_at
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {new Date(
                                    activity.created_at
                                  ).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {isAccountActivity && activityData.expires_at && (
                                <div className="flex items-center space-x-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>
                                    Expires:{" "}
                                    {new Date(
                                      activityData.expires_at
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {isAccountActivity && activityData.created_by && (
                                <div className="flex items-center space-x-1">
                                  <User className="h-3 w-3" />
                                  <span>Admin</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {isAccountActivity && (
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleStatus(activityData)}
                              className="text-gray-600 hover:text-[#F26623]"
                            >
                              {activityData.status === "active" ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(activityData)}
                              className="text-gray-600 hover:text-[#F26623]"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(activityData.id)}
                              className="text-gray-600 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
