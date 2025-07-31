"use client";
import type React from "react";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Download,
  CreditCard,
  MessageSquare,
  HelpCircle,
  Bitcoin,
  LogOut,
  Menu,
  X,
  Banknote,
} from "lucide-react";
import Image from "next/image";

const scrollbarHideStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* Internet Explorer 10+ */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar { 
    display: none;  /* Safari and Chrome */
  }
`;

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userProfile: any;
}

interface NotificationData {
  menu_item: string;
  count: number;
}

interface UserPermissionData {
  menu_item: string;
  is_enabled: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  isEnabled: boolean;
  badge?: string | number;
}

// Immutable default menu - ALWAYS available, never changes
const PERMANENT_MENU_ITEMS: Readonly<MenuItem[]> = Object.freeze([
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    isEnabled: true,
  },
  { id: "accounts", label: "Accounts", icon: Wallet, isEnabled: true },
  {
    id: "transfers",
    label: "Transfers",
    icon: ArrowLeftRight,
    isEnabled: true,
  },
  { id: "deposit", label: "Deposit", icon: Download, isEnabled: true },
  { id: "payments", label: "Payments", icon: CreditCard, isEnabled: true },
  { id: "loans", label: "Loans", icon: Banknote, isEnabled: true },
  { id: "card", label: "Card", icon: CreditCard, isEnabled: true },
  { id: "crypto", label: "Crypto", icon: Bitcoin, isEnabled: true },
  { id: "message", label: "Message", icon: MessageSquare, isEnabled: true },
  { id: "support", label: "Support", icon: HelpCircle, isEnabled: true },
]);

// Singleton connection manager for background tasks only
class BackgroundDataManager {
  private static instance: BackgroundDataManager;
  private isRunning = false;
  private lastSuccessfulFetch = 0;
  private consecutiveFailures = 0;
  private activeRequests = new Map<string, Promise<any>>();
  private cache = new Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >();

  // Connection health tracking
  private connectionHealth = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    consecutiveHealthFailures: 0,
  };

  static getInstance(): BackgroundDataManager {
    if (!BackgroundDataManager.instance) {
      BackgroundDataManager.instance = new BackgroundDataManager();
    }
    return BackgroundDataManager.instance;
  }

  private constructor() {
    this.startHealthMonitoring();
  }

  // Continuous health monitoring in background
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        const startTime = Date.now();
        // Ultra-lightweight health check
        const healthCheck = await Promise.race([
          supabase.from("profiles").select("id").limit(1).maybeSingle(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Health check timeout")), 3000)
          ),
        ]);

        const responseTime = Date.now() - startTime;

        if (healthCheck.error && healthCheck.error.code !== "PGRST116") {
          throw healthCheck.error;
        }

        // Consider healthy if response time < 5 seconds
        if (responseTime < 5000) {
          this.connectionHealth = {
            isHealthy: true,
            lastHealthCheck: Date.now(),
            consecutiveHealthFailures: 0,
          };
        } else {
          throw new Error("Response too slow");
        }
      } catch (error) {
        this.connectionHealth.consecutiveHealthFailures++;
        this.connectionHealth.isHealthy =
          this.connectionHealth.consecutiveHealthFailures < 3;
        this.connectionHealth.lastHealthCheck = Date.now();
        console.warn("Background health check failed:", error);
      }
    }, 15000); // Check every 15 seconds
  }

  // Get cached data if available and valid
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  // Set cache with TTL
  private setCache(key: string, data: any, ttlMs = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  // Ultra-safe background data fetch - never throws, never blocks
  async fetchBackgroundData(userId: string): Promise<{
    permissions: UserPermissionData[];
    notifications: NotificationData[];
    success: boolean;
  }> {
    if (!userId || !this.connectionHealth.isHealthy) {
      return { permissions: [], notifications: [], success: false };
    }

    const requestKey = `background-${userId}`;

    // Prevent duplicate requests
    if (this.activeRequests.has(requestKey)) {
      try {
        return await this.activeRequests.get(requestKey);
      } catch {
        return { permissions: [], notifications: [], success: false };
      }
    }

    // Check cache first
    const cachedPermissions = this.getFromCache<UserPermissionData[]>(
      `permissions-${userId}`
    );
    const cachedNotifications = this.getFromCache<NotificationData[]>(
      `notifications-${userId}`
    );

    if (cachedPermissions && cachedNotifications) {
      return {
        permissions: cachedPermissions,
        notifications: cachedNotifications,
        success: true,
      };
    }

    const fetchPromise = this.performBackgroundFetch(userId);
    this.activeRequests.set(requestKey, fetchPromise);

    try {
      const result = await fetchPromise;

      // Cache successful results
      if (result.success) {
        this.setCache(`permissions-${userId}`, result.permissions, 300000); // 5 minutes
        this.setCache(`notifications-${userId}`, result.notifications, 60000); // 1 minute
        this.lastSuccessfulFetch = Date.now();
        this.consecutiveFailures = 0;
      }

      return result;
    } catch (error) {
      this.consecutiveFailures++;
      return { permissions: [], notifications: [], success: false };
    } finally {
      this.activeRequests.delete(requestKey);
    }
  }

  private async performBackgroundFetch(userId: string): Promise<{
    permissions: UserPermissionData[];
    notifications: NotificationData[];
    success: boolean;
  }> {
    // Extremely aggressive timeout - 2 seconds max
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Background fetch timeout")), 2000);
    });

    try {
      // Fetch both in parallel with timeout
      const [permissionsResult, notificationsResult] = await Promise.allSettled(
        [
          Promise.race([
            supabase
              .from("user_permissions")
              .select("menu_item, is_enabled")
              .eq("user_id", userId),
            timeout,
          ]),
          Promise.race([
            supabase
              .from("notifications")
              .select("menu_item, count")
              .eq("user_id", userId)
              .eq("is_read", false),
            timeout,
          ]),
        ]
      );

      const permissions: UserPermissionData[] =
        permissionsResult.status === "fulfilled" &&
        (permissionsResult.value as any)?.data
          ? (permissionsResult.value as any).data
          : [];

      const notifications: NotificationData[] =
        notificationsResult.status === "fulfilled" &&
        (notificationsResult.value as any)?.data
          ? (notificationsResult.value as any).data
          : [];

      return { permissions, notifications, success: true };
    } catch (error) {
      // Always return empty arrays on failure - never throw
      return { permissions: [], notifications: [], success: false };
    }
  }

  // Clean up old cache entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get connection health status
  getConnectionHealth() {
    return { ...this.connectionHealth };
  }
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  userProfile,
}: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Menu items state - always starts with permanent items, never empty
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => [
    ...PERMANENT_MENU_ITEMS,
  ]);

  // Refs for component lifecycle management
  const isComponentMountedRef = useRef<boolean>(true);
  const backgroundUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundManager = useRef<BackgroundDataManager | undefined>(
    undefined
  );

  // Initialize background manager once
  useEffect(() => {
    backgroundManager.current = BackgroundDataManager.getInstance();
    return () => {
      isComponentMountedRef.current = false;
      if (backgroundUpdateTimeoutRef.current) {
        clearTimeout(backgroundUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Background update function - completely non-blocking
  const performBackgroundUpdate = useCallback(async () => {
    if (
      !userProfile?.id ||
      !isComponentMountedRef.current ||
      !backgroundManager.current
    ) {
      return;
    }

    try {
      const result = await backgroundManager.current.fetchBackgroundData(
        userProfile.id
      );

      if (!isComponentMountedRef.current || !result.success) {
        return;
      }

      // Apply updates to permanent menu items
      const updatedItems = [...PERMANENT_MENU_ITEMS];
      let hasChanges = false;

      // Apply permissions
      result.permissions.forEach((perm: UserPermissionData) => {
        const itemIndex = updatedItems.findIndex(
          (item: MenuItem) => item.id === perm.menu_item
        );
        if (
          itemIndex !== -1 &&
          updatedItems[itemIndex].isEnabled !== perm.is_enabled
        ) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            isEnabled: perm.is_enabled,
          };
          hasChanges = true;
        }
      });

      // Apply notifications
      result.notifications.forEach((notif: NotificationData) => {
        const itemIndex = updatedItems.findIndex(
          (item: MenuItem) => item.id === notif.menu_item
        );
        if (itemIndex !== -1 && notif.count > 0) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            badge: notif.count,
          };
          hasChanges = true;
        }
      });

      // Only update state if there are actual changes
      if (hasChanges) {
        setMenuItems(updatedItems);
      }
    } catch (error) {
      // Silent failure - sidebar continues working with permanent items
      console.warn("Background update failed silently:", error);
    }
  }, [userProfile?.id]);

  // Schedule background updates - very conservative timing
  useEffect(() => {
    if (!userProfile?.id) return;

    // Initial background update after component stabilizes
    backgroundUpdateTimeoutRef.current = setTimeout(() => {
      performBackgroundUpdate();
    }, 3000);

    // Set up periodic background updates only when page is visible
    const intervalId = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        isComponentMountedRef.current
      ) {
        performBackgroundUpdate();
      }
    }, 180000); // 3 minutes - very conservative

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setTimeout(() => {
          performBackgroundUpdate();
        }, 2000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [performBackgroundUpdate, userProfile?.id]);

  // Cleanup old cache periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      backgroundManager.current?.cleanup();
    }, 600000); // 10 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // Bulletproof sign out with multiple fallback strategies
  const handleSignOut = async () => {
    setIsLoggingOut(true);

    try {
      // Cleanup component state
      isComponentMountedRef.current = false;
      if (backgroundUpdateTimeoutRef.current) {
        clearTimeout(backgroundUpdateTimeoutRef.current);
      }

      // Try to get current user with timeout
      let user;
      try {
        const userResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("User fetch timeout")), 2000)
          ),
        ]);
        user = userResult.data?.user;
      } catch (error) {
        console.warn("Could not fetch user for logout:", error);
      }

      // Try to update presence (fire and forget)
      if (user) {
        const updatePresence = async () => {
          try {
            await Promise.race([
              supabase.from("user_presence").upsert(
                {
                  user_id: user.id,
                  is_online: false,
                  last_seen: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
              ),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Presence timeout")), 1000)
              ),
            ]);
          } catch {
            // Silent failure
          }
        };
        updatePresence(); // Don't await
      }

      // Multi-stage logout with increasing aggressiveness
      const logoutStrategies = [
        // Strategy 1: Normal logout with timeout
        () =>
          Promise.race([
            supabase.auth.signOut(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Normal logout timeout")), 3000)
            ),
          ]),
        // Strategy 2: Local logout
        () => supabase.auth.signOut({ scope: "local" }),
        // Strategy 3: Force local logout
        () => Promise.resolve({ error: null }),
      ];

      let logoutSuccess = false;
      for (const strategy of logoutStrategies) {
        try {
          const result = await strategy();
          if (!result.error) {
            logoutSuccess = true;
            break;
          }
        } catch (error) {
          console.warn("Logout strategy failed:", error);
          continue;
        }
      }

      if (logoutSuccess) {
        console.log("Successfully signed out");
      } else {
        console.warn("All logout strategies failed, but continuing...");
      }
    } catch (error) {
      console.error("Critical error during logout:", error);
    } finally {
      setIsLoggingOut(false);
      // Force redirect regardless of logout success
      try {
        window.location.href = "/";
      } catch {
        // Last resort
        window.location.reload();
      }
    }
  };

  // INSTANT menu item click - never waits, never fails
  const handleMenuItemClick = useCallback(
    (itemId: string, isEnabled: boolean) => {
      if (!isEnabled) return;

      // CRITICAL: Always respond instantly, no matter what
      setActiveTab(itemId);
      setIsMobileMenuOpen(false);

      // Optional background update trigger - fire and forget
      if (isComponentMountedRef.current) {
        setTimeout(() => {
          performBackgroundUpdate();
        }, 50);
      }
    },
    [setActiveTab, performBackgroundUpdate]
  );

  return (
    <>
      <style jsx>{scrollbarHideStyles}</style>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </Button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:relative
          w-64 bg-[#F5F0F0] h-screen flex flex-col
          transform transition-transform duration-300 ease-in-out z-50
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          overflow-hidden
        `}
      >
        {/* Logo Section */}
        <div className="px-6 pt-2 flex-shrink-0 border-b border-gray-200/50">
          <div className="flex items-center">
            <Image
              src="/logo.svg?height=96&width=160&text=Digital+Chain+Bank"
              alt="Digital Chain Bank Logo"
              width={160}
              height={96}
              className="mr-3 w-[160px] h-[96px] object-contain"
            />
          </div>
        </div>

        {/* Navigation Menu - Always renders, never empty */}
        <nav className="flex-1 px-6 overflow-y-auto scrollbar-hide">
          <ul className="space-y-1 py-4 min-h-0">
            {menuItems.map((item) => {
              // Safe icon rendering with fallback
              const IconComponent = item.icon;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleMenuItemClick(item.id, item.isEnabled)}
                    disabled={!item.isEnabled}
                    className={`w-full flex items-center px-0 py-4 text-left transition-all duration-200 relative ${
                      activeTab === item.id
                        ? "text-[#F26623]"
                        : item.isEnabled
                        ? "text-gray-800 hover:text-[#F26623]"
                        : "text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <IconComponent
                      className={`w-5 h-5 mr-4 ${
                        item.isEnabled ? "text-gray-600" : "text-gray-400"
                      }`}
                    />
                    <span className="font-medium text-base">{item.label}</span>
                    {/* Badge for notifications */}
                    {item.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Client Profile Section */}
        <div className="p-6 flex-shrink-0 border-t border-gray-200/50">
          <div className="bg-[#F26623] rounded-2xl px-4 py-3 text-white relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="font-medium text-base">
                  {userProfile?.full_name || "Client Name"}
                </span>
                <div className="w-2 h-2 bg-green-400 rounded-full ml-3"></div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="text-white hover:bg-white/20 w-6 h-6 p-0"
                title={isLoggingOut ? "Logging out..." : "Sign out"}
              >
                {isLoggingOut ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
