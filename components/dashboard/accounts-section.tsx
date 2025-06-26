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
import { Plus, Trash2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function AccountsSection() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    account_name: "",
    bank_name: "",
    account_number: "",
    routing_number: "",
    account_type: "Checking",
    currency: "USD",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setError(null);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(`Authentication error: ${userError.message}`);
      }

      if (!user) {
        throw new Error("No authenticated user found");
      }

      console.log("Fetching accounts for user:", user.id);

      const { data, error: fetchError } = await supabase
        .from("external_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Supabase error:", fetchError);
        throw new Error(`Database error: ${fetchError.message}`);
      }

      console.log("Fetched accounts:", data);
      setAccounts(data || []);
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      setError(error.message || "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async () => {
    try {
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No authenticated user found");
      }

      const { error } = await supabase.from("external_accounts").insert({
        user_id: user.id,
        ...formData,
      });

      if (error) throw error;

      setFormData({
        account_name: "",
        bank_name: "",
        account_number: "",
        routing_number: "",
        account_type: "Checking",
        currency: "USD",
      });
      setShowAddForm(false);
      fetchAccounts();
      alert("Account added successfully!");
    } catch (error: any) {
      console.error("Error adding account:", error);
      setError(error.message || "Failed to add account");
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      setError(null);
      const { error } = await supabase
        .from("external_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchAccounts();
      alert("Account deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setError(error.message || "Failed to delete account");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623]"></div>
          <span className="ml-2">Loading accounts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <div>
                <h3 className="font-medium text-red-800">
                  Error Loading Accounts
                </h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <Button
                  onClick={fetchAccounts}
                  variant="outline"
                  size="sm"
                  className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">External Bank Accounts</h2>
        <Button
          onClick={() => setShowAddForm(true)}
          className="bg-[#F26623] hover:bg-[#E55A1F]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Bank Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  value={formData.account_name}
                  onChange={(e) =>
                    setFormData({ ...formData, account_name: e.target.value })
                  }
                  placeholder="My Checking Account"
                />
              </div>
              <div>
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) =>
                    setFormData({ ...formData, bank_name: e.target.value })
                  }
                  placeholder="Chase Bank"
                />
              </div>
              <div>
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) =>
                    setFormData({ ...formData, account_number: e.target.value })
                  }
                  placeholder="1234567890"
                />
              </div>
              <div>
                <Label htmlFor="routing_number">Routing Number</Label>
                <Input
                  id="routing_number"
                  value={formData.routing_number}
                  onChange={(e) =>
                    setFormData({ ...formData, routing_number: e.target.value })
                  }
                  placeholder="021000021"
                />
              </div>
              <div>
                <Label htmlFor="account_type">Account Type</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, account_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Checking">Checking</SelectItem>
                    <SelectItem value="Savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={addAccount}
                className="bg-[#F26623] hover:bg-[#E55A1F]"
              >
                Add Account
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">No external accounts added yet.</p>
            </CardContent>
          </Card>
        ) : (
          accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {account.account_name}
                    </h3>
                    <p className="text-gray-600">{account.bank_name}</p>
                    <p className="text-sm text-gray-500">
                      {account.account_type} • {account.currency}
                    </p>
                    <p className="text-sm text-gray-500">
                      ****{account.account_number.slice(-4)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.is_verified ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Verified
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-600">
                        <XCircle className="w-4 h-4 mr-1" />
                        Pending
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAccount(account.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
