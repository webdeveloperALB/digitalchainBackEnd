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
  Loader2,
  CheckCircle,
  Search,
  X,
} from "lucide-react";

interface User {
  id: string;
  client_id: string;
  full_name: string | null;
  email: string | null;
}

export default function AdminDepositCreator() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

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

  // Ultra-fast user search with minimal queries
  useEffect(() => {
    if (userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        // Single, fast query with minimal data
        const { data, error } = await supabase
          .from("users")
          .select("id, email, full_name")
          .or(`email.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`)
          .limit(8)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            client_id: `DCB${user.id.slice(0, 6)}`,
            full_name: user.full_name || user.email?.split("@")[0] || "Unknown",
            email: user.email,
          }));
          setSearchResults(transformedUsers);
        } else {
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
  }, [userSearch]);

  // Minimal balance update function
  const updateUserBalance = async (
    userId: string,
    currency: string,
    amount: number
  ) => {
    const tableName =
      currency === "USD"
        ? "usd_balances"
        : currency === "EUR"
        ? "euro_balances"
        : currency === "CAD"
        ? "cad_balances"
        : "crypto_balances";

    try {
      // Try to update existing balance first
      const { data: existing } = await supabase
        .from(tableName)
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (existing) {
        const newBalance = (existing.balance || 0) + amount;
        await supabase
          .from(tableName)
          .update({ balance: newBalance })
          .eq("user_id", userId);
      } else {
        // Create new balance record
        await supabase.from(tableName).insert({
          user_id: userId,
          balance: amount,
        });
      }
    } catch (error) {
      console.error("Balance update failed:", error);
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
      const referenceId = `BANK-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create deposit record only
      const { error: depositError } = await supabase.from("deposits").insert({
        user_id: selectedUser.id,
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
        },
        admin_notes: bankForm.admin_notes || `Bank deposit processed by admin`,
      });

      if (depositError) throw depositError;

      // Update balance if auto-approved
      if (bankForm.auto_approve) {
        await updateUserBalance(
          selectedUser.id,
          bankForm.currency,
          Number.parseFloat(bankForm.amount)
        );
      }

      // Reset form
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
      setSelectedUser(null);
      setUserSearch("");

      setMessage({
        type: "success",
        text: `Bank deposit created successfully! Reference: ${referenceId}`,
      });
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
      const referenceId = `CRYPTO-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create deposit record only
      const { error: depositError } = await supabase.from("deposits").insert({
        user_id: selectedUser.id,
        currency: cryptoForm.cryptocurrency,
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
        },
        admin_notes:
          cryptoForm.admin_notes || `Crypto deposit processed by admin`,
      });

      if (depositError) throw depositError;

      // Update balance if auto-approved
      if (cryptoForm.auto_approve) {
        await updateUserBalance(
          selectedUser.id,
          cryptoForm.cryptocurrency,
          Number.parseFloat(cryptoForm.amount)
        );
      }

      // Reset form
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
      setSelectedUser(null);
      setUserSearch("");

      setMessage({
        type: "success",
        text: `Crypto deposit created successfully! Reference: ${referenceId}`,
      });
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

      <Card>
        <CardHeader>
          <CardTitle>Create Deposit - User Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ultra-fast user search */}
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
                    <p className="text-sm text-green-600">
                      {selectedUser.client_id} • {selectedUser.email}
                    </p>
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
                    placeholder="Type name or email to search users..."
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
                      searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => {
                            setSelectedUser(user);
                            setUserSearch("");
                            setSearchResults([]);
                          }}
                        >
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
                        </div>
                      ))
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
              </div>
            )}
          </div>

          {selectedUser && (
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
                        setBankForm({ ...bankForm, bank_name: e.target.value })
                      }
                      placeholder="e.g., JPMorgan Chase Bank"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-holder">Account Holder Name</Label>
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
                        setBankForm({ ...bankForm, swift_code: e.target.value })
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
                      setBankForm({ ...bankForm, bank_address: e.target.value })
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
                      setBankForm({ ...bankForm, admin_notes: e.target.value })
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
                        setCryptoForm({ ...cryptoForm, cryptocurrency: value })
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
                        <SelectItem value="BNB">Binance Coin (BNB)</SelectItem>
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
                        setCryptoForm({ ...cryptoForm, amount: e.target.value })
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

                <div>
                  <Label htmlFor="gas-fee">Gas Fee</Label>
                  <Input
                    id="gas-fee"
                    value={cryptoForm.gas_fee}
                    onChange={(e) =>
                      setCryptoForm({ ...cryptoForm, gas_fee: e.target.value })
                    }
                    placeholder="Transaction fee"
                  />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
