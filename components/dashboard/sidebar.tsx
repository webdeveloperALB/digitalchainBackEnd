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

export default function Sidebar({
  activeTab,
  setActiveTab,
  userProfile,
}: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([
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

  // Function to refresh menu items from backend/database
  const refreshMenuItems = useCallback(async () => {
    if (!userProfile?.id) {
      console.log("No user profile available, skipping menu refresh");
      return;
    }

    // Prevent too frequent refreshes
    const now = Date.now();
    if (now - lastRefreshRef.current < 15000) {
      // Minimum 15 seconds between refreshes
      console.log("Skipping menu refresh - too soon since last refresh");
      return;
    }
    lastRefreshRef.current = now;

    try {
      console.log("Refreshing menu items...");
      setRefreshError(null);

      // Set a timeout for the entire refresh operation
      const refreshPromise = new Promise(async (resolve, reject) => {
        try {
          // Fetch user permissions with timeout
          let userPermissions: UserPermissionData[] = [];
          try {
            const permissionsPromise = supabase
              .from("user_permissions")
              .select("menu_item, is_enabled")
              .eq("user_id", userProfile.id);

            const { data, error } = (await Promise.race([
              permissionsPromise,
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Permissions query timeout")),
                  5000
                )
              ),
            ])) as any;

            if (error && error.code !== "PGRST116") {
              // Ignore "not found" errors
              throw error;
            } else if (data) {
              userPermissions = data;
            }
          } catch (permError) {
            console.warn("Could not fetch permissions:", permError);
            // Continue without permissions - use defaults
          }

          // Fetch notification counts with timeout
          let notifications: NotificationData[] = [];
          try {
            const notificationsPromise = supabase
              .from("notifications")
              .select("menu_item, count")
              .eq("user_id", userProfile.id)
              .eq("is_read", false);

            const { data, error } = (await Promise.race([
              notificationsPromise,
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Notifications query timeout")),
                  5000
                )
              ),
            ])) as any;

            if (error && error.code !== "PGRST116") {
              // Ignore "not found" errors
              throw error;
            } else if (data) {
              notifications = data;
            }
          } catch (notifError) {
            console.warn("Could not fetch notifications:", notifError);
            // Continue without notifications
          }

          resolve({ userPermissions, notifications });
        } catch (error) {
          reject(error);
        }
      });

      // Wait for refresh with overall timeout
      const result = (await Promise.race([
        refreshPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Menu refresh timeout")), 10000)
        ),
      ])) as any;

      // Update menu items with fresh data while preserving structure
      setMenuItems((prevItems) =>
        prevItems.map((item) => {
          // Find if there are notifications for this menu item
          const notification = result.notifications.find(
            (n: NotificationData) => n.menu_item === item.id
          );

          // Check if user has permission for this menu item
          const permission = result.userPermissions.find(
            (p: UserPermissionData) => p.menu_item === item.id
          );
          const hasPermission = permission ? permission.is_enabled : true; // Default to true if no permissions data

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
      setRefreshError(error.message);

      // If refresh fails multiple times, stop trying
      if (error.message.includes("timeout")) {
        console.warn("Menu refresh timed out, disabling auto-refresh");
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      }
    }
  }, [userProfile?.id]);

  // Set up background refresh with better error handling
  useEffect(() => {
    if (!userProfile?.id) return;

    // Initial refresh (delayed to avoid conflicts with dashboard loading)
    const initialRefresh = setTimeout(() => {
      refreshMenuItems();
    }, 2000);

    // Set up interval for background refresh (increased to 60 seconds to reduce load)
    refreshIntervalRef.current = setInterval(() => {
      // Only refresh if no errors and page is visible
      if (!refreshError && document.visibilityState === "visible") {
        refreshMenuItems();
      }
    }, 60000); // 60 seconds

    // Cleanup interval on unmount
    return () => {
      clearTimeout(initialRefresh);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [refreshMenuItems, userProfile?.id, refreshError]);

  // Refresh on visibility change (when user comes back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !refreshError) {
        // Small delay to ensure everything is ready
        setTimeout(() => {
          refreshMenuItems();
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshMenuItems, refreshError]);

  const handleSignOut = async () => {
    setIsLoggingOut(true);

    try {
      // Clear refresh interval first
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }

      // Get current user before signing out
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        console.log("Logging out user:", user.id);

        // Try to mark user as offline before signing out (with timeout)
        try {
          const timestamp = new Date().toISOString();
          const presencePromise = supabase.from("user_presence").upsert(
            {
              user_id: user.id,
              is_online: false,
              last_seen: timestamp,
              updated_at: timestamp,
            },
            {
              onConflict: "user_id",
            }
          );

          // Don't wait too long for presence update
          await Promise.race([
            presencePromise,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Presence update timeout")),
                2000
              )
            ),
          ]);

          console.log("Successfully marked user offline on logout");
        } catch (presenceError) {
          console.warn("Could not update presence on logout:", presenceError);
          // Don't block logout if presence update fails
        }
      }

      // Then sign out
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Error signing out:", error);
      } else {
        console.log("Successfully signed out");
      }
    } catch (error) {
      console.error("Error during logout process:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleMenuItemClick = (itemId: string, isEnabled: boolean) => {
    if (!isEnabled) return;

    console.log(`Menu item clicked: ${itemId}`);
    setActiveTab(itemId);
    setIsMobileMenuOpen(false); // Close mobile menu on item click
  };

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

        {/* Error indicator */}
        {/* Info indicator */}
        {refreshError && (
          <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200">
            <p className="text-xs text-yellow-700">
              For the most accurate balance and recent activity, please refresh
              the page.
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
