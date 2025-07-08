"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  Send,
  Users,
  AlertTriangle,
  CheckCircle,
  Building2,
  Info,
  Loader2,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Wallet,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bell,
  Receipt,
} from "lucide-react";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface ActivityEntry {
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
  user_email?: string;
  user_name?: string;
}

export default function ActivityManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [activityType, setActivityType] = useState<string>("");
  const [activityTitle, setActivityTitle] = useState<string>("");
  const [activityDescription, setActivityDescription] = useState<string>("");
  const [currency, setCurrency] = useState<string>("usd");
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [recentActivities, setRecentActivities] = useState<ActivityEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const activityTypes = [
    // General Admin Types
    {
      value: "admin_notification",
      label: "Admin Notification",
      icon: Building2,
      category: "General",
    },
    {
      value: "system_update",
      label: "System Update",
      icon: Activity,
      category: "General",
    },
    {
      value: "security_alert",
      label: "Security Alert",
      icon: AlertTriangle,
      category: "General",
    },
    {
      value: "account_notice",
      label: "Account Notice",
      icon: Info,
      category: "General",
    },
    {
      value: "service_announcement",
      label: "Service Announcement",
      icon: Send,
      category: "General",
    },

    // Transaction/Transfer Types
    {
      value: "account_credit",
      label: "Account Credit Notification",
      icon: TrendingUp,
      category: "Transactions",
    },
    {
      value: "account_debit",
      label: "Account Debit Notification",
      icon: TrendingDown,
      category: "Transactions",
    },
    {
      value: "transfer_notification",
      label: "Transfer Notification",
      icon: ArrowUpRight,
      category: "Transactions",
    },
    {
      value: "deposit_notification",
      label: "Deposit Notification",
      icon: ArrowDownLeft,
      category: "Transactions",
    },
    {
      value: "withdrawal_notification",
      label: "Withdrawal Notification",
      icon: Wallet,
      category: "Transactions",
    },
    {
      value: "payment_notification",
      label: "Payment Notification",
      icon: CreditCard,
      category: "Transactions",
    },
    {
      value: "balance_inquiry",
      label: "Balance Inquiry",
      icon: DollarSign,
      category: "Transactions",
    },
    {
      value: "transaction_alert",
      label: "Transaction Alert",
      icon: Bell,
      category: "Transactions",
    },
    {
      value: "receipt_notification",
      label: "Receipt/Confirmation",
      icon: Receipt,
      category: "Transactions",
    },
  ];

  const currencies = [
    { value: "usd", label: "USD ($)" },
    { value: "euro", label: "EUR (€)" },
    { value: "cad", label: "CAD (C$)" },
    { value: "crypto", label: "Crypto (₿)" },
  ];

  // Quick message templates for common scenarios
  const getQuickTemplate = (type: string, amount: string, currency: string) => {
    const currencySymbol =
      {
        usd: "$",
        euro: "€",
        cad: "C$",
        crypto: "₿",
      }[currency] || "$";

    const amountText = amount
      ? `${currencySymbol}${amount}`
      : `${currencySymbol}[AMOUNT]`;

    switch (type) {
      case "account_credit":
        return {
          title: "Account Credited",
          description: `Your account has been credited with ${amountText}. This transaction has been processed successfully and the funds are now available in your account.`,
        };
      case "account_debit":
        return {
          title: "Account Debited",
          description: `Your account has been debited with ${amountText}. This transaction has been processed and deducted from your available balance.`,
        };
      case "transfer_notification":
        return {
          title: "Transfer Processed",
          description: `A transfer of ${amountText} has been processed on your account. Please review your transaction history for details.`,
        };
      case "deposit_notification":
        return {
          title: "Deposit Received",
          description: `A deposit of ${amountText} has been received and processed to your account. Funds are now available for use.`,
        };
      case "withdrawal_notification":
        return {
          title: "Withdrawal Processed",
          description: `A withdrawal of ${amountText} has been processed from your account. Please allow processing time for completion.`,
        };
      case "payment_notification":
        return {
          title: "Payment Processed",
          description: `A payment of ${amountText} has been processed. Transaction reference and details have been recorded.`,
        };
      case "balance_inquiry":
        return {
          title: "Balance Inquiry",
          description: `Your current account balance inquiry has been processed. Available balance: ${amountText}.`,
        };
      case "transaction_alert":
        return {
          title: "Transaction Alert",
          description: `Transaction alert: A ${amountText} transaction has been detected on your account. Please verify if this was authorized.`,
        };
      case "receipt_notification":
        return {
          title: "Transaction Receipt",
          description: `Receipt for your ${amountText} transaction. Transaction has been completed successfully.`,
        };
      default:
        return { title: "", description: "" };
    }
  };

  // Auto-fill form when activity type changes
  useEffect(() => {
    if (activityType && amount && currency) {
      const template = getQuickTemplate(activityType, amount, currency);
      if (template.title && !activityTitle) {
        setActivityTitle(template.title);
      }
      if (template.description && !activityDescription) {
        setActivityDescription(template.description);
      }
    }
  }, [activityType, amount, currency]);

  useEffect(() => {
    fetchUsers();
    fetchRecentActivities();
  }, []);

  const fetchUsers = async () => {
    try {
      let data = null;

      // Try 'users' table first
      const usersResult = await supabase
        .from("users")
        .select("id, email, first_name, last_name, full_name, created_at")
        .order("created_at", { ascending: false });

      if (!usersResult.error && usersResult.data) {
        data = usersResult.data.map((user) => ({
          id: user.id,
          client_id: `DCB${user.id.slice(0, 6)}`,
          full_name:
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            null,
          email: user.email,
          created_at: user.created_at,
        }));
      } else {
        // Try 'profiles' table
        const profilesResult = await supabase
          .from("profiles")
          .select("id, client_id, full_name, email, created_at")
          .order("created_at", { ascending: false });

        if (!profilesResult.error && profilesResult.data) {
          data = profilesResult.data;
        } else {
          // Try 'user_profiles' table
          const userProfilesResult = await supabase
            .from("user_profiles")
            .select("id, client_id, full_name, email, created_at")
            .order("created_at", { ascending: false });

          if (!userProfilesResult.error && userProfilesResult.data) {
            data = userProfilesResult.data;
          } else {
            throw new Error("Could not find users in any table");
          }
        }
      }

      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setMessage({
        type: "error",
        text: "Failed to load users. Check console for details.",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    setActivitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from("account_activities")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get user info for each activity
      const activitiesWithUserInfo = await Promise.all(
        (data || []).map(async (activity) => {
          // Try to get user info
          const user = users.find((u) => u.id === activity.user_id);
          if (user) {
            return {
              ...activity,
              user_email: user.email,
              user_name: user.full_name,
            };
          }

          // If not found in current users list, try to fetch from database
          const { data: userData } = await supabase
            .from("users")
            .select("email, first_name, last_name, full_name")
            .eq("id", activity.user_id)
            .single();

          return {
            ...activity,
            user_email: userData?.email,
            user_name:
              userData?.full_name ||
              `${userData?.first_name || ""} ${
                userData?.last_name || ""
              }`.trim(),
          };
        })
      );

      setRecentActivities(activitiesWithUserInfo);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !activityType || !activityTitle) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const selectedUserData = users.find((u) => u.id === selectedUser);
      if (!selectedUserData) {
        throw new Error("Selected user not found");
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      const activityData = {
        user_id: selectedUser,
        client_id: selectedUserData.client_id,
        activity_type: activityType,
        title: activityTitle,
        description: activityDescription || null,
        currency: currency,
        display_amount: amount ? Number.parseFloat(amount) : 0,
        priority: "normal",
        created_by: currentUser?.id || null,
        metadata: {
          admin_email: currentUser?.email || "System Admin",
          created_from: "admin_panel",
          target_user_name: selectedUserData.full_name,
          target_user_email: selectedUserData.email,
          is_balance_affecting: false, // Important: These don't affect actual balances
        },
      };

      const { error } = await supabase
        .from("account_activities")
        .insert([activityData]);

      if (error) throw error;

      setMessage({
        type: "success",
        text: `Activity successfully added to ${
          selectedUserData.full_name || selectedUserData.email
        }'s account`,
      });

      // Reset form
      setSelectedUser("");
      setActivityType("");
      setActivityTitle("");
      setActivityDescription("");
      setAmount("");

      // Refresh recent activities
      fetchRecentActivities();
    } catch (error) {
      console.error("Error creating activity:", error);
      setMessage({
        type: "error",
        text: `Failed to create activity entry: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("account_activities")
        .update({ status: "deleted" })
        .eq("id", activityId);

      if (error) throw error;

      setMessage({ type: "success", text: "Activity deleted successfully" });
      fetchRecentActivities();
    } catch (error) {
      console.error("Error deleting activity:", error);
      setMessage({ type: "error", text: "Failed to delete activity" });
    }
  };

  const getActivityIcon = (type: string) => {
    const activityType = activityTypes.find((t) => t.value === type);
    if (activityType) {
      const IconComponent = activityType.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    return <Activity className="h-4 w-4" />;
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "admin_notification":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "system_update":
        return "bg-green-100 text-green-800 border-green-200";
      case "security_alert":
        return "bg-red-100 text-red-800 border-red-200";
      case "account_notice":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "service_announcement":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "account_credit":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "account_debit":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "transfer_notification":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "deposit_notification":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "withdrawal_notification":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "payment_notification":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "balance_inquiry":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "transaction_alert":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "receipt_notification":
        return "bg-lime-100 text-lime-800 border-lime-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleQuickFill = () => {
    if (activityType && currency) {
      const template = getQuickTemplate(activityType, amount, currency);
      setActivityTitle(template.title);
      setActivityDescription(template.description);
    }
  };

  // Group activity types by category
  const groupedActivityTypes = activityTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, typeof activityTypes>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Account Activity Manager
            <Badge variant="outline" className="ml-2 text-xs">
              Enhanced
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Activity Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Create Activity Entry</h3>
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
                      message.type === "error"
                        ? "text-red-700"
                        : "text-green-700"
                    }
                  >
                    {message.text}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="user-select">Select User *</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          usersLoading ? "Loading users..." : "Choose a user"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4" />
                            <span>{user.full_name || user.email}</span>
                            <Badge variant="outline" className="text-xs">
                              {user.client_id}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="activity-type">Activity Type *</Label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupedActivityTypes).map(
                        ([category, types]) => (
                          <div key={category}>
                            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {category}
                            </div>
                            {types.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center space-x-2">
                                  <type.icon className="h-4 w-4" />
                                  <span>{type.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((curr) => (
                          <SelectItem key={curr.value} value={curr.value}>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount (Optional)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {activityType && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleQuickFill}
                      className="text-xs bg-transparent"
                    >
                      Auto-fill Template
                    </Button>
                  </div>
                )}

                <div>
                  <Label htmlFor="activity-title">Activity Title *</Label>
                  <Input
                    id="activity-title"
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    placeholder="Enter activity title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="activity-description">Description</Label>
                  <Textarea
                    id="activity-description"
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    placeholder="Enter activity description (optional)"
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    loading || !selectedUser || !activityType || !activityTitle
                  }
                  className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Activity...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create Activity Entry
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Recent Activities */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Activity Entries</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activitiesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="p-3 border rounded-lg animate-pulse"
                      >
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No activity entries yet</p>
                  </div>
                ) : (
                  recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`p-3 border rounded-lg ${getActivityColor(
                        activity.activity_type
                      )}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2">
                          {getActivityIcon(activity.activity_type)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-sm">
                                {activity.user_name || activity.user_email}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {activity.activity_type.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="font-medium text-sm mb-1">
                              {activity.title}
                            </p>
                            {activity.description && (
                              <p className="text-xs mb-1 opacity-90">
                                {activity.description}
                              </p>
                            )}
                            {activity.display_amount !== 0 && (
                              <p
                                className={`text-xs mb-1 font-medium ${
                                  activity.display_amount > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {activity.display_amount > 0 ? "+" : ""}
                                {activity.display_amount}{" "}
                                {activity.currency.toUpperCase()}
                              </p>
                            )}
                            <p className="text-xs opacity-75">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteActivity(activity.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <p className="text-sm">
              Activity entries appear in user's Account Activity section in
              real-time
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <p className="text-sm">
              These entries do NOT affect user account balances - they are
              informational only
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <p className="text-sm">
              Transaction notifications help users track account activity
              without balance changes
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <p className="text-sm">
              All activity entries are logged with timestamps and admin
              identification
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <p className="text-sm">
              Use appropriate activity types to ensure proper categorization and
              user understanding
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
