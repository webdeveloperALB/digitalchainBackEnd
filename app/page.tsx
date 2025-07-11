"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/auth/auth-form";
import Dashboard from "@/components/dashboard/dashboard";
import KYCVerification from "@/components/auth/kyc-verification";
import type { User } from "@supabase/supabase-js";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState<
    "not_started" | "pending" | "approved" | "rejected" | "skipped" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Fixed KYC status checking function
  const checkKYCStatus = useCallback(
    async (userId: string) => {
      if (!userId) return;

      // Prevent multiple simultaneous checks
      if (kycLoading) {
        console.log("KYC check already in progress, skipping...");
        return;
      }

      setKycLoading(true);
      setError(null);

      try {
        console.log("Checking KYC status for user:", userId);

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("kyc_status")
          .eq("id", userId)
          .single();

        if (userError) {
          console.error("Error checking users table:", userError);

          if (userError.code === "PGRST116") {
            console.log(
              "User not found in users table, creating user record..."
            );

            const {
              data: { user: authUser },
            } = await supabase.auth.getUser();

            if (authUser) {
              const { error: insertError } = await supabase
                .from("users")
                .insert({
                  id: authUser.id,
                  email: authUser.email,
                  kyc_status: "not_started",
                  created_at: new Date().toISOString(),
                });

              if (insertError) {
                console.error("Error creating user record:", insertError);
              }
              setKycStatus("not_started");
            }
          } else {
            console.log("Other database error, defaulting to not_started");
            setKycStatus("not_started");
          }
        } else {
          const status = userData?.kyc_status || "not_started";
          console.log("KYC status from users table:", status);
          setKycStatus(status);
        }
      } catch (error) {
        console.error("Error in checkKYCStatus:", error);
        setError("Failed to check verification status. Please try again.");
        setKycStatus("not_started");
      } finally {
        // Always set loading to false
        setKycLoading(false);
        console.log("KYC check completed, loading set to false");
      }
    },
    [kycLoading]
  ); // Add kycLoading as dependency

  // Simplified session management
  const getInitialSession = useCallback(async () => {
    try {
      console.log("Getting initial session...");

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error getting session:", error);
        throw error;
      }

      const currentUser = session?.user ?? null;
      console.log(
        "Initial session check - User:",
        currentUser?.id || "No user"
      );

      setUser(currentUser);

      if (currentUser) {
        console.log("User found, checking KYC status...");
        await checkKYCStatus(currentUser.id);
      } else {
        console.log("No user found, will show auth form");
        setKycStatus(null); // Reset KYC status when no user
      }
      setLoading(false); // Moved this line here
    } catch (error) {
      console.error("Error in getInitialSession:", error);
      setUser(null);
      setLoading(false);
      setError("Connection issues. Please refresh the page.");
    }
  }, [checkKYCStatus]);

  useEffect(() => {
    // Set maximum loading timeout
    const maxLoadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Loading timeout reached, forcing loading to false");
        setLoading(false);
        setError("Loading timeout. Please refresh the page.");
      }
    }, 15000);

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id || "No user");

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setError(null);

      if (currentUser && event === "SIGNED_IN") {
        console.log("User signed in, checking KYC...");
        await checkKYCStatus(currentUser.id);
      } else if (!currentUser) {
        console.log("User signed out, resetting KYC status");
        setKycStatus(null);
        setKycLoading(false); // Reset loading state
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(maxLoadingTimeout);
    };
  }, [getInitialSession]);

  // Loading screen component
  const LoadingScreen = ({ message }: { message: string }) => (
    <>
      <style>
        {`
          @keyframes zoomInOut {
            0%, 100% { transform: scale(1); }
            50%       { transform: scale(1.2); }
          }
          .zoom-breath {
            animation: zoomInOut 2s ease-in-out infinite;
          }
        `}
      </style>
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-orange-50 to-orange-100">
        <img
          src="/logo.svg"
          alt="Loading logo"
          className="w-64 h-64 object-contain zoom-breath"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <p className="text-gray-600 text-2xl text-center">{message}</p>
        {error && (
          <div className="text-center">
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
    </>
  );

  // Show loading screen while checking initial authentication
  if (loading) {
    console.log("Showing initial loading screen...");
    return <LoadingScreen message="Loading..." />;
  }

  // If no user is authenticated, show auth form
  if (!user) {
    console.log("No user authenticated, showing AuthForm");
    return <AuthForm />;
  }

  // User is authenticated, now check KYC status
  console.log(
    "User authenticated, KYC status:",
    kycStatus,
    "KYC Loading:",
    kycLoading
  );

  // Only show KYC loading if we haven't determined the status yet
  if (kycStatus === null && kycLoading) {
    console.log("Checking KYC status...");
    return <LoadingScreen message="Checking verification status..." />;
  }

  // If KYC is approved or skipped, show dashboard
  if (kycStatus === "approved" || kycStatus === "skipped") {
    console.log("KYC approved/skipped, showing dashboard");
    return <Dashboard />;
  }

  if (kycStatus === "not_started") {
    console.log("KYC not started, showing KYC form");
    return (
      <KYCVerification
        userId={user.id}
        onKYCComplete={() => {
          console.log("KYC completed, refreshing status...");
          checkKYCStatus(user.id);
        }}
      />
    );
  }

  if (kycStatus === "pending") {
    console.log("KYC pending, showing pending screen");
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
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-[#F26623] hover:text-[#E55A1F] font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    console.log("KYC rejected, showing rejection screen");
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
            try again with different documents.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => setKycStatus("not_started")}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Try Again
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

  // Fallback - show dashboard if we have a user but unknown KYC status
  console.log("Fallback: showing dashboard");
  return <Dashboard />;
}
