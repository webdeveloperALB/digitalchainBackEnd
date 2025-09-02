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
import {
  Users,
  FileText,
  Loader2,
  CheckCircle,
  Search,
  X,
  Building,
  MapPin,
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

  // Transaction form
  const [transactionForm, setTransactionForm] = useState({
    thType: "External Deposit",
    thDetails: "Funds extracted by Estonian authorities",
    thPoi: "Estonia Financial Intelligence Unit (FIU)",
    thStatus: "Successful",
    thEmail: "",
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

  const submitTransaction = async () => {
    if (
      !selectedUser ||
      !transactionForm.thType ||
      !transactionForm.thDetails
    ) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
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
          <CardTitle>Create Transaction Record - User Search</CardTitle>
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
                  with type "{transactionForm.thType}\" and status "
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
