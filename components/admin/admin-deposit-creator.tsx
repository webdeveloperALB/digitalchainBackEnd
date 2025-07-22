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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Building,
  Wallet,
  Send,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
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
  user_email?: string;
  user_name?: string;
}

export default function AdminDepositCreator() {
  const [users, setUsers] = useState<User[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [depositsLoading, setDepositsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // Bank deposit form
  const [bankForm, setBankForm] = useState({
    currency: "",
    amount: "",
    bank_name: "",
    account_holder_name: "",
    account_number: "",
    routing_number: "",
    swift_code: "",
    iban: "",
    bank_address: "",
    wire_reference: "",
    correspondent_bank: "",
    admin_notes: "",
    auto_approve: true,
  });

  // Crypto deposit form
  const [cryptoForm, setCryptoForm] = useState({
    cryptocurrency: "",
    amount: "",
    network: "",
    from_wallet: "",
    to_wallet: "",
    transaction_hash: "",
    block_confirmations: "",
    gas_fee: "",
    admin_notes: "",
    auto_approve: true,
  });

  useEffect(() => {
    fetchUsers();
    fetchDeposits();

    // Set up real-time subscription
    const subscription = supabase
      .channel("admin_deposits_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposits",
        },
        (payload) => {
          console.log("Admin deposit change received:", payload);
          fetchDeposits();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, client_id, full_name, email, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, email, first_name, last_name, full_name, created_at")
          .order("created_at", { ascending: false });

        if (usersError) throw usersError;

        const transformedUsers = (usersData || []).map((user) => ({
          id: user.id,
          client_id: `DCB${user.id.slice(0, 6)}`,
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

  const fetchDeposits = async () => {
    try {
      const { data, error } = await supabase
        .from("deposits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get user info for each deposit
      const depositsWithUserInfo = await Promise.all(
        (data || []).map(async (deposit) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", deposit.user_id)
            .single();

          if (profileData) {
            return {
              ...deposit,
              user_email: profileData.email,
              user_name: profileData.full_name,
            };
          }

          const { data: userData } = await supabase
            .from("users")
            .select("first_name, last_name, full_name, email")
            .eq("id", deposit.user_id)
            .single();

          return {
            ...deposit,
            user_email: userData?.email,
            user_name:
              userData?.full_name ||
              `${userData?.first_name || ""} ${
                userData?.last_name || ""
              }`.trim(),
          };
        })
      );

      setDeposits(depositsWithUserInfo);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      setMessage({ type: "error", text: "Failed to load deposits" });
    } finally {
      setDepositsLoading(false);
    }
  };

  // Helper function to get balance table name
  const getBalanceTableName = (currency: string) => {
    switch (currency.toUpperCase()) {
      case "USD":
        return "usd_balances";
      case "EUR":
        return "euro_balances";
      case "CAD":
        return "cad_balances";
      case "BTC":
      case "ETH":
      case "USDT":
      case "USDC":
      case "BNB":
      case "ADA":
      case "DOT":
      case "LINK":
      case "CRYPTO": // Keep this as fallback
        return "crypto_balances";
      default:
        return "usd_balances";
    }
  };

  // Helper function to update balance in separate table
  const updateUserBalance = async (
    userId: string,
    currency: string,
    amount: number
  ) => {
    const tableName = getBalanceTableName(currency);

    console.log(`🔄 Starting balance update:`, {
      userId,
      currency,
      amount,
      tableName,
    });

    try {
      // First, try to get existing balance
      console.log(`📊 Fetching existing balance from ${tableName}...`);
      const { data: existingBalance, error: fetchError } = await supabase
        .from(tableName)
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 is "not found" error, which is expected for new users
        console.error(`❌ Fetch error for ${tableName}:`, fetchError);
        throw new Error(
          `Failed to fetch balance from ${tableName}: ${fetchError.message}`
        );
      }

      if (existingBalance) {
        // Update existing balance
        const currentBalance = Number(existingBalance.balance) || 0;
        const newBalance = currentBalance + amount;

        console.log(`📈 Updating existing balance:`, {
          currentBalance,
          amount,
          newBalance,
        });

        // Prevent negative balances (optional safety check)
        if (newBalance < 0) {
          throw new Error(
            `Insufficient balance. Current: ${currentBalance}, Attempted change: ${amount}`
          );
        }

        const { error: updateError } = await supabase
          .from(tableName)
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateError) {
          console.error(`❌ Update error for ${tableName}:`, updateError);
          throw new Error(
            `Failed to update balance in ${tableName}: ${updateError.message}`
          );
        }

        console.log(
          `✅ Balance updated in ${tableName}: ${currentBalance} -> ${newBalance}`
        );
      } else {
        // Create new balance record (only if amount is positive)
        if (amount < 0) {
          throw new Error("Cannot create negative balance for new user");
        }

        console.log(
          `📝 Creating new balance record in ${tableName} with amount: ${amount}`
        );

        const { error: insertError } = await supabase.from(tableName).insert({
          user_id: userId,
          balance: amount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error(`❌ Insert error for ${tableName}:`, insertError);
          throw new Error(
            `Failed to create balance record in ${tableName}: ${insertError.message}`
          );
        }

        console.log(`✅ New balance created in ${tableName}: ${amount}`);
      }

      return true;
    } catch (error) {
      console.error(`💥 Error updating balance in ${tableName}:`, error);
      throw error;
    }
  };

  const submitBankDeposit = async () => {
    if (
      !selectedUser ||
      !bankForm.currency ||
      !bankForm.amount ||
      !bankForm.bank_name
    ) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const selectedUserData = users.find((u) => u.id === selectedUser);
      if (!selectedUserData) {
        throw new Error("Selected user not found");
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      const referenceId = `BANK-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create deposit record
      const { error: depositError } = await supabase.from("deposits").insert({
        user_id: selectedUser,
        currency: bankForm.currency,
        amount: Number.parseFloat(bankForm.amount),
        method: "Bank Transfer",
        reference_id: referenceId,
        status: bankForm.auto_approve ? "Approved" : "Pending Review",
        bank_details: {
          bank_name: bankForm.bank_name,
          account_holder_name: bankForm.account_holder_name,
          account_number: bankForm.account_number,
          routing_number: bankForm.routing_number,
          swift_code: bankForm.swift_code,
          iban: bankForm.iban,
          bank_address: bankForm.bank_address,
          wire_reference: bankForm.wire_reference,
          correspondent_bank: bankForm.correspondent_bank,
          processed_by: currentUser?.email || "System Admin",
          processing_date: new Date().toISOString(),
        },
        admin_notes:
          bankForm.admin_notes ||
          `Bank deposit processed by ${currentUser?.email || "System Admin"}`,
      });

      if (depositError) {
        console.error("Deposit creation error:", depositError);
        throw depositError;
      }

      // Create transaction record using correct column name
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: selectedUser,
          transaction_type: "Deposit", // Using correct column name
          amount: Number.parseFloat(bankForm.amount),
          currency: bankForm.currency,
          description: `Bank transfer deposit from ${bankForm.bank_name}`,
          platform: "Bank Transfer",
          status: bankForm.auto_approve ? "Completed" : "Pending",
          reference_id: referenceId,
        });

      if (transactionError) {
        console.error("Transaction creation error:", transactionError);
        throw transactionError;
      }

      // If auto-approve is enabled, update user balance in separate table
      if (bankForm.auto_approve) {
        try {
          await updateUserBalance(
            selectedUser,
            bankForm.currency,
            Number.parseFloat(bankForm.amount)
          );
        } catch (balanceError) {
          console.error("Balance operation failed:", balanceError);
          setMessage({
            type: "success",
            text: `Deposit created successfully but balance update failed. Please update manually. Reference: ${referenceId}`,
          });
        }
      }

      setBankForm({
        currency: "",
        amount: "",
        bank_name: "",
        account_holder_name: "",
        account_number: "",
        routing_number: "",
        swift_code: "",
        iban: "",
        bank_address: "",
        wire_reference: "",
        correspondent_bank: "",
        admin_notes: "",
        auto_approve: true,
      });
      setSelectedUser("");

      if (!message) {
        setMessage({
          type: "success",
          text: `Bank deposit successfully processed for ${
            selectedUserData.full_name || selectedUserData.email
          }! Reference: ${referenceId}`,
        });
      }

      fetchDeposits();
    } catch (error: any) {
      console.error("Error creating bank deposit:", error);
      setMessage({
        type: "error",
        text: `Error: ${error.message || "Unknown error occurred"}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitCryptoDeposit = async () => {
    if (!selectedUser || !cryptoForm.cryptocurrency || !cryptoForm.amount) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const selectedUserData = users.find((u) => u.id === selectedUser);
      if (!selectedUserData) {
        throw new Error("Selected user not found");
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      const referenceId = `CRYPTO-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create deposit record
      const { error: depositError } = await supabase.from("deposits").insert({
        user_id: selectedUser,
        currency: cryptoForm.cryptocurrency, // Changed from "CRYPTO"
        amount: Number.parseFloat(cryptoForm.amount),
        method: "Crypto Transfer",
        reference_id: referenceId,
        status: cryptoForm.auto_approve ? "Approved" : "Pending Confirmation",
        crypto_details: {
          cryptocurrency: cryptoForm.cryptocurrency,
          network: cryptoForm.network,
          from_wallet: cryptoForm.from_wallet,
          to_wallet: cryptoForm.to_wallet,
          transaction_hash: cryptoForm.transaction_hash,
          block_confirmations: cryptoForm.block_confirmations,
          gas_fee: cryptoForm.gas_fee,
          processed_by: currentUser?.email || "System Admin",
          processing_date: new Date().toISOString(),
        },
        admin_notes:
          cryptoForm.admin_notes ||
          `Crypto deposit processed by ${currentUser?.email || "System Admin"}`,
      });

      if (depositError) {
        console.error("Crypto deposit creation error:", depositError);
        throw depositError;
      }

      // Create transaction record using correct column name
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: selectedUser,
          transaction_type: "Deposit", // Using correct column name
          amount: Number.parseFloat(cryptoForm.amount),
          currency: cryptoForm.cryptocurrency, // Changed from "CRYPTO"
          description: `${cryptoForm.cryptocurrency} deposit`,
          platform: "Crypto Transfer",
          status: cryptoForm.auto_approve ? "Completed" : "Pending",
          reference_id: referenceId,
        });

      if (transactionError) {
        console.error("Crypto transaction creation error:", transactionError);
        throw transactionError;
      }

      // If auto-approve is enabled, update user balance in crypto_balances table
      if (cryptoForm.auto_approve) {
        try {
          await updateUserBalance(
            selectedUser,
            cryptoForm.cryptocurrency, // Changed from "CRYPTO"
            Number.parseFloat(cryptoForm.amount)
          );
        } catch (balanceError) {
          console.error("Crypto balance operation failed:", balanceError);
          setMessage({
            type: "success",
            text: `Crypto deposit created successfully but balance update failed. Please update manually. Reference: ${referenceId}`,
          });
        }
      }

      setCryptoForm({
        cryptocurrency: "",
        amount: "",
        network: "",
        from_wallet: "",
        to_wallet: "",
        transaction_hash: "",
        block_confirmations: "",
        gas_fee: "",
        admin_notes: "",
        auto_approve: true,
      });
      setSelectedUser("");

      if (!message) {
        setMessage({
          type: "success",
          text: `Crypto deposit successfully processed for ${
            selectedUserData.full_name || selectedUserData.email
          }! Reference: ${referenceId}`,
        });
      }

      fetchDeposits();
    } catch (error: any) {
      console.error("Error creating crypto deposit:", error);
      setMessage({
        type: "error",
        text: `Error: ${error.message || "Unknown error occurred"}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateDepositStatus = async (
    depositId: string,
    newStatus: string,
    notes?: string
  ) => {
    try {
      // First, get the current deposit details
      const deposit = deposits.find((d) => d.id === depositId);
      if (!deposit) {
        throw new Error("Deposit not found");
      }

      const previousStatus = deposit.status;

      // Update deposit status
      const { error } = await supabase
        .from("deposits")
        .update({
          status: newStatus,
          admin_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", depositId);

      if (error) {
        console.error("Status update error:", error);
        throw new Error(`Failed to update deposit status: ${error.message}`);
      }

      // Handle balance updates based on status changes
      if (newStatus === "Approved" && previousStatus !== "Approved") {
        // Only update balance if moving TO approved status (and wasn't already approved)
        try {
          await updateUserBalance(
            deposit.user_id,
            deposit.currency,
            deposit.amount
          );
          console.log(
            `Balance updated: +${deposit.amount} ${deposit.currency} for user ${deposit.user_id}`
          );
        } catch (balanceError) {
          console.error("Balance operation failed on approval:", balanceError);
          // Revert the status update if balance update fails
          await supabase
            .from("deposits")
            .update({
              status: previousStatus,
              admin_notes: `Balance update failed: ${balanceError}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", depositId);

          throw new Error(
            `Deposit status updated but balance update failed: ${balanceError}`
          );
        }
      } else if (previousStatus === "Approved" && newStatus !== "Approved") {
        // If moving FROM approved status, we need to subtract the balance
        try {
          await updateUserBalance(
            deposit.user_id,
            deposit.currency,
            -deposit.amount
          );
          console.log(
            `Balance updated: -${deposit.amount} ${deposit.currency} for user ${deposit.user_id}`
          );
        } catch (balanceError) {
          console.error("Balance reversal failed:", balanceError);
          // This is a critical error - we should probably alert admins
          setMessage({
            type: "error",
            text: `Status updated but balance reversal failed. Manual intervention required: ${balanceError}`,
          });
          return;
        }
      }

      setMessage({
        type: "success",
        text: `Deposit status updated to ${newStatus}`,
      });
      fetchDeposits();
    } catch (error: any) {
      console.error("Error updating deposit status:", error);
      setMessage({
        type: "error",
        text: `Error: ${error.message || "Unknown error occurred"}`,
      });
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
      case "Completed":
        return <CheckCircle className="w-4 h-4" />;
      case "Pending Review":
      case "Pending Confirmation":
      case "Pending":
        return <Clock className="w-4 h-4" />;
      case "Rejected":
      case "Failed":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deposit Creation Forms */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Create Deposit for User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search by name or email..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {users
                        .filter((user) => {
                          if (!userSearch) return true;
                          const searchLower = userSearch.toLowerCase();
                          const name = (user.full_name || "").toLowerCase();
                          const email = (user.email || "").toLowerCase();
                          return (
                            name.includes(searchLower) ||
                            email.includes(searchLower)
                          );
                        })
                        .map((user) => (
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
                      {users.filter((user) => {
                        if (!userSearch) return true;
                        const searchLower = userSearch.toLowerCase();
                        const name = (user.full_name || "").toLowerCase();
                        const email = (user.email || "").toLowerCase();
                        return (
                          name.includes(searchLower) ||
                          email.includes(searchLower)
                        );
                      }).length === 0 &&
                        userSearch && (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No users found matching "{userSearch}"
                          </div>
                        )}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <Tabs defaultValue="bank" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bank" className="flex items-center">
                    <Building className="w-4 h-4 mr-2" />
                    Bank Deposit
                  </TabsTrigger>
                  <TabsTrigger value="crypto" className="flex items-center">
                    <Wallet className="w-4 h-4 mr-2" />
                    Crypto Deposit
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="bank" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bank-currency">Currency *</Label>
                      <Select
                        value={bankForm.currency}
                        onValueChange={(value) =>
                          setBankForm({ ...bankForm, currency: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">US Dollar (USD)</SelectItem>
                          <SelectItem value="EUR">Euro (EUR)</SelectItem>
                          <SelectItem value="CAD">
                            Canadian Dollar (CAD)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="bank-amount">Amount *</Label>
                      <Input
                        id="bank-amount"
                        type="number"
                        step="0.01"
                        value={bankForm.amount}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, amount: e.target.value })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bank-name">Bank Name *</Label>
                      <Input
                        id="bank-name"
                        value={bankForm.bank_name}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            bank_name: e.target.value,
                          })
                        }
                        placeholder="e.g., JPMorgan Chase Bank"
                      />
                    </div>
                    <div>
                      <Label htmlFor="account-holder">
                        Account Holder Name
                      </Label>
                      <Input
                        id="account-holder"
                        value={bankForm.account_holder_name}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            account_holder_name: e.target.value,
                          })
                        }
                        placeholder="Full name on account"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="account-number">Account Number</Label>
                      <Input
                        id="account-number"
                        value={bankForm.account_number}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            account_number: e.target.value,
                          })
                        }
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="routing-number">Routing Number</Label>
                      <Input
                        id="routing-number"
                        value={bankForm.routing_number}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            routing_number: e.target.value,
                          })
                        }
                        placeholder="9-digit routing number"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="swift-code">SWIFT/BIC Code</Label>
                      <Input
                        id="swift-code"
                        value={bankForm.swift_code}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            swift_code: e.target.value,
                          })
                        }
                        placeholder="e.g., CHASUS33"
                      />
                    </div>
                    <div>
                      <Label htmlFor="iban">IBAN</Label>
                      <Input
                        id="iban"
                        value={bankForm.iban}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, iban: e.target.value })
                        }
                        placeholder="International Bank Account Number"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bank-address">Bank Address</Label>
                    <Textarea
                      id="bank-address"
                      value={bankForm.bank_address}
                      onChange={(e) =>
                        setBankForm({
                          ...bankForm,
                          bank_address: e.target.value,
                        })
                      }
                      placeholder="Full address of the bank branch"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="wire-reference">Wire Reference</Label>
                      <Input
                        id="wire-reference"
                        value={bankForm.wire_reference}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            wire_reference: e.target.value,
                          })
                        }
                        placeholder="Wire transfer reference"
                      />
                    </div>
                    <div>
                      <Label htmlFor="correspondent-bank">
                        Correspondent Bank
                      </Label>
                      <Input
                        id="correspondent-bank"
                        value={bankForm.correspondent_bank}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            correspondent_bank: e.target.value,
                          })
                        }
                        placeholder="If applicable"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bank-admin-notes">Admin Notes</Label>
                    <Textarea
                      id="bank-admin-notes"
                      value={bankForm.admin_notes}
                      onChange={(e) =>
                        setBankForm({
                          ...bankForm,
                          admin_notes: e.target.value,
                        })
                      }
                      placeholder="Internal notes about this deposit"
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="bank-auto-approve"
                      checked={bankForm.auto_approve}
                      onChange={(e) =>
                        setBankForm({
                          ...bankForm,
                          auto_approve: e.target.checked,
                        })
                      }
                      className="rounded"
                      aria-label="Auto-approve and update balance immediately"
                      title="Auto-approve and update balance immediately"
                    />
                    <Label htmlFor="bank-auto-approve" className="text-sm">
                      Auto-approve and update balance immediately
                    </Label>
                  </div>

                  <Button
                    onClick={submitBankDeposit}
                    disabled={
                      submitting ||
                      !selectedUser ||
                      !bankForm.currency ||
                      !bankForm.amount ||
                      !bankForm.bank_name
                    }
                    className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Building className="w-4 h-4 mr-2" />
                        Process Bank Deposit
                      </>
                    )}
                  </Button>
                </TabsContent>

                <TabsContent value="crypto" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cryptocurrency">Cryptocurrency *</Label>
                      <Select
                        value={cryptoForm.cryptocurrency}
                        onValueChange={(value) =>
                          setCryptoForm({
                            ...cryptoForm,
                            cryptocurrency: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select cryptocurrency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                          <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                          <SelectItem value="USDT">Tether (USDT)</SelectItem>
                          <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
                          <SelectItem value="BNB">
                            Binance Coin (BNB)
                          </SelectItem>
                          <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                          <SelectItem value="DOT">Polkadot (DOT)</SelectItem>
                          <SelectItem value="LINK">Chainlink (LINK)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="crypto-amount">Amount *</Label>
                      <Input
                        id="crypto-amount"
                        type="number"
                        step="0.00000001"
                        value={cryptoForm.amount}
                        onChange={(e) =>
                          setCryptoForm({
                            ...cryptoForm,
                            amount: e.target.value,
                          })
                        }
                        placeholder="0.00000000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="network">Network</Label>
                    <Select
                      value={cryptoForm.network}
                      onValueChange={(value) =>
                        setCryptoForm({ ...cryptoForm, network: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bitcoin">Bitcoin Network</SelectItem>
                        <SelectItem value="ethereum">
                          Ethereum (ERC-20)
                        </SelectItem>
                        <SelectItem value="bsc">
                          Binance Smart Chain (BEP-20)
                        </SelectItem>
                        <SelectItem value="polygon">Polygon (MATIC)</SelectItem>
                        <SelectItem value="avalanche">
                          Avalanche (AVAX)
                        </SelectItem>
                        <SelectItem value="solana">Solana</SelectItem>
                        <SelectItem value="cardano">Cardano</SelectItem>
                        <SelectItem value="polkadot">Polkadot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="from-wallet">From Wallet Address</Label>
                    <Input
                      id="from-wallet"
                      value={cryptoForm.from_wallet}
                      onChange={(e) =>
                        setCryptoForm({
                          ...cryptoForm,
                          from_wallet: e.target.value,
                        })
                      }
                      placeholder="Source wallet address"
                    />
                  </div>

                  <div>
                    <Label htmlFor="to-wallet">To Wallet Address</Label>
                    <Input
                      id="to-wallet"
                      value={cryptoForm.to_wallet}
                      onChange={(e) =>
                        setCryptoForm({
                          ...cryptoForm,
                          to_wallet: e.target.value,
                        })
                      }
                      placeholder="Destination wallet address"
                    />
                  </div>

                  <div>
                    <Label htmlFor="transaction-hash">Transaction Hash</Label>
                    <Input
                      id="transaction-hash"
                      value={cryptoForm.transaction_hash}
                      onChange={(e) =>
                        setCryptoForm({
                          ...cryptoForm,
                          transaction_hash: e.target.value,
                        })
                      }
                      placeholder="Blockchain transaction hash"
                    />
                  </div>

                  <div>
                    <Label htmlFor="block-confirmations">
                      Block Confirmations
                    </Label>
                    <Input
                      id="block-confirmations"
                      value={cryptoForm.block_confirmations}
                      onChange={(e) =>
                        setCryptoForm({
                          ...cryptoForm,
                          block_confirmations: e.target.value,
                        })
                      }
                      placeholder="e.g., 6/6"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="gas-fee">Gas Fee</Label>
                      <Input
                        id="gas-fee"
                        value={cryptoForm.gas_fee}
                        onChange={(e) =>
                          setCryptoForm({
                            ...cryptoForm,
                            gas_fee: e.target.value,
                          })
                        }
                        placeholder="Transaction fee"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="crypto-admin-notes">Admin Notes</Label>
                    <Textarea
                      id="crypto-admin-notes"
                      value={cryptoForm.admin_notes}
                      onChange={(e) =>
                        setCryptoForm({
                          ...cryptoForm,
                          admin_notes: e.target.value,
                        })
                      }
                      placeholder="Internal notes about this deposit"
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="crypto-auto-approve"
                      checked={cryptoForm.auto_approve}
                      onChange={(e) =>
                        setCryptoForm({
                          ...cryptoForm,
                          auto_approve: e.target.checked,
                        })
                      }
                      className="rounded"
                      aria-label="Auto-approve and update balance immediately"
                      title="Auto-approve and update balance immediately"
                    />
                    <Label htmlFor="crypto-auto-approve" className="text-sm">
                      Auto-approve and update balance immediately
                    </Label>
                  </div>

                  <Button
                    onClick={submitCryptoDeposit}
                    disabled={
                      submitting ||
                      !selectedUser ||
                      !cryptoForm.cryptocurrency ||
                      !cryptoForm.amount
                    }
                    className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        Process Crypto Deposit
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Recent Deposits */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {depositsLoading ? (
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
                ) : deposits.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No deposits yet</p>
                  </div>
                ) : (
                  deposits.map((deposit) => (
                    <div
                      key={deposit.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">
                              {Number(deposit.amount).toLocaleString()}{" "}
                              {deposit.currency}
                            </span>
                            <Badge
                              className={`text-xs ${getStatusColor(
                                deposit.status
                              )}`}
                            >
                              {getStatusIcon(deposit.status)}
                              <span className="ml-1">{deposit.status}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">
                            {deposit.user_name || deposit.user_email}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center">
                            {deposit.method === "Bank Transfer" ? (
                              <Building className="w-3 h-3 mr-1" />
                            ) : (
                              <Wallet className="w-3 h-3 mr-1" />
                            )}
                            {deposit.method}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(deposit.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedDeposit(deposit)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Deposit Details</DialogTitle>
                            </DialogHeader>
                            {selectedDeposit && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Amount</Label>
                                    <p className="font-medium">
                                      {Number(
                                        selectedDeposit.amount
                                      ).toLocaleString()}{" "}
                                      {selectedDeposit.currency}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <Badge
                                      className={`${getStatusColor(
                                        selectedDeposit.status
                                      )}`}
                                    >
                                      {selectedDeposit.status}
                                    </Badge>
                                  </div>
                                  <div>
                                    <Label>Method</Label>
                                    <p>{selectedDeposit.method}</p>
                                  </div>
                                  <div>
                                    <Label>Reference</Label>
                                    <p className="text-sm font-mono">
                                      {selectedDeposit.reference_id}
                                    </p>
                                  </div>
                                </div>

                                {selectedDeposit.bank_details && (
                                  <div>
                                    <Label>Bank Details</Label>
                                    <div className="bg-gray-50 p-3 rounded text-sm">
                                      <pre>
                                        {JSON.stringify(
                                          selectedDeposit.bank_details,
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                                {selectedDeposit.crypto_details && (
                                  <div>
                                    <Label>Crypto Details</Label>
                                    <div className="bg-gray-50 p-3 rounded text-sm">
                                      <pre>
                                        {JSON.stringify(
                                          selectedDeposit.crypto_details,
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                                <div className="flex space-x-2">
                                  {selectedDeposit.status !== "Approved" && (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        updateDepositStatus(
                                          selectedDeposit.id,
                                          "Approved",
                                          "Approved by admin"
                                        )
                                      }
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Approve
                                    </Button>
                                  )}
                                  {selectedDeposit.status !== "Rejected" && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        updateDepositStatus(
                                          selectedDeposit.id,
                                          "Rejected",
                                          "Rejected by admin"
                                        )
                                      }
                                    >
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Reject
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
