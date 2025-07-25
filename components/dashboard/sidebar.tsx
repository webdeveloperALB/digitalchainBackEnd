"use client";
import { useState, useEffect, useCallback } from "react";
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

    try {
      // Fetch user permissions with error handling
      let userPermissions: UserPermissionData[] = [];
      try {
        const { data, error } = await supabase
          .from("user_permissions")
          .select("menu_item, is_enabled")
          .eq("user_id", userProfile.id);

        if (error) {
          console.warn("Could not fetch user permissions:", error.message);
          // If table doesn't exist or other error, use default permissions
        } else if (data) {
          userPermissions = data;
        }
      } catch (permError) {
        console.warn("Error fetching permissions:", permError);
      }

      // Fetch notification counts with error handling
      let notifications: NotificationData[] = [];
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("menu_item, count")
          .eq("user_id", userProfile.id)
          .eq("is_read", false);

        if (error) {
          console.warn("Could not fetch notifications:", error.message);
          // If table doesn't exist or other error, continue without notifications
        } else if (data) {
          notifications = data;
        }
      } catch (notifError) {
        console.warn("Error fetching notifications:", notifError);
      }

      // Update menu items with fresh data while preserving structure
      setMenuItems((prevItems) =>
        prevItems.map((item) => {
          // Find if there are notifications for this menu item
          const notification = notifications.find(
            (n) => n.menu_item === item.id
          );

          // Check if user has permission for this menu item
          const permission = userPermissions.find(
            (p) => p.menu_item === item.id
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
    } catch (error) {
      // Silent error handling - don't disrupt user experience
      console.error("Background menu refresh failed:", error);
    }
  }, [userProfile?.id]);

  // Set up background refresh every 30 seconds (reduced frequency)
  useEffect(() => {
    // Initial refresh
    refreshMenuItems();

    // Set up interval for background refresh (increased to 30 seconds to reduce load)
    const refreshInterval = setInterval(() => {
      refreshMenuItems();
    }, 30000); // 30 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, [refreshMenuItems]);

  const handleSignOut = async () => {
    setIsLoggingOut(true);

    try {
      // Get current user before signing out
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        console.log("Logging out user:", user.id);

        // Try to mark user as offline before signing out
        try {
          const timestamp = new Date().toISOString();
          const { error: presenceError } = await supabase
            .from("user_presence")
            .upsert(
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

          if (presenceError) {
            console.warn(
              "Could not update presence on logout:",
              presenceError.message
            );
          } else {
            console.log("Successfully marked user offline on logout");
          }
        } catch (presenceError) {
          console.warn("Error updating presence on logout:", presenceError);
        }

        // Small delay to ensure the presence update completes
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Then sign out
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Error signing out:", error);
      } else {
        console.log("Successfully signed out");
        // The auth state change will be handled by your auth provider
      }
    } catch (error) {
      console.error("Error during logout process:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
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

        {/* Navigation Menu */}
        <nav
          className="flex-1 px-6 overflow-y-auto scrollbar-hide"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style jsx>{`
            nav::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <ul className="space-y-1 py-4">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    if (item.isEnabled) {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false); // Close mobile menu on item click
                    }
                  }}
                  disabled={!item.isEnabled}
                  className={`w-full flex items-center px-0 py-4 text-left transition-all duration-200 relative ${
                    activeTab === item.id
                      ? "text-[#F26623]"
                      : item.isEnabled
                      ? "text-gray-800 hover:text-[#F26623]"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <item.icon
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
