"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Users,
  DollarSign,
  Mail,
  Database,
  Shield,
  Activity,
  Calculator,
  Wifi,
} from "lucide-react";
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
  Send,
  AlertTriangle,
  CheckCircle,
  Building2,
  Info,
  Loader2,
  Trash2,
  Clock,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BalanceUpdater from "./balance-updater";
import MessageManager from "./message-manager";
import DatabaseTest from "./database-test";
import UserManagementTest from "./user-management-test";
import KYCAdminPanel from "./kyc-admin-panel";
import ActivityManager from "./activity-manager";
import TaxManager from "./tax-manager";
import UserPresenceTracker from "./user-presence-tracker";
import PresenceManager from "./presence-manager";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  kyc_status?: string;
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
  user_full_name?: string;
  user_email?: string;
  first_name?: string;
  last_name?: string;
}

function ActivityManagerComponent() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [activityType, setActivityType] = useState<string>("");
  const [activityTitle, setActivityTitle] = useState<string>("");
  const [activityDescription, setActivityDescription] = useState<string>("");
  const [currency, setCurrency] = useState<string>("usd");
  const [displayAmount, setDisplayAmount] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [recentActivities, setRecentActivities] = useState<AccountActivity[]>(
    []
  );
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const activityTypes = [
    {
      value: "admin_notification",
      label: "Admin Notification",
      icon: Building2,
    },
    { value: "system_update", label: "System Update", icon: Activity },
    { value: "security_alert", label: "Security Alert", icon: AlertTriangle },
    { value: "account_notice", label: "Account Notice", icon: Info },
    {
      value: "service_announcement",
      label: "Service Announcement",
      icon: Send,
    },
    { value: "maintenance_notice", label: "Maintenance Notice", icon: Clock },
    { value: "policy_update", label: "Policy Update", icon: CheckCircle },
    {
      value: "feature_announcement",
      label: "Feature Announcement",
      icon: Star,
    },
  ];

  const currencies = [
    { value: "usd", label: "USD ($)" },
    { value: "euro", label: "EUR (€)" },
    { value: "cad", label: "CAD (C$)" },
    { value: "crypto", label: "Crypto (₿)" },
  ];

  const priorities = [
    { value: "low", label: "Low", color: "bg-gray-100 text-gray-800" },
    { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-800" },
    { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
    { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800" },
  ];

  useEffect(() => {
    fetchUsers();
    fetchRecentActivities();
  }, []);

  const fetchUsers = async () => {
    try {
      // Try profiles table first
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, client_id, full_name, email, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        // Fallback to users table if profiles fails
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select(
            "id, email, first_name, last_name, full_name, created_at, kyc_status"
          )
          .order("created_at", { ascending: false });

        if (usersError) throw usersError;

        // Transform users data to match expected format
        const transformedUsers = (usersData || []).map((user) => ({
          id: user.id,
          client_id: `DCB${user.id.slice(0, 6)}`, // Generate client_id if not available
          full_name:
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email,
          created_at: user.created_at,
        }));

        setUsers(transformedUsers);
        return;
      }

      setUsers(profilesData || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setMessage({ type: "error", text: "Failed to load users" });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    setActivitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from("transfers")
        .select("*")
        .in("transfer_type", [
          "admin_notification",
          "system_update",
          "security_alert",
          "account_notice",
          "service_announcement",
        ])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get user info for each activity
      const activitiesWithUserInfo = await Promise.all(
        (data || []).map(async (activity) => {
          // Try to get user info from profiles first
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", activity.user_id)
            .single();

          if (profileData) {
            return {
              ...activity,
              user_email: profileData.email,
              user_name: profileData.full_name,
            };
          }

          // Fallback to users table
          const { data: userData } = await supabase
            .from("users")
            .select("first_name, last_name, full_name, email")
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
        display_amount: displayAmount ? Number.parseFloat(displayAmount) : 0,
        priority: priority,
        created_by: currentUser?.id || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        metadata: {
          admin_email: currentUser?.email || "System Admin",
          created_from: "admin_panel",
          target_user_name: selectedUserData.full_name,
          target_user_email: selectedUserData.email,
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

      setSelectedUser("");
      setActivityType("");
      setActivityTitle("");
      setActivityDescription("");
      setDisplayAmount("");
      setPriority("normal");
      setExpiresAt("");

      fetchRecentActivities();
    } catch (error) {
      console.error("Error creating activity:", error);
      setMessage({ type: "error", text: "Failed to create activity entry" });
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

  const archiveActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("account_activities")
        .update({ status: "archived" })
        .eq("id", activityId);

      if (error) throw error;

      setMessage({ type: "success", text: "Activity archived successfully" });
      fetchRecentActivities();
    } catch (error) {
      console.error("Error archiving activity:", error);
      setMessage({ type: "error", text: "Failed to archive activity" });
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
      case "maintenance_notice":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "policy_update":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "feature_announcement":
        return "bg-pink-100 text-pink-800 border-pink-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    const priorityObj = priorities.find((p) => p.value === priority);
    return priorityObj?.color || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Account Activity Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            {user.client_id && (
                              <Badge variant="outline" className="text-xs">
                                {user.client_id}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="activity-type">Activity Type *</Label>
                    <Select
                      value={activityType}
                      onValueChange={setActivityType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select activity type" />
                      </SelectTrigger>
                      <SelectContent>
                        {activityTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center space-x-2">
                              <type.icon className="h-4 w-4" />
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <Badge className={p.color}>{p.label}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                    placeholder="Enter detailed description (optional)"
                    rows={3}
                  />
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
                    <Label htmlFor="display-amount">
                      Display Amount (Optional)
                    </Label>
                    <Input
                      id="display-amount"
                      type="number"
                      step="0.01"
                      value={displayAmount}
                      onChange={(e) => setDisplayAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="expires-at">Expires At (Optional)</Label>
                  <Input
                    id="expires-at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
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
                                {activity.user_full_name ||
                                  activity.user_email ||
                                  `${activity.first_name || ""} ${
                                    activity.last_name || ""
                                  }`.trim()}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {activity.activity_type.replace("_", " ")}
                              </Badge>
                              <Badge
                                className={`text-xs ${getPriorityColor(
                                  activity.priority
                                )}`}
                              >
                                {activity.priority}
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
                            {activity.display_amount > 0 && (
                              <p className="text-xs mb-1">
                                Amount: {activity.display_amount}{" "}
                                {activity.currency.toUpperCase()}
                              </p>
                            )}
                            <p className="text-xs opacity-75">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archiveActivity(activity.id)}
                            className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100"
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
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
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-50">
      <PresenceManager />
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-[#F26623] mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">
                Digital Chain Bank Admin
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-green-600">
                <Activity className="w-4 h-4 mr-1" />
                System Online
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="overview" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="presence" className="flex items-center">
              <Wifi className="w-4 h-4 mr-2" />
              Presence
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              KYC
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Balances
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center">
              <Database className="w-4 h-4 mr-2" />
              Database
            </TabsTrigger>
            <TabsTrigger value="taxes" className="flex items-center">
              <Calculator className="w-4 h-4 mr-2" />
              Taxes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Active</div>
                  <p className="text-xs text-muted-foreground">
                    All user accounts operational
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    System Status
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    Online
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All services running
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Database
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    Connected
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supabase operational
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Messages
                  </CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Ready</div>
                  <p className="text-xs text-muted-foreground">
                    Messaging system active
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Admin Panel Features</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">User Presence Tracking</h4>
                  <p className="text-sm text-gray-600">
                    Real-time monitoring of user online/offline status with last
                    seen timestamps
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Activity Management</h4>
                  <p className="text-sm text-gray-600">
                    Push account activity entries to users without affecting
                    balances
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Balance Management</h4>
                  <p className="text-sm text-gray-600">
                    Update user balances across all currencies (USD, EUR, CAD,
                    Crypto)
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Message System</h4>
                  <p className="text-sm text-gray-600">
                    Send targeted messages to users with different priority
                    levels
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">User Management</h4>
                  <p className="text-sm text-gray-600">
                    View and manage user accounts, test isolation features
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Database Tools</h4>
                  <p className="text-sm text-gray-600">
                    Test database connectivity and run system diagnostics
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Tax Management</h4>
                  <p className="text-sm text-gray-600">
                    Manage user tax records, calculations, and compliance
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="presence">
            <UserPresenceTracker />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityManager />
          </TabsContent>

          <TabsContent value="kyc">
            <KYCAdminPanel />
          </TabsContent>

          <TabsContent value="balances">
            <BalanceUpdater />
          </TabsContent>

          <TabsContent value="messages">
            <MessageManager />
          </TabsContent>

          <TabsContent value="users">
            <UserManagementTest />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseTest />
          </TabsContent>

          <TabsContent value="taxes">
            <TaxManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
