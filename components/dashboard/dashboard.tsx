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

  useEffect(() => {
    fetchUserData();
  }, []);

  const generateClientId = () => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  };

  const logError = (message: string, error: any) => {
    console.error(message, {
      error,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      errorHint: error?.hint,
      fullError: JSON.stringify(error, null, 2)
    });
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
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no row exists

      if (checkError) {
        logError("Error checking existing profile:", checkError);
        // Don't throw here, continue with creation attempt
      }

      if (existingProfile) {
        console.log("Profile already exists:", existingProfile);
        return existingProfile;
      }

      // Create profile manually if trigger didn't work
      console.log("Inserting new profile...");
      const profileData = {
        id: user.id,
        client_id: clientId,
        full_name:
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "User",
        email: user.email,
      };

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .insert(profileData)
        .select()
        .single();

      if (profileError) {
        logError("Profile creation error:", profileError);

        // If it's a unique constraint error, try to fetch the existing profile
        if (profileError.code === '23505') {
          console.log("Profile already exists (unique constraint), fetching...");
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (existingProfile) {
            return existingProfile;
          }
        }

        throw new Error(`Failed to create profile: ${profileError.message || 'Unknown error'}`);
      }

      if (!profile) {
        throw new Error("Profile creation returned no data");
      }

      // Create initial balances if they don't exist
      console.log("Creating initial balances...");
      const balanceOperations = [
        { table: "crypto_balances", name: "crypto" },
        { table: "euro_balances", name: "euro" },
        { table: "cad_balances", name: "cad" },
        { table: "usd_balances", name: "usd" }
      ];

      const balancePromises = balanceOperations.map(async (operation) => {
        try {
          const { error: balanceError } = await supabase
            .from(operation.table)
            .upsert({ user_id: user.id, balance: 0 }, {
              onConflict: 'user_id',
              ignoreDuplicates: true
            });

          if (balanceError) {
            logError(`Error creating ${operation.name} balance:`, balanceError);
          }
        } catch (balanceError) {
          logError(`Exception creating ${operation.name} balance:`, balanceError);
        }
      });

      // Wait for all balance operations to complete (but don't fail if they don't)
      await Promise.allSettled(balancePromises);

      console.log("Profile created successfully:", profile);
      return profile;
    } catch (error: any) {
      logError("Error creating user profile:", error);
      // Return a basic profile object even if creation fails
      return {
        id: user.id,
        client_id: generateClientId(),
        full_name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
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
        .maybeSingle(); // Use maybeSingle to avoid 406 errors

      if (profileError) {
        logError("Profile fetch error:", profileError);
      }

      // If profile doesn't exist, create it
      if (!profile) {
        console.log("Profile not found, creating new profile...");
        profile = await createUserProfile(user);
      } else if (profileError) {
        logError("Unexpected profile fetch error:", profileError);
        // Create a fallback profile
        profile = {
          id: user.id,
          client_id: generateClientId(),
          full_name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User",
          email: user.email,
        };
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
      };

      setUserProfile(safeProfile);
      console.log("User profile loaded successfully:", safeProfile);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#F26623] rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-10 h-10 bg-white rounded transform rotate-45 animate-spin"></div>
          </div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

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
        <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-50">
          <div className="flex items-center">
            <span className="mr-2">⚠️</span>
            <span className="text-sm">Some features may not work properly</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-yellow-700 hover:text-yellow-900"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}