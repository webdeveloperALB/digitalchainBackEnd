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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export default function EnhancedAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalDeposits: 0,
    pendingDeposits: 0,
    totalVolume: 0,
  });

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

  return (
    <div className="min-h-screen bg-gray-50">
      <PresenceManager />
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-[#F26623] mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">
                Digital Chain Bank Admin
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-green-600">
                <Activity className="w-4 h-4 mr-1" />
                System Online
              </div>
              <Badge variant="outline" className="text-xs">
                Real-time Connected
              </Badge>
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
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="overview" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Overview
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
            <TabsTrigger value="taxes" className="flex items-center">
              <Calculator className="w-4 h-4 mr-2" />
              Taxes
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
                    System Status
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    Online
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All services running
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Admin Panel Features</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Deposit Management</h4>
                  <p className="text-sm text-gray-600">
                    Create bank and crypto deposits for users with detailed
                    forms
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Real-time Updates</h4>
                  <p className="text-sm text-gray-600">
                    Clients see deposits instantly when you create them
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">User Presence Tracking</h4>
                  <p className="text-sm text-gray-600">
                    Real-time monitoring of user online/offline status
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Activity Management</h4>
                  <p className="text-sm text-gray-600">
                    Push account activity entries to users
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Balance Management</h4>
                  <p className="text-sm text-gray-600">
                    Update user balances across all currencies
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Message System</h4>
                  <p className="text-sm text-gray-600">
                    Send targeted messages to users with different priority
                    levels
                  </p>
                </div>
              </CardContent>
            </Card>
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

          <TabsContent value="messages">
            <MessageManager />
          </TabsContent>

          <TabsContent value="users">
            <UserManagementTest />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseTest />
          </TabsContent>

          <TabsContent value="taxes">
            <TaxManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
