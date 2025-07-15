"use client";
import { useState } from "react";
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
} from "lucide-react";
import Image from "next/image";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userProfile: any;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  userProfile,
}: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);

    try {
      // Get current user before signing out
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        console.log("Logging out user:", user.id);

        // Mark user as offline before signing out
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
          console.error("Error updating presence on logout:", presenceError);
        } else {
          console.log("Successfully marked user offline on logout");
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

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "Accounts", icon: Wallet },
    { id: "transfers", label: "Transfers", icon: ArrowLeftRight },
    { id: "deposit", label: "Deposit", icon: Download },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "card", label: "Card", icon: CreditCard },
    { id: "crypto", label: "Crypto", icon: Bitcoin },
    { id: "message", label: "Message", icon: MessageSquare },
    { id: "support", label: "Support", icon: HelpCircle },
  ];

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
    `}
      >
        {/* Logo Section */}
        <div className="px-6 pt-16 md:pt-0">
          <div className="flex items-center">
            <Image
              src="/logo.svg"
              alt="Digital Chain Bank Logo"
              width={160}
              height={96}
              className="mr-3 w-[160px] h-[96px] object-contain"
            />
            {/* your text or other elements */}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-6">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false); // Close mobile menu on item click
                  }}
                  className={`w-full flex items-center px-0 py-4 text-left transition-all duration-200 ${
                    activeTab === item.id
                      ? "text-[#F26623]"
                      : "text-gray-800 hover:text-[#F26623]"
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-4 text-gray-600" />
                  <span className="font-medium text-base">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Client Profile Section */}
        <div className="p-6">
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
