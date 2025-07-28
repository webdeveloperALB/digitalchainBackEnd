"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import LoansSection from "./loans-section";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

const ErrorBanner = ({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) => (
  <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-sm">
    <div className="flex items-center">
      <span className="mr-2">⚠️</span>
      <span className="text-sm flex-1">{error}</span>
      <button
        onClick={onClose}
        className="ml-4 text-red-700 hover:text-red-900 text-xl leading-none"
      >
        ×
      </button>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623]"></div>
  </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const router = useRouter();

  // Use refs to avoid stale closure issues
  const lastActivityRef = useRef(Date.now());
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generateClientId = () => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  };

  const createUserProfile = async (user: any): Promise<UserProfile> => {
    const clientId = generateClientId();

    const profileData = {
      id: user.id,
      client_id: clientId,
      full_name:
        user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
      email: user.email,
    };

    // Use upsert to handle existing profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(profileData, { onConflict: "id" })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation error:", profileError);
      throw profileError;
    }

    // Create initial balances (non-blocking)
    const balanceOperations = [
      { table: "crypto_balances", name: "crypto" },
      { table: "euro_balances", name: "euro" },
      { table: "cad_balances", name: "cad" },
      { table: "usd_balances", name: "usd" },
    ];

    // Create balances asynchronously
    balanceOperations.forEach(async (operation) => {
      try {
        await supabase
          .from(operation.table)
          .upsert({ user_id: user.id, balance: 0 }, { onConflict: "user_id" });
      } catch (error) {
        console.warn(`Could not create ${operation.name} balance:`, error);
      }
    });

    return profile;
  };

  const fetchUserData = async () => {
    try {
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(`Authentication failed: ${userError.message}`);
      }

      if (!user) {
        throw new Error("No authenticated user found");
      }

      // Try to fetch existing profile
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // If profile doesn't exist, create it
      if (profileError?.code === "PGRST116") {
        profile = await createUserProfile(user);
      } else if (profileError) {
        throw profileError;
      }

      setUserProfile(profile);
    } catch (error: any) {
      console.error("Error fetching user data:", error);
      setError(error.message || "Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  // Test database connection
  const testDatabaseConnection = async () => {
    try {
      console.log("Testing database connection...");
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1);

      if (error) {
        console.error("Database connection test failed:", error);
        return false;
      }
      console.log("Database connection OK");
      return true;
    } catch (error) {
      console.error("Database connection test error:", error);
      return false;
    }
  };

  // Improved activity tracking
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setLastActivity(now);
    setIsIdle(false);
  }, []);

  // Force logout function
  const forceLogout = useCallback(async () => {
    console.log("Forcing logout due to inactivity");
    try {
      // Clear all intervals and timeouts first
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
      if (sectionTimeoutRef.current) {
        clearTimeout(sectionTimeoutRef.current);
        sectionTimeoutRef.current = null;
      }

      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Error during forced logout:", error);
      // Force redirect even if logout fails
      router.push("/");
    }
  }, [router]);

  // Initialize dashboard on mount
  useEffect(() => {
    fetchUserData();
    updateActivity(); // Initialize activity
  }, [updateActivity]);

  // Improved idle timeout functionality
  useEffect(() => {
    const IDLE_TIME = 300000; // 5 minutes
    const CHECK_INTERVAL = 10000; // Check every 10 seconds

    const handleActivity = () => {
      updateActivity();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateActivity();
        // Test database connection when coming back from idle
        testDatabaseConnection();
      }
    };

    // Add event listeners for user activity
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    // Use passive listeners and throttle activity updates
    const throttledActivity = (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) return; // Already scheduled
        timeoutId = setTimeout(() => {
          handleActivity();
          timeoutId = null;
        }, 2000); // Throttle to once per 2 seconds
      };
    })();

    events.forEach((event) => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });

    // Add visibility change listener for tab switching
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Set up interval to check for idle time
    idleCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      if (timeSinceLastActivity >= IDLE_TIME) {
        setIsIdle(true);
        forceLogout();
      } else if (timeSinceLastActivity >= IDLE_TIME * 0.8) {
        // Warn user when 80% of idle time has passed
        setIsIdle(true);
      } else {
        setIsIdle(false);
      }
    }, CHECK_INTERVAL);

    // Cleanup function
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
    };
  }, [updateActivity, forceLogout]);

  // Improved tab switching with timeout protection
  const handleTabChange = useCallback(
    async (newTab: string) => {
      console.log(`Attempting to switch to tab: ${newTab}`);

      // Clear any existing section timeout
      if (sectionTimeoutRef.current) {
        clearTimeout(sectionTimeoutRef.current);
        sectionTimeoutRef.current = null;
      }

      updateActivity(); // Record activity when switching tabs
      setSectionLoading(true);

      // Test database connection before switching
      const dbOk = await testDatabaseConnection();
      if (!dbOk) {
        console.error("Database connection failed, refreshing page...");
        window.location.reload();
        return;
      }

      // Set timeout to prevent infinite loading
      sectionTimeoutRef.current = setTimeout(() => {
        console.warn(`Section ${newTab} took too long to load, forcing reload`);
        setSectionLoading(false);
        window.location.reload();
      }, 10000); // 10 second timeout

      try {
        setActiveTab(newTab);
        console.log(`Successfully switched to tab: ${newTab}`);

        // Clear timeout on successful switch
        setTimeout(() => {
          setSectionLoading(false);
          if (sectionTimeoutRef.current) {
            clearTimeout(sectionTimeoutRef.current);
            sectionTimeoutRef.current = null;
          }
        }, 1000); // Give 1 second for section to render
      } catch (error) {
        console.error(`Error switching to tab ${newTab}:`, error);
        setSectionLoading(false);
        if (sectionTimeoutRef.current) {
          clearTimeout(sectionTimeoutRef.current);
          sectionTimeoutRef.current = null;
        }
      }
    },
    [updateActivity]
  );

  const renderActiveSection = () => {
    if (!userProfile) return null;

    // Remove the key prop that was causing remounts
    // The issue is likely in the individual section components

    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardContent
            userProfile={userProfile}
            setActiveTab={handleTabChange}
          />
        );
      case "accounts":
        return <AccountsSection userProfile={userProfile} />;
      case "transfers":
        return <TransfersSection userProfile={userProfile} />;
      case "deposit":
        return <DepositsSection userProfile={userProfile} />;
      case "payments":
        return <PaymentsSection userProfile={userProfile} />;
      case "card":
        return <CardSection userProfile={userProfile} />;
      case "crypto":
        return <CryptoSection userProfile={userProfile} />;
      case "message":
        return <MessageSection userProfile={userProfile} />;
      case "support":
        return <SupportSection userProfile={userProfile} />;
      case "loans":
        return <LoansSection />;
      default:
        return (
          <DashboardContent
            userProfile={userProfile}
            setActiveTab={handleTabChange}
          />
        );
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 text-red-500">⚠️</div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Authentication Error
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

  return (
    <div className="flex h-screen bg-gray-100">
      {userProfile && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          userProfile={userProfile}
        />
      )}

      <div className="flex-1 relative">
        {isIdle && (
          <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded text-sm z-40">
            ⚠️ Session will expire due to inactivity
          </div>
        )}

        {sectionLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-30">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading section...</p>
            </div>
          </div>
        )}

        {renderActiveSection()}
      </div>

      {error && userProfile && (
        <ErrorBanner error={error} onClose={() => setError(null)} />
      )}
    </div>
  );
}
