"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UserManagementTest() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [balanceUpdate, setBalanceUpdate] = useState({
    currency: "euro",
    amount: "",
  });

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          email,
          client_id,
          crypto_balances(balance),
          euro_balances(balance),
          cad_balances(balance),
          usd_balances(balance)
        `
        )
        .order("full_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateUserBalance = async () => {
    if (!selectedUser || !balanceUpdate.amount) return;

    try {
      const tableName = `${balanceUpdate.currency}_balances`;

      const { error } = await supabase
        .from(tableName)
        .update({
          balance: Number.parseFloat(balanceUpdate.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", selectedUser);

      if (error) throw error;

      // Add transaction record
      await supabase.from("transactions").insert({
        user_id: selectedUser,
        type: "Admin Adjustment",
        amount: Number.parseFloat(balanceUpdate.amount),
        currency: balanceUpdate.currency.toUpperCase(),
        description: `Balance updated by admin to ${
          balanceUpdate.amount
        } ${balanceUpdate.currency.toUpperCase()}`,
        platform: "Admin Panel",
        status: "Successful",
      });

      alert(
        "Balance updated successfully! Check the user's dashboard for real-time update."
      );
      setBalanceUpdate({ currency: "euro", amount: "" });
      fetchAllUsers();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Management & Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={fetchAllUsers}
            disabled={loading}
            className="bg-[#F26623] hover:bg-[#E55A1F]"
          >
            {loading ? "Loading..." : "Fetch All Users"}
          </Button>

          {users.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">All Users & Their Balances:</h3>
              <div className="grid gap-4">
                {users.map((user) => (
                  <Card key={user.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{user.full_name}</h4>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500">
                          Client ID: {user.client_id}
                        </p>
                        <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                          <span>
                            Crypto: {user.crypto_balances?.[0]?.balance || 0}
                          </span>
                          <span>
                            Euro: {user.euro_balances?.[0]?.balance || 0}
                          </span>
                          <span>
                            CAD: {user.cad_balances?.[0]?.balance || 0}
                          </span>
                          <span>
                            USD: {user.usd_balances?.[0]?.balance || 0}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={
                          selectedUser === user.id ? "default" : "outline"
                        }
                        onClick={() => setSelectedUser(user.id)}
                        className={
                          selectedUser === user.id ? "bg-[#F26623]" : ""
                        }
                      >
                        {selectedUser === user.id ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {selectedUser && (
                <Card className="p-4 bg-orange-50">
                  <h4 className="font-medium mb-4">
                    Update Selected User's Balance
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="currency-select">Currency</Label>
                      <select
                        id="currency-select"
                        value={balanceUpdate.currency}
                        onChange={(e) =>
                          setBalanceUpdate({
                            ...balanceUpdate,
                            currency: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded"
                        aria-label="Select currency to update"
                      >
                        <option value="crypto">Crypto</option>
                        <option value="euro">Euro</option>
                        <option value="cad">CAD</option>
                        <option value="usd">USD</option>
                      </select>
                    </div>
                    <div>
                      <Label>New Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={balanceUpdate.amount}
                        onChange={(e) =>
                          setBalanceUpdate({
                            ...balanceUpdate,
                            amount: e.target.value,
                          })
                        }
                        placeholder="1000.00"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={updateUserBalance}
                        className="bg-[#F26623] hover:bg-[#E55A1F]"
                      >
                        Update Balance
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Test User Isolation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium">Step 1: Create Test Users</h4>
            <p className="text-sm text-gray-600">
              1. Open your app in two different browsers (Chrome & Firefox)
              <br />
              2. Sign up as "Kevin" with kevin@test.com in Chrome
              <br />
              3. Sign up as "Andy" with andy@test.com in Firefox
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 2: Test Real-time Updates</h4>
            <p className="text-sm text-gray-600">
              1. Use this admin panel to update Kevin's Euro balance to 1000
              <br />
              2. Watch Kevin's dashboard update instantly in Chrome
              <br />
              3. Check Andy's dashboard in Firefox - it should NOT change
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 3: Verify Isolation</h4>
            <p className="text-sm text-gray-600">
              1. Update Andy's CAD balance to 500
              <br />
              2. Only Andy's dashboard should update
              <br />
              3. Kevin's balances remain unchanged
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
