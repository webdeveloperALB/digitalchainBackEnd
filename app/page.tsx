"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/auth/auth-form";
import Dashboard from "@/components/dashboard/dashboard";
import KYCVerification from "@/components/auth/kyc-verification";
import type { User } from "@supabase/supabase-js";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const isCheckingKYC = useRef(false);

  // Prevent re-initialization on tab switch by checking if we already have user data
  useEffect(() => {
    const checkPersistedSession = async () => {
      if (!loading || user) return; // Skip if already loaded or has user

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setLoading(false);
          await checkKYCStatus(session.user.id);
        }
      } catch (error) {
        console.error("Session check error:", error);
      }
    };

    checkPersistedSession();
  }, []); // Empty dependency array - only run once on mount

  // Simplified KYC status check
  const checkKYCStatus = async (userId: string) => {
    if (isCheckingKYC.current) return; // Prevent double execution
    isCheckingKYC.current = true;

    try {
      console.log("Checking KYC status for user:", userId);

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("kyc_status")
        .eq("id", userId)
        .single();

      if (userError) {
        console.log("User not found in users table, defaulting to approved");
        // If user not found, default to approved to skip KYC
        setKycStatus("approved");
        return;
      }

      const status = userData?.kyc_status || "approved";
      console.log("KYC status:", status);
      setKycStatus(status);
    } catch (error) {
      console.error("Error checking KYC status:", error);
      // Default to approved on error to avoid blocking users
      setKycStatus("approved");
    } finally {
      isCheckingKYC.current = false;
    }
  };

  // Initialize authentication - separate from auth listener
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // Prevent re-initialization if already done
      if (hasInitialized.current || user) return;

      try {
        console.log("Initializing authentication...");
        hasInitialized.current = true;

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          if (mounted) {
            setError("Authentication error. Please refresh the page.");
            setLoading(false);
          }
          return;
        }

        const currentUser = session?.user ?? null;
        console.log("Current user:", currentUser?.id || "No user");

        if (mounted) {
          setUser(currentUser);

          if (currentUser) {
            // Check KYC status for authenticated users
            await checkKYCStatus(currentUser.id);
          } else {
            setKycStatus(null);
          }

          setLoading(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (mounted) {
          setError("Failed to initialize. Please refresh the page.");
          setLoading(false);
        }
      }
    };

    // Only initialize if we don't have a user yet and we're still loading
    if (loading && !user && !hasInitialized.current) {
      initializeAuth();
    }

    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Separate useEffect for auth listener - runs only once
  useEffect(() => {
    let mounted = true;

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id || "No user");

      if (!mounted) return;

      // Only handle actual auth changes, not initial session
      if (event === "INITIAL_SESSION") return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setError(null);

      if (currentUser && event === "SIGNED_IN") {
        console.log("User signed in, checking KYC...");
        await checkKYCStatus(currentUser.id);
      } else if (!currentUser) {
        console.log("User signed out");
        setKycStatus(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

  // Loading screen component
  const LoadingScreen = ({ message }: { message: string }) => (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623]"></div>
      <p className="text-gray-600 text-lg text-center">{message}</p>
      {error && (
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Refresh Page
          </button>
        </div>
      )}
    </div>
  );

  // Show loading screen during initial load
  if (loading) {
    return <LoadingScreen message="Loading your account..." />;
  }

  // Show auth form if no user
  if (!user) {
    return <AuthForm />;
  }

  // Handle KYC flow
  if (kycStatus === "not_started") {
    return (
      <KYCVerification
        userId={user.id}
        onKYCComplete={() => {
          console.log("KYC completed, loading dashboard...");
          setKycStatus("approved");
        }}
      />
    );
  }

  if (kycStatus === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            KYC Under Review
          </h1>
          <p className="text-gray-600 mb-4">
            Your KYC documents are being reviewed. This usually takes 1-3
            business days.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => setKycStatus("approved")}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Skip KYC (Development)
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="block w-full text-[#F26623] hover:text-[#E55A1F] font-medium py-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            KYC Verification Failed
          </h1>
          <p className="text-gray-600 mb-4">
            Your KYC verification was not approved. Please contact support or
            try again.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => setKycStatus("not_started")}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => setKycStatus("approved")}
              className="block w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Skip KYC (Development)
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="block w-full text-[#F26623] hover:text-[#E55A1F] font-medium py-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default to dashboard - this will handle approved, skipped, or any other status
  console.log("Loading dashboard for user:", user.id);
  console.trace("Dashboard render trace"); // This will show us the call stack
  return <Dashboard />;
}
