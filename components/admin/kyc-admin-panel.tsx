"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "lucide-react"

interface KYCRecord {
  id: string
  user_id: string
  full_name: string
  email?: string
  status: string
  submitted_at: string
  document_type: string
  document_number: string
  date_of_birth: string
  address: string
  city: string
  country: string
  postal_code?: string
  id_document_path: string
  utility_bill_path: string
  selfie_path: string
  driver_license_path?: string
  reviewed_at?: string
  rejection_reason?: string
}

export default function KYCAdminPanel() {
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<KYCRecord | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    fetchKYCRecords()
  }, [])

  const fetchKYCRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("Fetching KYC records...")

      // Get KYC records
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_verifications")
        .select("*")
        .order("submitted_at", { ascending: false })

      if (kycError) {
        console.error("Error fetching KYC records:", kycError)
        throw new Error(`Database error: ${kycError.message}`)
      }

      console.log(`Found ${kycData?.length || 0} KYC records`)

      if (!kycData || kycData.length === 0) {
        setKycRecords([])
        return
      }

      // Get user emails
      const userIds = kycData.map((record) => record.user_id)
      const { data: userData, error: userError } = await supabase.from("users").select("id, email").in("id", userIds)

      if (userError) {
        console.error("Error fetching user emails:", userError)
      }

      // Combine data
      const combinedData = kycData.map((record) => ({
        ...record,
        email: userData?.find((user) => user.id === record.user_id)?.email || "Email not found",
      }))

      setKycRecords(combinedData)
      console.log("KYC records loaded successfully:", combinedData.length)
    } catch (error: any) {
      console.error("Error in fetchKYCRecords:", error)
      setError(`Failed to load KYC records: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const updateKYCStatus = async (userId: string, kycId: string, newStatus: string, rejectionReason?: string) => {
    try {
      setUpdating(kycId)
      console.log(`Updating KYC ${kycId} to status: ${newStatus}`)

      // Update KYC verification record
      const updateData: any = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      }

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason
      }

      const { error: kycError } = await supabase.from("kyc_verifications").update(updateData).eq("id", kycId)

      if (kycError) {
        console.error("Error updating KYC record:", kycError)
        throw kycError
      }

      // Update user's KYC status
      const { error: userError } = await supabase.from("users").update({ kyc_status: newStatus }).eq("id", userId)

      if (userError) {
        console.error("Error updating user KYC status:", userError)
        throw userError
      }

      console.log("KYC status updated successfully")
      await fetchKYCRecords()
      alert(`KYC ${newStatus} successfully!`)
    } catch (error: any) {
      console.error("Error updating KYC status:", error)
      alert(`Error updating KYC status: ${error.message}`)
    } finally {
      setUpdating(null)
    }
  }

  const handleReject = (userId: string, kycId: string) => {
    const reason = prompt("Please provide a reason for rejection:")
    if (reason) {
      updateKYCStatus(userId, kycId, "rejected", reason)
    }
  }

  const downloadDocument = async (path: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage.from("kyc-documents").download(path)

      if (error) {
        console.error("Error downloading document:", error)
        alert("Error downloading document")
        return
      }

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading document:", error)
      alert("Error downloading document")
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const filteredRecords = kycRecords.filter((record) => {
    if (activeTab === "all") return true
    return record.status === activeTab
  })

  const stats = {
    total: kycRecords.length,
    pending: kycRecords.filter((r) => r.status === "pending").length,
    approved: kycRecords.filter((r) => r.status === "approved").length,
    rejected: kycRecords.filter((r) => r.status === "rejected").length,
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading KYC records...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">KYC Administration</h1>
          <p className="text-gray-600 mt-1">Review and manage KYC verification submissions</p>
        </div>
        <Button onClick={fetchKYCRecords} variant="outline">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Submissions</p>
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
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
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
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
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
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredRecords.length === 0 ? (
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
      ) : (
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
                      <CardTitle className="text-xl">{record.full_name}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{record.email}</span>
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
                        <span className="font-medium text-gray-600">Document Type:</span>
                        <p className="capitalize">{record.document_type.replace("_", " ")}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Document Number:</span>
                        <p>{record.document_number}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Date of Birth:</span>
                        <p>{new Date(record.date_of_birth).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Submitted:</span>
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
                          <span className="font-medium text-gray-600">Address:</span>
                          <p className="text-sm">{record.address}</p>
                          <p className="text-sm text-gray-600">
                            {record.city}, {record.country}
                            {record.postal_code && ` ${record.postal_code}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {record.rejection_reason && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <span className="font-medium text-red-800">Rejection Reason:</span>
                        <p className="text-sm text-red-700 mt-1">{record.rejection_reason}</p>
                      </div>
                    )}
                  </div>

                  {/* Documents */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Uploaded Documents
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">ID Document</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadDocument(record.id_document_path, `${record.full_name}_ID_Document`)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <span className="text-sm font-medium">Utility Bill</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadDocument(record.utility_bill_path, `${record.full_name}_Utility_Bill`)}
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
                          onClick={() => downloadDocument(record.selfie_path, `${record.full_name}_Selfie`)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>

                      {record.driver_license_path && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <span className="text-sm font-medium">Driver License</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              downloadDocument(record.driver_license_path!, `${record.full_name}_Driver_License`)
                            }
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
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
                      onClick={() => updateKYCStatus(record.user_id, record.id, "approved")}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={updating === record.id}
                    >
                      {updating === record.id ? "Processing..." : "Approve"}
                    </Button>
                  </div>
                )}

                {record.status !== "pending" && record.reviewed_at && (
                  <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                    Status updated on {new Date(record.reviewed_at).toLocaleDateString()} at{" "}
                    {new Date(record.reviewed_at).toLocaleTimeString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
