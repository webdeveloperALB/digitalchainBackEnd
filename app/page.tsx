"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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
  const forceRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // FORCE FETCH function with maximum retry power
  const forceFetchUserData = useCallback(
    async (userId: string, retryCount = 0): Promise<void> => {
      const MAX_RETRIES = 5;
      const RETRY_DELAY = 1000; // 1 second base delay

      if (!mountedRef.current) return;

      try {
        console.log(
          `🚀 FORCE FETCHING user data (attempt ${retryCount + 1}/${
            MAX_RETRIES + 1
          })`
        );

        // Force a fresh database connection and query
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("kyc_status")
          .eq("id", userId)
          .single();

        if (userError) {
          if (userError.code === "PGRST116") {
            // User not found - this is OK, default to approved
            console.log("✅ User not in users table, defaulting to approved");
            if (mountedRef.current) {
              setKycStatus("approved");
              setLoading(false);
            }
            return;
          }
          throw userError;
        }

        const status = userData?.kyc_status || "approved";
        console.log("✅ KYC status fetched successfully:", status);

        if (mountedRef.current) {
          setKycStatus(status);
          setLoading(false);
          setError(null);
        }
      } catch (error) {
        console.error(
          `❌ Force fetch failed (attempt ${retryCount + 1}):`,
          error
        );

        if (retryCount < MAX_RETRIES && mountedRef.current) {
          // Exponential backoff with jitter
          const delay =
            RETRY_DELAY * Math.pow(2, retryCount) + Math.random() * 1000;
          console.log(`🔄 Retrying in ${delay}ms...`);

          setTimeout(() => {
            if (mountedRef.current) {
              forceFetchUserData(userId, retryCount + 1);
            }
          }, delay);
        } else {
          // Final fallback - default to approved to prevent infinite loading
          console.log(
            "🛡️ Max retries reached, defaulting to approved to prevent infinite loading"
          );
          if (mountedRef.current) {
            setKycStatus("approved");
            setLoading(false);
            setError(
              "Unable to verify KYC status, proceeding with default access"
            );
          }
        }
      }
    },
    []
  );

  // FORCE SESSION CHECK with aggressive validation
  const forceValidateSession = useCallback(async (): Promise<User | null> => {
    try {
      console.log("🔍 FORCE validating session...");

      // Get fresh session with force refresh
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        console.log("❌ No valid session found");
        return null;
      }

      // Double-check session validity by making an authenticated request
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        console.log("❌ Session validation failed");
        return null;
      }

      console.log("✅ Session validated successfully:", authData.user.id);
      return authData.user;
    } catch (error) {
      console.error("❌ Session validation error:", error);
      return null;
    }
  }, []);

  // Initialize authentication with FORCE
  useEffect(() => {
    const initializeAuth = async () => {
      if (hasInitialized.current || !mountedRef.current) return;
      hasInitialized.current = true;

      console.log("🚀 FORCE initializing authentication...");
      setLoading(true);

      const validatedUser = await forceValidateSession();

      if (!mountedRef.current) return;

      if (!validatedUser) {
        console.log("❌ No valid user, showing auth form");
        setUser(null);
        setKycStatus(null);
        setLoading(false);
        return;
      }

      console.log("✅ User authenticated, force fetching data...");
      setUser(validatedUser);
      await forceFetchUserData(validatedUser.id);
    };

    initializeAuth();
  }, [forceValidateSession, forceFetchUserData]);

  // Auth state listener with FORCE refresh capability
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current || event === "INITIAL_SESSION") return;

      console.log(
        "🔄 Auth state changed:",
        event,
        session?.user?.id || "No user"
      );

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setError(null);

      if (currentUser && event === "SIGNED_IN") {
        console.log("🚀 User signed in, FORCE fetching data...");
        setLoading(true);
        await forceFetchUserData(currentUser.id);
      } else if (!currentUser && event === "SIGNED_OUT") {
        console.log("👋 User signed out");
        setKycStatus(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [forceFetchUserData]);

  // AGGRESSIVE session monitoring - but with safeguards
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!mountedRef.current || !user) return;

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          console.warn("⚠️ Session lost during monitoring, cleaning up...");
          if (mountedRef.current) {
            setUser(null);
            setKycStatus(null);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("❌ Session monitoring error:", error);
      }
    }, 30000); // Check every 30 seconds instead of 60

    return () => clearInterval(interval);
  }, [user]);

  // Force refresh mechanism for stuck states
  useEffect(() => {
    if (loading && user && hasInitialized.current) {
      // If we're loading for more than 10 seconds with a valid user, force refresh
      forceRefreshTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && loading && user) {
          console.log("⚡ EMERGENCY FORCE REFRESH - stuck loading detected");
          forceFetchUserData(user.id);
        }
      }, 10000);
    } else {
      if (forceRefreshTimeoutRef.current) {
        clearTimeout(forceRefreshTimeoutRef.current);
        forceRefreshTimeoutRef.current = null;
      }
    }

    return () => {
      if (forceRefreshTimeoutRef.current) {
        clearTimeout(forceRefreshTimeoutRef.current);
      }
    };
  }, [loading, user, forceFetchUserData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (forceRefreshTimeoutRef.current) {
        clearTimeout(forceRefreshTimeoutRef.current);
      }
    };
  }, []);

  // Manual force refresh function for emergency use
  const handleForceRefresh = useCallback(async () => {
    if (!user) return;

    console.log("🔄 Manual force refresh triggered");
    setLoading(true);
    setError(null);

    const validatedUser = await forceValidateSession();
    if (validatedUser) {
      await forceFetchUserData(validatedUser.id);
    } else {
      setUser(null);
      setKycStatus(null);
      setLoading(false);
    }
  }, [user, forceValidateSession, forceFetchUserData]);

  // Debug logs
  console.group("== Page Render ==");
  console.log("User:", user?.id || "null");
  console.log("KYC Status:", kycStatus);
  console.log("Loading:", loading);
  console.log("Initialized:", hasInitialized.current);
  console.log("Mounted:", mountedRef.current);
  console.groupEnd();

  const LoadingScreen = ({ message }: { message: string }) => (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623]"></div>
      <p className="text-gray-600 text-lg text-center">{message}</p>
      {error && (
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleForceRefresh}
          className="bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Force Refresh
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );

  // Show loading only when truly initializing or when we have a user but no KYC status yet
  if (loading && (hasInitialized.current || (user && kycStatus === null))) {
    return <LoadingScreen message="Loading your account..." />;
  }

  if (!user) return <AuthForm />;

  if (kycStatus === "not_started") {
    return (
      <KYCVerification
        userId={user.id}
        onKYCComplete={() => {
          console.log("✅ KYC completed, loading dashboard...");
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
            Your KYC documents are being reviewed. This usually takes 1–3
            business days.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                console.log("🚀 Skipping KYC (Development mode)");
                setKycStatus("approved");
              }}
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
              onClick={() => {
                console.log("🔄 Retrying KYC verification");
                setKycStatus("not_started");
              }}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                console.log("🚀 Skipping KYC (Development mode)");
                setKycStatus("approved");
              }}
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

  console.log("🎯 Loading dashboard for user:", user.id);
  return <Dashboard />;
}
