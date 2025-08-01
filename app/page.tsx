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

  const checkKYCStatus = async (userId: string) => {
    if (isCheckingKYC.current) return;
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
        setKycStatus("approved");
        return;
      }

      const status = userData?.kyc_status || "approved";
      console.log("KYC status:", status);
      setKycStatus(status);
    } catch (error) {
      console.error("Error checking KYC status:", error);
      setKycStatus("approved");
    } finally {
      isCheckingKYC.current = false;
    }
  };

  // Initial auth/session setup
  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      console.log("Initializing authentication...");

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        console.warn("Session not found or invalid");
        if (mounted) {
          setUser(null);
          setKycStatus(null);
          setLoading(false);
        }
        return;
      }

      const currentUser = session.user;
      console.log("Authenticated user:", currentUser.id);
      if (mounted) {
        setUser(currentUser);
        await checkKYCStatus(currentUser.id);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Supabase auth listener
  useEffect(() => {
    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || event === "INITIAL_SESSION") return;

      console.log("Auth state changed:", event, session?.user?.id || "No user");
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setError(null);

      if (currentUser && event === "SIGNED_IN") {
        console.log("User signed in, checking KYC...");
        await checkKYCStatus(currentUser.id);
      } else if (!currentUser && event === "SIGNED_OUT") {
        console.log("User signed out");
        setKycStatus(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Periodic idle session check
  useEffect(() => {
    const interval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        console.warn("Session expired or signed out during idle");
        setUser(null);
        setKycStatus(null);
        setLoading(false);
      }
    }, 60 * 1000); // Every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Debug logs
  console.group("== Page Render ==");
  console.log("User:", user);
  console.log("KYC Status:", kycStatus);
  console.log("Loading:", loading);
  console.log("Initialized:", hasInitialized.current);
  console.groupEnd();

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

  if (loading && hasInitialized.current) {
    return <LoadingScreen message="Loading your account..." />;
  }

  if (!user) return <AuthForm />;

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
            Your KYC documents are being reviewed. This usually takes 1–3
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

  console.log("Loading dashboard for user:", user.id);
  return <Dashboard />;
}
