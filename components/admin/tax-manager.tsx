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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import {
  Calculator,
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  Building2,
  Receipt,
  Loader2,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

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
  user_full_name?: string;
  user_email?: string;
}

export default function TaxManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form states
  const [taxType, setTaxType] = useState<string>("");
  const [taxName, setTaxName] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("");
  const [taxAmount, setTaxAmount] = useState<string>("");
  const [taxableIncome, setTaxableIncome] = useState<string>("");
  const [taxPeriod, setTaxPeriod] = useState<string>("yearly");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [description, setDescription] = useState<string>("");
  const [taxYear, setTaxYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [isEstimated, setIsEstimated] = useState<boolean>(false);

  const taxTypes = [
    { value: "income", label: "Income Tax", icon: DollarSign },
    { value: "property", label: "Property Tax", icon: Building2 },
    { value: "sales", label: "Sales Tax", icon: Receipt },
    { value: "capital_gains", label: "Capital Gains Tax", icon: TrendingUp },
    { value: "corporate", label: "Corporate Tax", icon: Building2 },
    { value: "payroll", label: "Payroll Tax", icon: Users },
    { value: "excise", label: "Excise Tax", icon: FileText },
    { value: "other", label: "Other Tax", icon: Calculator },
  ];

  const taxPeriods = [
    { value: "yearly", label: "Annual" },
    { value: "quarterly", label: "Quarterly" },
    { value: "monthly", label: "Monthly" },
    { value: "weekly", label: "Weekly" },
    { value: "one-time", label: "One-time" },
  ];

  const taxStatuses = [
    {
      value: "pending",
      label: "Pending",
      color: "bg-yellow-100 text-yellow-800",
    },
    { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
    { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-800" },
    {
      value: "processing",
      label: "Processing",
      color: "bg-blue-100 text-blue-800",
    },
    {
      value: "cancelled",
      label: "Cancelled",
      color: "bg-gray-100 text-gray-800",
    },
  ];

  useEffect(() => {
    fetchUsers();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchTaxesForUser(selectedUser);
    }
  }, [selectedUser]);

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel("taxes_admin_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "taxes",
        },
        (payload) => {
          console.log("Tax change detected:", payload);
          if (selectedUser) {
            fetchTaxesForUser(selectedUser);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, client_id, full_name, email, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
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

  const fetchTaxesForUser = async (userId: string) => {
    setTaxesLoading(true);
    try {
      const selectedUserData = users.find((u) => u.id === userId);
      if (!selectedUserData) return;

      const { data, error } = await supabase
        .from("taxes")
        .select("*")
        .or(`user_id.eq.${userId},client_id.eq.${selectedUserData.client_id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Add user info to each tax record
      const taxesWithUserInfo = (data || []).map((tax) => ({
        ...tax,
        user_full_name: selectedUserData.full_name,
        user_email: selectedUserData.email,
      }));

      setTaxes(taxesWithUserInfo);
    } catch (error) {
      console.error("Error fetching taxes:", error);
      setMessage({ type: "error", text: "Failed to load tax records" });
    } finally {
      setTaxesLoading(false);
    }
  };

  const resetForm = () => {
    setTaxType("");
    setTaxName("");
    setTaxRate("");
    setTaxAmount("");
    setTaxableIncome("");
    setTaxPeriod("yearly");
    setDueDate("");
    setStatus("pending");
    setDescription("");
    setTaxYear(new Date().getFullYear().toString());
    setIsEstimated(false);
    setEditingTax(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !taxType || !taxName) {
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

      const taxData = {
        user_id: selectedUser,
        client_id: selectedUserData.client_id,
        tax_type: taxType,
        tax_name: taxName,
        tax_rate: Number.parseFloat(taxRate) || 0,
        tax_amount: Number.parseFloat(taxAmount) || 0,
        taxable_income: Number.parseFloat(taxableIncome) || 0,
        tax_period: taxPeriod,
        due_date: dueDate || null,
        status: status,
        description: description || null,
        tax_year: Number.parseInt(taxYear),
        is_active: true,
        is_estimated: isEstimated,
        created_by: currentUser?.email || "admin",
      };

      let result;
      if (editingTax) {
        // Update existing tax
        result = await supabase
          .from("taxes")
          .update(taxData)
          .eq("id", editingTax.id);
      } else {
        // Create new tax
        result = await supabase.from("taxes").insert([taxData]);
      }

      if (result.error) throw result.error;

      setMessage({
        type: "success",
        text: `Tax ${editingTax ? "updated" : "created"} successfully for ${
          selectedUserData.full_name || selectedUserData.email
        }`,
      });

      resetForm();
      setIsDialogOpen(false);
      fetchTaxesForUser(selectedUser);
    } catch (error) {
      console.error("Error saving tax:", error);
      setMessage({ type: "error", text: "Failed to save tax record" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tax: Tax) => {
    setEditingTax(tax);
    setTaxType(tax.tax_type);
    setTaxName(tax.tax_name);
    setTaxRate(tax.tax_rate.toString());
    setTaxAmount(tax.tax_amount.toString());
    setTaxableIncome(tax.taxable_income.toString());
    setTaxPeriod(tax.tax_period);
    setDueDate(tax.due_date || "");
    setStatus(tax.status);
    setDescription(tax.description || "");
    setTaxYear(tax.tax_year.toString());
    setIsEstimated(tax.is_estimated);
    setIsDialogOpen(true);
  };

  const handleDelete = async (taxId: string) => {
    if (!confirm("Are you sure you want to delete this tax record?")) return;

    try {
      const { error } = await supabase.from("taxes").delete().eq("id", taxId);
      if (error) throw error;

      setMessage({ type: "success", text: "Tax record deleted successfully" });
      fetchTaxesForUser(selectedUser);
    } catch (error) {
      console.error("Error deleting tax:", error);
      setMessage({ type: "error", text: "Failed to delete tax record" });
    }
  };

  const updateTaxStatus = async (taxId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("taxes")
        .update({ status: newStatus })
        .eq("id", taxId);
      if (error) throw error;

      setMessage({
        type: "success",
        text: `Tax status updated to ${newStatus}`,
      });
      fetchTaxesForUser(selectedUser);
    } catch (error) {
      console.error("Error updating tax status:", error);
      setMessage({ type: "error", text: "Failed to update tax status" });
    }
  };

  const getTaxIcon = (taxType: string) => {
    const type = taxTypes.find((t) => t.value === taxType);
    if (type) {
      const IconComponent = type.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    return <Calculator className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    const statusObj = taxStatuses.find((s) => s.value === status);
    return statusObj?.color || "bg-gray-100 text-gray-800";
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Tax Management System
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                  disabled={!selectedUser}
                  className="bg-[#F26623] hover:bg-[#E55A1F]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Tax
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTax ? "Edit Tax Record" : "Create New Tax Record"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTax
                      ? "Update the tax information below"
                      : "Fill in the tax details for the selected user"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tax-type">Tax Type *</Label>
                      <Select value={taxType} onValueChange={setTaxType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax type" />
                        </SelectTrigger>
                        <SelectContent>
                          {taxTypes.map((type) => (
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
                      <Label htmlFor="tax-period">Tax Period</Label>
                      <Select value={taxPeriod} onValueChange={setTaxPeriod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taxPeriods.map((period) => (
                            <SelectItem key={period.value} value={period.value}>
                              {period.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="tax-name">Tax Name *</Label>
                    <Input
                      id="tax-name"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                      placeholder="e.g., Federal Income Tax 2024"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                      <Input
                        id="tax-rate"
                        type="number"
                        step="0.0001"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        placeholder="0.2200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tax-amount">Tax Amount ($)</Label>
                      <Input
                        id="tax-amount"
                        type="number"
                        step="0.01"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                        placeholder="5000.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxable-income">Taxable Income ($)</Label>
                      <Input
                        id="taxable-income"
                        type="number"
                        step="0.01"
                        value={taxableIncome}
                        onChange={(e) => setTaxableIncome(e.target.value)}
                        placeholder="50000.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="due-date">Due Date</Label>
                      <Input
                        id="due-date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taxStatuses.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              <Badge className={s.color}>{s.label}</Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tax-year">Tax Year</Label>
                      <Input
                        id="tax-year"
                        type="number"
                        value={taxYear}
                        onChange={(e) => setTaxYear(e.target.value)}
                        placeholder="2024"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Additional tax details..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is-estimated"
                      checked={isEstimated}
                      onCheckedChange={(checked) =>
                        setIsEstimated(checked as boolean)
                      }
                    />
                    <Label htmlFor="is-estimated">
                      This is an estimated tax
                    </Label>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !taxType || !taxName}
                      className="bg-[#F26623] hover:bg-[#E55A1F]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editingTax ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>{editingTax ? "Update Tax" : "Create Tax"}</>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert
              className={`mb-4 ${
                message.type === "error"
                  ? "border-red-500 bg-red-50"
                  : "border-green-500 bg-green-50"
              }`}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select User</h3>
              <div>
                <Label htmlFor="user-select">Choose User *</Label>
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
              {selectedUser && (
                <div className="mt-4">
                  <Button
                    onClick={() => fetchTaxesForUser(selectedUser)}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Tax Records
                  </Button>
                </div>
              )}
            </div>
            {/* Tax Records */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold">
                Tax Records
                {selectedUser && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({taxes.length} records)
                  </span>
                )}
              </h3>
              {!selectedUser ? (
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    Select a user to view their tax records
                  </p>
                </div>
              ) : taxesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-4 border rounded-lg animate-pulse"
                    >
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : taxes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No tax records found for this user</p>
                  <p className="text-xs">
                    Create a new tax record to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {taxes.map((tax) => (
                    <div
                      key={tax.id}
                      className="p-4 border rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            {getTaxIcon(tax.tax_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium">{tax.tax_name}</h4>
                              <Badge className={getStatusColor(tax.status)}>
                                {tax.status}
                              </Badge>
                              {tax.is_estimated && (
                                <Badge variant="outline" className="text-xs">
                                  Estimated
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Amount: </span>
                                {formatCurrency(tax.tax_amount)}
                              </div>
                              <div>
                                <span className="font-medium">Rate: </span>
                                {(tax.tax_rate * 100).toFixed(2)}%
                              </div>
                              <div>
                                <span className="font-medium">Due: </span>
                                {formatDate(tax.due_date)}
                              </div>
                              <div>
                                <span className="font-medium">Year: </span>
                                {tax.tax_year}
                              </div>
                            </div>
                            {tax.description && (
                              <p className="text-xs text-gray-500 mt-2">
                                {tax.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Select
                            value={tax.status}
                            onValueChange={(newStatus) =>
                              updateTaxStatus(tax.id, newStatus)
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {taxStatuses.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(tax)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(tax.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
