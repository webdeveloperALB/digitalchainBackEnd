"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
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

interface DatabaseState {
  isHealthy: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
  isReconnecting: boolean;
}

interface BaseSectionProps {
  userProfile: UserProfile;
}

interface ExtendedSectionProps extends BaseSectionProps {
  setActiveTab?: (tab: string) => void;
}

// Enhanced Database Manager with better connection handling
class DatabaseManager {
  private static instance: DatabaseManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectionTimeout: NodeJS.Timeout | null = null;
  private state: DatabaseState = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    consecutiveFailures: 0,
    isReconnecting: false,
  };
  private listeners: ((state: DatabaseState) => void)[] = [];
  private activeOperations: Map<string, Promise<any>> = new Map();
  private operationTimeouts: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private constructor() {
    this.startHealthMonitoring();
    this.setupConnectionRecovery();
  }

  subscribe(callback: (state: DatabaseState) => void): () => void {
    this.listeners.push(callback);
    callback(this.state);

    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error("Error in database state listener:", error);
      }
    });
  }

  private startHealthMonitoring(): void {
    // More frequent health checks during issues
    const getCheckInterval = () => (this.state.isHealthy ? 30000 : 5000);

    const scheduleNextCheck = () => {
      if (this.healthCheckInterval) {
        clearTimeout(this.healthCheckInterval);
      }
      this.healthCheckInterval = setTimeout(() => {
        this.performHealthCheck().finally(() => {
          scheduleNextCheck();
        });
      }, getCheckInterval());
    };

    scheduleNextCheck();
    this.performHealthCheck();
  }

  private setupConnectionRecovery(): void {
    // Listen to browser online/offline events
    window.addEventListener("online", () => {
      console.log("Browser back online, checking database connection");
      this.performHealthCheck();
    });

    window.addEventListener("offline", () => {
      console.log("Browser offline detected");
      this.state = {
        ...this.state,
        isHealthy: false,
        consecutiveFailures: this.state.consecutiveFailures + 1,
      };
      this.notifyListeners();
    });

    // Check for page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.state.consecutiveFailures > 0) {
        console.log("Page visible again, checking database connection");
        setTimeout(() => this.performHealthCheck(), 1000);
      }
    });
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();

      // Use a simple, fast query with proper timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const { error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (responseTime > 8000) {
        throw new Error("Database response timeout");
      }

      // Health check passed
      const wasUnhealthy = !this.state.isHealthy;
      this.state = {
        isHealthy: true,
        lastHealthCheck: Date.now(),
        consecutiveFailures: 0,
        isReconnecting: false,
      };

      if (wasUnhealthy) {
        console.log("Database connection restored");
      }

      this.notifyListeners();
    } catch (error) {
      console.error("Database health check failed:", error);

      this.state = {
        ...this.state,
        isHealthy: false,
        consecutiveFailures: this.state.consecutiveFailures + 1,
        lastHealthCheck: Date.now(),
        isReconnecting: false,
      };

      this.notifyListeners();

      // Don't auto-reconnect too aggressively
      if (this.state.consecutiveFailures <= 5) {
        this.scheduleReconnection();
      }
    }
  }

  private scheduleReconnection(): void {
    if (this.state.isReconnecting) return;

    this.state = { ...this.state, isReconnecting: true };
    this.notifyListeners();

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      1000 * Math.pow(2, this.state.consecutiveFailures),
      30000
    );
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
    }

    this.reconnectionTimeout = setTimeout(() => {
      this.performHealthCheck();
    }, delay);
  }

  async executeOperation<T>(
    operationKey: string,
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      timeoutMs?: number;
      skipHealthCheck?: boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 2,
      timeoutMs = 12000,
      skipHealthCheck = false,
    } = options;

    // Cancel any existing operation with the same key
    if (this.activeOperations.has(operationKey)) {
      console.log(`Cancelling existing operation: ${operationKey}`);
      this.cancelOperation(operationKey);
    }

    // Wait for healthy connection unless skipped
    if (!skipHealthCheck && !this.state.isHealthy) {
      try {
        await this.waitForHealthyConnection(3000);
      } catch (error) {
        // If we can't get a healthy connection, try anyway but with reduced timeout
        console.warn("Proceeding with unhealthy connection");
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create operation promise with timeout
        const operationPromise = this.wrapWithTimeout(
          operation(),
          timeoutMs,
          operationKey
        );

        // Track active operation
        this.activeOperations.set(operationKey, operationPromise);

        const result = await operationPromise;

        // Clean up
        this.activeOperations.delete(operationKey);
        this.clearOperationTimeout(operationKey);

        return result;
      } catch (error: any) {
        lastError = error;

        // Clean up failed operation
        this.activeOperations.delete(operationKey);
        this.clearOperationTimeout(operationKey);

        console.error(
          `Operation failed (attempt ${attempt + 1}/${maxRetries + 1}):`,
          {
            operationKey,
            error: error.message,
            isTimeout: error.name === "TimeoutError",
          }
        );

        // Mark as unhealthy on certain errors
        if (this.isConnectionError(error) && this.state.isHealthy) {
          this.state = {
            ...this.state,
            isHealthy: false,
            consecutiveFailures: this.state.consecutiveFailures + 1,
          };
          this.notifyListeners();
          this.scheduleReconnection();
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 3000);
          await this.sleep(delay);
        }
      }
    }

    throw (
      lastError ||
      new Error(`Operation ${operationKey} failed after all retries`)
    );
  }

  private wrapWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationKey: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Operation timeout after ${timeoutMs}ms`);
        error.name = "TimeoutError";
        reject(error);
      }, timeoutMs);

      this.operationTimeouts.set(operationKey, timeoutId);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => {
          clearTimeout(timeoutId);
          this.operationTimeouts.delete(operationKey);
        });
    });
  }

  private cancelOperation(operationKey: string): void {
    this.activeOperations.delete(operationKey);
    this.clearOperationTimeout(operationKey);
  }

  private clearOperationTimeout(operationKey: string): void {
    const timeoutId = this.operationTimeouts.get(operationKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.operationTimeouts.delete(operationKey);
    }
  }

  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      "fetch",
      "network",
      "timeout",
      "connection",
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
    ];

    const errorMessage = (error.message || "").toLowerCase();
    return connectionErrors.some((keyword) => errorMessage.includes(keyword));
  }

  private async waitForHealthyConnection(timeoutMs: number): Promise<void> {
    if (this.state.isHealthy) return;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for healthy database connection"));
      }, timeoutMs);

      const unsubscribe = this.subscribe((state) => {
        if (state.isHealthy) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getState(): DatabaseState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearTimeout(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }

    // Cancel all active operations
    this.activeOperations.clear();
    this.operationTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.operationTimeouts.clear();

    this.listeners = [];
  }
}

// Simplified Section Renderer without problematic caching
class SectionRenderer {
  private sections = {
    dashboard: DashboardContent,
    accounts: AccountsSection,
    transfers: TransfersSection,
    deposit: DepositsSection,
    payments: PaymentsSection,
    card: CardSection,
    crypto: CryptoSection,
    message: MessageSection,
    support: SupportSection,
    loans: LoansSection,
  };

  renderSection(
    sectionName: string,
    userProfile: UserProfile,
    additionalProps: any = {}
  ): React.ReactNode {
    const SectionComponent =
      this.sections[sectionName as keyof typeof this.sections];

    if (!SectionComponent) {
      return this.createErrorComponent(`Section "${sectionName}" not found`);
    }

    if (!userProfile) {
      return this.createErrorComponent("User profile not available");
    }

    try {
      const props: ExtendedSectionProps = {
        userProfile,
        ...additionalProps,
      };

      return React.createElement(
        SectionComponent as React.ComponentType<any>,
        props
      );
    } catch (error) {
      console.error(`Error creating section ${sectionName}:`, error);
      return this.createErrorComponent(`Failed to load ${sectionName}`);
    }
  }

  private createErrorComponent(message: string): React.ReactNode {
    return React.createElement("div", {
      className: "min-h-screen flex items-center justify-center",
      children: React.createElement("div", {
        className: "text-center",
        children: [
          React.createElement("div", {
            key: "icon",
            className:
              "w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4",
            children: "⚠️",
          }),
          React.createElement("h2", {
            key: "title",
            className: "text-xl font-semibold text-gray-900 mb-2",
            children: "Section Error",
          }),
          React.createElement("p", {
            key: "message",
            className: "text-gray-600",
            children: message,
          }),
        ],
      }),
    });
  }
}

// Connection Status Indicator
const ConnectionStatusIndicator = ({ dbState }: { dbState: DatabaseState }) => {
  if (dbState.isHealthy) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-2 text-sm text-center z-50">
      <div className="flex items-center justify-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
        <span>
          {dbState.isReconnecting
            ? "Reconnecting to database..."
            : `Connection issues detected (${dbState.consecutiveFailures} failures)`}
        </span>
      </div>
    </div>
  );
};

// Main Dashboard Component
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbState, setDbState] = useState<DatabaseState>({
    isHealthy: true,
    lastHealthCheck: Date.now(),
    consecutiveFailures: 0,
    isReconnecting: false,
  });

  const router = useRouter();
  const lastActivityRef = useRef(Date.now());
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef(false);

  // Initialize permanent managers
  const dbManager = useMemo(() => DatabaseManager.getInstance(), []);
  const sectionRenderer = useMemo(() => new SectionRenderer(), []);

  // Generate client ID
  const generateClientId = useCallback(() => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  }, []);

  // Create user profile
  const createUserProfile = useCallback(
    async (user: any): Promise<UserProfile> => {
      const profileData = {
        id: user.id,
        client_id: generateClientId(),
        full_name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
      };

      const profile = await dbManager.executeOperation(
        `create-profile-${user.id}`,
        async () => {
          const { data, error } = await supabase
            .from("profiles")
            .upsert(profileData, { onConflict: "id" })
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        { maxRetries: 2, timeoutMs: 10000 }
      );

      // Create balances in background (non-blocking)
      const balanceOperations = [
        "crypto_balances",
        "euro_balances",
        "cad_balances",
        "usd_balances",
      ];

      balanceOperations.forEach((table) => {
        dbManager
          .executeOperation(
            `create-balance-${table}-${user.id}-${Date.now()}`,
            async () => {
              const { error } = await supabase
                .from(table)
                .upsert(
                  { user_id: user.id, balance: 0 },
                  { onConflict: "user_id" }
                );
              if (error) throw error;
            },
            { maxRetries: 1, timeoutMs: 5000 }
          )
          .catch((error) => {
            console.warn(`Failed to create ${table}:`, error);
          });
      });

      return profile;
    },
    [dbManager, generateClientId]
  );

  // Fetch user data
  const fetchUserData = useCallback(async (): Promise<void> => {
    if (!dbManager) return;

    try {
      setError(null);
      setLoading(true);

      const userData = await dbManager.executeOperation(
        `fetch-user-auth-${Date.now()}`,
        async () => {
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();
          if (error) throw error;
          if (!user) throw new Error("No authenticated user found");
          return user;
        },
        { maxRetries: 2, timeoutMs: 8000 }
      );

      const profile = await dbManager.executeOperation(
        `fetch-profile-${userData.id}-${Date.now()}`,
        async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userData.id)
            .single();

          if (error?.code === "PGRST116") {
            return await createUserProfile(userData);
          }
          if (error) throw error;
          return data;
        },
        { maxRetries: 2, timeoutMs: 10000 }
      );

      setUserProfile(profile);
      console.log("User profile loaded successfully");
    } catch (error: any) {
      console.error("Error fetching user data:", error);
      setError(error.message || "Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, [dbManager, createUserProfile]);

  // Activity tracking
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Auto-logout setup
  const setupActivityTracking = useCallback(() => {
    const IDLE_TIME = 900000; // 15 minutes
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        updateActivity();
        throttleTimeout = null;
      }, 30000); // Throttle to once per 30 seconds
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });

    // Check for inactivity every 2 minutes
    activityTimeoutRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= IDLE_TIME) {
        console.log("Auto-logout due to inactivity");
        supabase.auth.signOut().finally(() => router.push("/"));
      }
    }, 120000);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledActivity);
      });
      if (activityTimeoutRef.current) {
        clearInterval(activityTimeoutRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [updateActivity, router]);

  // Tab switching
  const handleTabChange = useCallback(
    (newTab: string) => {
      updateActivity();
      setActiveTab(newTab);
      console.log(`Switching to tab: ${newTab}`);
    },
    [updateActivity]
  );

  // Initialize dashboard
  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    console.log("Initializing dashboard");

    fetchUserData();
    updateActivity();

    const cleanup = setupActivityTracking();
    const unsubscribe = dbManager.subscribe(setDbState);

    return () => {
      cleanup();
      unsubscribe();
    };
  }, [fetchUserData, updateActivity, setupActivityTracking, dbManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("Dashboard unmounting");
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623] mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {dbState.isReconnecting
              ? "Connecting to database..."
              : "Loading dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 text-red-500">⚠️</div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Connection Error
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchUserData();
            }}
            className="bg-[#F26623] text-white px-6 py-2 rounded-lg hover:bg-[#d55a1f] transition-colors"
          >
            Retry Connection
          </button>
          <div className="mt-3 text-xs text-gray-500">
            Database Status: {dbState.isHealthy ? "Healthy" : "Issues Detected"}
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="relative h-screen bg-gray-100">
      <ConnectionStatusIndicator dbState={dbState} />

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

        <div
          className={`flex-1 md:ml-64 overflow-auto ${
            !dbState.isHealthy ? "pt-12" : ""
          }`}
        >
          {userProfile && (
            <React.Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623]"></div>
                </div>
              }
            >
              {sectionRenderer.renderSection(activeTab, userProfile, {
                setActiveTab: handleTabChange,
              })}
            </React.Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
