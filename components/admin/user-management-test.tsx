"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, RefreshCw, DollarSign, Euro, Bitcoin } from "lucide-react";

interface User {
  id: string;
  full_name: string;
  client_id: string;
  email: string;
}

interface UserBalance {
  user_id: string;
  crypto: number;
  euro: number;
  cad: number;
  usd: number;
}

export default function UserManagementTest() {
  const [users, setUsers] = useState<User[]>([]);
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users ordered by created_at descending (newest first)
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Error fetching users:", usersError);
        return;
      }

      setUsers(usersData || []);

      // Fetch balances for each user separately
      const balances: UserBalance[] = [];
      for (const user of usersData || []) {
        try {
          const [cryptoResult, euroResult, cadResult, usdResult] =
            await Promise.allSettled([
              supabase
                .from("crypto_balances")
                .select("balance")
                .eq("user_id", user.id)
                .single(),
              supabase
                .from("euro_balances")
                .select("balance")
                .eq("user_id", user.id)
                .single(),
              supabase
                .from("cad_balances")
                .select("balance")
                .eq("user_id", user.id)
                .single(),
              supabase
                .from("usd_balances")
                .select("balance")
                .eq("user_id", user.id)
                .single(),
            ]);

          const userBalance: UserBalance = {
            user_id: user.id,
            crypto:
              cryptoResult.status === "fulfilled"
                ? Number(cryptoResult.value.data?.balance || 0)
                : 0,
            euro:
              euroResult.status === "fulfilled"
                ? Number(euroResult.value.data?.balance || 0)
                : 0,
            cad:
              cadResult.status === "fulfilled"
                ? Number(cadResult.value.data?.balance || 0)
                : 0,
            usd:
              usdResult.status === "fulfilled"
                ? Number(usdResult.value.data?.balance || 0)
                : 0,
          };

          balances.push(userBalance);
        } catch (error) {
          console.error(`Error fetching balances for user ${user.id}:`, error);
          // Add zero balances for this user
          balances.push({
            user_id: user.id,
            crypto: 0,
            euro: 0,
            cad: 0,
            usd: 0,
          });
        }
      }

      setUserBalances(balances);
    } catch (error) {
      console.error("Error in fetchAllUsers:", error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            User Management & Testing
          </div>
          <Button onClick={fetchAllUsers} disabled={loading} variant="outline">
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Fetch All Users
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading users and balances...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No users found</p>
            <p className="text-sm text-gray-500">
              Click "Fetch All Users" to load user data
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                All Users ({users.length})
              </h3>
              <Badge variant="outline">{users.length} users loaded</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {users.map((user) => {
                const balance = getUserBalance(user.id);
                return (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-lg">
                          {user.full_name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Client ID: {user.client_id}
                        </p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600">Crypto</p>
                            <p className="font-bold text-lg">
                              {balance.crypto}
                            </p>
                            <p className="text-xs text-gray-500">BTC</p>
                          </div>
                          <Bitcoin className="w-5 h-5 text-orange-500" />
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600">Euro</p>
                            <p className="font-bold text-lg">
                              €{balance.euro.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">EUR</p>
                          </div>
                          <Euro className="w-5 h-5 text-blue-500" />
                        </div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600">CAD</p>
                            <p className="font-bold text-lg">
                              ${balance.cad.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">CAD</p>
                          </div>
                          <DollarSign className="w-5 h-5 text-green-500" />
                        </div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600">USD</p>
                            <p className="font-bold text-lg">
                              ${balance.usd.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">USD</p>
                          </div>
                          <DollarSign className="w-5 h-5 text-purple-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
