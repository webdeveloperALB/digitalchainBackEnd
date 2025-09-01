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
  Calculator,
  Users,
  DollarSign,
  FileText,
  Loader2,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  X,
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
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  kyc_status: string;
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
  // Core state
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(false);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form states
  const [taxType, setTaxType] = useState<string>("");
  const [taxName, setTaxName] = useState<string>("");
  const [taxAmount, setTaxAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [description, setDescription] = useState<string>("");

  // Tax types
  const taxTypes = [
    { value: "income", label: "Income Tax" },
    { value: "property", label: "Property Tax" },
    { value: "sales", label: "Sales Tax" },
    { value: "other", label: "Other Tax" },
  ];

  const taxStatuses = [
    {
      value: "pending",
      label: "Pending",
      color: "bg-yellow-100 text-yellow-800",
    },
    { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
    { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-800" },
  ];

  useEffect(() => {
    setupRealtimeSubscription();
  }, []);

  // Ultra-fast user search
  useEffect(() => {
    if (userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select(
            "id, email, full_name, first_name, last_name, created_at, kyc_status"
          )
          .or(`email.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`)
          .limit(8)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            email: user.email,
            full_name:
              user.full_name ||
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              user.email?.split("@")[0] ||
              "Unknown",
            first_name: user.first_name,
            last_name: user.last_name,
            created_at: user.created_at,
            kyc_status: user.kyc_status,
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

  useEffect(() => {
    if (selectedUser) {
      fetchTaxesForUser(selectedUser.id);
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
            fetchTaxesForUser(selectedUser.id);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const fetchTaxesForUser = async (userId: string) => {
    setTaxesLoading(true);
    try {
      if (!selectedUser) return;

      const { data, error } = await supabase
        .from("taxes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const taxesWithUserInfo = (data || []).map((tax) => ({
        ...tax,
        user_full_name: selectedUser?.full_name,
        user_email: selectedUser?.email,
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
    setTaxAmount("");
    setDueDate("");
    setStatus("pending");
    setDescription("");
    setEditingTax(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !taxType || !taxName || !taxAmount) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      const taxAmountNum = Number.parseFloat(taxAmount);
      const clientId = `DCB${selectedUser.id.slice(0, 6)}`;

      const taxData = {
        user_id: selectedUser.id,
        client_id: clientId,
        tax_type: taxType,
        tax_name: taxName,
        tax_rate: 0.0, // Default rate, can be calculated later
        tax_amount: taxAmountNum,
        taxable_income: taxAmountNum,
        tax_period: "yearly",
        due_date: dueDate || null,
        status: status,
        description: description || null,
        tax_year: new Date().getFullYear(),
        is_active: true,
        is_estimated: false,
        created_by: currentUser?.email || "admin",
        payment_reference: null,
      };

      let result;
      if (editingTax) {
        result = await supabase
          .from("taxes")
          .update(taxData)
          .eq("id", editingTax.id);
      } else {
        result = await supabase.from("taxes").insert([taxData]);
      }

      if (result.error) throw result.error;

      setMessage({
        type: "success",
        text: `Tax ${editingTax ? "updated" : "created"} successfully for ${
          selectedUser.full_name || selectedUser.email
        }`,
      });

      resetForm();
      setIsDialogOpen(false);
      fetchTaxesForUser(selectedUser.id);
    } catch (error: any) {
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
    setTaxAmount(tax.tax_amount.toString());
    setDueDate(tax.due_date || "");
    setStatus(tax.status);
    setDescription(tax.description || "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (taxId: string) => {
    if (!confirm("Are you sure you want to delete this tax record?")) return;

    try {
      const { error } = await supabase.from("taxes").delete().eq("id", taxId);
      if (error) throw error;

      setMessage({ type: "success", text: "Tax record deleted successfully" });
      if (selectedUser) {
        fetchTaxesForUser(selectedUser.id);
      }
    } catch (error: any) {
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
      if (selectedUser) {
        fetchTaxesForUser(selectedUser.id);
      }
    } catch (error: any) {
      console.error("Error updating tax status:", error);
      setMessage({ type: "error", text: "Failed to update tax status" });
    }
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
              Tax Manager - Fast User Search
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
                  Add Tax
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingTax ? "Edit Tax" : "Add New Tax"}
                  </DialogTitle>
                  <DialogDescription>
                    Fill in the basic tax information
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="tax-type">Tax Type *</Label>
                    <Select value={taxType} onValueChange={setTaxType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tax type" />
                      </SelectTrigger>
                      <SelectContent>
                        {taxTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                  <div>
                    <Label htmlFor="tax-amount">Tax Amount ($) *</Label>
                    <Input
                      id="tax-amount"
                      type="number"
                      step="0.01"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      placeholder="5000.00"
                      required
                    />
                  </div>

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
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="description">Notes (Optional)</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Additional notes..."
                      rows={2}
                    />
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
                      disabled={loading || !taxType || !taxName || !taxAmount}
                      className="bg-[#F26623] hover:bg-[#E55A1F]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {editingTax ? "Updating..." : "Adding..."}
                        </>
                      ) : (
                        <>{editingTax ? "Update" : "Add Tax"}</>
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
            {/* Fast User Search and Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Search & Select Client</h3>

              {selectedUser ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">
                        {selectedUser.full_name || selectedUser.email}
                      </p>
                      <p className="text-sm text-green-600">
                        DCB{selectedUser.id.slice(0, 6)} • {selectedUser.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedUser(null);
                      setUserSearch("");
                      setTaxes([]);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Type name or email to search clients..."
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
                                  DCB{user.id.slice(0, 6)} • {user.email}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : !searching ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No clients found matching "{userSearch}"
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

              {selectedUser && (
                <Button
                  onClick={() => fetchTaxesForUser(selectedUser.id)}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              )}
            </div>

            {/* Tax Records */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold">
                Tax Records
                {selectedUser && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({taxes.length})
                  </span>
                )}
              </h3>

              {!selectedUser ? (
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Search and select a client to view tax records</p>
                  <p className="text-xs mt-2">
                    Type 2+ characters to search all clients
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
                  <p>No tax records found</p>
                  <p className="text-xs">Add a new tax record to get started</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {taxes.map((tax) => (
                    <div
                      key={tax.id}
                      className="p-4 border rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-gray-500" />
                          <h4 className="font-medium">{tax.tax_name}</h4>
                          <Badge className={getStatusColor(tax.status)}>
                            {tax.status}
                          </Badge>
                        </div>
                        <div className="flex space-x-1">
                          <Select
                            value={tax.status}
                            onValueChange={(newStatus) =>
                              updateTaxStatus(tax.id, newStatus)
                            }
                          >
                            <SelectTrigger className="w-24 h-8">
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
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(tax.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Amount: </span>
                          {formatCurrency(tax.tax_amount)}
                        </div>
                        <div>
                          <span className="font-medium">Due: </span>
                          {formatDate(tax.due_date)}
                        </div>
                      </div>

                      {tax.description && (
                        <p className="text-xs text-gray-500 mt-2">
                          {tax.description}
                        </p>
                      )}
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
