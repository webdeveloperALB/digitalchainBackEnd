"use client";
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
  icon: any;
  isEnabled?: boolean;
  badge?: string | number;
}

// Default menu items - fallback when database fails
const DEFAULT_MENU_ITEMS: MenuItem[] = [
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
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  userProfile,
}: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DEFAULT_MENU_ITEMS);
  const [connectionHealth, setConnectionHealth] = useState<
    "healthy" | "degraded" | "offline"
  >("healthy");

  // Refs for cleanup and state management
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);

  // Enhanced database query with retry logic and better error handling
  const executeWithRetry = useCallback(
    async (
      operation: () => Promise<any>,
      maxRetries: number = 2,
      timeout: number = 8000
    ): Promise<any> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Create timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Operation timeout")), timeout);
          });

          // Execute operation with timeout
          const result = await Promise.race([operation(), timeoutPromise]);

          // Reset retry count on success
          retryCountRef.current = 0;
          setConnectionHealth("healthy");

          return result;
        } catch (error: any) {
          lastError = error;
          console.warn(
            `Attempt ${attempt + 1}/${maxRetries + 1} failed:`,
            error.message
          );

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempt) * 1000)
            );
          }
        }
      }

      // All attempts failed
      retryCountRef.current++;
      if (retryCountRef.current >= 3) {
        setConnectionHealth("offline");
      } else {
        setConnectionHealth("degraded");
      }

      console.error("All retry attempts failed:", lastError);
      return null;
    },
    []
  );

  // Robust function to refresh menu items
  const refreshMenuItems = useCallback(async () => {
    if (!userProfile?.id || isRefreshingRef.current) {
      return;
    }

    // Prevent too frequent refreshes
    const now = Date.now();
    if (now - lastRefreshRef.current < 10000) {
      return;
    }

    lastRefreshRef.current = now;
    isRefreshingRef.current = true;

    try {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      console.log("Refreshing menu items...");

      // Fetch permissions with retry logic
      const userPermissions = await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from("user_permissions")
          .select("menu_item, is_enabled")
          .eq("user_id", userProfile.id)
          .abortSignal(abortControllerRef.current!.signal);

        if (error && error.code !== "PGRST116") {
          throw error;
        }
        return data || [];
      });

      // Fetch notifications with retry logic
      const notifications = await executeWithRetry(async () => {
        const { data, error } = await supabase
          .from("notifications")
          .select("menu_item, count")
          .eq("user_id", userProfile.id)
          .eq("is_read", false)
          .abortSignal(abortControllerRef.current!.signal);

        if (error && error.code !== "PGRST116") {
          throw error;
        }
        return data || [];
      });

      // Update menu items - always succeeds even if database calls failed
      setMenuItems((prevItems) =>
        prevItems.map((item) => {
          // Find notifications for this menu item
          const notification = notifications?.find(
            (n: NotificationData) => n.menu_item === item.id
          );

          // Check user permissions for this menu item
          const permission = userPermissions?.find(
            (p: UserPermissionData) => p.menu_item === item.id
          );

          // Default to enabled if no permissions data or if database failed
          const hasPermission =
            userPermissions === null
              ? true
              : permission
              ? permission.is_enabled
              : true;

          return {
            ...item,
            isEnabled: hasPermission,
            badge:
              notification && notification.count && notification.count > 0
                ? notification.count
                : undefined,
          };
        })
      );

      console.log("Menu items refreshed successfully");
    } catch (error: any) {
      console.error("Menu refresh failed:", error);

      // On critical failure, ensure menu items are still usable
      setMenuItems(DEFAULT_MENU_ITEMS);
      setConnectionHealth("degraded");
    } finally {
      isRefreshingRef.current = false;
    }
  }, [userProfile?.id, executeWithRetry]);

  // Enhanced background refresh with better error handling
  useEffect(() => {
    if (!userProfile?.id) return;

    // Initial refresh with delay
    const initialTimeout = setTimeout(() => {
      refreshMenuItems();
    }, 1500);

    // Set up interval for background refresh
    const intervalId = setInterval(() => {
      // Only refresh if page is visible and not already refreshing
      if (document.visibilityState === "visible" && !isRefreshingRef.current) {
        refreshMenuItems();
      }
    }, 45000); // 45 seconds - reduced frequency to prevent overload

    refreshIntervalRef.current = intervalId;

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isRefreshingRef.current = false;
    };
  }, [refreshMenuItems, userProfile?.id]);

  // Handle visibility change for reconnection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        connectionHealth !== "healthy"
      ) {
        // Reset connection health and try to refresh
        setTimeout(() => {
          refreshMenuItems();
        }, 2000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshMenuItems, connectionHealth]);

  // Enhanced sign out with better error handling
  const handleSignOut = async () => {
    setIsLoggingOut(true);

    try {
      // Clean up intervals and requests
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        console.log("Logging out user:", user.id);

        // Try to update presence (don't block logout if it fails)
        try {
          await executeWithRetry(
            async () => {
              const timestamp = new Date().toISOString();
              const { error } = await supabase.from("user_presence").upsert(
                {
                  user_id: user.id,
                  is_online: false,
                  last_seen: timestamp,
                  updated_at: timestamp,
                },
                { onConflict: "user_id" }
              );
              if (error) throw error;
            },
            1,
            3000
          ); // Single retry, 3 second timeout
        } catch (error) {
          console.warn("Could not update presence on logout:", error);
        }
      }

      // Sign out - this should always work
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
        // Force logout by clearing local session
        await supabase.auth.signOut({ scope: "local" });
      }

      console.log("Successfully signed out");
    } catch (error) {
      console.error("Error during logout process:", error);
      // Force logout even if there were errors
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (finalError) {
        console.error("Could not perform local logout:", finalError);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Enhanced menu item click handler
  const handleMenuItemClick = useCallback(
    (itemId: string, isEnabled: boolean) => {
      if (!isEnabled) return;

      console.log(`Menu item clicked: ${itemId}`);

      // Always update active tab immediately for responsive UI
      setActiveTab(itemId);
      setIsMobileMenuOpen(false);

      // Optional: Trigger a refresh of menu items to ensure fresh data
      if (connectionHealth === "degraded" || connectionHealth === "offline") {
        setTimeout(() => {
          refreshMenuItems();
        }, 500);
      }
    },
    [setActiveTab, connectionHealth, refreshMenuItems]
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

        {/* Connection Status Indicator */}
        {connectionHealth !== "healthy" && (
          <div
            className={`px-4 py-2 border-b ${
              connectionHealth === "degraded"
                ? "bg-yellow-50 border-yellow-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <p
              className={`text-xs ${
                connectionHealth === "degraded"
                  ? "text-yellow-700"
                  : "text-red-700"
              }`}
            >
              {connectionHealth === "degraded"
                ? "Limited connectivity - some features may be delayed"
                : "Working offline - functionality may be limited"}
            </p>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 px-6 overflow-y-auto scrollbar-hide">
          <ul className="space-y-1 py-4 min-h-0">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() =>
                    handleMenuItemClick(item.id, item.isEnabled ?? true)
                  }
                  disabled={!(item.isEnabled ?? true)}
                  className={`w-full flex items-center px-0 py-4 text-left transition-all duration-200 relative ${
                    activeTab === item.id
                      ? "text-[#F26623]"
                      : item.isEnabled ?? true
                      ? "text-gray-800 hover:text-[#F26623]"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <item.icon
                    className={`w-5 h-5 mr-4 ${
                      item.isEnabled ?? true ? "text-gray-600" : "text-gray-400"
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
            ))}
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
                <div
                  className={`w-2 h-2 rounded-full ml-3 ${
                    connectionHealth === "healthy"
                      ? "bg-green-400"
                      : connectionHealth === "degraded"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                  }`}
                ></div>
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
