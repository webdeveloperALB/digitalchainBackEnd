"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "./sidebar";
import DashboardContent from "./dashboard-content";
import AccountsSection from "./accounts-section";
import DepositsSection from "./deposits-section";
import PaymentsSection from "./payments-section";
import CardSection from "./card-section";
import SupportSection from "./support-section";
import TransfersSection from "./transfers-section-fixed";
import CryptoSection from "./crypto-section-fixed";
import MessageSection from "./message-section-database";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Prevent double execution
    if (isInitialized) return;

    const initializeDashboard = async () => {
      setIsInitialized(true);
      await fetchUserData();
    };

    initializeDashboard();
  }, [isInitialized]);

  const generateClientId = () => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  };

  const logError = (message: string, error: any) => {
    // Improved error logging with fallback information
    const errorInfo = {
      message: message,
      error: error,
      errorMessage: error?.message || "No error message provided",
      errorCode: error?.code || "No error code",
      errorDetails: error?.details || "No error details",
      errorHint: error?.hint || "No error hint",
      timestamp: new Date().toISOString(),
      // Add more context if error is empty
      isEmpty: !error || Object.keys(error).length === 0,
      type: typeof error,
      stringified: JSON.stringify(error, null, 2),
    };

    console.error(message, errorInfo);

    // Also log to help with debugging
    if (errorInfo.isEmpty) {
      console.warn(
        "Empty error object detected - this might indicate a network issue or invalid operation"
      );
    }
  };

  const createUserProfile = async (user: any) => {
    try {
      const clientId = generateClientId();

      console.log("Creating profile for user:", user.id);

      // First check if profile already exists with better error handling
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (checkError) {
        logError("Error checking existing profile:", checkError);
        // Continue with creation attempt only if it's not a critical error
        if (checkError.code !== "PGRST116") {
          // PGRST116 = no rows found
          console.warn("Continuing despite check error...");
        }
      }

      if (existingProfile) {
        console.log("Profile already exists:", existingProfile);
        return existingProfile;
      }

      // Create profile with upsert to handle race conditions
      console.log("Upserting profile...");
      const profileData = {
        id: user.id,
        client_id: clientId,
        full_name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
      };

      console.log("Profile data to upsert:", profileData);

      // Use upsert instead of insert to handle concurrent requests
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .upsert(profileData, {
          onConflict: "id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (profileError) {
        logError("Profile upsert error:", profileError);

        // If upsert fails, try to fetch existing profile
        console.log("Upsert failed, attempting to fetch existing profile...");
        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (!fallbackError && fallbackProfile) {
          console.log(
            "Found existing profile after upsert failure:",
            fallbackProfile
          );
          return fallbackProfile;
        }

        // If we still can't get the profile, throw error
        const errorMessage =
          profileError.message ||
          profileError.details ||
          profileError.hint ||
          "Unknown database error";

        throw new Error(
          `Failed to create/fetch profile: ${errorMessage} (Code: ${
            profileError.code || "unknown"
          })`
        );
      }

      if (!profile) {
        throw new Error("Profile operation returned no data");
      }

      // Create initial balances asynchronously (don't block profile creation)
      console.log("Scheduling initial balance creation...");
      setTimeout(async () => {
        const balanceOperations = [
          { table: "crypto_balances", name: "crypto" },
          { table: "euro_balances", name: "euro" },
          { table: "cad_balances", name: "cad" },
          { table: "usd_balances", name: "usd" },
        ];

        for (const operation of balanceOperations) {
          try {
            const { error: balanceError } = await supabase
              .from(operation.table)
              .upsert(
                { user_id: user.id, balance: 0 },
                {
                  onConflict: "user_id",
                  ignoreDuplicates: true,
                }
              );

            if (balanceError) {
              console.warn(
                `Warning: Could not create ${operation.name} balance:`,
                balanceError.message
              );
            }
          } catch (balanceError) {
            console.warn(
              `Warning: Exception creating ${operation.name} balance:`,
              balanceError
            );
          }
        }
      }, 100); // Small delay to avoid blocking

      console.log("Profile created/updated successfully:", profile);
      return profile;
    } catch (error: any) {
      logError("Error in createUserProfile:", error);

      // Last resort: try to fetch existing profile one more time
      try {
        console.log("Last resort: attempting to fetch existing profile...");
        const { data: lastResortProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (lastResortProfile) {
          console.log(
            "Successfully found existing profile on last resort:",
            lastResortProfile
          );
          return lastResortProfile;
        }
      } catch (lastResortError) {
        console.warn("Last resort fetch also failed:", lastResortError);
      }

      // Return a basic profile object even if everything fails
      console.log("Creating temporary profile as fallback");
      return {
        id: user.id,
        client_id: generateClientId(),
        full_name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
        _isTemporary: true,
      };
    }
  };

  const fetchUserData = async () => {
    try {
      setError(null);
      console.log("Fetching user authentication...");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        logError("User authentication error:", userError);
        throw new Error(`Authentication failed: ${userError.message}`);
      }

      if (!user) {
        console.log("No authenticated user found");
        // Set fallback data immediately
        setUserProfile({
          id: "unknown",
          client_id: "000000",
          full_name: "Guest User",
          email: "guest@example.com",
        });
        return;
      }

      console.log("Authenticated user found:", user.id);
      console.log("User metadata:", user.user_metadata);

      // Try to fetch user profile with better error handling
      console.log("Fetching user profile from database...");
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        logError("Profile fetch error:", profileError);
      }

      // If profile doesn't exist, create it
      if (!profile) {
        console.log("Profile not found, creating new profile...");
        try {
          profile = await createUserProfile(user);
        } catch (createError) {
          logError("Failed to create profile, using fallback:", createError);
          // Continue with fallback profile
        }
      }

      // Ensure profile has all required fields
      const safeProfile = {
        id: profile?.id || user.id,
        client_id: profile?.client_id || generateClientId(),
        full_name:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "User",
        email: profile?.email || user.email || "user@example.com",
        created_at: profile?.created_at,
        updated_at: profile?.updated_at,
        _isTemporary: profile?._isTemporary || false,
      };

      setUserProfile(safeProfile);
      console.log("User profile loaded successfully:", safeProfile);

      // Set a warning if using temporary profile
      if (safeProfile._isTemporary) {
        setError("Using temporary profile - some features may be limited");
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error occurred";
      logError("Error in fetchUserData:", error);
      setError(errorMessage);

      // Set fallback data
      setUserProfile({
        id: "unknown",
        client_id: "000000",
        full_name: "User",
        email: "user@example.com",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderActiveSection = () => {
    // Always ensure userProfile is not null before passing it
    const safeUserProfile = userProfile || {
      id: "unknown",
      client_id: "000000",
      full_name: "User",
      email: "user@example.com",
    };

    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardContent
            userProfile={safeUserProfile}
            setActiveTab={setActiveTab}
          />
        );
      case "accounts":
        return <AccountsSection />;
      case "transfers":
        return <TransfersSection />;
      case "deposit":
        return <DepositsSection />;
      case "payments":
        return <PaymentsSection />;
      case "card":
        return <CardSection />;
      case "crypto":
        return <CryptoSection />;
      case "message":
        return <MessageSection />;
      case "support":
        return <SupportSection />;
      default:
        return (
          <DashboardContent
            userProfile={safeUserProfile}
            setActiveTab={setActiveTab}
          />
        );
    }
  };

 

  // Show error state if there's a critical error
  if (error && userProfile?.id === "unknown") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 text-red-500">⚠️</div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchUserData();
            }}
            className="bg-[#F26623] text-white px-4 py-2 rounded-lg hover:bg-[#d55a1f] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Always ensure userProfile is not null
  const safeUserProfile = userProfile || {
    id: "unknown",
    client_id: "000000",
    full_name: "User",
    email: "user@example.com",
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userProfile={safeUserProfile}
      />
      {renderActiveSection()}

      {/* Show error banner if there's a non-critical error */}
      {error && userProfile?.id !== "unknown" && (
        <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-50 max-w-sm">
          <div className="flex items-center">
            <span className="mr-2">⚠️</span>
            <span className="text-sm flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-yellow-700 hover:text-yellow-900 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
