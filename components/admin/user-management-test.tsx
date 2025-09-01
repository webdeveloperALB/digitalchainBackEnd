"use client";

import { useState, useCallback } from "react";
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
  ChevronDown,
  ChevronUp,
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
}

interface UserBalance {
  user_id: string;
  crypto: number;
  euro: number;
  cad: number;
  usd: number;
}

interface LoadingStats {
  usersLoaded: number;
  balancesLoaded: number;
  totalUsers: number;
  currentBatch: number;
  totalBatches: number;
}

export default function OptimizedUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [loadingStats, setLoadingStats] = useState<LoadingStats>({
    usersLoaded: 0,
    balancesLoaded: 0,
    totalUsers: 0,
    currentBatch: 0,
    totalBatches: 0,
  });
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [totalUserCount, setTotalUserCount] = useState(0);

  // Fast parallel balance fetching for a batch of users
  const fetchBalancesBatch = async (
    userBatch: User[]
  ): Promise<UserBalance[]> => {
    const balancePromises = userBatch.map(async (user, index) => {
      try {
        // Add staggered delay to prevent overwhelming the database
        await new Promise((resolve) => setTimeout(resolve, index * 50));

        // Parallel queries for all balance types
        const balanceQueries = [
          () =>
            supabase
              .from("crypto_balances")
              .select("balance")
              .eq("user_id", user.id)
              .maybeSingle(),
          () =>
            supabase
              .from("euro_balances")
              .select("balance")
              .eq("user_id", user.id)
              .maybeSingle(),
          () =>
            supabase
              .from("cad_balances")
              .select("balance")
              .eq("user_id", user.id)
              .maybeSingle(),
          () =>
            supabase
              .from("usd_balances")
              .select("balance")
              .eq("user_id", user.id)
              .maybeSingle(),
        ];

        // Execute queries with retry logic
        const results = await Promise.allSettled(
          balanceQueries.map(async (query, queryIndex) => {
            let retries = 3;
            while (retries > 0) {
              try {
                await new Promise((resolve) =>
                  setTimeout(resolve, queryIndex * 25)
                );
                return await query();
              } catch (error: any) {
                retries--;
                if (retries === 0) throw error;
                console.warn(
                  `Retrying balance query for user ${user.id}, attempts left: ${retries}`
                );
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          })
        );

        const [cryptoResult, euroResult, cadResult, usdResult] = results;

        return {
          user_id: user.id,
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
        console.error(`Balance fetch failed for user ${user.id}:`, error);
        return {
          user_id: user.id,
          crypto: 0,
          euro: 0,
          cad: 0,
          usd: 0,
        };
      }
    });

    return Promise.all(balancePromises);
  };

  // Optimized user fetching with streaming updates
  const fetchAllUsersOptimized = useCallback(async () => {
    setLoading(true);
    setUsers([]);
    setUserBalances([]);

    try {
      console.log("🚀 Starting optimized user fetch...");
      const startTime = Date.now();

      // Step 1: Get total count first (fast)
      const { count: totalCount, error: countError } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      setTotalUserCount(totalCount || 0);
      console.log(`📊 Total users in database: ${totalCount}`);

      // Step 2: Fetch users in optimized batches
      const BATCH_SIZE = 25; // Reduced batch size to prevent connection issues
      const BALANCE_BATCH_SIZE = 10; // Much smaller for balance queries
      const totalBatches = Math.ceil((totalCount || 0) / BATCH_SIZE);

      setLoadingStats({
        usersLoaded: 0,
        balancesLoaded: 0,
        totalUsers: totalCount || 0,
        currentBatch: 0,
        totalBatches,
      });

      let allUsers: User[] = [];
      let allBalances: UserBalance[] = [];

      // Fetch users in batches with immediate UI updates
      for (let i = 0; i < totalBatches; i++) {
        const offset = i * BATCH_SIZE;
        console.log(
          `📦 Fetching user batch ${i + 1}/${totalBatches} (offset: ${offset})`
        );

        // Add delay between batches to prevent overwhelming the database
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const { data: userBatch, error: userError } = await supabase
          .from("users")
          .select(
            "id, email, full_name, first_name, last_name, created_at, kyc_status"
          )
          .order("created_at", { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (userError) throw userError;

        // Transform user data
        const transformedBatch: User[] = (userBatch || []).map((user: any) => ({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          first_name: user.first_name,
          last_name: user.last_name,
          created_at: user.created_at,
          kyc_status: user.kyc_status || "not_started",
          client_id: `DCB${user.id.slice(0, 6)}`,
          display_name:
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            user.email?.split("@")[0] ||
            "Unknown User",
        }));

        allUsers = [...allUsers, ...transformedBatch];

        // Update UI immediately with new users
        setUsers([...allUsers]);
        setLoadingStats((prev) => ({
          ...prev,
          usersLoaded: allUsers.length,
          currentBatch: i + 1,
        }));

        // Fetch balances for this batch in smaller sub-batches
        const balanceBatches = [];
        for (let j = 0; j < transformedBatch.length; j += BALANCE_BATCH_SIZE) {
          balanceBatches.push(
            transformedBatch.slice(j, j + BALANCE_BATCH_SIZE)
          );
        }

        // Process balance batches sequentially to prevent connection issues
        const batchBalances = [];
        for (let k = 0; k < balanceBatches.length; k++) {
          const subBatch = balanceBatches[k];
          console.log(
            `💰 Processing balance sub-batch ${k + 1}/${
              balanceBatches.length
            } for batch ${i + 1}`
          );

          // Add delay between balance batches
          if (k > 0) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }

          const subBatchBalances = await fetchBalancesBatch(subBatch);
          batchBalances.push(subBatchBalances);
        }

        const flatBalances = batchBalances.flat();

        allBalances = [...allBalances, ...flatBalances];

        // Update balances immediately
        setUserBalances([...allBalances]);
        setLoadingStats((prev) => ({
          ...prev,
          balancesLoaded: allBalances.length,
        }));

        console.log(
          `✅ Batch ${i + 1} complete: ${transformedBatch.length} users, ${
            flatBalances.length
          } balances`
        );
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`🎉 Optimized fetch complete!`);
      console.log(
        `📈 Performance: ${allUsers.length} users + ${
          allBalances.length
        } balances in ${duration.toFixed(2)}s`
      );
      console.log(
        `⚡ Average: ${(allUsers.length / duration).toFixed(1)} users/second`
      );
    } catch (error) {
      console.error("❌ Optimized fetch failed:", error);
      setMessage({
        type: "error",
        text: "Failed to load users. Please try the Quick Load option or refresh the page.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Quick load first 100 users for immediate display
  const quickLoadUsers = useCallback(async () => {
    setLoading(true);
    setUsers([]);
    setUserBalances([]);

    try {
      console.log("⚡ Quick loading first 100 users...");

      const { data: quickUsers, error } = await supabase
        .from("users")
        .select(
          "id, email, full_name, first_name, last_name, created_at, kyc_status"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformedUsers: User[] = (quickUsers || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at,
        kyc_status: user.kyc_status || "not_started",
        client_id: `DCB${user.id.slice(0, 6)}`,
        display_name:
          user.full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email?.split("@")[0] ||
          "Unknown User",
      }));

      setUsers(transformedUsers);

      // Quick balance fetch in smaller chunks to prevent connection issues
      const balances: UserBalance[] = [];
      const chunkSize = 10;

      for (let i = 0; i < transformedUsers.length; i += chunkSize) {
        const chunk = transformedUsers.slice(i, i + chunkSize);
        console.log(
          `💰 Loading balances for users ${i + 1}-${Math.min(
            i + chunkSize,
            transformedUsers.length
          )}`
        );

        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        const quickChunkBalances = await fetchBalancesBatch(chunk);
        balances.push(...quickChunkBalances);

        // Update UI progressively
        setUserBalances([...balances]);
      }

      setUserBalances(balances);

      console.log(
        `⚡ Quick load complete: ${transformedUsers.length} users with balances`
      );
    } catch (error) {
      console.error("Quick load failed:", error);
      setMessage({
        type: "error",
        text: "Quick load failed. Please try again or check your connection.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.client_id?.toLowerCase().includes(searchLower)
    );
  });

  const displayUsers = showAllUsers
    ? filteredUsers
    : filteredUsers.slice(0, 50);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Optimized User Management
            <Badge variant="outline" className="ml-3">
              High Performance
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={quickLoadUsers}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <Loader2
                className={`w-4 h-4 mr-2 ${
                  loading ? "animate-spin" : "hidden"
                }`}
              />
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "hidden" : ""}`}
              />
              Quick Load (100)
            </Button>
            <Button
              onClick={fetchAllUsersOptimized}
              disabled={loading}
              variant="outline"
            >
              <Loader2
                className={`w-4 h-4 mr-2 ${
                  loading ? "animate-spin" : "hidden"
                }`}
              />
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "hidden" : ""}`}
              />
              Load All Users
            </Button>
          </div>
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

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Optimized Loading...</p>

            {loadingStats.totalUsers > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>
                    Users: {loadingStats.usersLoaded} /{" "}
                    {loadingStats.totalUsers}
                  </span>
                  <span>
                    Batch: {loadingStats.currentBatch} /{" "}
                    {loadingStats.totalBatches}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#F26623] h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (loadingStats.usersLoaded / loadingStats.totalUsers) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Balances: {loadingStats.balancesLoaded}</span>
                  <span>
                    {(
                      (loadingStats.usersLoaded / loadingStats.totalUsers) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Loading optimized to prevent connection issues...
                </p>
              </div>
            )}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No users loaded</p>
            <p className="text-sm text-gray-500 mb-4">
              Choose your loading strategy:
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={quickLoadUsers} variant="outline">
                Quick Load (100 users)
              </Button>
              <Button
                onClick={fetchAllUsersOptimized}
                className="bg-[#F26623] hover:bg-[#E55A1F]"
              >
                Load All Users
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats and Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">
                  Users ({users.length}
                  {totalUserCount > users.length ? ` of ${totalUserCount}` : ""}
                  )
                </h3>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {users.length} loaded
                </Badge>
                {userBalances.length > 0 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {userBalances.length} with balances
                  </Badge>
                )}
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by name, email, or client ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {searchTerm && (
              <div className="text-sm text-gray-600 mb-2">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            )}

            {/* Show/Hide Toggle */}
            {filteredUsers.length > 50 && (
              <div className="flex justify-center mb-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAllUsers(!showAllUsers)}
                  className="flex items-center gap-2"
                >
                  {showAllUsers ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show Less (50)
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show All ({filteredUsers.length})
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* User Grid */}
            <div className="grid grid-cols-1 gap-4">
              {displayUsers.map((user) => {
                const balance = getUserBalance(user.id);
                return (
                  <div
                    key={user.id}
                    className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-lg">
                            {user.display_name}
                          </h4>
                          <Badge className={getKycStatusColor(user.kyc_status)}>
                            <Shield className="w-3 h-3 mr-1" />
                            {getKycStatusLabel(user.kyc_status)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
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
                        </div>
                      </div>
                    </div>

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

            {filteredUsers.length === 0 && searchTerm && (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">
                  No users found matching "{searchTerm}"
                </p>
                <p className="text-sm text-gray-500">
                  Try searching by name, email, or client ID
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
