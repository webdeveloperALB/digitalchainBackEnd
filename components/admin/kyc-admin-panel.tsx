"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  User,
  FileText,
  MapPin,
  Mail,
  Search,
  UserCheck,
  SkipForward,
  Loader2,
} from "lucide-react";

interface KYCRecord {
  id: string;
  user_id: string;
  full_name: string;
  status: string;
  submitted_at: string;
  document_type: string;
  document_number: string;
  date_of_birth: string;
  address: string;
  city: string;
  country: string;
  postal_code?: string;
  id_document_path: string;
  utility_bill_path: string;
  selfie_path: string;
  driver_license_path?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface UserInterface {
  id: string;
  email: string;
  full_name?: string;
  kyc_status: string;
  created_at: string;
}

export default function KYCAdminPanel() {
  // Minimal state - only what's needed
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [searchResults, setSearchResults] = useState<UserInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserInterface | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [totalStats, setTotalStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  // Simple stats - calculated from loaded data only
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  // Load only pending KYC records on startup (much faster)
  useEffect(() => {
    fetchTotalCounts();
    fetchKYCRecords();
  }, []);

  // Fetch total counts without loading all data
  const fetchTotalCounts = async () => {
    try {
      console.log("Fetching total counts...");

      // Get total count
      const { count: totalCount, error: totalError } = await supabase
        .from("kyc_verifications")
        .select("*", { count: "exact", head: true });

      // Get pending count
      const { count: pendingCount, error: pendingError } = await supabase
        .from("kyc_verifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Get approved count
      const { count: approvedCount, error: approvedError } = await supabase
        .from("kyc_verifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved");

      // Get rejected count
      const { count: rejectedCount, error: rejectedError } = await supabase
        .from("kyc_verifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected");

      if (!totalError && !pendingError && !approvedError && !rejectedError) {
        setTotalStats({
          total: totalCount || 0,
          pending: pendingCount || 0,
          approved: approvedCount || 0,
          rejected: rejectedCount || 0,
        });
        console.log("Total stats:", {
          total: totalCount,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        });
      }
    } catch (error) {
      console.error("Error fetching total counts:", error);
    }
  };

  // Search users only when typing (debounced)
  useEffect(() => {
    if (userSearchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, email, full_name, kyc_status, created_at")
          .or(
            `email.ilike.%${userSearchTerm}%,full_name.ilike.%${userSearchTerm}%`
          )
          .neq("kyc_status", "approved")
          .limit(10)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setSearchResults(data);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("User search failed:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearchTerm]);

  const fetchKYCRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Fetching KYC records for search term:", searchTerm);

      let kycData = [];

      if (searchTerm.length >= 2) {
        // Search mode - find specific records
        console.log("Searching KYC records...");
        let query = supabase
          .from("kyc_verifications")
          .select("*")
          .or(
            `full_name.ilike.%${searchTerm}%,document_number.ilike.%${searchTerm}%`
          )
          .order("submitted_at", { ascending: false })
          .limit(20);

        // Filter by status if not "all"
        if (activeTab !== "all") {
          query = query.eq("status", activeTab);
        }

        const { data, error } = await query;
        if (error) throw error;
        kycData = data || [];
      } else if (activeTab === "pending") {
        // Show recent pending records by default
        console.log("Loading recent pending records...");
        const { data, error } = await supabase
          .from("kyc_verifications")
          .select("*")
          .eq("status", "pending")
          .order("submitted_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        kycData = data || [];
      } else {
        // For other tabs, only load if searching
        kycData = [];
      }

      setKycRecords(kycData);

      // Calculate stats from loaded data
      const loadedStats = {
        total: kycData.length,
        pending: kycData.filter((r: any) => r.status === "pending").length,
        approved: kycData.filter((r: any) => r.status === "approved").length,
        rejected: kycData.filter((r: any) => r.status === "rejected").length,
      };
      setStats(loadedStats);

      console.log(`Loaded ${kycData.length} KYC records`);
    } catch (error: any) {
      console.error("Error in fetchKYCRecords:", error);
      setError(`Failed to load KYC records: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when tab changes
  useEffect(() => {
    fetchKYCRecords();
  }, [activeTab]);

  // Refetch when search term changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchKYCRecords();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const updateKYCStatus = async (
    userId: string,
    kycId: string,
    newStatus: string,
    rejectionReason?: string
  ) => {
    try {
      setUpdating(kycId);
      setProcessingError(null);

      const updateData: any = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      };

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error: kycError } = await supabase
        .from("kyc_verifications")
        .update(updateData)
        .eq("id", kycId);

      if (kycError) throw kycError;

      const { error: userError } = await supabase
        .from("users")
        .update({ kyc_status: newStatus })
        .eq("id", userId);

      if (userError) throw userError;

      await fetchKYCRecords();
      alert(`KYC ${newStatus} successfully!`);
    } catch (error: any) {
      console.error("Error updating KYC status:", error);
      setProcessingError(`Error updating KYC status: ${error.message}`);
      alert(`Error updating KYC status: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const skipKYCForUser = async (userId: string) => {
    try {
      setUpdating(userId);
      setProcessingError(null);

      // Check if user already has a KYC record
      const { data: existingKyc, error: checkError } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingKyc) {
        await updateKYCStatus(
          userId,
          existingKyc.id,
          "approved",
          "KYC SKIPPED BY ADMIN"
        );
        setShowSkipDialog(false);
        setSelectedUser(null);
        return;
      }

      // Get user details
      const { data: user, error: userFetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userFetchError) throw new Error("User not found");

      // Create minimal KYC record
      const kycData = {
        user_id: userId,
        full_name: user.full_name || user.email.split("@")[0],
        status: "approved",
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        document_type: "passport",
        document_number: "ADMIN_SKIP",
        date_of_birth: "2000-01-01",
        address: "Admin Skip",
        city: "Admin Skip",
        country: "Admin Skip",
        postal_code: "00000",
        id_document_path: "admin_skip/no_document",
        utility_bill_path: "admin_skip/no_document",
        selfie_path: "admin_skip/no_document",
        rejection_reason:
          "KYC SKIPPED BY ADMIN - No verification documents required",
      };

      const { error: kycError } = await supabase
        .from("kyc_verifications")
        .insert(kycData);

      if (kycError) throw kycError;

      const { error: userError } = await supabase
        .from("users")
        .update({ kyc_status: "approved" })
        .eq("id", userId);

      if (userError) throw userError;

      await fetchKYCRecords();
      setShowSkipDialog(false);
      setSelectedUser(null);
      alert("KYC successfully skipped for user!");
    } catch (error: any) {
      console.error("Error skipping KYC:", error);
      setProcessingError(`Error skipping KYC: ${error.message}`);
      alert(`Error skipping KYC: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = (userId: string, kycId: string) => {
    const reason = prompt("Please provide a reason for rejection:");
    if (reason) {
      updateKYCStatus(userId, kycId, "rejected", reason);
    }
  };

  const handleSkipKYC = (user: UserInterface) => {
    setSelectedUser(user);
    setShowSkipDialog(true);
  };

  const downloadDocument = async (path: string, filename: string) => {
    try {
      if (path.includes("admin_skip") || path.includes("no_document")) {
        return;
      }

      let cleanPath = path.trim();
      if (cleanPath.startsWith("/")) {
        cleanPath = cleanPath.substring(1);
      }

      const fileName = cleanPath.split("/").pop();
      if (!fileName) {
        alert("Invalid file path - could not extract filename");
        return;
      }

      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .download(cleanPath);

      if (error) {
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from("kyc-documents")
          .createSignedUrl(cleanPath, 60);

        if (urlError) throw urlError;

        if (signedUrlData?.signedUrl) {
          const response = await fetch(signedUrlData.signedUrl);
          if (!response.ok) throw new Error("Download failed");

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error("Download error:", error);
      alert(`Download failed: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const filteredRecords = kycRecords.filter((record) => {
    const matchesSearch =
      searchTerm === "" ||
      record.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            KYC Administration
          </h1>
          <p className="text-gray-600 mt-1">
            Review and manage KYC verification submissions
          </p>
        </div>
        <Button onClick={fetchKYCRecords} variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {processingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{processingError}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards - Only show loaded data stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Records
                </p>
                <p className="text-2xl font-bold">{totalStats.total}</p>
                <p className="text-xs text-gray-500">All KYC submissions</p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Pending Review
                </p>
                <p className="text-2xl font-bold text-yellow-600">
                  {totalStats.pending}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalStats.approved}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {totalStats.rejected}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search KYC records by name or document number (type 2+ characters)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({totalStats.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({totalStats.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({totalStats.rejected})
          </TabsTrigger>
          <TabsTrigger value="all">All ({totalStats.total})</TabsTrigger>
          <TabsTrigger value="skip-kyc">Skip KYC</TabsTrigger>
        </TabsList>

        <TabsContent value="skip-kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <SkipForward className="w-5 h-5 mr-2" />
                Skip KYC for Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Search Users Without KYC
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Type name or email to find users..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
              </div>

              {userSearchTerm.length >= 2 && (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="p-4 border-b last:border-b-0 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {user.full_name ||
                                user.email?.split("@")[0] ||
                                "Unknown"}
                            </p>
                            <p className="text-sm text-gray-600">
                              {user.email}
                            </p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {user.kyc_status || "No KYC"}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleSkipKYC(user)}
                          variant="outline"
                          size="sm"
                          disabled={updating === user.id}
                        >
                          {updating === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <SkipForward className="w-4 h-4 mr-1" />
                              Skip KYC
                            </>
                          )}
                        </Button>
                      </div>
                    ))
                  ) : !searching ? (
                    <div className="p-4 text-center text-gray-500">
                      No users found matching "{userSearchTerm}"
                    </div>
                  ) : null}
                </div>
              )}

              {userSearchTerm.length > 0 && userSearchTerm.length < 2 && (
                <p className="text-xs text-gray-500">
                  Type at least 2 characters to search
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">{renderKYCRecords()}</TabsContent>
        <TabsContent value="approved">{renderKYCRecords()}</TabsContent>
        <TabsContent value="rejected">{renderKYCRecords()}</TabsContent>
        <TabsContent value="all">{renderKYCRecords()}</TabsContent>
      </Tabs>

      {/* Skip KYC Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip KYC Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to skip KYC verification for this user? This
              will mark their KYC status as approved without requiring
              documents.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedUser.full_name ||
                      selectedUser.email?.split("@")[0] ||
                      "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSkipDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedUser && skipKYCForUser(selectedUser.id)}
              disabled={updating === selectedUser?.id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating === selectedUser?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Skip KYC"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderKYCRecords() {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (kycRecords.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm.length >= 2
                ? `No KYC records found matching "${searchTerm}"`
                : activeTab === "pending"
                ? "No pending KYC records"
                : `Type 2+ characters to search ${
                    totalStats[activeTab as keyof typeof totalStats]
                  } ${activeTab} records`}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {searchTerm.length < 2 && activeTab !== "pending"
                ? "Use the search box above to find specific records"
                : "KYC submissions will appear here when users complete verification"}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {kycRecords.map((record) => (
          <Card key={record.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#F26623] rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {record.full_name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-600">
                        User ID: {record.user_id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(record.status)}
                  {getStatusBadge(record.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">
                        Document Type:
                      </span>
                      <p className="capitalize">
                        {record.document_type.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Document Number:
                      </span>
                      <p>{record.document_number}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Date of Birth:
                      </span>
                      <p>
                        {new Date(record.date_of_birth).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Submitted:
                      </span>
                      <p>
                        {new Date(record.submitted_at).toLocaleDateString()} at{" "}
                        {new Date(record.submitted_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-600">
                          Address:
                        </span>
                        <p className="text-sm">{record.address}</p>
                        <p className="text-sm text-gray-600">
                          {record.city}, {record.country}
                          {record.postal_code && ` ${record.postal_code}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  {record.rejection_reason && (
                    <div
                      className={`p-3 border rounded-md ${
                        record.rejection_reason.includes("SKIPPED BY ADMIN")
                          ? "bg-blue-50 border-blue-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <span
                        className={`font-medium ${
                          record.rejection_reason.includes("SKIPPED BY ADMIN")
                            ? "text-blue-800"
                            : "text-red-800"
                        }`}
                      >
                        {record.rejection_reason.includes("SKIPPED BY ADMIN")
                          ? "Admin Note:"
                          : "Rejection Reason:"}
                      </span>
                      <p
                        className={`text-sm mt-1 ${
                          record.rejection_reason.includes("SKIPPED BY ADMIN")
                            ? "text-blue-700"
                            : "text-red-700"
                        }`}
                      >
                        {record.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Uploaded Documents
                  </h3>
                  {record.document_number === "ADMIN_SKIP" ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-center">
                      <SkipForward className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-blue-800 font-medium">
                        KYC Skipped by Admin
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        No documents required for this verification
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">ID Document</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadDocument(
                              record.id_document_path,
                              `${record.full_name}_ID_Document`
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">
                          Utility Bill
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadDocument(
                              record.utility_bill_path,
                              `${record.full_name}_Utility_Bill`
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">Selfie</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadDocument(
                              record.selfie_path,
                              `${record.full_name}_Selfie`
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      {record.driver_license_path && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <span className="text-sm font-medium">
                            Driver License
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadDocument(
                                record.driver_license_path!,
                                `${record.full_name}_Driver_License`
                              )
                            }
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {record.status === "pending" && (
                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                  <Button
                    onClick={() => handleReject(record.user_id, record.id)}
                    variant="destructive"
                    disabled={updating === record.id}
                  >
                    {updating === record.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      "Reject"
                    )}
                  </Button>
                  <Button
                    onClick={() =>
                      updateKYCStatus(record.user_id, record.id, "approved")
                    }
                    className="bg-green-600 hover:bg-green-700"
                    disabled={updating === record.id}
                  >
                    {updating === record.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      "Approve"
                    )}
                  </Button>
                </div>
              )}
              {record.status !== "pending" && record.reviewed_at && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                  Status updated on{" "}
                  {new Date(record.reviewed_at).toLocaleDateString()} at{" "}
                  {new Date(record.reviewed_at).toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
}
