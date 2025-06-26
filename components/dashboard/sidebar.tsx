"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
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
  User,
} from "lucide-react"

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  userProfile: any
}

export default function Sidebar({ activeTab, setActiveTab, userProfile }: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    setIsLoggingOut(false)
  }

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
  ]

  return (
    <div className="w-64 bg-gray-50 h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[#F26623] rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 bg-white rounded transform rotate-45"></div>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-bold text-[#F26623]">DIGITAL</h1>
            <p className="text-sm text-gray-600">Chain Bank</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                  activeTab === item.id ? "bg-[#F26623] text-white" : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t">
        <div className="bg-[#F26623] rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-[#F26623]" />
              </div>
              <div className="ml-3">
                <p className="font-medium">{userProfile?.full_name || "Client Name"}</p>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  <span className="text-xs opacity-90">Online</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="text-white hover:bg-white/20"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
