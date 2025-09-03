"use client";
import type React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
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
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
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
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [accessibleUserIds, setAccessibleUserIds] = useState<string[]>([]);
  const [accessibleUserIdsLoaded, setAccessibleUserIdsLoaded] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

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

  // Tax types - STABLE
  const taxTypes = useMemo(
    () => [
      { value: "income", label: "Income Tax" },
      { value: "property", label: "Property Tax" },
      { value: "sales", label: "Sales Tax" },
      { value: "other", label: "Other Tax" },
    ],
    []
  );

  const taxStatuses = useMemo(
    () => [
      {
        value: "pending",
        label: "Pending",
        color: "bg-yellow-100 text-yellow-800",
      },
      { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
      { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-800" },
    ],
    []
  );

  // Get current admin info - STABLE FUNCTION
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

  // Get accessible user IDs - STABLE FUNCTION
  const loadAccessibleUserIds = useCallback(
    async (admin: CurrentAdmin): Promise<string[]> => {
      if (!admin) {
        console.log("No admin provided to loadAccessibleUserIds");
        return [];
      }

      console.log("Getting accessible users for admin:", admin);

      // Full admin (is_admin: true, is_superiormanager: false, is_manager: false) - can see everyone
      if (admin.is_admin && !admin.is_superiormanager && !admin.is_manager) {
        console.log("Full admin - can see all users");
        return []; // Empty array means no filter (see all)
      }

      // Superior manager (is_admin: true, is_superiormanager: true) - can see their managers and their assigned users
      if (admin.is_admin && admin.is_superiormanager) {
        console.log("Superior manager loading accessible users for:", admin.id);

        try {
          // Get managers assigned to this superior manager
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
            // Verify these are actually managers (not other superior managers or regular users)
            const { data: verifiedManagers, error: verifyError } =
              await supabase
                .from("users")
                .select("id")
                .in("id", managerIds)
                .eq("is_manager", true)
                .eq("is_superiormanager", false); // Only regular managers, not other superior managers

            if (verifyError) {
              console.error("Error verifying managers:", verifyError);
              return [admin.id];
            }

            const verifiedManagerIds =
              verifiedManagers?.map((m: any) => m.id) || [];
            console.log("Verified manager IDs:", verifiedManagerIds);

            if (verifiedManagerIds.length > 0) {
              // Get users assigned to those verified managers
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

              // Filter out any admin/manager users from the assigned users list
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

      // Manager (is_manager: true) - can only see assigned users (not other managers)
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
            // Verify these are regular users (not managers or admins)
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

  // Check if user has full admin access (is_admin: true, others: false)
  const hasFullAdminAccess = useMemo(() => {
    return (
      currentAdmin?.is_admin === true &&
      currentAdmin?.is_manager === false &&
      currentAdmin?.is_superiormanager === false
    );
  }, [currentAdmin]);

  // Get admin level description
  const getAdminLevelDescription = useMemo(() => {
    if (!currentAdmin) return "Loading permissions...";

    if (
      currentAdmin.is_admin &&
      !currentAdmin.is_superiormanager &&
      !currentAdmin.is_manager
    ) {
      return "Full Administrator - Can manage taxes for all users";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can manage taxes for assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can manage taxes for assigned users only";
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

  // User search with cached accessible IDs
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

        // Build base query
        let query = supabase
          .from("users")
          .select(
            "id, email, full_name, first_name, last_name, created_at, kyc_status, is_admin, is_manager, is_superiormanager"
          )
          .or(`email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%`);

        // Use cached accessible user IDs
        console.log(
          "Search using cached accessible user IDs:",
          accessibleUserIds
        );

        if (accessibleUserIds.length > 0) {
          // Filter to only accessible users
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
          // Full admin sees everyone - no filter needed
          console.log("Full admin search - no filter applied");
        } else {
          // No accessible users
          console.log("No accessible users for search");
          query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // No results
        }

        const { data, error } = await query
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

  // Setup realtime subscription - STABLE FUNCTION
  const setupRealtimeSubscription = useCallback(() => {
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
  }, [selectedUser]);

  // Fetch taxes for user - STABLE FUNCTION
  const fetchTaxesForUser = useCallback(
    async (userId: string) => {
      if (!currentAdmin) {
        console.log("No current admin, cannot fetch taxes");
        return;
      }

      // Check if admin can access this user
      const canAccessUser =
        accessibleUserIds.length === 0 || // Full admin
        accessibleUserIds.includes(userId); // User is accessible

      if (!canAccessUser) {
        setMessage({
          type: "error",
          text: "You don't have permission to view taxes for this user",
        });
        return;
      }

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
    },
    [currentAdmin, selectedUser, accessibleUserIds]
  );

  // Reset form - STABLE FUNCTION
  const resetForm = useCallback(() => {
    setTaxType("");
    setTaxName("");
    setTaxAmount("");
    setDueDate("");
    setStatus("pending");
    setDescription("");
    setEditingTax(null);
  }, []);

  // Handle submit - STABLE FUNCTION
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedUser || !taxType || !taxName || !taxAmount) {
        setMessage({
          type: "error",
          text: "Please fill in all required fields",
        });
        return;
      }

      if (!currentAdmin) {
        setMessage({ type: "error", text: "Admin session not found" });
        return;
      }

      // Check if admin can manage taxes for this user
      const canManageTaxes =
        accessibleUserIds.length === 0 || // Full admin
        accessibleUserIds.includes(selectedUser.id); // User is accessible

      if (!canManageTaxes) {
        setMessage({
          type: "error",
          text: "You don't have permission to manage taxes for this user",
        });
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
    },
    [
      selectedUser,
      taxType,
      taxName,
      taxAmount,
      currentAdmin,
      accessibleUserIds,
      dueDate,
      status,
      description,
      editingTax,
      resetForm,
      fetchTaxesForUser,
    ]
  );

  // Handle edit - STABLE FUNCTION
  const handleEdit = useCallback((tax: Tax) => {
    setEditingTax(tax);
    setTaxType(tax.tax_type);
    setTaxName(tax.tax_name);
    setTaxAmount(tax.tax_amount.toString());
    setDueDate(tax.due_date || "");
    setStatus(tax.status);
    setDescription(tax.description || "");
    setIsDialogOpen(true);
  }, []);

  // Handle delete - STABLE FUNCTION
  const handleDelete = useCallback(
    async (taxId: string) => {
      if (!confirm("Are you sure you want to delete this tax record?")) return;

      if (!currentAdmin) {
        setMessage({ type: "error", text: "Admin session not found" });
        return;
      }

      try {
        const { error } = await supabase.from("taxes").delete().eq("id", taxId);
        if (error) throw error;

        setMessage({
          type: "success",
          text: "Tax record deleted successfully",
        });
        if (selectedUser) {
          fetchTaxesForUser(selectedUser.id);
        }
      } catch (error: any) {
        console.error("Error deleting tax:", error);
        setMessage({ type: "error", text: "Failed to delete tax record" });
      }
    },
    [currentAdmin, selectedUser, fetchTaxesForUser]
  );

  // Update tax status - STABLE FUNCTION
  const updateTaxStatus = useCallback(
    async (taxId: string, newStatus: string) => {
      if (!currentAdmin) {
        setMessage({ type: "error", text: "Admin session not found" });
        return;
      }

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
    },
    [currentAdmin, selectedUser, fetchTaxesForUser]
  );

  // Helper functions - STABLE
  const getStatusColor = useCallback(
    (status: string) => {
      const statusObj = taxStatuses.find((s) => s.value === status);
      return statusObj?.color || "bg-gray-100 text-gray-800";
    },
    [taxStatuses]
  );

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);

  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return "No due date";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  // EFFECT 1: Initialize current admin - NO DEPENDENCIES ON OTHER FUNCTIONS
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
        if (mounted) {
          setMessage({
            type: "error",
            text: "Failed to load admin permissions",
          });
        }
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
  }, []); // NO DEPENDENCIES

  // EFFECT 2: Load accessible user IDs when admin changes - STABLE
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
  }, [currentAdmin, loadAccessibleUserIds]); // Only depends on currentAdmin and stable function

  // EFFECT 3: Setup realtime subscription - STABLE
  useEffect(() => {
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [setupRealtimeSubscription]);

  // EFFECT 4: Fetch taxes when user selected - STABLE
  useEffect(() => {
    if (selectedUser && accessibleUserIdsLoaded) {
      fetchTaxesForUser(selectedUser.id);
    }
  }, [selectedUser, accessibleUserIdsLoaded, fetchTaxesForUser]);

  // Loading state
  if (loadingPermissions) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
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
      <Card className="w-full max-w-2xl mx-auto mt-8">
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
      <Card className="w-full max-w-2xl mx-auto mt-8">
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
            You need admin or manager permissions to manage taxes.
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

  return (
    <div className="space-y-6">
      {/* Admin Level Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Your Access Level - Tax Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            {currentAdmin.is_admin &&
              !currentAdmin.is_superiormanager &&
              !currentAdmin.is_manager && (
                <Badge className="bg-red-100 text-red-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Full Administrator
                </Badge>
              )}
            {currentAdmin.is_admin && currentAdmin.is_superiormanager && (
              <Badge className="bg-purple-100 text-purple-800">
                <Crown className="w-3 h-3 mr-1" />
                Superior Manager
              </Badge>
            )}
            {currentAdmin.is_manager && (
              <Badge className="bg-blue-100 text-blue-800">
                <UserCheck className="w-3 h-3 mr-1" />
                Manager
              </Badge>
            )}
            <span className="text-sm text-gray-600">
              {getAdminLevelDescription}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Tax Manager - Hierarchy-Aware Search
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
            {/* Hierarchy-aware User Search and Selection */}
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
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-green-600">
                          DCB{selectedUser.id.slice(0, 6)} •{" "}
                          {selectedUser.email}
                        </p>
                        {getRoleBadges(selectedUser).map((role, index) => (
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
                                      DCB{user.id.slice(0, 6)} • {user.email}
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
                          No clients found matching "{userSearch}"
                          {currentAdmin.is_manager && (
                            <p className="text-xs mt-1">
                              You can only search users assigned to you
                            </p>
                          )}
                          {currentAdmin.is_admin &&
                            currentAdmin.is_superiormanager && (
                              <p className="text-xs mt-1">
                                You can only search managers you assigned and
                                their users
                              </p>
                            )}
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
                        <strong>Search Scope:</strong>{" "}
                        {getAdminLevelDescription}
                      </p>
                      {currentAdmin.is_manager && (
                        <p className="text-xs text-blue-600 mt-1">
                          You can only manage taxes for users specifically
                          assigned to you
                        </p>
                      )}
                      {currentAdmin.is_admin &&
                        currentAdmin.is_superiormanager && (
                          <p className="text-xs text-blue-600 mt-1">
                            You can manage taxes for managers you assigned and
                            their users
                          </p>
                        )}
                    </div>
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
                    {currentAdmin.is_admin &&
                    !currentAdmin.is_superiormanager &&
                    !currentAdmin.is_manager
                      ? "You can search any user"
                      : currentAdmin.is_admin && currentAdmin.is_superiormanager
                      ? "You can search managers you assigned and their users"
                      : "You can search users assigned to you"}
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
