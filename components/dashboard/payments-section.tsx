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
import {
  Receipt,
  FileText,
  AlertTriangle,
  Building,
  Zap,
  CreditCard,
  ArrowUpDown,
} from "lucide-react";

export default function PaymentsSection() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [formData, setFormData] = useState({
    payment_type: "",
    amount: "",
    currency: "EUR",
    description: "",
    recipient: "",
    due_date: "",
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setPayments(data || []);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase.from("payments").insert({
          user_id: user.id,
          payment_type: formData.payment_type,
          amount: Number.parseFloat(formData.amount),
          currency: formData.currency,
          description: formData.description,
          recipient: formData.recipient,
          due_date: formData.due_date || null,
          status: "Pending",
        });

        if (error) throw error;

        // Add transaction record
        await supabase.from("transactions").insert({
          user_id: user.id,
          type: "Payment",
          amount: Number.parseFloat(formData.amount),
          currency: formData.currency,
          description: `${formData.payment_type} - ${formData.description}`,
          platform: "Digital Chain Bank",
          status: "Pending",
          recipient_name: formData.recipient,
        });

        setFormData({
          payment_type: "",
          amount: "",
          currency: "EUR",
          description: "",
          recipient: "",
          due_date: "",
        });
        setShowPaymentForm(false);
        fetchPayments();
        alert("Payment request submitted successfully!");
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const paymentTypes = [
    {
      id: "taxes",
      name: "Taxes",
      icon: Receipt,
      description: "Pay your outstanding state or national tax obligations",
    },
    {
      id: "invoices",
      name: "Invoices",
      icon: FileText,
      description: "Settle pending bills or service-related invoices",
    },
    {
      id: "penalties",
      name: "Penalties & Fines",
      icon: AlertTriangle,
      description: "Clear any fines or penalties applied to your account",
    },
    {
      id: "government",
      name: "Government Fees",
      icon: Building,
      description: "Pay administrative or registration-related fees",
    },
    {
      id: "utilities",
      name: "Utility Bills",
      icon: Zap,
      description: "Electricity, water, internet, and other monthly charges",
    },
    {
      id: "recovery",
      name: "Account Recovery",
      icon: CreditCard,
      description: "Pay to unlock or reactivate frozen accounts",
    },
    {
      id: "transfer",
      name: "Transfer Fees",
      icon: ArrowUpDown,
      description: "Cover costs related to outgoing or international transfers",
    },
  ];

  if (loading) {
    return <div className="p-6">Loading payments...</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Payments</h2>
          <Button
            onClick={() => setShowPaymentForm(true)}
            className="bg-[#F26623] hover:bg-[#E55A1F]"
          >
            <Receipt className="w-4 h-4 mr-2" />
            New Payment
          </Button>
        </div>

        {/* Payment Categories - Now Horizontal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paymentTypes.map((type) => (
            <Card
              key={type.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <type.icon className="w-6 h-6 text-[#F26623] mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium">{type.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {type.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {showPaymentForm && (
          <Card>
            <CardHeader>
              <CardTitle>New Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, payment_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
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
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      <SelectItem value="CAD">Canadian Dollar (CAD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <Label>Due Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Recipient/Payee</Label>
                <Input
                  value={formData.recipient}
                  onChange={(e) =>
                    setFormData({ ...formData, recipient: e.target.value })
                  }
                  placeholder="Enter recipient name or organization"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter payment description..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={submitPayment}
                  className="bg-[#F26623] hover:bg-[#E55A1F]"
                >
                  Submit Payment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No payments yet</p>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{payment.payment_type}</p>
                      <p className="text-sm text-gray-600">
                        {payment.description}
                      </p>
                      <p className="text-sm text-gray-600">
                        To: {payment.recipient}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleString()}
                      </p>
                      {payment.due_date && (
                        <p className="text-xs text-gray-500">
                          Due: {new Date(payment.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {Number(payment.amount).toLocaleString()}{" "}
                        {payment.currency}
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          payment.status === "Success"
                            ? "text-green-600"
                            : payment.status === "Pending"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {payment.status}
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
