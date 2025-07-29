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

// Wrapper component to catch section loading issues
const SectionWrapper = ({
  children,
  sectionName,
  onLoadingTimeout,
}: {
  children: React.ReactNode;
  sectionName: string;
  onLoadingTimeout: (section: string) => void;
}) => {
  const [mounted, setMounted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log(`${sectionName} section mounting...`);

    // Set timeout for section loading
    timeoutRef.current = setTimeout(() => {
      if (!mounted) {
        console.error(
          `${sectionName} section failed to mount within 5 seconds`
        );
        onLoadingTimeout(sectionName);
      }
    }, 5000);

    // Mark as mounted after a brief delay
    const mountTimer = setTimeout(() => {
      setMounted(true);
      console.log(`${sectionName} section mounted successfully`);
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearTimeout(mountTimer);
      console.log(`${sectionName} section unmounting...`);
    };
  }, [sectionName, mounted, onLoadingTimeout]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading {sectionName}...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [sectionError, setSectionError] = useState<string | null>(null);
  const router = useRouter();

  // Use refs to avoid stale closure issues
  const lastActivityRef = useRef(Date.now());
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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

  // Improved activity tracking
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setLastActivity(now);
  }, []);

  // Force logout function
  const forceLogout = useCallback(async () => {
    console.log("Forcing logout due to inactivity");
    try {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }

      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Error during forced logout:", error);
      router.push("/");
    }
  }, [router]);

  // Initialize dashboard on mount
  useEffect(() => {
    fetchUserData();
    updateActivity();
  }, [updateActivity]);

  // Simplified idle timeout functionality
  useEffect(() => {
    const IDLE_TIME = 900000; // 15 minutes (increased from 5)
    const CHECK_INTERVAL = 30000; // Check every 30 seconds

    const handleActivity = () => {
      updateActivity();
    };

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const throttledActivity = (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) return;
        timeoutId = setTimeout(() => {
          handleActivity();
          timeoutId = null;
        }, 5000); // Throttle to once per 5 seconds
      };
    })();

    events.forEach((event) => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });

    idleCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      if (timeSinceLastActivity >= IDLE_TIME) {
        forceLogout();
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledActivity);
      });

      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
    };
  }, [updateActivity, forceLogout]);

  // Simple tab switching
  const handleTabChange = useCallback(
    (newTab: string) => {
      console.log(`Switching to tab: ${newTab}`);
      updateActivity();
      setSectionError(null);
      setActiveTab(newTab);
    },
    [updateActivity]
  );

  // Handle section loading timeout
  const handleSectionTimeout = useCallback((sectionName: string) => {
    console.error(`Section ${sectionName} timed out`);
    setSectionError(
      `${sectionName} section failed to load. This might be due to a database connection issue.`
    );

    // Offer recovery options
    setTimeout(() => {
      const shouldReload = window.confirm(
        `The ${sectionName} section is not responding. Would you like to reload the page to fix this issue?`
      );
      if (shouldReload) {
        window.location.reload();
      }
    }, 1000);
  }, []);

  const renderActiveSection = () => {
    if (!userProfile) return null;

    // Wrap each section to catch loading issues
    switch (activeTab) {
      case "dashboard":
        return (
          <SectionWrapper
            sectionName="Dashboard"
            onLoadingTimeout={handleSectionTimeout}
          >
            <DashboardContent
              userProfile={userProfile}
              setActiveTab={handleTabChange}
            />
          </SectionWrapper>
        );
      case "accounts":
        return (
          <SectionWrapper
            sectionName="Accounts"
            onLoadingTimeout={handleSectionTimeout}
          >
            <AccountsSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "transfers":
        return (
          <SectionWrapper
            sectionName="Transfers"
            onLoadingTimeout={handleSectionTimeout}
          >
            <TransfersSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "deposit":
        return (
          <SectionWrapper
            sectionName="Deposits"
            onLoadingTimeout={handleSectionTimeout}
          >
            <DepositsSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "payments":
        return (
          <SectionWrapper
            sectionName="Payments"
            onLoadingTimeout={handleSectionTimeout}
          >
            <PaymentsSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "card":
        return (
          <SectionWrapper
            sectionName="Card"
            onLoadingTimeout={handleSectionTimeout}
          >
            <CardSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "crypto":
        return (
          <SectionWrapper
            sectionName="Crypto"
            onLoadingTimeout={handleSectionTimeout}
          >
            <CryptoSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "message":
        return (
          <SectionWrapper
            sectionName="Message"
            onLoadingTimeout={handleSectionTimeout}
          >
            <MessageSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "support":
        return (
          <SectionWrapper
            sectionName="Support"
            onLoadingTimeout={handleSectionTimeout}
          >
            <SupportSection userProfile={userProfile} />
          </SectionWrapper>
        );
      case "loans":
        return (
          <SectionWrapper
            sectionName="Loans"
            onLoadingTimeout={handleSectionTimeout}
          >
            <LoansSection />
          </SectionWrapper>
        );
      default:
        return (
          <SectionWrapper
            sectionName="Dashboard"
            onLoadingTimeout={handleSectionTimeout}
          >
            <DashboardContent
              userProfile={userProfile}
              setActiveTab={handleTabChange}
            />
          </SectionWrapper>
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
    <div className="relative h-screen bg-gray-100">
      <div className="flex h-full">
        {userProfile && (
          <div className="md:w-64 md:h-full md:fixed md:left-0 md:top-0 md:z-20">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              userProfile={userProfile}
            />
          </div>
        )}

        <div className="flex-1 md:ml-64 overflow-auto">
          {renderActiveSection()}
        </div>
      </div>

      {error && userProfile && (
        <ErrorBanner error={error} onClose={() => setError(null)} />
      )}
      {sectionError && (
        <ErrorBanner
          error={sectionError}
          onClose={() => setSectionError(null)}
        />
      )}
    </div>
  );
}
