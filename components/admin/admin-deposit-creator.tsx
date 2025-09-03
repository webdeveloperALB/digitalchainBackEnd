"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Users,
  FileText,
  Loader2,
  CheckCircle,
  Search,
  X,
  Building,
  MapPin,
  Shield,
  Crown,
  UserCheck,
  AlertTriangle,
} from "lucide-react";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
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

interface UserAssignment {
  id: string;
  manager_id: string;
  assigned_user_id: string;
  assigned_by: string;
  created_at: string;
}

export default function AdminDepositCreator() {
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  // Transaction form
  const [transactionForm, setTransactionForm] = useState({
    thType: "External Deposit",
    thDetails: "Funds extracted by Estonian authorities",
    thPoi: "Estonia Financial Intelligence Unit (FIU)",
    thStatus: "Successful",
    thEmail: "",
  });

  // Get current admin info
  const getCurrentAdmin = useCallback(async () => {
    try {
      // Get current session from localStorage (matches your login system)
      const currentSession = localStorage.getItem("current_admin_session");
      if (!currentSession) {
        console.log("No current admin session found");
        return null;
      }

      const sessionData = JSON.parse(currentSession);
      console.log("Current session data:", sessionData);

      // Get admin info from users table using session user ID
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

  // Load assignments
  const loadAssignments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Failed to load assignments:", error);
    }
  }, []);

  // Get accessible user IDs based on hierarchy
  const getAccessibleUserIds = useCallback(
    async (admin: CurrentAdmin): Promise<string[]> => {
      if (!admin) {
        console.log("No admin provided to getAccessibleUserIds");
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
            return [];
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

            const verifiedManagerIds = verifiedManagers?.map((m) => m.id) || [];
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

              const verifiedUserIds = verifiedUsers?.map((u) => u.id) || [];
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

            const verifiedUserIds = verifiedUsers?.map((u) => u.id) || [];
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
  const hasFullAdminAccess = () => {
    return (
      currentAdmin?.is_admin === true &&
      currentAdmin?.is_manager === false &&
      currentAdmin?.is_superiormanager === false
    );
  };

  // Get admin level description
  const getAdminLevelDescription = () => {
    if (!currentAdmin) return "Loading permissions...";

    if (
      currentAdmin.is_admin &&
      !currentAdmin.is_superiormanager &&
      !currentAdmin.is_manager
    ) {
      return "Full Administrator - Can create deposits for all users";
    }
    if (currentAdmin.is_admin && currentAdmin.is_superiormanager) {
      return "Superior Manager - Can create deposits for assigned managers and their users";
    }
    if (currentAdmin.is_manager) {
      return "Manager - Can create deposits for assigned users only";
    }
    return "No admin permissions";
  };

  // Hierarchy-aware user search
  useEffect(() => {
    if (!currentAdmin || userSearch.length < 2) {
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
            "id, email, full_name, is_admin, is_manager, is_superiormanager"
          )
          .or(`email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%`);

        // Apply hierarchy-based filtering
        const accessibleUserIds = await getAccessibleUserIds(currentAdmin);

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
          .limit(20)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            client_id: `DCB${user.id.slice(0, 6)}`,
            full_name: user.full_name || user.email?.split("@")[0] || "Unknown",
            email: user.email,
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
  }, [userSearch, currentAdmin, getAccessibleUserIds]);

  // Initialize current admin and load assignments
  useEffect(() => {
    const init = async () => {
      setLoadingPermissions(true);
      try {
        const admin = await getCurrentAdmin();
        setCurrentAdmin(admin);

        if (admin) {
          await loadAssignments();
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
        setMessage({ type: "error", text: "Failed to load admin permissions" });
      } finally {
        setLoadingPermissions(false);
      }
    };
    init();
  }, [getCurrentAdmin, loadAssignments]);

  const submitTransaction = async () => {
    if (
      !selectedUser ||
      !transactionForm.thType ||
      !transactionForm.thDetails
    ) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    if (!currentAdmin) {
      setMessage({ type: "error", text: "Admin session not found" });
      return;
    }

    // Check if admin can create deposits for this user
    const accessibleUserIds = await getAccessibleUserIds(currentAdmin);
    const canCreateDeposit =
      accessibleUserIds.length === 0 || // Full admin
      accessibleUserIds.includes(selectedUser.id); // User is accessible

    if (!canCreateDeposit) {
      setMessage({
        type: "error",
        text: "You don't have permission to create deposits for this user",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      // Create transaction record in deposits table
      const { error: transactionError } = await supabase
        .from("deposits")
        .insert({
          uuid: selectedUser.id,
          thType: transactionForm.thType,
          thDetails: transactionForm.thDetails,
          thPoi: transactionForm.thPoi,
          thStatus: transactionForm.thStatus,
          thEmail: transactionForm.thEmail || selectedUser.email,
        });

      if (transactionError) throw transactionError;

      // Reset form
      setTransactionForm({
        thType: "External Deposit",
        thDetails: "Funds extracted by Estonian authorities",
        thPoi: "Estonia Financial Intelligence Unit (FIU)",
        thStatus: "Successful",
        thEmail: "",
      });
      setSelectedUser(null);
      setUserSearch("");

      setMessage({
        type: "success",
        text: `Transaction record created successfully for ${
          selectedUser.full_name || selectedUser.email
        }!`,
      });
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      setMessage({
        type: "error",
        text: `Error: ${error.message || "Unknown error occurred"}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Get role badges for user
  const getRoleBadges = (user: User) => {
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
  };

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
            You need admin or manager permissions to create deposits.
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
            Your Access Level - Deposit Creation
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
              {getAdminLevelDescription()}
            </span>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Create Transaction Record - User Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hierarchy-aware user search */}
          <div className="space-y-2">
            <Label>Search and Select User *</Label>
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
                      {getAdminLevelDescription()}
                    </p>
                    {currentAdmin.is_manager && (
                      <p className="text-xs text-blue-600 mt-1">
                        You can only create deposits for users specifically
                        assigned to you
                      </p>
                    )}
                    {currentAdmin.is_admin &&
                      currentAdmin.is_superiormanager && (
                        <p className="text-xs text-blue-600 mt-1">
                          You can create deposits for managers you assigned and
                          their users
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedUser && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Transaction Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="thType">Transaction Type *</Label>
                  <Select
                    value={transactionForm.thType}
                    onValueChange={(value) =>
                      setTransactionForm({ ...transactionForm, thType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="External Deposit">
                        External Deposit
                      </SelectItem>
                      <SelectItem value="Internal Transfer">
                        Internal Transfer
                      </SelectItem>
                      <SelectItem value="Regulatory Action">
                        Regulatory Action
                      </SelectItem>
                      <SelectItem value="Compliance Review">
                        Compliance Review
                      </SelectItem>
                      <SelectItem value="Account Adjustment">
                        Account Adjustment
                      </SelectItem>
                      <SelectItem value="Administrative Action">
                        Administrative Action
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="thStatus">Status *</Label>
                  <Select
                    value={transactionForm.thStatus}
                    onValueChange={(value) =>
                      setTransactionForm({
                        ...transactionForm,
                        thStatus: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Successful">Successful</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Processing">Processing</SelectItem>
                      <SelectItem value="Under Review">Under Review</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="thDetails">Transaction Details *</Label>
                <Textarea
                  id="thDetails"
                  value={transactionForm.thDetails}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      thDetails: e.target.value,
                    })
                  }
                  placeholder="Detailed description of the transaction"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div>
                <Label htmlFor="thPoi">Point of Interest</Label>
                <Input
                  id="thPoi"
                  value={transactionForm.thPoi}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      thPoi: e.target.value,
                    })
                  }
                  placeholder="e.g., Estonia Financial Intelligence Unit (FIU)"
                />
              </div>

              <div>
                <Label htmlFor="thEmail">Associated Email</Label>
                <Input
                  id="thEmail"
                  type="email"
                  value={transactionForm.thEmail}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      thEmail: e.target.value,
                    })
                  }
                  placeholder={`Default: ${selectedUser.email || "No email"}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use the selected user's email
                </p>
              </div>

              <Alert>
                <Building className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Preview:</strong> This will create a transaction
                  record for{" "}
                  <strong>
                    {selectedUser.full_name || selectedUser.email}
                  </strong>{" "}
                  with type "{transactionForm.thType}" and status "
                  {transactionForm.thStatus}". The record will appear in their
                  transaction history immediately.
                </AlertDescription>
              </Alert>

              <Button
                onClick={submitTransaction}
                disabled={
                  submitting ||
                  !selectedUser ||
                  !transactionForm.thType ||
                  !transactionForm.thDetails
                }
                className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Transaction...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Create Transaction Record
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
