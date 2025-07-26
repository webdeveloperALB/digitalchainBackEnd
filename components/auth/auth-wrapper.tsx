"use client"
import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useKYCStatus } from "@/hooks/use-kyc-status"
import KYCVerification from "./kyc-verification"
import AuthForm from "./auth-form"

// This would be your dashboard component
function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Digital Chain Bank</h1>
        <p className="text-gray-600">Your dashboard is ready! KYC verification completed.</p>
      </div>
    </div>
  )
}

export default function AuthWrapper() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Only call useKYCStatus when user is available and has an ID
  const shouldFetchKYC = user?.id != null
  const { kycStatus, loading: kycLoading, refreshKYCStatus } = useKYCStatus(shouldFetchKYC ? user.id : null)

  // Session refresh function
  const refreshSession = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error("Session refresh error:", error)
        setSessionError("Session expired. Please sign in again.")
        setUser(null)
        return false
      }

      if (session?.user) {
        // Verify the session is still valid by making a test request
        const { error: testError } = await supabase.from("users").select("id").eq("id", session.user.id).limit(1)

        if (testError) {
          console.error("Session validation failed:", testError)
          setSessionError("Session expired. Please sign in again.")
          setUser(null)
          return false
        }

        setUser(session.user)
        setSessionError(null)
        return true
      } else {
        setUser(null)
        return false
      }
    } catch (error) {
      console.error("Session refresh failed:", error)
      setSessionError("Session expired. Please sign in again.")
      setUser(null)
      return false
    }
  }, [])

  useEffect(() => {
    // Get initial session with improved error handling
    const getSession = async () => {
      try {
        const sessionValid = await refreshSession()
        if (!sessionValid) {
          setUser(null)
        }
      } catch (error) {
        console.error("Initial session check failed:", error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id)

      if (event === "SIGNED_OUT" || !session) {
        setUser(null)
        setSessionError(null)
      } else if (session?.user) {
        setUser(session.user)
        setSessionError(null)
      }

      setLoading(false)
    })

    // Handle visibility change to refresh session when tab becomes active
    const handleVisibilityChange = async () => {
      if (!document.hidden && user) {
        console.log("Tab became visible, refreshing session...")
        await refreshSession()
      }
    }

    // Handle page focus to refresh session
    const handleFocus = async () => {
      if (user) {
        console.log("Page focused, refreshing session...")
        await refreshSession()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [refreshSession, user])

  // Show loading only when actually loading, not when KYC is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show session error if present
  if (sessionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Expired</h1>
          <p className="text-gray-600 mb-4">{sessionError}</p>
          <button
            onClick={() => {
              setSessionError(null)
              setUser(null)
            }}
            className="bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Sign In Again
          </button>
        </div>
      </div>
    )
  }

  // If user is not authenticated, show auth form
  if (!user) {
    return <AuthForm />
  }

  // Show KYC loading state only when we're actually fetching KYC status
  if (shouldFetchKYC && kycLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking verification status...</p>
        </div>
      </div>
    )
  }

  // If user is authenticated but needs KYC verification
  if (kycStatus === "not_started" || kycStatus === null) {
    return (
      <KYCVerification
        userId={user.id}
        onKYCComplete={async () => {
          // Refetch KYC status before redirecting
          console.log("KYC completed, refetching status...")
          if (refreshKYCStatus) {
            await refreshKYCStatus()
          }
          // Small delay to ensure state updates
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        }}
      />
    )
  }

  // If KYC is pending
  if (kycStatus === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">KYC Under Review</h1>
          <p className="text-gray-600 mb-4">
            Your KYC documents are being reviewed. This usually takes 1-3 business days.
          </p>
          <button
            onClick={async () => {
              // Clean up presence before signing out
              if (window.presenceCleanup) {
                window.presenceCleanup()
              }
              await supabase.auth.signOut()
            }}
            className="text-[#F26623] hover:text-[#E55A1F] font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // If KYC is rejected
  if (kycStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">KYC Verification Failed</h1>
          <p className="text-gray-600 mb-4">
            Your KYC verification was not approved. Please contact support or try again with different documents.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                // Clean up presence before reload
                if (window.presenceCleanup) {
                  window.presenceCleanup()
                }
                window.location.reload()
              }}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={async () => {
                // Clean up presence before signing out
                if (window.presenceCleanup) {
                  window.presenceCleanup()
                }
                await supabase.auth.signOut()
              }}
              className="block w-full text-[#F26623] hover:text-[#E55A1F] font-medium py-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // If KYC is approved, show dashboard
  return <Dashboard />
}
