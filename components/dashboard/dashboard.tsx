"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "./sidebar";
import DashboardContent from "./dashboard-content";
import AccountsSection from "./accounts-section";
import TransfersSection from "./transfers-section";
import DepositsSection from "./deposits-section";
import PaymentsSection from "./payments-section";
import CardSection from "./card-section";
import CryptoSection from "./crypto-section";
import MessageSection from "./message-section";
import SupportSection from "./support-section";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const generateClientId = () => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  };

  const createUserProfile = async (user: any) => {
    try {
      const clientId = generateClientId();

      // First check if profile already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (existingProfile) {
        console.log("Profile already exists:", existingProfile);
        return existingProfile;
      }

      // Create profile manually if trigger didn't work
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          client_id: clientId,
          full_name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User",
          email: user.email,
        })
        .select()
        .single();

      if (profileError) {
        console.error("Profile creation error:", profileError);
        throw profileError;
      }

      // Create initial balances if they don't exist
      const balancePromises = [
        supabase
          .from("crypto_balances")
          .upsert({ user_id: user.id, balance: 0 }),
        supabase.from("euro_balances").upsert({ user_id: user.id, balance: 0 }),
        supabase.from("cad_balances").upsert({ user_id: user.id, balance: 0 }),
        supabase.from("usd_balances").upsert({ user_id: user.id, balance: 0 }),
      ];

      await Promise.all(balancePromises);

      console.log("Profile created successfully:", profile);
      return profile;
    } catch (error: any) {
      console.error("Error creating user profile:", error);
      // Return a basic profile object even if creation fails
      return {
        id: user.id,
        client_id: "000000",
        full_name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
      };
    }
  };

  const fetchUserData = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("User error:", userError);
        throw userError;
      }

      if (!user) {
        console.error("No user found");
        return;
      }

      console.log("Fetching data for user:", user.id);

      // Try to fetch user profile
      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // If profile doesn't exist, create it
      if (profileError && profileError.code === "PGRST116") {
        console.log("Profile not found, creating new profile...");
        profile = await createUserProfile(user);
      } else if (profileError) {
        console.error("Profile fetch error:", profileError);
        // Create a fallback profile
        profile = {
          id: user.id,
          client_id: "000000",
          full_name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User",
          email: user.email,
        };
      }

      setUserProfile(profile);
      console.log("User profile loaded:", profile);
    } catch (error) {
      console.error("Error fetching user data:", error);
      // Set fallback data
      setUserProfile({
        id: "unknown",
        client_id: "000000",
        full_name: "User",
        email: "user@example.com",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderActiveSection = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardContent userProfile={userProfile} />;
      case "accounts":
        return <AccountsSection />;
      case "transfers":
        return <TransfersSection />;
      case "deposit":
        return <DepositsSection />;
      case "payments":
        return <PaymentsSection />;
      case "card":
        return <CardSection />;
      case "crypto":
        return <CryptoSection />;
      case "message":
        return <MessageSection />;
      case "support":
        return <SupportSection />;
      default:
        return <DashboardContent userProfile={userProfile} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#F26623] rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="w-10 h-10 bg-white rounded transform rotate-45 animate-spin"></div>
          </div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userProfile={userProfile}
      />
      {renderActiveSection()}
    </div>
  );
}
