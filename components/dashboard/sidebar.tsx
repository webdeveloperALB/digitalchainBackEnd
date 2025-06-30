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

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setIsLoggingOut(false);
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
    <div className="w-64 bg-[#F5F0F0] h-screen flex flex-col">
      {/* Logo Section */}
      <div className="px-6 py-8">
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
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center px-0 py-4 text-left transition-all duration-200 text-gray-800 hover:text-[#F26623]"
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
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
