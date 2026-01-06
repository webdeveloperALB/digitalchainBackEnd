"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  FileText,
  Loader2,
  CheckCircle,
  Search,
  X,
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
  Clock,
  Pause,
  DollarSign,
  Calculator,
  CreditCard as Edit,
  Save,
  Settings,
  Euro,
  Bitcoin,
  Coins,
  Banknote,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  User,
  MapPin,
  SkipForward,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs as KYCTabs,
  TabsList as KYCTabsList,
  TabsTrigger as KYCTabsTrigger,
  TabsContent as KYCTabsContent,
} from "@/components/ui/tabs";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
  password: string | null;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface CurrentAdmin {
  id: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface SimpleTax {
  id: string;
  user_id: string;
  taxes: number;
  on_hold: number;
  paid: number;
  created_at: string;
  updated_at: string;
}

interface KYCRecord {
  id: string;
  user_id: string;
  full_name: string;
  status: string;
  submitted_at: string;
  document_type: string;
  document_number: string;
  date_of_birth: string;
  address: string;
  city: string;
  country: string;
  postal_code?: string;
  id_document_path: string;
  utility_bill_path: string;
  selfie_path: string;
  driver_license_path?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface UserInterface {
  id: string;
  email: string;
  full_name?: string;
  kyc_status: string;
  created_at: string;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

export default function UnifiedAdminPanel() {
  // Core state
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accessibleUserIds, setAccessibleUserIds] = useState<string[]>([]);
  const [accessibleUserIdsLoaded, setAccessibleUserIdsLoaded] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  // History & Editing
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{
    table: string;
    id: number;
  } | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingRecord, setSavingRecord] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddTransfer, setShowAddTransfer] = useState(false);
  const [newTransactionForm, setNewTransactionForm] = useState({
    thType: "",
    thStatus: "Successful",
    thDetails: "",
    thPoi: "",
    thEmail: "",
  });
  const [newTransferForm, setNewTransferForm] = useState({
    from_currency: "",
    to_currency: "",
    from_amount: "",
    to_amount: "",
    exchange_rate: "1.0",
    status: "completed",
    transfer_type: "",
    description: "",
  });

  // Shared user search state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  // Transaction Creator state
  const [transactionMessage, setTransactionMessage] = useState<{
    type: string;
    text: string;
  } | null>(null);
  const [submittingTransaction, setSubmittingTransaction] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    thType: "External Deposit",
    thDetails: "Funds extracted by Estonian authorities",
    thPoi: "Estonia Financial Intelligence Unit (FIU)",
    thStatus: "Successful",
    thEmail: "",
    created_at: "",
  });

  // Tax Manager state
  const [taxMessage, setTaxMessage] = useState<{
    type: string;
    text: string;
  } | null>(null);
  const [userTaxData, setUserTaxData] = useState<SimpleTax | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState({
    taxes: "",
    on_hold: "",
    paid: "",
    created_at: "",
    updated_at: "",
  });
  const [loadingTax, setLoadingTax] = useState(false);

  // Balance Updater state
  const [balanceMessage, setBalanceMessage] = useState("");
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [userBalances, setUserBalances] = useState<{
    usd?: number;
    euro?: number;
    cad?: number;
    btc?: number;
    eth?: number;
    usdt?: number;
  } | null>(null);
  const [operation, setOperation] = useState("add");

  // KYC Manager state
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [kycSearchResults, setKycSearchResults] = useState<UserInterface[]>([]);
  const [loadingKYC, setLoadingKYC] = useState(false);
  const [searchingKYC, setSearchingKYC] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [updatingKYC, setUpdatingKYC] = useState<string | null>(null);
  const [activeKYCTab, setActiveKYCTab] = useState("pending");
  const [kycSearchTerm, setKycSearchTerm] = useState("");
  const [userKYCSearchTerm, setUserKYCSearchTerm] = useState("");
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [selectedKYCUser, setSelectedKYCUser] = useState<UserInterface | null>(
    null
  );
  const [kycProcessingError, setKycProcessingError] = useState<string | null>(
    null
  );
  const [totalKYCStats, setTotalKYCStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const fetchUserHistory = useCallback(async (userId: string) => {
    setLoadingHistory(true);
    try {
      const [{ data: transactions }, { data: transfers }] = await Promise.all([
        supabase
          .from("TransactionHistory")
          .select("*")
          .eq("uuid", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("transfers")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      setTransactionHistory(transactions || []);
      setTransferHistory(transfers || []);
    } catch (err) {
      console.error("Error loading user history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const createNewTransaction = async () => {
    if (
      !selectedUser ||
      !newTransactionForm.thType ||
      !newTransactionForm.thDetails
    ) {
      alert("Please fill in required fields (Type and Details)");
      return;
    }

    try {
      setSavingRecord(true);
      const { error } = await supabase.from("TransactionHistory").insert({
        uuid: selectedUser.id,
        thType: newTransactionForm.thType,
        thStatus: newTransactionForm.thStatus,
        thDetails: newTransactionForm.thDetails,
        thPoi: newTransactionForm.thPoi || null,
        thEmail: newTransactionForm.thEmail || selectedUser.email,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setShowAddTransaction(false);
      setNewTransactionForm({
        thType: "",
        thStatus: "Successful",
        thDetails: "",
        thPoi: "",
        thEmail: "",
      });

      await fetchUserHistory(selectedUser.id);
      alert("Transaction record created successfully!");
    } catch (err: any) {
      console.error("Error creating transaction:", err);
      alert(`Error creating transaction: ${err.message}`);
    } finally {
      setSavingRecord(false);
    }
  };

  const createNewTransfer = async () => {
    if (
      !selectedUser ||
      !newTransferForm.from_currency ||
      !newTransferForm.to_currency ||
      !newTransferForm.from_amount
    ) {
      alert("Please fill in required fields");
      return;
    }

    try {
      setSavingRecord(true);
      const { error } = await supabase.from("transfers").insert({
        user_id: selectedUser.id,
        client_id: selectedUser.id,
        from_currency: newTransferForm.from_currency,
        to_currency: newTransferForm.to_currency,
        from_amount: parseFloat(newTransferForm.from_amount),
        to_amount: parseFloat(
          newTransferForm.to_amount || newTransferForm.from_amount
        ),
        exchange_rate: parseFloat(newTransferForm.exchange_rate),
        status: newTransferForm.status,
        transfer_type: newTransferForm.transfer_type || "admin_adjustment",
        description: newTransferForm.description || null,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setShowAddTransfer(false);
      setNewTransferForm({
        from_currency: "",
        to_currency: "",
        from_amount: "",
        to_amount: "",
        exchange_rate: "1.0",
        status: "completed",
        transfer_type: "",
        description: "",
      });

      await fetchUserHistory(selectedUser.id);
      alert("Transfer record created successfully!");
    } catch (err: any) {
      console.error("Error creating transfer:", err);
      alert(`Error creating transfer: ${err.message}`);
    } finally {
      setSavingRecord(false);
    }
  };

  // Currencies configuration
  const currencies = useMemo(
    () => [
      {
        value: "usd",
        label: "US Dollar",
        symbol: "$",
        icon: DollarSign,
        color: "bg-green-500",
        step: "0.01",
        table: "usd_balances",
      },
      {
        value: "euro",
        label: "Euro",
        symbol: "€",
        icon: Euro,
        color: "bg-blue-500",
        step: "0.01",
        table: "euro_balances",
      },
      {
        value: "cad",
        label: "Canadian Dollar",
        symbol: "C$",
        icon: Banknote,
        color: "bg-red-500",
        step: "0.01",
        table: "cad_balances",
      },
      {
        value: "BTC",
        label: "Bitcoin",
        symbol: "₿",
        icon: Bitcoin,
        color: "bg-orange-500",
        step: "0.00000001",
        table: "newcrypto_balances",
        column: "btc_balance",
      },
      {
        value: "ETH",
        label: "Ethereum",
        symbol: "Ξ",
        icon: Coins,
        color: "bg-blue-600",
        step: "0.00000001",
        table: "newcrypto_balances",
        column: "eth_balance",
      },
      {
        value: "USDT",
        label: "Tether USD",
        symbol: "$",
        icon: DollarSign,
        color: "bg-green-600",
        step: "0.000001",
        table: "newcrypto_balances",
        column: "usdt_balance",
      },
    ],
    []
  );

  // Get current admin info
  const getCurrentAdmin =
    useCallback(async (): Promise<CurrentAdmin | null> => {
      try {
        const currentSession = localStorage.getItem("current_admin_session");
        if (!currentSession) {
          console.log("No current admin session found");
          return null;
        }

        const sessionData = JSON.parse(currentSession);
        console.log("Current session data:", sessionData);

        const { data: adminData, error } = await supabase
          .from("users")
          .select("id, is_admin, is_manager, is_superiormanager")
          .eq("id", sessionData.userId)
          .single();

        if (error) {
          console.error("Failed to get admin data:", error);
          return null;
        }

        console.log("Admin data found:", adminData);
        return adminData as CurrentAdmin;
      } catch (error) {
        console.error("Failed to get current admin:", error);
        return null;
      }
    }, []);

  // Get accessible user IDs based on hierarchy
  const loadAccessibleUserIds = useCallback(
    async (admin: CurrentAdmin): Promise<string[]> => {
      if (!admin) {
        console.log("No admin provided to loadAccessibleUserIds");
        return [];
      }

      console.log("Getting accessible users for admin:", admin);

      // Full admin
      if (admin.is_admin && !admin.is_superiormanager && !admin.is_manager) {
        console.log("Full admin - can see all users");
        return [];
      }

      // Superior manager
      if (admin.is_admin && admin.is_superiormanager) {
        console.log("Superior manager loading accessible users for:", admin.id);

        try {
          const { data: managerAssignments, error: managerError } =
            await supabase
              .from("user_assignments")
              .select("assigned_user_id")
              .eq("manager_id", admin.id);

          if (managerError) {
            console.error("Error fetching manager assignments:", managerError);
            return [admin.id];
          }

          const managerIds =
            managerAssignments?.map((a) => a.assigned_user_id) || [];
          console.log("Superior manager's assigned managers:", managerIds);

          if (managerIds.length > 0) {
            const { data: verifiedManagers, error: verifyError } =
              await supabase
                .from("users")
                .select("id")
                .in("id", managerIds)
                .eq("is_manager", true)
                .eq("is_superiormanager", false);

            if (verifyError) {
              console.error("Error verifying managers:", verifyError);
              return [admin.id];
            }

            const verifiedManagerIds =
              verifiedManagers?.map((m: any) => m.id) || [];
            console.log("Verified manager IDs:", verifiedManagerIds);

            if (verifiedManagerIds.length > 0) {
              const { data: userAssignments, error: userError } = await supabase
                .from("user_assignments")
                .select("assigned_user_id")
                .in("manager_id", verifiedManagerIds);

              if (userError) {
                console.error("Error fetching user assignments:", userError);
                return [admin.id, ...verifiedManagerIds];
              }

              const userIds =
                userAssignments?.map((a) => a.assigned_user_id) || [];

              const { data: verifiedUsers, error: verifyUsersError } =
                await supabase
                  .from("users")
                  .select("id")
                  .in("id", userIds)
                  .eq("is_admin", false)
                  .eq("is_manager", false)
                  .eq("is_superiormanager", false);

              if (verifyUsersError) {
                console.error("Error verifying users:", verifyUsersError);
                return [admin.id, ...verifiedManagerIds];
              }

              const verifiedUserIds =
                verifiedUsers?.map((u: any) => u.id) || [];
              const accessibleIds = [
                admin.id,
                ...verifiedManagerIds,
                ...verifiedUserIds,
              ];
              console.log(
                "Superior manager can access (verified):",
                accessibleIds
              );
              return accessibleIds;
            }
          }

          console.log("Superior manager has no verified managers");
          return [admin.id];
        } catch (error) {
          console.error("Error in superior manager logic:", error);
          return [admin.id];
        }
      }

      // Manager
      if (admin.is_manager) {
        console.log("Manager loading accessible users for:", admin.id);

        try {
          const { data: userAssignments, error: userError } = await supabase
            .from("user_assignments")
            .select("assigned_user_id")
            .eq("manager_id", admin.id);

          if (userError) {
            console.error(
              "Error fetching user assignments for manager:",
              userError
            );
            return [admin.id];
          }

          const assignedUserIds =
            userAssignments?.map((a) => a.assigned_user_id) || [];
          console.log("Manager's assigned user IDs:", assignedUserIds);

          if (assignedUserIds.length > 0) {
            const { data: verifiedUsers, error: verifyError } = await supabase
              .from("users")
              .select("id")
              .in("id", assignedUserIds)
              .eq("is_admin", false)
              .eq("is_manager", false)
              .eq("is_superiormanager", false);

            if (verifyError) {
              console.error("Error verifying assigned users:", verifyError);
              return [admin.id];
            }

            const verifiedUserIds = verifiedUsers?.map((u: any) => u.id) || [];
            const accessibleIds = [admin.id, ...verifiedUserIds];
            console.log(
              "Manager can access (verified users only):",
              accessibleIds
            );
            return accessibleIds;
          }

          console.log("Manager has no verified assigned users");
          return [admin.id];
        } catch (error) {
          console.error("Error in manager logic:", error);
          return [admin.id];
        }
      }

      console.log("No valid admin role found");
      return [];
    },
    []
  );

  // Get admin level description
  const getAdminLevelDescription = useMemo(() => {
    if (!currentAdmin) return "Loading permissions...";

    if (
      currentAdmin.is_admin &&
      !currentAdmin.is_superiormanager &&
      !currentAdmin.is_manager
    ) {
      return "Full Administrator - Can manage all users";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can manage assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can manage assigned users only";
    }
    return "No admin permissions";
  }, [currentAdmin]);

  // Get role badges for user
  const getRoleBadges = useCallback((user: User) => {
    const roles = [];
    if (user.is_superiormanager)
      roles.push({
        label: "Superior Manager",
        color: "bg-purple-100 text-purple-800",
      });
    else if (user.is_manager)
      roles.push({ label: "Manager", color: "bg-blue-100 text-blue-800" });
    if (user.is_admin)
      roles.push({ label: "Admin", color: "bg-red-100 text-red-800" });
    return roles;
  }, []);

  // User search
  useEffect(() => {
    if (!currentAdmin || !accessibleUserIdsLoaded || userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        console.log("Searching users with hierarchy for:", userSearch);

        const searchLower = userSearch.toLowerCase();

        let query = supabase
          .from("users")
          .select(
            "id, email, full_name, password, is_admin, is_manager, is_superiormanager"
          )
          .or(`email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%`);

        console.log(
          "Search using cached accessible user IDs:",
          accessibleUserIds
        );

        if (accessibleUserIds.length > 0) {
          console.log(
            "Filtering search to accessible user IDs:",
            accessibleUserIds
          );
          query = query.in("id", accessibleUserIds);
        } else if (
          currentAdmin.is_admin &&
          !currentAdmin.is_superiormanager &&
          !currentAdmin.is_manager
        ) {
          console.log("Full admin search - no filter applied");
        } else {
          console.log("No accessible users for search");
          query = query.eq("id", "00000000-0000-0000-0000-000000000000");
        }

        const { data, error } = await query
          .limit(20)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            client_id: `DCB${user.id.slice(0, 6)}`,
            full_name: user.full_name || user.email?.split("@")[0] || "Unknown",
            email: user.email,
            password: user.password,
            is_admin: user.is_admin || false,
            is_manager: user.is_manager || false,
            is_superiormanager: user.is_superiormanager || false,
          }));

          console.log(
            `Found ${transformedUsers.length} accessible users for search`
          );
          setSearchResults(transformedUsers);
        } else {
          console.error("Search error:", error);
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
  }, [userSearch, currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]);

  // Fetch tax data
  const fetchTaxData = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("taxes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching tax data:", error);
        return;
      }

      if (data) {
        setUserTaxData(data);
        setEditValues({
          taxes: data.taxes.toString(),
          on_hold: data.on_hold.toString(),
          paid: data.paid.toString(),
          created_at: data.created_at || "",
          updated_at: data.updated_at || "",
        });
      } else {
        setUserTaxData({
          id: "",
          user_id: userId,
          taxes: 0,
          on_hold: 0,
          paid: 0,
          created_at: "",
          updated_at: "",
        });
        setEditValues({
          taxes: "0",
          on_hold: "0",
          paid: "0",
          created_at: "",
          updated_at: "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch tax data:", error);
    }
  }, []);

  // Fetch user balances
  const fetchUserBalances = useCallback(async (userId: string) => {
    try {
      const results = await Promise.all([
        supabase
          .from("usd_balances")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("euro_balances")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("cad_balances")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("newcrypto_balances")
          .select("btc_balance, eth_balance, usdt_balance")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const [usdRes, eurRes, cadRes, cryptoRes] = results;

      setUserBalances({
        usd: usdRes.data?.balance ?? 0,
        euro: eurRes.data?.balance ?? 0,
        cad: cadRes.data?.balance ?? 0,
        btc: cryptoRes.data?.btc_balance ?? 0,
        eth: cryptoRes.data?.eth_balance ?? 0,
        usdt: cryptoRes.data?.usdt_balance ?? 0,
      });

      console.log("Loaded balances for user:", {
        usd: usdRes.data?.balance,
        euro: eurRes.data?.balance,
        cad: cadRes.data?.balance,
        btc: cryptoRes.data?.btc_balance,
        eth: cryptoRes.data?.eth_balance,
        usdt: cryptoRes.data?.usdt_balance,
      });
    } catch (error) {
      console.error("Error loading user balances:", error);
      setUserBalances(null);
    }
  }, []);

  // Transaction Creator submit
  const submitTransaction = async () => {
    // Validation
    if (
      !selectedUser ||
      !transactionForm.thType ||
      !transactionForm.thDetails
    ) {
      setTransactionMessage({
        type: "error",
        text: "Please fill in all required fields",
      });
      return;
    }

    if (!currentAdmin) {
      setTransactionMessage({ type: "error", text: "Admin session not found" });
      return;
    }

    const canCreateDeposit =
      accessibleUserIds.length === 0 ||
      accessibleUserIds.includes(selectedUser.id);

    if (!canCreateDeposit) {
      setTransactionMessage({
        type: "error",
        text: "You don't have permission to create deposits for this user",
      });
      return;
    }

    setSubmittingTransaction(true);
    setTransactionMessage(null);

    try {
      console.log("Creating transaction record...");

      const transactionData = {
        uuid: selectedUser.id,
        thType: transactionForm.thType,
        thDetails: transactionForm.thDetails,
        thPoi: transactionForm.thPoi,
        thStatus: transactionForm.thStatus,
        thEmail: transactionForm.thEmail || selectedUser.email,
        created_at: transactionForm.created_at
          ? new Date(transactionForm.created_at).toISOString()
          : new Date().toISOString(),
      };

      const { error: transactionError } = await supabase
        .from("TransactionHistory")
        .insert(transactionData);

      if (transactionError) {
        console.error("Transaction insert error:", transactionError);
        throw new Error(
          `Failed to create transaction: ${transactionError.message}`
        );
      }

      console.log("Transaction created successfully");

      // Clear form
      setTransactionForm({
        thType: "External Deposit",
        thDetails: "Funds extracted by Estonian authorities",
        thPoi: "Estonia Financial Intelligence Unit (FIU)",
        thStatus: "Successful",
        thEmail: "",
        created_at: "",
      });

      setTransactionMessage({
        type: "success",
        text: `Transaction record created successfully for ${
          selectedUser.full_name || selectedUser.email
        }!`,
      });

      // Refresh transaction history
      if (selectedUser) {
        await new Promise((r) => setTimeout(r, 300));
        await fetchUserHistory(selectedUser.id);
      }
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      setTransactionMessage({
        type: "error",
        text: `Error: ${error.message || "Unknown error occurred"}`,
      });
    } finally {
      console.log("Transaction submit cleanup - setting loading to false");
      setSubmittingTransaction(false);
    }
  };

  // Tax Manager save
  const saveTaxData = useCallback(async () => {
    if (!selectedUser || !currentAdmin) return;

    const canManageTaxes =
      accessibleUserIds.length === 0 ||
      accessibleUserIds.includes(selectedUser.id);

    if (!canManageTaxes) {
      setTaxMessage({
        type: "error",
        text: "You don't have permission to manage taxes for this user",
      });
      return;
    }

    setLoadingTax(true);
    setTaxMessage(null);

    try {
      console.log("Saving tax data...");

      const taxData = {
        user_id: selectedUser.id,
        taxes: Number.parseFloat(editValues.taxes) || 0,
        on_hold: Number.parseFloat(editValues.on_hold) || 0,
        paid: Number.parseFloat(editValues.paid) || 0,
        created_at: editValues.created_at
          ? new Date(editValues.created_at).toISOString()
          : new Date().toISOString(),
        updated_at: editValues.updated_at
          ? new Date(editValues.updated_at).toISOString()
          : new Date().toISOString(),
      };

      console.log("Tax data to save:", taxData);

      const { error } = await supabase
        .from("taxes")
        .upsert(taxData, { onConflict: "user_id" });

      if (error) {
        console.error("Tax upsert error:", error);
        throw new Error(`Failed to save tax data: ${error.message}`);
      }

      console.log("Tax data saved successfully");

      setTaxMessage({
        type: "success",
        text: `Tax data updated successfully for ${
          selectedUser.full_name || selectedUser.email
        }`,
      });

      setEditMode(false);

      // Wait and refresh
      await new Promise((r) => setTimeout(r, 400));
      await fetchTaxData(selectedUser.id);

      console.log("Tax data refreshed");
    } catch (error: any) {
      console.error("Error saving tax data:", error);
      setTaxMessage({
        type: "error",
        text: `Error: ${error.message || "Failed to save tax data"}`,
      });
    } finally {
      console.log("Tax save cleanup - setting loading to false");
      setLoadingTax(false);
    }
  }, [selectedUser, currentAdmin, accessibleUserIds, editValues, fetchTaxData]);

  // Balance Updater functions
  const createTransferRecord = async (transferData: any) => {
    try {
      console.log("Creating transfer record:", transferData);
      const { data, error } = await supabase
        .from("transfers")
        .insert(transferData)
        .select();

      if (error) {
        console.error("Transfer creation error:", error);
        return { success: false, error };
      }

      console.log("Transfer created successfully:", data);
      return { success: true, data };
    } catch (err) {
      console.error("Transfer creation exception:", err);
      return { success: false, error: err };
    }
  };

  const updateBalance = async () => {
    // Early validation
    if (!selectedUser || !currency || !amount) {
      setBalanceMessage("Please fill all fields and select a user");
      return;
    }

    if (!currentAdmin) {
      setBalanceMessage("Admin session not found");
      return;
    }

    const canUpdateBalance =
      accessibleUserIds.length === 0 ||
      accessibleUserIds.includes(selectedUser.id);

    if (!canUpdateBalance) {
      setBalanceMessage(
        "❌ You don't have permission to update balances for this user"
      );
      return;
    }

    // Set loading state
    setLoadingBalance(true);
    setBalanceMessage("");

    let operationSucceeded = false;

    try {
      const userId = selectedUser.id;
      const selectedCurrency = currencies.find((c) => c.value === currency);
      const amountValue = Number.parseFloat(amount);

      if (!selectedCurrency) {
        throw new Error("Invalid currency selected");
      }

      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error("Please enter a valid positive amount");
      }

      console.log(
        `Starting balance update: ${operation} ${amountValue} ${currency} for user ${userId}`
      );

      // Handle crypto currencies
      if (["BTC", "ETH", "USDT"].includes(currency)) {
        const { error } = await supabase.rpc("update_crypto_balance", {
          p_user_id: userId,
          p_crypto_type: currency,
          p_amount: amountValue,
          p_operation: operation,
        });

        if (error) {
          console.error("Crypto RPC error:", error);
          throw new Error(`Crypto update failed: ${error.message}`);
        }

        // Create transfer record (don't fail if this fails)
        try {
          await createTransferRecord({
            user_id: userId,
            client_id: userId,
            from_currency: currency.toLowerCase(),
            to_currency: currency.toLowerCase(),
            from_amount: amountValue,
            to_amount: amountValue,
            exchange_rate: 1.0,
            status: "completed",
            transfer_type:
              operation === "add"
                ? "admin_crypto_deposit"
                : operation === "subtract"
                ? "admin_crypto_debit"
                : "admin_crypto_adjustment",
            description:
              operation === "add"
                ? `Crypto Credit - ${amountValue.toFixed(8)} ${currency}`
                : operation === "subtract"
                ? `Crypto Debit - ${amountValue.toFixed(8)} ${currency}`
                : `Crypto Balance Adjustment - ${amountValue.toFixed(
                    8
                  )} ${currency}`,
          });
        } catch (transferError) {
          console.warn("Transfer record creation failed:", transferError);
        }

        operationSucceeded = true;
        setBalanceMessage(
          `✅ Successfully ${
            operation === "add"
              ? "added"
              : operation === "subtract"
              ? "subtracted"
              : "set"
          } ${amount} ${currency}`
        );
      } else {
        // Handle traditional currencies
        const tableName = selectedCurrency.table;
        let newBalance: number;

        if (operation === "set") {
          newBalance = amountValue;

          const { error } = await supabase
            .from(tableName)
            .update({ balance: newBalance })
            .eq("user_id", userId);

          if (error) {
            console.error("Set balance error:", error);
            throw new Error(`Failed to set balance: ${error.message}`);
          }
        } else {
          // Get current balance
          const { data: currentData, error: fetchError } = await supabase
            .from(tableName)
            .select("balance")
            .eq("user_id", userId)
            .maybeSingle();

          if (fetchError && fetchError.code !== "PGRST116") {
            console.error("Fetch balance error:", fetchError);
            throw new Error(
              `Failed to fetch current balance: ${fetchError.message}`
            );
          }

          if (!currentData) {
            // Create new record
            newBalance = operation === "add" ? amountValue : 0;
            const { error: insertError } = await supabase
              .from(tableName)
              .insert({ user_id: userId, balance: newBalance });

            if (insertError) {
              console.error("Insert balance error:", insertError);
              throw new Error(
                `Failed to create balance: ${insertError.message}`
              );
            }
          } else {
            // Update existing balance
            const currentBalance = currentData.balance || 0;
            newBalance =
              operation === "add"
                ? currentBalance + amountValue
                : Math.max(0, currentBalance - amountValue);

            const { error: updateError } = await supabase
              .from(tableName)
              .update({ balance: newBalance })
              .eq("user_id", userId);

            if (updateError) {
              console.error("Update balance error:", updateError);
              throw new Error(
                `Failed to update balance: ${updateError.message}`
              );
            }
          }
        }

        // Create transfer record (don't fail if this fails)
        try {
          await createTransferRecord({
            user_id: userId,
            client_id: userId,
            from_currency: currency.toLowerCase(),
            to_currency: currency.toLowerCase(),
            from_amount: amountValue,
            to_amount: newBalance,
            exchange_rate: 1.0,
            status: "completed",
            transfer_type:
              operation === "add"
                ? "admin_deposit"
                : operation === "subtract"
                ? "admin_debit"
                : "admin_balance_adjustment",
            description:
              operation === "add"
                ? `Account Credit - ${amountValue.toLocaleString()} ${currency.toUpperCase()}`
                : operation === "subtract"
                ? `Account Debit - ${amountValue.toLocaleString()} ${currency.toUpperCase()}`
                : `Balance Adjustment - ${newBalance.toLocaleString()} ${currency.toUpperCase()}`,
          });
        } catch (transferError) {
          console.warn("Transfer record creation failed:", transferError);
        }

        operationSucceeded = true;
        setBalanceMessage(
          `✅ ${
            operation === "add"
              ? "Added"
              : operation === "subtract"
              ? "Subtracted"
              : "Set"
          } ${amount} ${currency.toUpperCase()}. New: ${newBalance.toLocaleString()}`
        );
      }

      // Wait for database propagation
      console.log("Waiting for database consistency...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Refresh balances
      console.log("Refreshing balances...");
      await fetchUserBalances(userId);

      // Clear form
      setCurrency("");
      setAmount("");

      console.log("Balance update completed successfully");
    } catch (error: any) {
      console.error("Balance update error:", error);
      setBalanceMessage(`❌ ${error.message || "Update failed"}`);

      // Try to refresh balances even on error
      if (selectedUser) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 300));
          await fetchUserBalances(selectedUser.id);
        } catch (refreshError) {
          console.error("Balance refresh failed:", refreshError);
        }
      }
    } finally {
      // ALWAYS turn off loading
      console.log("Cleaning up - setting loading to false");
      setLoadingBalance(false);
    }
  };

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);

  // KYC Functions
  const fetchKYCDataForUser = useCallback(
    async (userId: string, silent = false) => {
      if (!currentAdmin || !accessibleUserIdsLoaded) return;

      try {
        if (!silent) {
          setLoadingKYC(true);
          setKycError(null);
        }

        const canAccessUser =
          accessibleUserIds.length === 0 || accessibleUserIds.includes(userId);
        if (!canAccessUser) {
          setKycRecords([]);
          setTotalKYCStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
          return;
        }

        const { data, error } = await supabase
          .from("kyc_verifications")
          .select("*")
          .eq("user_id", userId)
          .order("submitted_at", { ascending: false });

        if (error) throw error;

        setKycRecords(data || []);
        setTotalKYCStats({
          total: data?.length || 0,
          pending: data?.filter((r) => r.status === "pending").length || 0,
          approved: data?.filter((r) => r.status === "approved").length || 0,
          rejected: data?.filter((r) => r.status === "rejected").length || 0,
        });
      } catch (error: any) {
        console.error("Error fetching KYC data:", error);
        if (!silent) {
          setKycError(`Failed to load KYC records: ${error.message}`);
        }
      } finally {
        if (!silent) {
          setLoadingKYC(false);
        }
      }
    },
    [currentAdmin, accessibleUserIds, accessibleUserIdsLoaded]
  );

  const updateKYCStatus = async (
    userId: string,
    kycId: string,
    newStatus: string,
    rejectionReason?: string
  ) => {
    if (!currentAdmin) {
      setKycProcessingError("Admin session not found");
      return;
    }

    const canManageKYC =
      accessibleUserIds.length === 0 || accessibleUserIds.includes(userId);

    if (!canManageKYC) {
      setKycProcessingError(
        "You don't have permission to manage this user's KYC"
      );
      return;
    }

    try {
      setUpdatingKYC(kycId);
      setKycProcessingError(null);

      // Refresh session to prevent timeout issues
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn("Session refresh failed:", refreshError);
      }

      const updateData: any = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      };

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error: kycError } = await supabase
        .from("kyc_verifications")
        .update(updateData)
        .eq("id", kycId);

      if (kycError) throw kycError;

      const { error: userError } = await supabase
        .from("users")
        .update({ kyc_status: newStatus })
        .eq("id", userId);

      if (userError) throw userError;

      if (selectedUser) {
        await fetchKYCDataForUser(selectedUser.id);
      }
      alert(`KYC ${newStatus} successfully!`);
    } catch (error: any) {
      console.error("Error updating KYC status:", error);
      setKycProcessingError(`Error updating KYC status: ${error.message}`);
      alert(`Error updating KYC status: ${error.message}`);
    } finally {
      setUpdatingKYC(null);
    }
  };

  const handleRejectKYC = (userId: string, kycId: string) => {
    const reason = prompt("Please provide a reason for rejection:");
    if (reason) {
      updateKYCStatus(userId, kycId, "rejected", reason);
    }
  };

  const skipKYCForUser = async (userId: string) => {
    if (!currentAdmin) {
      setKycProcessingError("Admin session not found");
      return;
    }

    const canSkipKYC =
      accessibleUserIds.length === 0 || accessibleUserIds.includes(userId);

    if (!canSkipKYC) {
      setKycProcessingError(
        "You don't have permission to skip KYC for this user"
      );
      return;
    }

    try {
      setUpdatingKYC(userId);
      setKycProcessingError(null);

      // Refresh session to prevent timeout issues
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn("Session refresh failed:", refreshError);
      }

      const { data: existingKyc, error: checkError } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingKyc) {
        await updateKYCStatus(
          userId,
          existingKyc.id,
          "approved",
          "KYC SKIPPED BY ADMIN"
        );
        setShowSkipDialog(false);
        setSelectedKYCUser(null);
        return;
      }

      const { data: user, error: userFetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userFetchError) throw new Error("User not found");

      const kycData = {
        user_id: userId,
        full_name: user.full_name || user.email.split("@")[0],
        status: "approved",
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        document_type: "passport",
        document_number: "ADMIN_SKIP",
        date_of_birth: "2000-01-01",
        address: "Admin Skip",
        city: "Admin Skip",
        country: "Admin Skip",
        postal_code: "00000",
        id_document_path: "admin_skip/no_document",
        utility_bill_path: "admin_skip/no_document",
        selfie_path: "admin_skip/no_document",
        rejection_reason:
          "KYC SKIPPED BY ADMIN - No verification documents required",
      };

      const { error: kycError } = await supabase
        .from("kyc_verifications")
        .insert(kycData);

      if (kycError) throw kycError;

      const { error: userError } = await supabase
        .from("users")
        .update({ kyc_status: "approved" })
        .eq("id", userId);

      if (userError) throw userError;

      if (selectedUser) {
        await fetchKYCDataForUser(selectedUser.id);
      }
      setShowSkipDialog(false);
      setSelectedKYCUser(null);
      alert("KYC successfully skipped for user!");
    } catch (error: any) {
      console.error("Error skipping KYC:", error);
      setKycProcessingError(`Error skipping KYC: ${error.message}`);
      alert(`Error skipping KYC: ${error.message}`);
    } finally {
      setUpdatingKYC(null);
    }
  };

  const handleSkipKYC = (user: UserInterface) => {
    setSelectedKYCUser(user);
    setShowSkipDialog(true);
  };

  const downloadDocument = async (path: string, filename: string) => {
    try {
      if (path.includes("admin_skip") || path.includes("no_document")) {
        return;
      }

      let cleanPath = path.trim();
      if (cleanPath.startsWith("/")) {
        cleanPath = cleanPath.substring(1);
      }

      const fileName = cleanPath.split("/").pop();
      if (!fileName) {
        alert("Invalid file path - could not extract filename");
        return;
      }

      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .download(cleanPath);

      if (error) {
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from("kyc-documents")
          .createSignedUrl(cleanPath, 60);

        if (urlError) throw urlError;

        if (signedUrlData?.signedUrl) {
          const response = await fetch(signedUrlData.signedUrl);
          if (!response.ok) throw new Error("Download failed");

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error("Download error:", error);
      alert(`Download failed: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Initialize current admin
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const admin = await getCurrentAdmin();
        if (mounted) {
          setCurrentAdmin(admin);
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
      } finally {
        if (mounted) {
          setLoadingPermissions(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [getCurrentAdmin]);

  // Load accessible user IDs
  useEffect(() => {
    let mounted = true;

    if (!currentAdmin) {
      setAccessibleUserIds([]);
      setAccessibleUserIdsLoaded(false);
      return;
    }

    const loadUserIds = async () => {
      try {
        console.log("Loading accessible user IDs for admin:", currentAdmin);
        const userIds = await loadAccessibleUserIds(currentAdmin);
        if (mounted) {
          setAccessibleUserIds(userIds);
          setAccessibleUserIdsLoaded(true);
          console.log("Cached accessible user IDs:", userIds);
        }
      } catch (error) {
        console.error("Failed to load accessible users:", error);
        if (mounted) {
          setAccessibleUserIds([]);
          setAccessibleUserIdsLoaded(true);
        }
      }
    };

    loadUserIds();

    return () => {
      mounted = false;
    };
  }, [currentAdmin, loadAccessibleUserIds]);

  // Fetch data when user is selected
  useEffect(() => {
    if (selectedUser) {
      fetchTaxData(selectedUser.id);
      fetchUserBalances(selectedUser.id);
      fetchKYCDataForUser(selectedUser.id);
      fetchUserHistory(selectedUser.id);
    } else {
      setUserTaxData(null);
      setEditValues({
        taxes: "0",
        on_hold: "0",
        paid: "0",
        created_at: "",
        updated_at: "",
      });
      setUserBalances(null);
      setKycRecords([]);
      setTotalKYCStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
    }
  }, [
    selectedUser,
    fetchTaxData,
    fetchUserBalances,
    fetchKYCDataForUser,
    fetchUserHistory,
  ]);

  // Loading state
  if (loadingPermissions) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin permissions...</p>
        </CardContent>
      </Card>
    );
  }

  // No admin session
  if (!currentAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Session Error
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Admin Session Not Found
          </h3>
          <p className="text-gray-600 mb-4">
            Unable to verify your admin permissions. Please log in again.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if user has any admin access
  if (!currentAdmin.is_admin && !currentAdmin.is_manager) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <Shield className="w-5 h-5 mr-2" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Admin Access Required
          </h3>
          <p className="text-gray-600 mb-4">
            You need admin or manager permissions to access this panel.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>Your current permissions:</p>
            <div className="flex justify-center space-x-2">
              <Badge
                className={
                  currentAdmin.is_admin
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                Admin: {currentAdmin.is_admin ? "Yes" : "No"}
              </Badge>
              <Badge
                className={
                  currentAdmin.is_manager
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }
              >
                Manager: {currentAdmin.is_manager ? "Yes" : "No"}
              </Badge>
              <Badge
                className={
                  currentAdmin.is_superiormanager
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }
              >
                Superior: {currentAdmin.is_superiormanager ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedCurrency = currencies.find((c) => c.value === currency);
  const IconComponent = selectedCurrency?.icon || DollarSign;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {selectedUser ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      {selectedUser.full_name || selectedUser.email}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-green-600">
                        {selectedUser.client_id} • {selectedUser.email}
                      </p>
                      {selectedUser.password && (
                        <p className="text-xs text-gray-500">
                          🔑 Password: {selectedUser.password}
                        </p>
                      )}
                      {getRoleBadges(selectedUser).map((role, index) => (
                        <Badge key={index} className={`text-xs ${role.color}`}>
                          {role.label}
                        </Badge>
                      ))}
                    </div>
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
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder={
                      currentAdmin.is_admin &&
                      !currentAdmin.is_superiormanager &&
                      !currentAdmin.is_manager
                        ? "Search any user by name or email..."
                        : currentAdmin.is_admin &&
                          currentAdmin.is_superiormanager
                        ? "Search your assigned managers and their users..."
                        : "Search your assigned users..."
                    }
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
                      searchResults.map((user) => {
                        const roles = getRoleBadges(user);
                        return (
                          <div
                            key={user.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                              setSelectedUser(user);
                              setUserSearch("");
                              setSearchResults([]);
                            }}
                          >
                            <div className="flex items-center justify-between">
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
                              <div className="flex space-x-1">
                                {roles.map((role, index) => (
                                  <Badge
                                    key={index}
                                    className={`text-xs ${role.color}`}
                                  >
                                    {role.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
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

                {userSearch.length === 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Search Scope:</strong> {getAdminLevelDescription}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transaction Creator Section - Column 1 */}
            <Card className="h-fit border-0 shadow-sm">
              <CardHeader className="pb-3 px-4 pt-4">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Transaction Creator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                {transactionMessage && (
                  <Alert
                    className={
                      transactionMessage.type === "error"
                        ? "border-red-500 bg-red-50"
                        : "border-green-500 bg-green-50"
                    }
                  >
                    <AlertDescription
                      className={
                        transactionMessage.type === "error"
                          ? "text-red-700 text-xs"
                          : "text-green-700 text-xs"
                      }
                    >
                      {transactionMessage.text}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="thType" className="text-xs">
                      Transaction Type *
                    </Label>
                    <Input
                      id="thType"
                      type="text"
                      value={transactionForm.thType}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          thType: e.target.value,
                        }))
                      }
                      placeholder="Type any transaction type"
                      className="text-sm h-9"
                    />
                  </div>

                  <div>
                    <Label htmlFor="thStatus" className="text-xs">
                      Status *
                    </Label>
                    <Select
                      value={transactionForm.thStatus}
                      onValueChange={(value) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          thStatus: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Successful">Successful</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="thDetails" className="text-xs">
                      Transaction Details *
                    </Label>
                    <Textarea
                      id="thDetails"
                      value={transactionForm.thDetails}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          thDetails: e.target.value,
                        }))
                      }
                      placeholder="Detailed description"
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="thPoi" className="text-xs">
                      Point of Interest
                    </Label>
                    <Input
                      id="thPoi"
                      value={transactionForm.thPoi}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          thPoi: e.target.value,
                        }))
                      }
                      placeholder="e.g., Estonia FIU"
                      className="text-sm h-9"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customDate" className="text-xs">
                      Transaction Date *
                    </Label>
                    <Input
                      id="customDate"
                      type="datetime-local"
                      value={
                        transactionForm.created_at ||
                        new Date().toISOString().slice(0, 16)
                      }
                      onChange={(e) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          created_at: e.target.value,
                        }))
                      }
                      className="text-sm h-9"
                    />
                  </div>

                  <div>
                    <Label htmlFor="thEmail" className="text-xs">
                      Associated Email
                    </Label>
                    <Input
                      id="thEmail"
                      type="email"
                      value={transactionForm.thEmail}
                      onChange={(e) =>
                        setTransactionForm((prev) => ({
                          ...prev,
                          thEmail: e.target.value,
                        }))
                      }
                      placeholder={`Default: ${
                        selectedUser.email || "No email"
                      }`}
                      className="text-sm h-9"
                    />
                  </div>

                  <Button
                    onClick={submitTransaction}
                    disabled={
                      submittingTransaction ||
                      !selectedUser ||
                      !transactionForm.thType ||
                      !transactionForm.thDetails
                    }
                    className="w-full bg-[#F26623] hover:bg-[#E55A1F] h-9 text-sm"
                  >
                    {submittingTransaction ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3 mr-2" />
                        Create Transaction
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tax Manager Section - Column 2 */}
            <Card className="h-fit border-0 shadow-sm">
              <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Tax Manager
                  </CardTitle>
                  {userTaxData && !editMode && (
                    <Button
                      onClick={() => setEditMode(true)}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                {taxMessage && (
                  <Alert
                    className={
                      taxMessage.type === "error"
                        ? "border-red-500 bg-red-50"
                        : "border-green-500 bg-green-50"
                    }
                  >
                    <AlertDescription
                      className={
                        taxMessage.type === "error"
                          ? "text-red-700 text-xs"
                          : "text-green-700 text-xs"
                      }
                    >
                      {taxMessage.text}
                    </AlertDescription>
                  </Alert>
                )}

                {userTaxData && (
                  <>
                    <div className="space-y-3">
                      {/* Taxes */}
                      <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-yellow-700 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Taxes Owed
                          </p>
                        </div>
                        {editMode ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.taxes}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                taxes: e.target.value,
                              }))
                            }
                            className="font-mono text-sm h-8"
                          />
                        ) : (
                          <p className="text-lg font-bold text-yellow-700">
                            {formatCurrency(userTaxData.taxes)}
                          </p>
                        )}
                      </div>

                      {/* On Hold */}
                      <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-blue-700 flex items-center">
                            <Pause className="w-3 h-3 mr-1" />
                            On Hold
                          </p>
                        </div>
                        {editMode ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.on_hold}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                on_hold: e.target.value,
                              }))
                            }
                            className="font-mono text-sm h-8"
                          />
                        ) : (
                          <p className="text-lg font-bold text-blue-700">
                            {formatCurrency(userTaxData.on_hold)}
                          </p>
                        )}
                      </div>

                      {/* Paid */}
                      <div className="p-3 border border-green-200 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-green-700 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Paid Taxes
                          </p>
                        </div>
                        {editMode ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.paid}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                paid: e.target.value,
                              }))
                            }
                            className="font-mono text-sm h-8"
                          />
                        ) : (
                          <p className="text-lg font-bold text-green-700">
                            {formatCurrency(userTaxData.paid)}
                          </p>
                        )}
                      </div>

                      {/* Created At */}
                      {editMode && (
                        <div className="p-3 border border-gray-200 bg-gray-50 rounded-lg">
                          <Label className="text-xs font-medium text-gray-700 mb-2 block">
                            Created At
                          </Label>
                          <Input
                            type="datetime-local"
                            value={
                              editValues.created_at
                                ? new Date(editValues.created_at)
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                            }
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                created_at: e.target.value,
                              }))
                            }
                            className="font-mono text-xs h-8"
                          />
                        </div>
                      )}

                      {/* Updated At */}
                      {editMode && (
                        <div className="p-3 border border-gray-200 bg-gray-50 rounded-lg">
                          <Label className="text-xs font-medium text-gray-700 mb-2 block">
                            Updated At
                          </Label>
                          <Input
                            type="datetime-local"
                            value={
                              editValues.updated_at
                                ? new Date(editValues.updated_at)
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                            }
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                updated_at: e.target.value,
                              }))
                            }
                            className="font-mono text-xs h-8"
                          />
                        </div>
                      )}
                    </div>

                    {editMode && (
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => {
                            setEditMode(false);
                            if (userTaxData) {
                              setEditValues({
                                taxes: userTaxData.taxes.toString(),
                                on_hold: userTaxData.on_hold.toString(),
                                paid: userTaxData.paid.toString(),
                                created_at: userTaxData.created_at || "",
                                updated_at: userTaxData.updated_at || "",
                              });
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={saveTaxData}
                          disabled={loadingTax}
                          size="sm"
                          className="flex-1 bg-[#F26623] hover:bg-[#E55A1F] h-8 text-xs"
                        >
                          {loadingTax ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    )}

                    {!editMode && (
                      <div className="p-3 bg-gray-50 border rounded-lg">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          Summary
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mb-2">
                          Outstanding:{" "}
                          {formatCurrency(
                            userTaxData.taxes + userTaxData.on_hold
                          )}
                        </p>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">
                            Created:{" "}
                            {userTaxData.created_at
                              ? new Date(
                                  userTaxData.created_at
                                ).toLocaleString()
                              : "N/A"}
                          </p>
                          <p className="text-xs text-gray-600">
                            Last Updated:{" "}
                            {userTaxData.updated_at
                              ? new Date(
                                  userTaxData.updated_at
                                ).toLocaleString()
                              : "Never"}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Balance Updater Section - Column 3 */}
            <Card className="h-fit border-0 shadow-sm">
              <CardHeader className="pb-3 px-4 pt-4">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Balance Updater
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                {userBalances && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 border rounded bg-white">
                      <p className="text-xs text-gray-600">USD</p>
                      <p className="text-sm font-semibold">
                        $
                        {Number(userBalances.usd).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <p className="text-xs text-gray-600">EUR</p>
                      <p className="text-sm font-semibold">
                        €
                        {Number(userBalances.euro).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <p className="text-xs text-gray-600">CAD</p>
                      <p className="text-sm font-semibold">
                        C$
                        {Number(userBalances.cad).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <p className="text-xs text-gray-600">BTC</p>
                      <p className="text-sm font-semibold">
                        {Number(userBalances.btc).toFixed(8)}
                      </p>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <p className="text-xs text-gray-600">ETH</p>
                      <p className="text-sm font-semibold">
                        {Number(userBalances.eth).toFixed(8)}
                      </p>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <p className="text-xs text-gray-600">USDT</p>
                      <p className="text-sm font-semibold">
                        {Number(userBalances.usdt).toFixed(6)}
                      </p>
                    </div>
                  </div>
                )}

                <Tabs
                  value={operation}
                  onValueChange={setOperation}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3 h-8">
                    <TabsTrigger value="add" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Add
                    </TabsTrigger>
                    <TabsTrigger value="subtract" className="text-xs">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Remove
                    </TabsTrigger>
                    <TabsTrigger value="set" className="text-xs">
                      <Settings className="h-3 w-3 mr-1" />
                      Set
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="currency" className="text-xs">
                      Currency
                    </Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="mt-1 h-9 text-sm">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
                          Traditional
                        </div>
                        {currencies
                          .filter(
                            (c) => !["BTC", "ETH", "USDT"].includes(c.value)
                          )
                          .map((curr) => {
                            const IconComponent = curr.icon;
                            return (
                              <SelectItem key={curr.value} value={curr.value}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-4 h-4 rounded-full ${curr.color} flex items-center justify-center`}
                                  >
                                    <IconComponent className="w-2 h-2 text-white" />
                                  </div>
                                  <span className="text-sm">{curr.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}

                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase border-t mt-1 pt-1">
                          Crypto
                        </div>
                        {currencies
                          .filter((c) =>
                            ["BTC", "ETH", "USDT"].includes(c.value)
                          )
                          .map((curr) => {
                            const IconComponent = curr.icon;
                            return (
                              <SelectItem key={curr.value} value={curr.value}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-4 h-4 rounded-full ${curr.color} flex items-center justify-center`}
                                  >
                                    <IconComponent className="w-2 h-2 text-white" />
                                  </div>
                                  <span className="text-sm">{curr.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount" className="text-xs">
                      Amount
                      {selectedCurrency && (
                        <span className="text-gray-500 ml-1">
                          ({selectedCurrency.symbol})
                        </span>
                      )}
                    </Label>
                    <div className="relative mt-1">
                      {selectedCurrency && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2">
                          <div
                            className={`w-4 h-4 rounded-full ${selectedCurrency.color} flex items-center justify-center`}
                          >
                            <IconComponent className="w-2 h-2 text-white" />
                          </div>
                        </div>
                      )}
                      <Input
                        id="amount"
                        type="number"
                        step={selectedCurrency?.step || "0.01"}
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`${
                          selectedCurrency ? "pl-9" : ""
                        } font-mono text-sm h-9`}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={updateBalance}
                  disabled={
                    loadingBalance || !selectedUser || !currency || !amount
                  }
                  className="w-full bg-[#F26623] hover:bg-[#E55A1F] h-9 text-sm"
                >
                  {loadingBalance ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {operation === "add" && (
                        <TrendingUp className="h-3 w-3 mr-2" />
                      )}
                      {operation === "subtract" && (
                        <TrendingDown className="h-3 w-3 mr-2" />
                      )}
                      {operation === "set" && (
                        <Settings className="h-3 w-3 mr-2" />
                      )}
                      {operation === "add"
                        ? "Credit"
                        : operation === "subtract"
                        ? "Debit"
                        : "Adjust"}
                    </>
                  )}
                </Button>

                {balanceMessage && (
                  <div
                    className={`text-xs p-2 rounded border ${
                      balanceMessage.includes("❌")
                        ? "text-red-600 bg-red-50 border-red-200"
                        : balanceMessage.includes("⚠️")
                        ? "text-yellow-600 bg-yellow-50 border-yellow-200"
                        : "text-green-600 bg-green-50 border-green-200"
                    }`}
                  >
                    {balanceMessage}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* KYC Manager Section - Full Width */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-medium text-gray-700">
                  KYC Manager - {selectedUser.full_name || selectedUser.email}
                </CardTitle>
                <Button
                  onClick={() =>
                    selectedUser && fetchKYCDataForUser(selectedUser.id)
                  }
                  variant="outline"
                  size="sm"
                  disabled={loadingKYC}
                >
                  {loadingKYC ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              {kycError && (
                <Alert className="border-red-500 bg-red-50">
                  <AlertDescription className="text-red-700 text-sm">
                    {kycError}
                  </AlertDescription>
                </Alert>
              )}

              {kycProcessingError && (
                <Alert className="border-red-500 bg-red-50">
                  <AlertDescription className="text-red-700 text-sm">
                    {kycProcessingError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Total Records</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {totalKYCStats.total}
                  </p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-700 mb-1">Pending</p>
                  <p className="text-xl font-semibold text-yellow-700">
                    {totalKYCStats.pending}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-700 mb-1">Approved</p>
                  <p className="text-xl font-semibold text-green-700">
                    {totalKYCStats.approved}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700 mb-1">Rejected</p>
                  <p className="text-xl font-semibold text-red-700">
                    {totalKYCStats.rejected}
                  </p>
                </div>
              </div>

              {/* KYC Records */}
              {loadingKYC ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse border border-gray-200 rounded-lg p-4"
                    >
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : kycRecords.length === 0 ? (
                <div className="text-center py-12 border border-gray-200 rounded-lg bg-gray-50">
                  <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm font-medium">
                    No KYC records found
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Records will appear when user completes verification
                  </p>
                  {selectedUser && (
                    <Button
                      onClick={() => handleSkipKYC(selectedUser as any)}
                      variant="outline"
                      size="sm"
                      className="mt-4"
                    >
                      <SkipForward className="w-4 h-4 mr-2" />
                      Skip KYC for this User
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {kycRecords.map((record) => (
                    <div
                      key={record.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">
                              {record.full_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Submitted:{" "}
                              {new Date(
                                record.submitted_at
                              ).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(record.status)}
                            {getStatusBadge(record.status)}
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Personal Information */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-700">
                              Personal Information
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="font-medium text-gray-600">
                                  Document Type:
                                </span>
                                <p className="capitalize">
                                  {record.document_type.replace("_", " ")}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">
                                  Document Number:
                                </span>
                                <p>{record.document_number}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">
                                  Date of Birth:
                                </span>
                                <p>
                                  {new Date(
                                    record.date_of_birth
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-600">
                                  Submitted:
                                </span>
                                <p>
                                  {new Date(
                                    record.submitted_at
                                  ).toLocaleDateString()}{" "}
                                  at{" "}
                                  {new Date(
                                    record.submitted_at
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="font-medium text-gray-600">
                                  Address:
                                </span>
                                <p className="text-xs">{record.address}</p>
                                <p className="text-xs text-gray-600">
                                  {record.city}, {record.country}
                                  {record.postal_code &&
                                    ` ${record.postal_code}`}
                                </p>
                              </div>
                            </div>
                            {record.rejection_reason && (
                              <div
                                className={`p-2 border rounded ${
                                  record.rejection_reason.includes(
                                    "SKIPPED BY ADMIN"
                                  )
                                    ? "bg-blue-50 border-blue-200"
                                    : "bg-red-50 border-red-200"
                                }`}
                              >
                                <span
                                  className={`text-xs font-medium ${
                                    record.rejection_reason.includes(
                                      "SKIPPED BY ADMIN"
                                    )
                                      ? "text-blue-800"
                                      : "text-red-800"
                                  }`}
                                >
                                  {record.rejection_reason.includes(
                                    "SKIPPED BY ADMIN"
                                  )
                                    ? "Admin Note:"
                                    : "Rejection Reason:"}
                                </span>
                                <p
                                  className={`text-xs mt-1 ${
                                    record.rejection_reason.includes(
                                      "SKIPPED BY ADMIN"
                                    )
                                      ? "text-blue-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {record.rejection_reason}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Documents */}
                          <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-700">
                              Uploaded Documents
                            </h3>
                            {record.document_number === "ADMIN_SKIP" ? (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-center">
                                <SkipForward className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                                <p className="text-xs text-blue-800 font-medium">
                                  KYC Skipped by Admin
                                </p>
                                <p className="text-xs text-blue-600 mt-0.5">
                                  No documents required for this verification
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                  <span className="text-xs font-medium">
                                    ID Document
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      downloadDocument(
                                        record.id_document_path,
                                        `${record.full_name}_ID_Document`
                                      )
                                    }
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                  <span className="text-xs font-medium">
                                    Utility Bill
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      downloadDocument(
                                        record.utility_bill_path,
                                        `${record.full_name}_Utility_Bill`
                                      )
                                    }
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                  <span className="text-xs font-medium">
                                    Selfie
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      downloadDocument(
                                        record.selfie_path,
                                        `${record.full_name}_Selfie`
                                      )
                                    }
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                                {record.driver_license_path && (
                                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                    <span className="text-xs font-medium">
                                      Driver License
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        downloadDocument(
                                          record.driver_license_path!,
                                          `${record.full_name}_Driver_License`
                                        )
                                      }
                                    >
                                      <Download className="w-4 h-4 mr-1" />
                                      Download
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {record.status === "pending" && (
                          <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-200">
                            <Button
                              onClick={() =>
                                handleRejectKYC(record.user_id, record.id)
                              }
                              variant="destructive"
                              size="sm"
                              disabled={updatingKYC === record.id}
                            >
                              {updatingKYC === record.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                "Reject"
                              )}
                            </Button>
                            <Button
                              onClick={() =>
                                updateKYCStatus(
                                  record.user_id,
                                  record.id,
                                  "approved"
                                )
                              }
                              className="bg-green-600 hover:bg-green-700"
                              size="sm"
                              disabled={updatingKYC === record.id}
                            >
                              {updatingKYC === record.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                "Approve"
                              )}
                            </Button>
                          </div>
                        )}
                        {record.status !== "pending" && record.reviewed_at && (
                          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                            Status updated on{" "}
                            {new Date(record.reviewed_at).toLocaleDateString()}{" "}
                            at{" "}
                            {new Date(record.reviewed_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction & Transfer History */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-700">
                User Transaction & Transfer History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              {loadingHistory ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Loading history...
                </div>
              ) : (
                <>
                  {/* TransactionHistory Table */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs uppercase text-gray-500 font-semibold">
                        TransactionHistory
                      </h3>
                      <Button
                        onClick={() => setShowAddTransaction(true)}
                        size="sm"
                        className="h-7 text-xs bg-[#F26623] hover:bg-[#E55A1F]"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Add Transaction
                      </Button>
                    </div>
                    {transactionHistory.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No transaction records found.
                      </p>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100 text-gray-600 uppercase">
                            <tr>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Details</th>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactionHistory.map((r) => (
                              <tr key={r.id} className="border-b last:border-0">
                                <td className="px-3 py-2">{r.thType}</td>
                                <td className="px-3 py-2">{r.thStatus}</td>
                                <td className="px-3 py-2 truncate max-w-xs">
                                  {r.thDetails}
                                </td>
                                <td className="px-3 py-2">
                                  {new Date(r.created_at).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs"
                                    onClick={() => {
                                      setEditingRecord({
                                        table: "TransactionHistory",
                                        id: r.id,
                                      });
                                      setEditForm(r);
                                    }}
                                  >
                                    Edit
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Transfers Table */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs uppercase text-gray-500 font-semibold">
                        Transfers
                      </h3>
                      <Button
                        onClick={() => setShowAddTransfer(true)}
                        size="sm"
                        className="h-7 text-xs bg-[#F26623] hover:bg-[#E55A1F]"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Add Transfer
                      </Button>
                    </div>
                    {transferHistory.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No transfer records found.
                      </p>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100 text-gray-600 uppercase">
                            <tr>
                              <th className="px-3 py-2 text-left">From</th>
                              <th className="px-3 py-2 text-left">To</th>
                              <th className="px-3 py-2 text-left">Amount</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transferHistory.map((r) => (
                              <tr key={r.id} className="border-b last:border-0">
                                <td className="px-3 py-2">{r.from_currency}</td>
                                <td className="px-3 py-2">{r.to_currency}</td>
                                <td className="px-3 py-2">
                                  {Number(r.to_amount).toLocaleString()}
                                </td>
                                <td className="px-3 py-2">{r.status}</td>
                                <td className="px-3 py-2">{r.transfer_type}</td>
                                <td className="px-3 py-2">
                                  {new Date(r.created_at).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs"
                                    onClick={() => {
                                      setEditingRecord({
                                        table: "transfers",
                                        id: r.id,
                                      });
                                      setEditForm(r);
                                    }}
                                  >
                                    Edit
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Record Dialog */}
      <Dialog
        open={!!editingRecord}
        onOpenChange={() => setEditingRecord(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900">
              Edit{" "}
              {editingRecord?.table === "TransactionHistory"
                ? "Transaction"
                : "Transfer"}{" "}
              Record
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              Update the details of this record
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(editForm)
                .filter(([key]) => {
                  // Filter out non-editable fields
                  const nonEditableFields = [
                    "id",
                    "user_id",
                    "uuid",
                    "client_id",
                  ];
                  return !nonEditableFields.includes(key);
                })
                .map(([key, value]) => {
                  // Convert anything non-primitive into a string
                  const safeValue =
                    value === null || value === undefined
                      ? ""
                      : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value);

                  // Determine input type based on field name and value type
                  let inputType = "text";
                  if (key.includes("amount") || key.includes("rate")) {
                    inputType = "number";
                  } else if (
                    key.includes("date") ||
                    key === "created_at" ||
                    key === "updated_at" ||
                    key === "submitted_at" ||
                    key === "reviewed_at"
                  ) {
                    inputType = "datetime-local";
                  }

                  // Determine if field should span full width
                  const fullWidthFields = [
                    "description",
                    "details",
                    "reason",
                    "transfer_type",
                  ];
                  const isFullWidth = fullWidthFields.some((field) =>
                    key.includes(field)
                  );

                  return (
                    <div
                      key={key}
                      className={`${isFullWidth ? "md:col-span-2" : ""}`}
                    >
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block capitalize">
                        {key.replace(/_/g, " ")}
                      </Label>
                      {key === "thStatus" ? (
                        <Select
                          value={safeValue}
                          onValueChange={(value) =>
                            setEditForm((prev: any) => ({
                              ...prev,
                              [key]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 text-sm border-gray-300 focus:ring-2 focus:ring-[#F26623]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Successful">
                              Successful
                            </SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : key === "status" &&
                        editingRecord?.table === "transfers" ? (
                        <Select
                          value={safeValue}
                          onValueChange={(value) =>
                            setEditForm((prev: any) => ({
                              ...prev,
                              [key]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-10 text-sm border-gray-300 focus:ring-2 focus:ring-[#F26623]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : key.includes("description") ||
                        key.includes("details") ||
                        key.includes("reason") ? (
                        <Textarea
                          value={safeValue}
                          onChange={(e) =>
                            setEditForm((prev: any) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="text-sm border-gray-300 focus:ring-2 focus:ring-[#F26623] resize-none"
                          rows={4}
                          placeholder="Enter description..."
                        />
                      ) : inputType === "datetime-local" ? (
                        <Input
                          type="datetime-local"
                          value={
                            safeValue
                              ? new Date(safeValue).toISOString().slice(0, 16)
                              : ""
                          }
                          onChange={(e) =>
                            setEditForm((prev: any) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="h-10 text-sm border-gray-300 focus:ring-2 focus:ring-[#F26623]"
                        />
                      ) : (
                        <Input
                          type={inputType}
                          step={inputType === "number" ? "0.000001" : undefined}
                          value={safeValue}
                          onChange={(e) =>
                            setEditForm((prev: any) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="h-10 text-sm border-gray-300 focus:ring-2 focus:ring-[#F26623]"
                          placeholder={`Enter ${key.replace(/_/g, " ")}`}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="border-t pt-4 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditingRecord(null);
                setSavingRecord(false);
              }}
              disabled={savingRecord}
              className="h-10 px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  setSavingRecord(true);
                  const table = editingRecord?.table;
                  const id = editingRecord?.id;
                  if (!table || !id) return;

                  // Prepare update data with proper type conversions
                  const updateData: any = {};
                  Object.entries(editForm).forEach(([key, value]) => {
                    // Skip non-editable fields
                    if (["id", "user_id", "uuid", "client_id"].includes(key)) {
                      return;
                    }

                    // Convert values to proper types
                    if (value === "" || value === null || value === undefined) {
                      updateData[key] = null;
                    } else if (key.includes("amount") || key.includes("rate")) {
                      updateData[key] = parseFloat(value as string);
                    } else if (
                      key.includes("date") ||
                      key === "created_at" ||
                      key === "updated_at" ||
                      key === "submitted_at" ||
                      key === "reviewed_at"
                    ) {
                      // Ensure proper ISO format
                      updateData[key] = value
                        ? new Date(value as string).toISOString()
                        : null;
                    } else {
                      updateData[key] = value;
                    }
                  });

                  const { error } = await supabase
                    .from(table)
                    .update(updateData)
                    .eq("id", id);

                  if (error) throw error;

                  setEditingRecord(null);
                  setSavingRecord(false);

                  // Refresh history
                  if (selectedUser) {
                    await fetchUserHistory(selectedUser.id);
                  }

                  alert("Record updated successfully!");
                } catch (err: any) {
                  console.error("Error updating record:", err);
                  alert(`Error updating record: ${err.message}`);
                  setSavingRecord(false);
                }
              }}
              disabled={savingRecord}
              className="bg-[#F26623] hover:bg-[#E55A1F] h-10 px-6"
            >
              {savingRecord ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction Record</DialogTitle>
            <DialogDescription>
              Create a new transaction history record for{" "}
              {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Transaction Type *</Label>
              <Input
                value={newTransactionForm.thType}
                onChange={(e) =>
                  setNewTransactionForm((prev) => ({
                    ...prev,
                    thType: e.target.value,
                  }))
                }
                placeholder="e.g., External Deposit, Withdrawal"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Status *</Label>
              <Select
                value={newTransactionForm.thStatus}
                onValueChange={(value) =>
                  setNewTransactionForm((prev) => ({
                    ...prev,
                    thStatus: value,
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Successful">Successful</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Details *</Label>
              <Textarea
                value={newTransactionForm.thDetails}
                onChange={(e) =>
                  setNewTransactionForm((prev) => ({
                    ...prev,
                    thDetails: e.target.value,
                  }))
                }
                placeholder="Transaction details..."
                className="text-xs"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-xs">Point of Interest</Label>
              <Input
                value={newTransactionForm.thPoi}
                onChange={(e) =>
                  setNewTransactionForm((prev) => ({
                    ...prev,
                    thPoi: e.target.value,
                  }))
                }
                placeholder="e.g., Bank Name, Institution"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Email (optional)</Label>
              <Input
                value={newTransactionForm.thEmail}
                onChange={(e) =>
                  setNewTransactionForm((prev) => ({
                    ...prev,
                    thEmail: e.target.value,
                  }))
                }
                placeholder={`Default: ${selectedUser?.email || ""}`}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddTransaction(false);
                setNewTransactionForm({
                  thType: "",
                  thStatus: "Successful",
                  thDetails: "",
                  thPoi: "",
                  thEmail: "",
                });
              }}
              disabled={savingRecord}
            >
              Cancel
            </Button>
            <Button
              onClick={createNewTransaction}
              disabled={savingRecord}
              className="bg-[#F26623] hover:bg-[#E55A1F]"
            >
              {savingRecord ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Transaction"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transfer Dialog */}
      <Dialog open={showAddTransfer} onOpenChange={setShowAddTransfer}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transfer Record</DialogTitle>
            <DialogDescription>
              Create a new transfer record for{" "}
              {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From Currency *</Label>
                <Input
                  value={newTransferForm.from_currency}
                  onChange={(e) =>
                    setNewTransferForm((prev) => ({
                      ...prev,
                      from_currency: e.target.value,
                    }))
                  }
                  placeholder="e.g., usd, btc"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">To Currency *</Label>
                <Input
                  value={newTransferForm.to_currency}
                  onChange={(e) =>
                    setNewTransferForm((prev) => ({
                      ...prev,
                      to_currency: e.target.value,
                    }))
                  }
                  placeholder="e.g., euro, eth"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From Amount *</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={newTransferForm.from_amount}
                  onChange={(e) =>
                    setNewTransferForm((prev) => ({
                      ...prev,
                      from_amount: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">To Amount</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={newTransferForm.to_amount}
                  onChange={(e) =>
                    setNewTransferForm((prev) => ({
                      ...prev,
                      to_amount: e.target.value,
                    }))
                  }
                  placeholder="Same as from amount"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Exchange Rate</Label>
              <Input
                type="number"
                step="0.000001"
                value={newTransferForm.exchange_rate}
                onChange={(e) =>
                  setNewTransferForm((prev) => ({
                    ...prev,
                    exchange_rate: e.target.value,
                  }))
                }
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={newTransferForm.status}
                onValueChange={(value) =>
                  setNewTransferForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Transfer Type</Label>
              <Input
                value={newTransferForm.transfer_type}
                onChange={(e) =>
                  setNewTransferForm((prev) => ({
                    ...prev,
                    transfer_type: e.target.value,
                  }))
                }
                placeholder="e.g., admin_adjustment, conversion"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newTransferForm.description}
                onChange={(e) =>
                  setNewTransferForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional description..."
                className="text-xs"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddTransfer(false);
                setNewTransferForm({
                  from_currency: "",
                  to_currency: "",
                  from_amount: "",
                  to_amount: "",
                  exchange_rate: "1.0",
                  status: "completed",
                  transfer_type: "",
                  description: "",
                });
              }}
              disabled={savingRecord}
            >
              Cancel
            </Button>
            <Button
              onClick={createNewTransfer}
              disabled={savingRecord}
              className="bg-[#F26623] hover:bg-[#E55A1F]"
            >
              {savingRecord ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Transfer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skip KYC Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip KYC Verification</DialogTitle>
            <DialogDescription>
              This will create an approved KYC record for{" "}
              {selectedKYCUser?.full_name || selectedKYCUser?.email} without
              requiring document uploads. This action should only be used for
              trusted users.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will mark the user's KYC as approved without document
                verification. This action cannot be easily reversed.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSkipDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedKYCUser && skipKYCForUser(selectedKYCUser.id)
              }
              disabled={updatingKYC === selectedKYCUser?.id}
            >
              {updatingKYC === selectedKYCUser?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Skip KYC"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
