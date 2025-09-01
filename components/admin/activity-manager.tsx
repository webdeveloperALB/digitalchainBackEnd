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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  Send,
  Users,
  AlertTriangle,
  Info,
  Loader2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Bell,
  Receipt,
  Calendar,
  Clock,
  Search,
  Plus,
  Settings,
  Eye,
  EyeOff,
  Copy,
  Upload,
  Zap,
  Star,
  Shield,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  Banknote,
  CreditCardIcon,
  Smartphone,
  Globe,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
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

export default function EnhancedActivityManager() {
  // Core state
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searching, setSearching] = useState(false);

  // Form state
  const [activityType, setActivityType] = useState<string>("");
  const [activityTitle, setActivityTitle] = useState<string>("");
  const [activityDescription, setActivityDescription] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [amount, setAmount] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [expiresAt, setExpiresAt] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [recentActivities, setRecentActivities] = useState<ActivityEntry[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const activityTypes = [
    // Banking Operations
    {
      value: "account_credit",
      label: "Account Credit",
      icon: TrendingUp,
      category: "Banking Operations",
      description: "Credit transactions and deposits",
    },
    {
      value: "account_debit",
      label: "Account Debit",
      icon: TrendingDown,
      category: "Banking Operations",
      description: "Debit transactions and withdrawals",
    },
    {
      value: "wire_transfer",
      label: "Wire Transfer",
      icon: ArrowUpRight,
      category: "Banking Operations",
      description: "International and domestic wire transfers",
    },
    {
      value: "ach_transfer",
      label: "ACH Transfer",
      icon: ArrowDownLeft,
      category: "Banking Operations",
      description: "Automated Clearing House transfers",
    },
    {
      value: "check_deposit",
      label: "Check Deposit",
      icon: Receipt,
      category: "Banking Operations",
      description: "Check deposits and clearances",
    },
    {
      value: "card_transaction",
      label: "Card Transaction",
      icon: CreditCardIcon,
      category: "Banking Operations",
      description: "Debit and credit card transactions",
    },
    {
      value: "mobile_payment",
      label: "Mobile Payment",
      icon: Smartphone,
      category: "Banking Operations",
      description: "Mobile banking and payment app transactions",
    },
    {
      value: "online_banking",
      label: "Online Banking",
      icon: Globe,
      category: "Banking Operations",
      description: "Online banking platform activities",
    },
    // Account Management
    {
      value: "account_opening",
      label: "Account Opening",
      icon: Plus,
      category: "Account Management",
      description: "New account creation and setup",
    },
    {
      value: "account_closure",
      label: "Account Closure",
      icon: XCircle,
      category: "Account Management",
      description: "Account closure and termination",
    },
    {
      value: "account_freeze",
      label: "Account Freeze",
      icon: Lock,
      category: "Account Management",
      description: "Account suspension and freezing",
    },
    {
      value: "account_unfreeze",
      label: "Account Unfreeze",
      icon: Unlock,
      category: "Account Management",
      description: "Account reactivation and unfreezing",
    },
    {
      value: "limit_change",
      label: "Limit Change",
      icon: Settings,
      category: "Account Management",
      description: "Transaction and withdrawal limit changes",
    },
    // Security & Compliance
    {
      value: "security_alert",
      label: "Security Alert",
      icon: Shield,
      category: "Security & Compliance",
      description: "Security warnings and alerts",
    },
    {
      value: "fraud_alert",
      label: "Fraud Alert",
      icon: AlertTriangle,
      category: "Security & Compliance",
      description: "Fraud detection and prevention alerts",
    },
    {
      value: "kyc_update",
      label: "KYC Update",
      icon: FileText,
      category: "Security & Compliance",
      description: "Know Your Customer documentation updates",
    },
    {
      value: "compliance_notice",
      label: "Compliance Notice",
      icon: AlertCircle,
      category: "Security & Compliance",
      description: "Regulatory compliance notifications",
    },
    // Communications
    {
      value: "statement_ready",
      label: "Statement Ready",
      icon: FileText,
      category: "Communications",
      description: "Monthly and quarterly statements",
    },
    {
      value: "promotional_offer",
      label: "Promotional Offer",
      icon: Star,
      category: "Communications",
      description: "Special offers and promotions",
    },
    {
      value: "service_update",
      label: "Service Update",
      icon: Bell,
      category: "Communications",
      description: "Banking service updates and changes",
    },
    {
      value: "maintenance_notice",
      label: "Maintenance Notice",
      icon: Settings,
      category: "Communications",
      description: "System maintenance notifications",
    },
    // Customer Service
    {
      value: "support_response",
      label: "Support Response",
      icon: MessageSquare,
      category: "Customer Service",
      description: "Customer support responses",
    },
    {
      value: "appointment_reminder",
      label: "Appointment Reminder",
      icon: Calendar,
      category: "Customer Service",
      description: "Branch appointment reminders",
    },
    {
      value: "document_request",
      label: "Document Request",
      icon: Upload,
      category: "Customer Service",
      description: "Document submission requests",
    },
  ];

  const currencies = [
    { value: "USD", label: "USD ($)", symbol: "$" },
    { value: "EUR", label: "EUR (€)", symbol: "€" },
    { value: "CAD", label: "CAD (C$)", symbol: "C$" },
    { value: "GBP", label: "GBP (£)", symbol: "£" },
    { value: "JPY", label: "JPY (¥)", symbol: "¥" },
    { value: "BTC", label: "Bitcoin (₿)", symbol: "₿" },
  ];

  const priorities = [
    { value: "low", label: "Low Priority", color: "bg-gray-100 text-gray-800" },
    {
      value: "normal",
      label: "Normal Priority",
      color: "bg-blue-100 text-blue-800",
    },
    {
      value: "high",
      label: "High Priority",
      color: "bg-orange-100 text-orange-800",
    },
    {
      value: "urgent",
      label: "Urgent Priority",
      color: "bg-red-100 text-red-800",
    },
  ];

  // Ultra-fast user search (only when needed)
  useEffect(() => {
    if (userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        // Ultra-fast query with minimal data
        const { data, error } = await supabase
          .from("users")
          .select("id, email, full_name")
          .or(`email.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`)
          .limit(8)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            client_id: `DCB${user.id.slice(0, 6)}`,
            full_name: user.full_name || user.email?.split("@")[0] || "Unknown",
            email: user.email,
          }));
          setSearchResults(transformedUsers);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearch]);

  // Load recent activities (lightweight)
  useEffect(() => {
    fetchRecentActivities();
  }, []);

  const fetchRecentActivities = async () => {
    setActivitiesLoading(true);
    try {
      // Simple query without JOINs to avoid RLS issues
      const { data, error } = await supabase
        .from("account_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setRecentActivities(data);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Enhanced templates with professional banking messages
  const getAdvancedTemplate = (
    type: string,
    amount: string,
    currency: string
  ) => {
    const currencySymbol =
      currencies.find((c) => c.value === currency)?.symbol || "$";
    const amountText = amount
      ? `${currencySymbol}${Number(amount).toLocaleString()}`
      : `${currencySymbol}[AMOUNT]`;

    const templates = {
      account_credit: {
        title: "Account Credit Processed",
        description: `Dear Valued Customer,\n\nWe are pleased to inform you that your account has been credited with ${amountText}. This transaction has been successfully processed and the funds are now available in your account.\n\nTransaction Details:\n• Amount: ${amountText}\n• Processing Date: ${new Date().toLocaleDateString()}\n• Reference: TXN${Date.now()
          .toString()
          .slice(
            -8
          )}\n\nIf you have any questions regarding this transaction, please contact our customer service team.\n\nThank you for banking with us.\n\nDigital Chain Bank`,
      },
      account_debit: {
        title: "Account Debit Notification",
        description: `Dear Valued Customer,\n\nThis is to notify you that your account has been debited with ${amountText}. The transaction has been processed successfully.\n\nTransaction Details:\n• Amount: ${amountText}\n• Processing Date: ${new Date().toLocaleDateString()}\n• Reference: TXN${Date.now()
          .toString()
          .slice(
            -8
          )}\n• Available Balance: Please check your account for current balance\n\nIf you did not authorize this transaction or have any concerns, please contact us immediately.\n\nDigital Chain Bank Customer Service`,
      },
      wire_transfer: {
        title: "Wire Transfer Confirmation",
        description: `Dear Customer,\n\nYour wire transfer of ${amountText} has been processed successfully.\n\nTransfer Details:\n• Amount: ${amountText}\n• Processing Date: ${new Date().toLocaleDateString()}\n• Wire Reference: WIRE${Date.now()
          .toString()
          .slice(
            -8
          )}\n• Expected Delivery: 1-3 business days\n\nYou will receive a confirmation once the transfer is completed. Please retain this notification for your records.\n\nDigital Chain Bank Wire Services`,
      },
      security_alert: {
        title: "Security Alert - Account Activity",
        description: `IMPORTANT SECURITY NOTICE\n\nDear Customer,\n\nWe have detected unusual activity on your account involving ${amountText}. As part of our security measures, we are notifying you of this transaction.\n\nActivity Details:\n• Amount: ${amountText}\n• Date: ${new Date().toLocaleDateString()}\n• Time: ${new Date().toLocaleTimeString()}\n• Alert Level: High\n\nIf you recognize this activity, no action is required. If you did not authorize this transaction, please contact our security team immediately at 1-800-SECURITY.\n\nYour account security is our priority.\n\nDigital Chain Bank Security Team`,
      },
      fraud_alert: {
        title: "FRAUD ALERT - Immediate Action Required",
        description: `URGENT FRAUD ALERT\n\nDear Customer,\n\nWe have detected potentially fraudulent activity on your account involving ${amountText}. Your account has been temporarily secured as a precautionary measure.\n\nSuspicious Activity:\n• Amount: ${amountText}\n• Date: ${new Date().toLocaleDateString()}\n• Status: BLOCKED\n• Reference: FRAUD${Date.now()
          .toString()
          .slice(
            -8
          )}\n\nIMMEDIATE ACTION REQUIRED:\n1. Call our fraud hotline: 1-800-FRAUD-HELP\n2. Verify your identity\n3. Confirm or dispute the transaction\n\nDo not ignore this alert. Your account security depends on your prompt response.\n\nDigital Chain Bank Fraud Prevention Team`,
      },
      statement_ready: {
        title: "Monthly Statement Available",
        description: `Dear Valued Customer,\n\nYour monthly account statement is now available for review.\n\nStatement Period: ${new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toLocaleDateString()} - ${new Date().toLocaleDateString()}\nAccount Summary:\n• Total Credits: ${amountText}\n• Statement Date: ${new Date().toLocaleDateString()}\n• Document ID: STMT${Date.now()
          .toString()
          .slice(
            -8
          )}\n\nYou can view and download your statement through:\n• Online Banking Portal\n• Mobile Banking App\n• Customer Service: 1-800-BANK-HELP\n\nPlease review your statement carefully and report any discrepancies within 30 days.\n\nDigital Chain Bank Statements Team`,
      },
    };

    return (
      templates[type as keyof typeof templates] || {
        title: "",
        description: "",
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      setMessage({ type: "error", text: "Please select a user" });
      return;
    }

    if (!activityType || !activityTitle.trim()) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      const activityData = {
        user_id: selectedUser.id,
        client_id: selectedUser.client_id,
        activity_type: activityType,
        title: activityTitle.trim(),
        description: activityDescription.trim() || null,
        currency: currency,
        display_amount: amount ? Number.parseFloat(amount) : 0,
        priority: priority,
        status: "active",
        is_read: false,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        created_by: currentUser?.id || null,
        metadata: {
          admin_email: currentUser?.email || "System Admin",
          created_from: "enhanced_admin_panel",
          target_user_name: selectedUser.full_name,
          target_user_email: selectedUser.email,
          created_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase
        .from("account_activities")
        .insert([activityData]);

      if (error) throw error;

      setMessage({
        type: "success",
        text: `Activity created successfully for ${
          selectedUser.full_name || selectedUser.email
        }`,
      });

      // Reset form
      setSelectedUser(null);
      setUserSearch("");
      setActivityType("");
      setActivityTitle("");
      setActivityDescription("");
      setAmount("");
      setPriority("normal");
      setExpiresAt("");

      // Refresh activities
      fetchRecentActivities();
    } catch (error: any) {
      console.error("Error creating activity:", error);
      setMessage({
        type: "error",
        text: `Error: ${error.message || "Unknown error occurred"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    if (activityType && currency) {
      const template = getAdvancedTemplate(activityType, amount, currency);
      setActivityTitle(template.title);
      setActivityDescription(template.description);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Are you sure you want to delete this activity?")) return;

    try {
      const { error } = await supabase
        .from("account_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;

      setMessage({ type: "success", text: "Activity deleted successfully" });
      fetchRecentActivities();
    } catch (error: any) {
      setMessage({ type: "error", text: `Error: ${error.message}` });
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
    const colorMap = {
      account_credit: "bg-emerald-100 text-emerald-800 border-emerald-200",
      account_debit: "bg-orange-100 text-orange-800 border-orange-200",
      wire_transfer: "bg-blue-100 text-blue-800 border-blue-200",
      ach_transfer: "bg-indigo-100 text-indigo-800 border-indigo-200",
      security_alert: "bg-red-100 text-red-800 border-red-200",
      fraud_alert: "bg-red-200 text-red-900 border-red-300",
      statement_ready: "bg-purple-100 text-purple-800 border-purple-200",
      promotional_offer: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };
    return (
      colorMap[type as keyof typeof colorMap] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    );
  };

  const groupedActivityTypes = activityTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, typeof activityTypes>);

  return (
    <div className="space-y-6">
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

      <Card className="border-2 border-[#F26623]/20">
        <CardHeader className="bg-gradient-to-r from-[#F26623]/5 to-orange-50">
          <CardTitle className="flex items-center">
            <Activity className="h-6 w-6 mr-3 text-[#F26623]" />
            Enhanced Activity Manager
            <Badge
              variant="outline"
              className="ml-3 text-xs bg-[#F26623] text-white"
            >
              Professional
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Form */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Create Activity Entry
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* User Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Select User *</Label>

                  {selectedUser ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">
                            {selectedUser.full_name || selectedUser.email}
                          </p>
                          <p className="text-sm text-green-600">
                            {selectedUser.client_id} • {selectedUser.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(null);
                          setUserSearch("");
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Type name or email to search users..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-10"
                        />
                        {searching && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                        )}
                      </div>

                      {userSearch.length >= 2 && (
                        <div className="border rounded-lg max-h-48 overflow-y-auto">
                          {searchResults.length > 0 ? (
                            searchResults.map((user) => (
                              <div
                                key={user.id}
                                className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setUserSearch("");
                                  setSearchResults([]);
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <Users className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <p className="font-medium text-sm">
                                      {user.full_name ||
                                        user.email?.split("@")[0] ||
                                        "Unknown User"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {user.client_id} • {user.email}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : !searching ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              No users found matching "{userSearch}"
                            </div>
                          ) : null}
                        </div>
                      )}

                      {userSearch.length > 0 && userSearch.length < 2 && (
                        <p className="text-xs text-gray-500">
                          Type at least 2 characters to search
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Activity Type */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">
                    Activity Type *
                  </Label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {Object.entries(groupedActivityTypes).map(
                        ([category, types]) => (
                          <div key={category}>
                            <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide bg-gray-100">
                              {category}
                            </div>
                            {types.map((type) => (
                              <SelectItem
                                key={type.value}
                                value={type.value}
                                className="py-3"
                              >
                                <div className="flex items-center space-x-3">
                                  <type.icon className="h-5 w-5 text-[#F26623]" />
                                  <div>
                                    <div className="font-medium">
                                      {type.label}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {type.description}
                                    </div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount and Currency */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((curr) => (
                          <SelectItem key={curr.value} value={curr.value}>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-lg">
                                {curr.symbol}
                              </span>
                              <span>{curr.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="font-mono text-lg"
                    />
                  </div>
                </div>

                {/* Priority and Expiry */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      Priority Level
                    </Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  p.color.split(" ")[0]
                                }`}
                              ></div>
                              <span>{p.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      Expires At (Optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Title and Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">
                        Activity Title *
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleQuickFill}
                        disabled={!activityType}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Auto-fill
                      </Button>
                    </div>
                    <Input
                      value={activityTitle}
                      onChange={(e) => setActivityTitle(e.target.value)}
                      placeholder="Enter professional activity title"
                      className="text-lg font-medium"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Description</Label>
                    <Textarea
                      value={activityDescription}
                      onChange={(e) => setActivityDescription(e.target.value)}
                      placeholder="Enter detailed activity description"
                      rows={6}
                      className="text-sm leading-relaxed"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={
                    loading ||
                    !selectedUser ||
                    !activityType ||
                    !activityTitle.trim()
                  }
                  className="w-full h-12 bg-[#F26623] hover:bg-[#E55A1F] text-white font-semibold text-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating Activity...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Create Activity Entry
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Recent Activities */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Recent Activities
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRecentActivities}
                  disabled={activitiesLoading}
                >
                  {activitiesLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto border rounded-lg bg-gray-50 p-4">
                {activitiesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="p-4 border rounded-lg animate-pulse bg-white"
                      >
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No activities found</p>
                    <p className="text-sm">
                      Create your first activity entry to get started
                    </p>
                  </div>
                ) : (
                  recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`p-4 border-2 rounded-xl bg-white shadow-sm hover:shadow-md transition-all ${getActivityColor(
                        activity.activity_type
                      )}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-semibold text-sm">
                                User ID: {activity.user_id.slice(0, 8)}...
                              </span>
                              <Badge
                                variant="outline"
                                className="text-xs font-medium"
                              >
                                {activity.activity_type
                                  .replace("_", " ")
                                  .toUpperCase()}
                              </Badge>
                              <Badge
                                className={
                                  priorities.find(
                                    (p) => p.value === activity.priority
                                  )?.color
                                }
                              >
                                {activity.priority.toUpperCase()}
                              </Badge>
                            </div>
                            <h4 className="font-bold text-base mb-2 text-gray-900">
                              {activity.title}
                            </h4>
                            {activity.description && (
                              <p className="text-sm text-gray-700 mb-3 leading-relaxed line-clamp-3">
                                {activity.description.slice(0, 150)}...
                              </p>
                            )}
                            {activity.display_amount !== 0 && (
                              <div className="flex items-center space-x-2 mb-2">
                                <Banknote className="h-4 w-4 text-green-600" />
                                <span
                                  className={`font-bold text-lg ${
                                    activity.display_amount > 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {activity.display_amount > 0 ? "+" : ""}
                                  {
                                    currencies.find(
                                      (c) => c.value === activity.currency
                                    )?.symbol
                                  }
                                  {Math.abs(
                                    activity.display_amount
                                  ).toLocaleString()}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {new Date(
                                    activity.created_at
                                  ).toLocaleString()}
                                </span>
                              </div>
                              {activity.expires_at && (
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    Expires:{" "}
                                    {new Date(
                                      activity.expires_at
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteActivity(activity.id)}
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

      {/* Guidelines */}
      <Card className="border-l-4 border-l-[#F26623]">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
          <CardTitle className="flex items-center text-[#F26623]">
            <Info className="h-5 w-5 mr-2" />
            Professional Banking Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Real-time Delivery</p>
                  <p className="text-xs text-gray-600">
                    Activities appear instantly in user dashboards
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Balance Protection</p>
                  <p className="text-xs text-gray-600">
                    No impact on actual account balances
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    Professional Templates
                  </p>
                  <p className="text-xs text-gray-600">
                    Bank-grade messaging standards
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Audit Trail</p>
                  <p className="text-xs text-gray-600">
                    Complete logging and admin identification
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Compliance Ready</p>
                  <p className="text-xs text-gray-600">
                    Meets banking communication standards
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Zap className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    Ultra-Fast Performance
                  </p>
                  <p className="text-xs text-gray-600">
                    Optimized for instant user selection
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
