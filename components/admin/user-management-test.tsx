"use client";

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  RefreshCw,
  DollarSign,
  Euro,
  Bitcoin,
  Search,
  Calendar,
  Shield,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  kyc_status: string;
  client_id: string;
  display_name: string;
  age: number | null;
  is_admin: boolean;
  is_manager: boolean;
  is_superiormanager: boolean;
}

interface UserBalance {
  user_id: string;
  crypto: number;
  euro: number;
  cad: number;
  usd: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Fetch balances for a user
  const fetchUserBalance = async (userId: string): Promise<UserBalance> => {
    try {
      const [cryptoResult, euroResult, cadResult, usdResult] = await Promise.allSettled([
        supabase
          .from("crypto_balances")
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
          .from("usd_balances")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      return {
        user_id: userId,
        crypto:
          cryptoResult.status === "fulfilled"
            ? Number(cryptoResult.value?.data?.balance || 0)
            : 0,
        euro:
          euroResult.status === "fulfilled"
            ? Number(euroResult.value?.data?.balance || 0)
            : 0,
        cad:
          cadResult.status === "fulfilled"
            ? Number(cadResult.value?.data?.balance || 0)
            : 0,
        usd:
          usdResult.status === "fulfilled"
            ? Number(usdResult.value?.data?.balance || 0)
            : 0,
      };
    } catch (error) {
      console.error(`Balance fetch failed for user ${userId}:`, error);
      return {
        user_id: userId,
        crypto: 0,
        euro: 0,
        cad: 0,
        usd: 0,
      };
    }
  };

  // Load 20 newest users
  const loadNewestUsers = useCallback(async () => {
    setLoading(true);
    setUsers([]);
    setUserBalances([]);
    setIsSearchMode(false);
    setMessage(null);

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select(
          "id, email, full_name, first_name, last_name, created_at, kyc_status, age, is_admin, is_manager, is_superiormanager"
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (userError) throw userError;

      const transformedUsers: User[] = (userData || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        kyc_status: user.kyc_status || "not_started",
        age: user.age,
        is_admin: user.is_admin || false,
        is_manager: user.is_manager || false,
        is_superiormanager: user.is_superiormanager || false,
        client_id: `DCB${user.id.slice(0, 6)}`,
        display_name:
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Unknown User",
      }));

      setUsers(transformedUsers);

      // Fetch balances for all users
      const balancePromises = transformedUsers.map((user) =>
        fetchUserBalance(user.id)
      );
      const balances = await Promise.all(balancePromises);
      setUserBalances(balances);
    } catch (error) {
      console.error("Failed to load users:", error);
      setMessage({
        type: "error",
        text: "Failed to load users. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Search users in database
  const searchUsers = useCallback(async () => {
    if (!searchTerm.trim()) {
      loadNewestUsers();
      return;
    }

    setSearchLoading(true);
    setUsers([]);
    setUserBalances([]);
    setIsSearchMode(true);
    setMessage(null);

    try {
      const searchLower = searchTerm.toLowerCase();
      
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select(
          "id, email, full_name, first_name, last_name, created_at, kyc_status, age, is_admin, is_manager, is_superiormanager"
        )
        .or(
          `email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%,first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%`
        )
        .order("created_at", { ascending: false })
        .limit(50); // Limit search results

      if (userError) throw userError;

      const transformedUsers: User[] = (userData || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        kyc_status: user.kyc_status || "not_started",
        age: user.age,
        is_admin: user.is_admin || false,
        is_manager: user.is_manager || false,
        is_superiormanager: user.is_superiormanager || false,
        client_id: `DCB${user.id.slice(0, 6)}`,
        display_name:
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Unknown User",
      }));

      setUsers(transformedUsers);

      if (transformedUsers.length > 0) {
        // Fetch balances for search results
        const balancePromises = transformedUsers.map((user) =>
          fetchUserBalance(user.id)
        );
        const balances = await Promise.all(balancePromises);
        setUserBalances(balances);
      }

      setMessage({
        type: "success",
        text: `Found ${transformedUsers.length} users matching "${searchTerm}"`,
      });
    } catch (error) {
      console.error("Search failed:", error);
      setMessage({
        type: "error",
        text: "Search failed. Please try again.",
      });
    } finally {
      setSearchLoading(false);
    }
  }, [searchTerm, loadNewestUsers]);

  // Load newest users on component mount
  useEffect(() => {
    loadNewestUsers();
  }, [loadNewestUsers]);

  const getUserBalance = (userId: string) => {
    return (
      userBalances.find((balance) => balance.user_id === userId) || {
        crypto: 0,
        euro: 0,
        cad: 0,
        usd: 0,
      }
    );
  };

  const getKycStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getKycStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Verified";
      case "pending":
        return "Pending";
      case "rejected":
        return "Rejected";
      case "not_started":
        return "Not Started";
      default:
        return "Unknown";
    }
  };

  const getRoleBadges = (user: User) => {
    const roles = [];
    if (user.is_superiormanager) roles.push("Superior Manager");
    else if (user.is_manager) roles.push("Manager");
    if (user.is_admin) roles.push("Admin");
    return roles;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchUsers();
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    loadNewestUsers();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            User Management
            <Badge variant="outline" className="ml-3">
              {isSearchMode ? "Search Results" : "20 Newest"}
            </Badge>
          </div>
          <Button
            onClick={loadNewestUsers}
            disabled={loading || searchLoading}
            variant="outline"
            size="sm"
          >
            <Loader2
              className={`w-4 h-4 mr-2 ${
                loading ? "animate-spin" : "hidden"
              }`}
            />
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "hidden" : ""}`} />
            Refresh
          </Button>
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

        {/* Search Section */}
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by name, email, or client ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Button
              onClick={searchUsers}
              disabled={searchLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Loader2
                className={`w-4 h-4 mr-2 ${
                  searchLoading ? "animate-spin" : "hidden"
                }`}
              />
              <Search className={`w-4 h-4 mr-2 ${searchLoading ? "hidden" : ""}`} />
              Search
            </Button>
            {isSearchMode && (
              <Button onClick={clearSearch} variant="outline">
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isSearchMode 
              ? "Searching entire database (up to 50 results)"
              : "Showing 20 newest users. Use search to find specific users."
            }
          </p>
        </div>

        {loading || searchLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              {searchLoading ? "Searching users..." : "Loading users..."}
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">
              {isSearchMode ? "No users found" : "No users available"}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {isSearchMode 
                ? `No results found for "${searchTerm}"`
                : "Click refresh to load the newest users"
              }
            </p>
            {!isSearchMode && (
              <Button onClick={loadNewestUsers} className="bg-[#F26623] hover:bg-[#E55A1F]">
                Load Users
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold">
                {isSearchMode ? "Search Results" : "Latest Users"}
              </h3>
            </div>

            {/* User Grid */}
            <div className="grid grid-cols-1 gap-4">
              {users.map((user) => {
                const balance = getUserBalance(user.id);
                const roles = getRoleBadges(user);
                
                return (
                  <div
                    key={user.id}
                    className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h4 className="font-medium text-lg">
                            {user.display_name}
                          </h4>
                          <Badge className={getKycStatusColor(user.kyc_status)}>
                            <Shield className="w-3 h-3 mr-1" />
                            {getKycStatusLabel(user.kyc_status)}
                          </Badge>
                          {roles.map((role) => (
                            <Badge key={role} variant="secondary" className="bg-purple-100 text-purple-800">
                              {role}
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">Client ID:</span>{" "}
                            {user.client_id}
                          </p>
                          <p>
                            <span className="font-medium">Email:</span>{" "}
                            {user.email}
                          </p>
                          <p className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span className="font-medium">Joined:</span>{" "}
                            {formatDate(user.created_at)}
                          </p>
                          {user.age && (
                            <p>
                              <span className="font-medium">Age:</span> {user.age}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Balance Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 font-medium">
                              Crypto
                            </p>
                            <p className="font-bold text-lg text-orange-700">
                              {balance.crypto.toFixed(8)}
                            </p>
                            <p className="text-xs text-gray-500">BTC</p>
                          </div>
                          <Bitcoin className="w-5 h-5 text-orange-500" />
                        </div>
                      </div>

                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 font-medium">
                              Euro
                            </p>
                            <p className="font-bold text-lg text-blue-700">
                              €{balance.euro.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">EUR</p>
                          </div>
                          <Euro className="w-5 h-5 text-blue-500" />
                        </div>
                      </div>

                      <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 font-medium">
                              Canadian
                            </p>
                            <p className="font-bold text-lg text-green-700">
                              C${balance.cad.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">CAD</p>
                          </div>
                          <DollarSign className="w-5 h-5 text-green-500" />
                        </div>
                      </div>

                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 font-medium">
                              US Dollar
                            </p>
                            <p className="font-bold text-lg text-purple-700">
                              ${balance.usd.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">USD</p>
                          </div>
                          <DollarSign className="w-5 h-5 text-purple-500" />
                        </div>
                      </div>
                    </div>

                    {/* Total Portfolio Value */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">
                          Total Portfolio Value:
                        </span>
                        <span className="font-bold text-gray-900">
                          $
                          {(
                            balance.usd +
                            balance.cad +
                            balance.euro * 1.1 +
                            balance.crypto * 50000
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {isSearchMode && users.length === 0 && searchTerm && (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">
                  No users found matching "{searchTerm}"
                </p>
                <p className="text-sm text-gray-500">
                  Try searching by name, email, or different keywords
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}