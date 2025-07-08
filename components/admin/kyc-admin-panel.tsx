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
} from "lucide-react";

interface KYCRecord {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
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
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<KYCRecord | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserInterface | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Fetching KYC records and users...");

      // Get all users
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name, kyc_status, created_at")
        .order("created_at", { ascending: false });

      if (userError) {
        console.error("Error fetching users:", userError);
        throw new Error(`Database error: ${userError.message}`);
      }

      setAllUsers(userData || []);

      // Get KYC records
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_verifications")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (kycError) {
        console.error("Error fetching KYC records:", kycError);
        throw new Error(`Database error: ${kycError.message}`);
      }

      console.log(`Found ${kycData?.length || 0} KYC records`);

      if (!kycData || kycData.length === 0) {
        setKycRecords([]);
        return;
      }

      // Combine data
      const combinedData = kycData.map((record) => ({
        ...record,
        email:
          userData?.find((user) => user.id === record.user_id)?.email ||
          "Email not found",
      }));

      setKycRecords(combinedData);
      console.log("Data loaded successfully");
    } catch (error: any) {
      console.error("Error in fetchData:", error);
      setError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateKYCStatus = async (
    userId: string,
    kycId: string,
    newStatus: string,
    rejectionReason?: string
  ) => {
    try {
      setUpdating(kycId);
      setProcessingError(null);
      console.log(`Updating KYC ${kycId} to status: ${newStatus}`);

      // Update KYC verification record
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

      if (kycError) {
        console.error("Error updating KYC record:", kycError);
        throw kycError;
      }

      // Update user's KYC status
      const { error: userError } = await supabase
        .from("users")
        .update({ kyc_status: newStatus })
        .eq("id", userId);

      if (userError) {
        console.error("Error updating user KYC status:", userError);
        throw userError;
      }

      console.log("KYC status updated successfully");
      await fetchData();
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
      console.log(`Skipping KYC for user: ${userId}`);

      // First, check if user already has a KYC record
      const { data: existingKyc, error: checkError } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing KYC:", checkError);
        throw checkError;
      }

      if (existingKyc) {
        console.log("User already has KYC record, updating status instead");
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

      if (userFetchError) {
        console.error("Error fetching user:", userFetchError);
        throw new Error("User not found");
      }

      // Create a minimal KYC verification record for the skipped user
      const kycData = {
        user_id: userId,
        full_name: user.full_name || user.email.split("@")[0],
        status: "approved",
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        document_type: "passport", // Use a valid document type that exists in your constraint
        document_number: "ADMIN_SKIP",
        date_of_birth: "2000-01-01", // Placeholder
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

      const { data: kycRecord, error: kycError } = await supabase
        .from("kyc_verifications")
        .insert(kycData)
        .select()
        .single();

      if (kycError) {
        console.error("Error creating KYC record:", kycError);
        throw kycError;
      }

      // Update user's KYC status to 'approved'
      const { error: userError } = await supabase
        .from("users")
        .update({
          kyc_status: "approved",
        })
        .eq("id", userId);

      if (userError) {
        console.error("Error updating user KYC status:", userError);
        throw userError;
      }

      console.log("KYC skipped successfully");
      await fetchData();
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
      // Prevent admin skip downloads
      if (path.includes("admin_skip") || path.includes("no_document")) {
        console.log(
          "Attempted to download admin-skipped document, blocking request"
        );
        return;
      }

      console.log("Original path from database:", path);

      // Clean and normalize the path
      let cleanPath = path.trim();
      if (cleanPath.startsWith("/")) {
        cleanPath = cleanPath.substring(1);
      }

      console.log("Cleaned path:", cleanPath);

      // Extract just the filename from the path
      const fileName = cleanPath.split("/").pop();
      if (!fileName) {
        console.error("Could not extract filename from path:", cleanPath);
        alert("Invalid file path - could not extract filename");
        return;
      }

      console.log("Extracted filename:", fileName);

      // Determine document type from path
      let documentType = "";
      if (
        cleanPath.includes("id-documents") ||
        cleanPath.includes("id_documents")
      ) {
        documentType = "id-documents";
      } else if (
        cleanPath.includes("utility-bills") ||
        cleanPath.includes("utility_bills")
      ) {
        documentType = "utility-bills";
      } else if (cleanPath.includes("selfies")) {
        documentType = "selfies";
      } else if (
        cleanPath.includes("driver-license") ||
        cleanPath.includes("driver_license")
      ) {
        documentType = "driver-license";
      }

      console.log("Document type:", documentType);

      // Try different path combinations based on your storage structure
      const pathsToTry = [
        cleanPath, // Original path
        fileName, // Just filename
        documentType ? `${documentType}/${fileName}` : fileName, // document-type/filename
        cleanPath.replace(/^[^/]+\//, ""), // Remove first folder (user ID)
      ].filter(Boolean);

      console.log("Paths to try:", pathsToTry);

      let downloadSuccess = false;
      let lastError = null;

      for (const tryPath of pathsToTry) {
        try {
          console.log(`Attempting download with path: ${tryPath}`);

          // First try direct download
          const { data, error } = await supabase.storage
            .from("kyc-documents")
            .download(tryPath);

          if (error) {
            console.log(
              `Direct download failed for ${tryPath}:`,
              error.message
            );

            // Try with signed URL
            const { data: signedUrlData, error: urlError } =
              await supabase.storage
                .from("kyc-documents")
                .createSignedUrl(tryPath, 60);

            if (urlError) {
              console.log(
                `Signed URL failed for ${tryPath}:`,
                urlError.message
              );
              lastError = urlError;
              continue;
            }

            if (signedUrlData?.signedUrl) {
              console.log(
                `Using signed URL for ${tryPath}:`,
                signedUrlData.signedUrl
              );

              const response = await fetch(signedUrlData.signedUrl);
              if (!response.ok) {
                console.log(`Fetch failed for ${tryPath}: ${response.status}`);
                continue;
              }

              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              console.log(
                `Document downloaded successfully via signed URL: ${tryPath}`
              );
              downloadSuccess = true;
              break;
            }
          } else if (data) {
            console.log(`Direct download successful: ${tryPath}`);

            // Create download link
            const url = URL.createObjectURL(data);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log("Document downloaded successfully via direct download");
            downloadSuccess = true;
            break;
          }
        } catch (err: any) {
          console.log(`Exception with path ${tryPath}:`, err.message);
          lastError = err;
          continue;
        }
      }

      if (!downloadSuccess) {
        console.error("All download attempts failed. Last error:", lastError);

        // Show a more helpful error message
        alert(`Unable to download document. Tried these paths:
${pathsToTry.map((p) => `• ${p}`).join("\n")}

This might be due to:
1. File permissions (RLS policies)
2. File was moved or deleted
3. Path mismatch between database and storage

Please check your Supabase RLS policies for the kyc-documents bucket.`);
      }
    } catch (error: any) {
      console.error("Unexpected error downloading document:", error);
      alert(`Unexpected error: ${error.message || "Unknown error"}`);
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
    const matchesTab = activeTab === "all" || record.status === activeTab;
    const matchesSearch =
      searchTerm === "" ||
      record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Get users who haven't submitted KYC yet
  const usersWithoutKYC = allUsers
    .filter(
      (user) =>
        !kycRecords.some((record) => record.user_id === user.id) &&
        user.kyc_status !== "approved"
    )
    .filter(
      (user) =>
        searchTerm === "" ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const stats = {
    total: kycRecords.length,
    pending: kycRecords.filter((r) => r.status === "pending").length,
    approved: kycRecords.filter((r) => r.status === "approved").length,
    rejected: kycRecords.filter((r) => r.status === "rejected").length,
    noKYC: usersWithoutKYC.length,
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading KYC records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            KYC Administration
          </h1>
          <p className="text-gray-600 mt-1">
            Review and manage KYC verification submissions
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {processingError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{processingError}</AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Submissions
                </p>
                <p className="text-2xl font-bold">{stats.total}</p>
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
                  {stats.pending}
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
                  {stats.approved}
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
                  {stats.rejected}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">No KYC</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.noKYC}
                </p>
              </div>
              <UserCheck className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for filtering */}
      <Tabs
        defaultValue={activeTab}
        onValueChange={setActiveTab}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="all">All Submissions ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({stats.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({stats.rejected})
          </TabsTrigger>
          <TabsTrigger value="no-kyc">No KYC ({stats.noKYC})</TabsTrigger>
        </TabsList>

        <TabsContent value="no-kyc">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Users Without KYC Submission
            </h2>
            {usersWithoutKYC.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">
                    No users without KYC found
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    All users have either submitted KYC or have been approved
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {usersWithoutKYC.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium">
                              {user.full_name || "Name not provided"}
                            </h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {user.email}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              Registered:{" "}
                              {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800"
                          >
                            {user.kyc_status || "No KYC"}
                          </Badge>
                          <Button
                            onClick={() => handleSkipKYC(user)}
                            variant="outline"
                            size="sm"
                            disabled={updating === user.id}
                          >
                            <SkipForward className="w-4 h-4 mr-1" />
                            {updating === user.id
                              ? "Processing..."
                              : "Skip KYC"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="all">{renderKYCRecords()}</TabsContent>

        <TabsContent value="pending">{renderKYCRecords()}</TabsContent>

        <TabsContent value="approved">{renderKYCRecords()}</TabsContent>

        <TabsContent value="rejected">{renderKYCRecords()}</TabsContent>
      </Tabs>

      {/* Skip KYC Confirmation Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip KYC Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to skip KYC verification for this user? This
              will mark their KYC status as approved and allow them to access
              the dashboard without submitting verification documents.
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
                    {selectedUser.full_name || "Name not provided"}
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
              {updating === selectedUser?.id ? "Processing..." : "Skip KYC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderKYCRecords() {
    if (filteredRecords.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No KYC records found</p>
            <p className="text-sm text-gray-400 mt-2">
              {activeTab === "all"
                ? "KYC submissions will appear here when users complete their verification"
                : `No ${activeTab} KYC records found`}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-6">
        {filteredRecords.map((record) => (
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
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {record.email}
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
                  {record.document_number === "ADMIN_SKIP" ||
                  record.document_number === "ADMIN_SKIP_NO_DOCUMENT" ? (
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
                          onClick={() => {
                            downloadDocument(
                              record.id_document_path,
                              `${record.full_name}_ID_Document`
                            );
                          }}
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
                    {updating === record.id ? "Processing..." : "Reject"}
                  </Button>
                  <Button
                    onClick={() =>
                      updateKYCStatus(record.user_id, record.id, "approved")
                    }
                    className="bg-green-600 hover:bg-green-700"
                    disabled={updating === record.id}
                  >
                    {updating === record.id ? "Processing..." : "Approve"}
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
