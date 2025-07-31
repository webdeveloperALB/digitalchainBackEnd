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

interface SectionCache {
  [key: string]: {
    component: React.ReactNode;
    timestamp: number;
    isValid: boolean;
  };
}

// Base props interface that all sections should extend
interface BaseSectionProps {
  userProfile: UserProfile;
}

// Extended props for sections that need additional functionality
interface ExtendedSectionProps extends BaseSectionProps {
  setActiveTab?: (tab: string) => void;
}

// Permanent database connection manager
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
  private connectionPool: Map<string, Promise<any>> = new Map();

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private constructor() {
    this.startHealthMonitoring();
  }

  // Subscribe to database state changes
  subscribe(callback: (state: DatabaseState) => void): () => void {
    this.listeners.push(callback);
    // Immediately call with current state
    callback(this.state);

    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Initial health check
    this.performHealthCheck();
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();

      // Simple, fast health check query
      const { error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1)
        .maybeSingle();

      const responseTime = Date.now() - startTime;

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // Consider unhealthy if response time > 10 seconds
      if (responseTime > 10000) {
        throw new Error("Database response too slow");
      }

      // Health check passed
      this.state = {
        isHealthy: true,
        lastHealthCheck: Date.now(),
        consecutiveFailures: 0,
        isReconnecting: false,
      };

      this.notifyListeners();
    } catch (error) {
      console.error("Database health check failed:", error);

      this.state = {
        ...this.state,
        isHealthy: false,
        consecutiveFailures: this.state.consecutiveFailures + 1,
        lastHealthCheck: Date.now(),
      };

      this.notifyListeners();
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    if (this.state.isReconnecting) return;

    this.state.isReconnecting = true;
    this.notifyListeners();

    // Exponential backoff: 1s, 2s, 4s, 8s, then 30s max
    const delay = Math.min(
      1000 * Math.pow(2, this.state.consecutiveFailures),
      30000
    );

    this.reconnectionTimeout = setTimeout(() => {
      this.performHealthCheck();
    }, delay);
  }

  // Execute database operation with automatic retry and connection pooling
  async executeOperation<T>(
    operationKey: string,
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      timeoutMs?: number;
      useCache?: boolean;
      cacheTime?: number;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      timeoutMs = 15000,
      useCache = false,
      cacheTime = 30000,
    } = options;

    // Check cache first
    if (useCache && this.connectionPool.has(operationKey)) {
      const cachedPromise = this.connectionPool.get(operationKey);
      const isExpired =
        Date.now() - (cachedPromise as any).timestamp > cacheTime;

      if (!isExpired) {
        return cachedPromise as Promise<T>;
      } else {
        this.connectionPool.delete(operationKey);
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Wait for healthy connection if needed
        if (!this.state.isHealthy && attempt === 0) {
          await this.waitForHealthyConnection(5000);
        }

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Operation timeout")), timeoutMs);
        });

        // Execute operation with timeout
        const operationPromise = operation();

        // Cache the promise if requested
        if (useCache) {
          (operationPromise as any).timestamp = Date.now();
          this.connectionPool.set(operationKey, operationPromise);
        }

        const result = await Promise.race([operationPromise, timeoutPromise]);

        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Database operation failed (attempt ${attempt + 1}/${
            maxRetries + 1
          }):`,
          error
        );

        // Mark as unhealthy if operation fails
        if (this.state.isHealthy) {
          this.state.isHealthy = false;
          this.state.consecutiveFailures++;
          this.notifyListeners();
          this.attemptReconnection();
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Database operation failed after all retries");
  }

  private waitForHealthyConnection(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state.isHealthy) {
        resolve();
        return;
      }

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

  getState(): DatabaseState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }
    this.connectionPool.clear();
    this.listeners = [];
  }
}

// Permanent section renderer with caching and preloading
class SectionRenderer {
  private cache: SectionCache = {};
  private preloadQueue: Set<string> = new Set();
  private readonly CACHE_TTL = 300000; // 5 minutes

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

  // Preload adjacent sections for instant switching
  preloadSections(currentSection: string): void {
    const sectionOrder = Object.keys(this.sections);
    const currentIndex = sectionOrder.indexOf(currentSection);

    // Preload previous and next sections
    const toPreload = [
      sectionOrder[currentIndex - 1],
      sectionOrder[currentIndex + 1],
    ].filter(Boolean);

    toPreload.forEach((section) => {
      if (!this.preloadQueue.has(section)) {
        this.preloadQueue.add(section);
        // Preload after a short delay to not block current rendering
        setTimeout(() => this.preloadSection(section), 100);
      }
    });
  }

  private preloadSection(sectionName: string): void {
    if (this.isCacheValid(sectionName)) return;

    try {
      // Create a lightweight version for preloading
      const component = this.createSectionComponent(sectionName, true);
      this.cache[sectionName] = {
        component,
        timestamp: Date.now(),
        isValid: true,
      };
    } catch (error) {
      console.warn(`Failed to preload section ${sectionName}:`, error);
    } finally {
      this.preloadQueue.delete(sectionName);
    }
  }

  renderSection(
    sectionName: string,
    userProfile: UserProfile,
    additionalProps: any = {}
  ): React.ReactNode {
    // Check cache first
    if (this.isCacheValid(sectionName)) {
      return this.cache[sectionName].component;
    }

    // Render fresh component
    const component = this.createSectionComponent(
      sectionName,
      false,
      userProfile,
      additionalProps
    );

    // Cache the component
    this.cache[sectionName] = {
      component,
      timestamp: Date.now(),
      isValid: true,
    };

    // Preload adjacent sections
    this.preloadSections(sectionName);

    return component;
  }

  private createSectionComponent(
    sectionName: string,
    isPreload: boolean = false,
    userProfile?: UserProfile,
    additionalProps: any = {}
  ): React.ReactNode {
    const SectionComponent =
      this.sections[sectionName as keyof typeof this.sections];

    if (!SectionComponent) {
      return this.createErrorComponent(`Section "${sectionName}" not found`);
    }

    try {
      // For preloading, create a minimal version
      if (isPreload) {
        return React.createElement("div", {
          className: "preloaded-section",
          "data-section": sectionName,
        });
      }

      // Ensure userProfile is provided for full components
      if (!userProfile) {
        return this.createErrorComponent("User profile not available");
      }

      // Create props with proper typing
      const props: ExtendedSectionProps = {
        userProfile,
        ...additionalProps,
      };

      // Special handling for dashboard which needs setActiveTab
      if (sectionName === "dashboard" && additionalProps.setActiveTab) {
        props.setActiveTab = additionalProps.setActiveTab;
      }

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

  private isCacheValid(sectionName: string): boolean {
    const cached = this.cache[sectionName];
    if (!cached || !cached.isValid) return false;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
    if (isExpired) {
      delete this.cache[sectionName];
      return false;
    }

    return true;
  }

  invalidateCache(sectionName?: string): void {
    if (sectionName) {
      delete this.cache[sectionName];
    } else {
      this.cache = {};
    }
  }

  destroy(): void {
    this.cache = {};
    this.preloadQueue.clear();
  }
}

// Status indicator component
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

  // Initialize permanent managers
  const dbManager = useMemo(() => DatabaseManager.getInstance(), []);
  const sectionRenderer = useMemo(() => new SectionRenderer(), []);

  // Generate client ID
  const generateClientId = useCallback(() => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  }, []);

  // Create user profile with database manager
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
        { maxRetries: 3, timeoutMs: 10000 }
      );

      // Create balances asynchronously (non-blocking)
      const balanceOperations = [
        "crypto_balances",
        "euro_balances",
        "cad_balances",
        "usd_balances",
      ];

      balanceOperations.forEach((table) => {
        dbManager
          .executeOperation(
            `create-balance-${table}-${user.id}`,
            async () => {
              const { error } = await supabase
                .from(table)
                .upsert(
                  { user_id: user.id, balance: 0 },
                  { onConflict: "user_id" }
                );
              if (error) throw error;
            },
            { maxRetries: 2, timeoutMs: 5000 }
          )
          .catch((error) => {
            console.warn(`Failed to create ${table}:`, error);
          });
      });

      return profile;
    },
    [dbManager, generateClientId]
  );

  // Fetch user data with database manager
  const fetchUserData = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      const userData = await dbManager.executeOperation(
        "fetch-user-auth",
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
        `fetch-profile-${userData.id}`,
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
        { maxRetries: 3, timeoutMs: 10000, useCache: true, cacheTime: 60000 }
      );

      setUserProfile(profile);
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

  // Auto-logout on inactivity
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

    const handleActivity = () => updateActivity();
    const throttledActivity = (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) return;
        timeoutId = setTimeout(() => {
          handleActivity();
          timeoutId = null;
        }, 10000); // Throttle to once per 10 seconds
      };
    })();

    events.forEach((event) => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });

    // Check for inactivity every minute
    activityTimeoutRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= IDLE_TIME) {
        console.log("Auto-logout due to inactivity");
        supabase.auth.signOut().finally(() => router.push("/"));
      }
    }, 60000);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledActivity);
      });
      if (activityTimeoutRef.current) {
        clearInterval(activityTimeoutRef.current);
      }
    };
  }, [updateActivity, router]);

  // Enhanced tab switching
  const handleTabChange = useCallback(
    (newTab: string) => {
      updateActivity();
      setActiveTab(newTab);
      // Clear section cache for fresh data
      sectionRenderer.invalidateCache(newTab);
    },
    [updateActivity, sectionRenderer]
  );

  // Initialize dashboard
  useEffect(() => {
    fetchUserData();
    updateActivity();

    const cleanup = setupActivityTracking();

    // Subscribe to database state changes
    const unsubscribe = dbManager.subscribe(setDbState);

    return () => {
      cleanup();
      unsubscribe();
    };
  }, [fetchUserData, updateActivity, setupActivityTracking, dbManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sectionRenderer.destroy();
      // Don't destroy dbManager as it's singleton
    };
  }, [sectionRenderer]);

  // Render loading state
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

  // Render error state
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

  // Render main dashboard
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
          {userProfile &&
            sectionRenderer.renderSection(activeTab, userProfile, {
              setActiveTab: handleTabChange,
            })}
        </div>
      </div>
    </div>
  );
}
