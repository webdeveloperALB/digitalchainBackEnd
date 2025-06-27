"use client";

import { useState } from "react";
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
} from "lucide-react";
import BalanceUpdater from "./balance-updater";
import MessageManager from "./message-manager";
import DatabaseTest from "./database-test";
import UserManagementTest from "./user-management-test";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-50">
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Overview
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
                  <div className="text-2xl font-bold">Active</div>
                  <p className="text-xs text-muted-foreground">
                    All user accounts operational
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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Database
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    Connected
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supabase operational
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Messages
                  </CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Ready</div>
                  <p className="text-xs text-muted-foreground">
                    Messaging system active
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
                  <h4 className="font-medium">Balance Management</h4>
                  <p className="text-sm text-gray-600">
                    Update user balances across all currencies (USD, EUR, CAD,
                    Crypto)
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Message System</h4>
                  <p className="text-sm text-gray-600">
                    Send targeted messages to users with different priority
                    levels
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">User Management</h4>
                  <p className="text-sm text-gray-600">
                    View and manage user accounts, test isolation features
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Database Tools</h4>
                  <p className="text-sm text-gray-600">
                    Test database connectivity and run system diagnostics
                  </p>
                </div>
              </CardContent>
            </Card>
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
        </Tabs>
      </div>
    </div>
  );
}
