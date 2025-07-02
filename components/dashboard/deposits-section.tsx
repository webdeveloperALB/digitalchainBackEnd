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
import { Download, CreditCard, Building, Smartphone } from "lucide-react";

export default function DepositsSection() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [formData, setFormData] = useState({
    currency: "",
    amount: "",
    method: "",
    bank_details: "",
  });

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("deposits")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setDeposits(data || []);
      }
    } catch (error) {
      console.error("Error fetching deposits:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitDeposit = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const referenceId = `DEP-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const { error } = await supabase.from("deposits").insert({
          user_id: user.id,
          currency: formData.currency,
          amount: Number.parseFloat(formData.amount),
          method: formData.method,
          reference_id: referenceId,
          bank_details: formData.bank_details
            ? JSON.parse(`{"details": "${formData.bank_details}"}`)
            : null,
          status: "Pending",
        });

        if (error) throw error;

        // Add transaction record
        await supabase.from("transactions").insert({
          user_id: user.id,
          type: "Deposit",
          amount: Number.parseFloat(formData.amount),
          currency: formData.currency,
          description: `${formData.method} deposit`,
          platform: formData.method,
          status: "Pending",
          reference_id: referenceId,
        });

        setFormData({ currency: "", amount: "", method: "", bank_details: "" });
        setShowDepositForm(false);
        fetchDeposits();
        alert(`Deposit request submitted! Reference ID: ${referenceId}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const depositMethods = [
    { id: "bank_transfer", name: "Bank Transfer", icon: Building },
    { id: "credit_card", name: "Credit Card", icon: CreditCard },
    { id: "mobile_payment", name: "Mobile Payment", icon: Smartphone },
    { id: "crypto_transfer", name: "Crypto Transfer", icon: Download },
  ];

  if (loading) {
    return <div className="p-6">Loading deposits...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto max-h-screen">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Deposits</h2>
          <Button
            onClick={() => setShowDepositForm(true)}
            className="bg-[#F26623] hover:bg-[#E55A1F]"
          >
            <Download className="w-4 h-4 mr-2" />
            New Deposit
          </Button>
        </div>

        {/* Deposit Methods */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {depositMethods.map((method) => (
            <Card
              key={method.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6 text-center">
                <method.icon className="w-8 h-8 mx-auto mb-2 text-[#F26623]" />
                <p className="font-medium">{method.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {showDepositForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Deposit Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="CAD">Canadian Dollar (CAD)</SelectItem>
                      <SelectItem value="CRYPTO">Cryptocurrency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label>Deposit Method</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) =>
                    setFormData({ ...formData, method: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Mobile Payment">
                      Mobile Payment
                    </SelectItem>
                    <SelectItem value="Crypto Transfer">
                      Crypto Transfer
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Additional Details (Optional)</Label>
                <Textarea
                  value={formData.bank_details}
                  onChange={(e) =>
                    setFormData({ ...formData, bank_details: e.target.value })
                  }
                  placeholder="Enter any additional information..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={submitDeposit}
                  className="bg-[#F26623] hover:bg-[#E55A1F]"
                >
                  Submit Deposit Request
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDepositForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deposit History */}
        <Card>
          <CardHeader>
            <CardTitle>Deposit History</CardTitle>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No deposits yet</p>
            ) : (
              <div className="space-y-4">
                {deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {Number(deposit.amount).toLocaleString()}{" "}
                        {deposit.currency}
                      </p>
                      <p className="text-sm text-gray-600">{deposit.method}</p>
                      <p className="text-xs text-gray-500">
                        Ref: {deposit.reference_id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(deposit.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${
                          deposit.status === "Approved"
                            ? "text-green-600"
                            : deposit.status === "Pending"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {deposit.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
