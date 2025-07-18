"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Users,
  DollarSign,
  Mail,
  Database,
  Shield,
  Activity,
  Calculator,
  Wifi,
  Download,
  Clock,
  Lock,
  MapPin,
  Globe,
  Monitor,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import BalanceUpdater from "./balance-updater";
import MessageManager from "./message-manager";
import DatabaseTest from "./database-test";
import UserManagementTest from "./user-management-test";
import KYCAdminPanel from "./kyc-admin-panel";
import ActivityManager from "./activity-manager";
import TaxManager from "./tax-manager";
import UserPresenceTracker from "./user-presence-tracker";
import PresenceManager from "./presence-manager";
import AdminDepositCreator from "./admin-deposit-creator";

interface LocationInfo {
  ip: string;
  country: string;
  city: string;
  region: string;
  isp?: string;
  timezone?: string;
}

interface AdminSession {
  sessionId: string;
  ip: string;
  country: string;
  city: string;
  loginTime: number;
  lastActivity: number;
  isActive: boolean;
  userId: string;
}

interface LoginAttempt {
  timestamp: number;
  success: boolean;
  ip: string;
  country: string;
  sessionId?: string;
}

interface SecurityProps {
  sessionTimeLeft: number;
  sessionId: string;
  onLogout: () => void;
  loginAttempts: LoginAttempt[];
  activeSessions: AdminSession[];
  currentSessionId: string;
  onUpdateSession: (sessionId: string) => void;
}

export default function EnhancedAdminDashboard({
  sessionTimeLeft,
  sessionId,
  onLogout,
  loginAttempts,
  activeSessions,
  currentSessionId,
  onUpdateSession,
}: SecurityProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    ip: "Detecting...",
    country: "Detecting...",
    city: "Detecting...",
    region: "Detecting...",
    isp: "Unknown",
    timezone: "Unknown",
  });
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalDeposits: 0,
    pendingDeposits: 0,
    totalVolume: 0,
  });
  const [securityStats, setSecurityStats] = useState({
    activeAdminSessions: activeSessions.length,
    lastLoginTime: new Date().toISOString(),
    totalLoginAttempts: loginAttempts.length,
    successfulLogins: loginAttempts.filter((a) => a.success).length,
  });

  // Fetch location info and update session
  useEffect(() => {
    const fetchLocationAndUpdateSession = async () => {
      try {
        console.log("Dashboard: Fetching location info...");

        // Try multiple IP services in sequence
        let ipAddress: string | null = null;

        // Service 1: ipify
        try {
          const ipResponse = await fetch("https://api.ipify.org?format=json", {
            signal: AbortSignal.timeout(3000),
          });
          const ipData = await ipResponse.json();
          if (ipData.ip) {
            ipAddress = ipData.ip;
            setLocationInfo((prev) => ({ ...prev, ip: ipData.ip }));
            console.log("Got IP from ipify:", ipData.ip);
          }
        } catch (error) {
          console.log("ipify failed:", error);
        }

        // Service 2: ipapi.co if first failed
        if (!ipAddress) {
          try {
            const ipResponse = await fetch("https://ipapi.co/ip/", {
              signal: AbortSignal.timeout(3000),
            });
            const ip = await ipResponse.text();
            if (ip && ip.trim()) {
              ipAddress = ip.trim();
              setLocationInfo((prev) => ({ ...prev, ip: ipAddress! }));
              console.log("Got IP from ipapi.co:", ipAddress);
            }
          } catch (error) {
            console.log("ipapi.co IP failed:", error);
          }
        }

        // Service 3: httpbin if others failed
        if (!ipAddress) {
          try {
            const ipResponse = await fetch("https://httpbin.org/ip", {
              signal: AbortSignal.timeout(3000),
            });
            const ipData = await ipResponse.json();
            if (ipData.origin) {
              ipAddress = ipData.origin.split(",")[0].trim(); // Handle multiple IPs
              setLocationInfo((prev) => ({ ...prev, ip: ipAddress! }));
              console.log("Got IP from httpbin:", ipAddress);
            }
          } catch (error) {
            console.log("httpbin failed:", error);
          }
        }

        // Now try to get location data if we have an IP
        if (ipAddress) {
          // Try multiple location services
          let locationFound = false;

          // Location Service 1: ipapi.co
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `https://ipapi.co/${ipAddress}/json/`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (
                locationData &&
                !locationData.error &&
                locationData.country_name
              ) {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country_name || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.region || "Unknown",
                  isp: locationData.org || "Unknown",
                  timezone: locationData.timezone || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log("Got location from ipapi.co:", fullLocationInfo);
              }
            } catch (error) {
              console.log("ipapi.co location failed:", error);
            }
          }

          // Location Service 2: ip-api.com
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `http://ip-api.com/json/${ipAddress}`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (locationData && locationData.status === "success") {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.regionName || "Unknown",
                  isp: locationData.isp || "Unknown",
                  timezone: locationData.timezone || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log("Got location from ip-api.com:", fullLocationInfo);
              }
            } catch (error) {
              console.log("ip-api.com failed:", error);
            }
          }

          // Location Service 3: ipgeolocation.io (free tier)
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `https://api.ipgeolocation.io/ipgeo?apiKey=free&ip=${ipAddress}`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (locationData && locationData.country_name) {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country_name || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.state_prov || "Unknown",
                  isp: locationData.isp || "Unknown",
                  timezone: locationData.time_zone?.name || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log(
                  "Got location from ipgeolocation.io:",
                  fullLocationInfo
                );
              }
            } catch (error) {
              console.log("ipgeolocation.io failed:", error);
            }
          }

          // Location Service 4: ipinfo.io
          if (!locationFound) {
            try {
              const locationResponse = await fetch(
                `https://ipinfo.io/${ipAddress}/json`,
                {
                  signal: AbortSignal.timeout(5000),
                }
              );
              const locationData = await locationResponse.json();

              if (locationData && locationData.country) {
                const fullLocationInfo = {
                  ip: ipAddress,
                  country: locationData.country || "Unknown",
                  city: locationData.city || "Unknown",
                  region: locationData.region || "Unknown",
                  isp: locationData.org || "Unknown",
                  timezone: locationData.timezone || "Unknown",
                };

                setLocationInfo(fullLocationInfo);
                locationFound = true;
                console.log("Got location from ipinfo.io:", fullLocationInfo);
              }
            } catch (error) {
              console.log("ipinfo.io failed:", error);
            }
          }

          // If no location service worked
          if (!locationFound) {
            setLocationInfo((prev) => ({
              ...prev,
              country: "Location services unavailable",
              city: "Unable to determine",
              region: "Unknown",
            }));
            console.log("All location services failed");
          }
        } else {
          // No IP address could be determined
          setLocationInfo({
            ip: "IP detection failed",
            country: "Unable to determine",
            city: "Unknown",
            region: "Unknown",
            isp: "Unknown",
            timezone: "Unknown",
          });
          console.log("Failed to get IP address from all services");
        }
      } catch (error) {
        console.error("Dashboard: Location fetch error:", error);
        setLocationInfo((prev) => ({
          ...prev,
          ip: "Detection failed",
          country: "Service error",
          city: "Unknown",
          region: "Unknown",
        }));
      }
    };

    fetchLocationAndUpdateSession();
  }, []); // Remove sessionId dependency to avoid loops

  useEffect(() => {
    fetchSystemStats();

    // Set up real-time subscription for system stats
    const subscription = supabase
      .channel("admin_system_stats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deposits",
        },
        () => {
          fetchSystemStats();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Update security stats when login attempts or sessions change
    setSecurityStats((prev) => ({
      ...prev,
      activeAdminSessions: activeSessions.length,
      totalLoginAttempts: loginAttempts.length,
      successfulLogins: loginAttempts.filter((a) => a.success).length,
    }));
  }, [loginAttempts, activeSessions]);

  const fetchSystemStats = async () => {
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get deposit stats
      const { data: deposits } = await supabase
        .from("deposits")
        .select("amount, status");

      const totalDeposits = deposits?.length || 0;
      const pendingDeposits =
        deposits?.filter((d) => d.status.includes("Pending")).length || 0;
      const totalVolume =
        deposits?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      setSystemStats({
        totalUsers: userCount || 0,
        totalDeposits,
        pendingDeposits,
        totalVolume,
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Get session status color
  const getSessionStatusColor = () => {
    if (sessionTimeLeft < 5 * 60 * 1000) return "text-red-600"; // Less than 5 minutes
    if (sessionTimeLeft < 10 * 60 * 1000) return "text-yellow-600"; // Less than 10 minutes
    return "text-green-600";
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PresenceManager />

      {/* Enhanced Header with Current User's Location */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-[#F26623] mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Digital Chain Bank Admin
                </h1>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <span>Your Session: {sessionId.slice(0, 8)}...</span>
                  <div
                    className={`flex items-center ${getSessionStatusColor()}`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    <span>{formatTimeRemaining(sessionTimeLeft)}</span>
                  </div>
                  <div className="flex items-center">
                    <Globe className="w-3 h-3 mr-1" />
                    <span>Your IP: {locationInfo.ip}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span>Your Location: {locationInfo.country}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-green-600">
                <Activity className="w-4 h-4 mr-1" />
                System Online
              </div>
              <Badge variant="outline" className="text-xs">
                <Monitor className="w-3 h-3 mr-1" />
                {activeSessions.length} Active Sessions
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Lock className="w-3 h-3 mr-1" />
                Secure Session
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
              >
                Secure Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-11">
            <TabsTrigger value="overview" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="deposits" className="flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Deposits
            </TabsTrigger>
            <TabsTrigger value="presence" className="flex items-center">
              <Wifi className="w-4 h-4 mr-2" />
              Presence
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              KYC
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Balances
            </TabsTrigger>
            <TabsTrigger value="taxes" className="flex items-center">
              <Calculator className="w-4 h-4 mr-2" />
              Taxes
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center">
              <Database className="w-4 h-4 mr-2" />
              Database
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats.totalUsers}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Registered accounts
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Deposits
                  </CardTitle>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemStats.totalDeposits}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemStats.pendingDeposits} pending review
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Volume
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${systemStats.totalVolume.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All currencies combined
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Sessions
                  </CardTitle>
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {activeSessions.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Admin sessions online
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Your Current Session Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Your Current Session Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center">
                    <Globe className="w-4 h-4 mr-1" />
                    Your IP Address
                  </h4>
                  <p className="text-sm text-gray-600 font-mono">
                    {locationInfo.ip}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Your Country</h4>
                  <p className="text-sm text-gray-600">
                    {locationInfo.country}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Your City</h4>
                  <p className="text-sm text-gray-600">{locationInfo.city}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Your Region</h4>
                  <p className="text-sm text-gray-600">{locationInfo.region}</p>
                </div>
                {locationInfo.isp && locationInfo.isp !== "Unknown" && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Your ISP</h4>
                    <p className="text-sm text-gray-600">{locationInfo.isp}</p>
                  </div>
                )}
                {locationInfo.timezone &&
                  locationInfo.timezone !== "Unknown" && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Your Timezone</h4>
                      <p className="text-sm text-gray-600">
                        {locationInfo.timezone}
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* All Active Admin Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Monitor className="w-5 h-5 mr-2" />
                  All Active Admin Sessions ({activeSessions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className={`p-3 rounded-lg border ${
                        session.sessionId === currentSessionId
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm font-medium">
                              {session.sessionId === currentSessionId
                                ? "Your Session"
                                : "Admin Session"}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 font-mono">
                            {session.ip}
                          </div>
                          <div className="text-sm text-gray-600">
                            {session.country}
                          </div>
                          <div className="text-sm text-gray-600">
                            {session.city}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            Login: {formatTimeAgo(session.loginTime)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Active: {formatTimeAgo(session.lastActivity)}
                          </span>
                          {session.sessionId === currentSessionId && (
                            <Badge variant="default" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeSessions.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No active sessions
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Enhanced Multi-User Admin Panel Features</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">🔒 Multi-Admin Support</h4>
                  <p className="text-sm text-gray-600">
                    Multiple administrators can access simultaneously with
                    cross-tab session sync
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">🌍 Real-time Geolocation</h4>
                  <p className="text-sm text-gray-600">
                    Each admin sees their own IP address and location
                    information in real-time
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">💳 Deposit Management</h4>
                  <p className="text-sm text-gray-600">
                    Create bank and crypto deposits for users with detailed
                    forms
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">⚡ Real-time Updates</h4>
                  <p className="text-sm text-gray-600">
                    Clients see deposits instantly when you create them
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">👥 User Presence Tracking</h4>
                  <p className="text-sm text-gray-600">
                    Real-time monitoring of user online/offline status
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">📊 Activity Management</h4>
                  <p className="text-sm text-gray-600">
                    Push account activity entries to users
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">💰 Balance Management</h4>
                  <p className="text-sm text-gray-600">
                    Update user balances across all currencies
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">🛡️ Session Security</h4>
                  <p className="text-sm text-gray-600">
                    Individual session management with automatic cleanup and
                    persistence
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enhanced Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Your Session Time
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${getSessionStatusColor()}`}
                  >
                    {formatTimeRemaining(sessionTimeLeft)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Time remaining
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Your IP</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold font-mono">
                    {locationInfo.ip}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your real IP address
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Your Location
                  </CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {locationInfo.country}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locationInfo.city}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Sessions
                  </CardTitle>
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activeSessions.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total admin sessions
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Features Active</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Multi-Admin Support</span>
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cross-Tab Session Sync</span>
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Real IP Detection</span>
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Geolocation Tracking</span>
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Session Timeout</span>
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      30 min
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Inactivity Detection</span>
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      10 min
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Account Lockout</span>
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      3 attempts
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Login Attempts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loginAttempts
                      .slice(-5)
                      .reverse()
                      .map((attempt, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                attempt.success ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            <span className="text-sm">
                              {new Date(attempt.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              {attempt.ip}
                            </span>
                            <span className="text-xs text-gray-500">
                              {attempt.country}
                            </span>
                            {attempt.sessionId === currentSessionId && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <Badge
                            variant={
                              attempt.success ? "default" : "destructive"
                            }
                            className="text-xs"
                          >
                            {attempt.success ? "Success" : "Failed"}
                          </Badge>
                        </div>
                      ))}
                    {loginAttempts.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No login attempts recorded
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="deposits">
            <AdminDepositCreator />
          </TabsContent>

          <TabsContent value="presence">
            <UserPresenceTracker />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityManager />
          </TabsContent>

          <TabsContent value="kyc">
            <KYCAdminPanel />
          </TabsContent>

          <TabsContent value="balances">
            <BalanceUpdater />
          </TabsContent>

          <TabsContent value="taxes">
            <TaxManager />
          </TabsContent>

          <TabsContent value="messages">
            <MessageManager />
          </TabsContent>

          <TabsContent value="users">
            <UserManagementTest />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseTest />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
