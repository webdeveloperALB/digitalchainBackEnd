"use client";

import { useState, useEffect } from "react";
import AdminDashboard from "@/components/admin/admin-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield } from "lucide-react";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    securityQuestion: "",
  });
  const [error, setError] = useState("");

  // Admin credentials (in production, use environment variables)
  const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "digitalchain2024",
    securityQuestion: "What is the name of the bank?", // Answer: "Digital Chain Bank"
    securityAnswer: "digital chain bank",
  };

  const handleLogin = () => {
    setError("");

    // Check credentials
    if (
      formData.username.toLowerCase() === ADMIN_CREDENTIALS.username &&
      formData.password === ADMIN_CREDENTIALS.password &&
      formData.securityQuestion.toLowerCase().includes("digital") &&
      formData.securityQuestion.toLowerCase().includes("chain")
    ) {
      setIsAuthenticated(true);
      // Store in sessionStorage for this session only
      sessionStorage.setItem("admin_authenticated", "true");
    } else {
      setError("Invalid credentials or security answer");
    }
  };

  // Remove this problematic useState:
  // useState(() => {
  //   const isAuth = sessionStorage.getItem("admin_authenticated")
  //   if (isAuth === "true") {
  //     setIsAuthenticated(true)
  //   }
  // })

  // Replace with useEffect:
  useEffect(() => {
    // Check if already authenticated on page load
    const isAuth = sessionStorage.getItem("admin_authenticated");
    if (isAuth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_authenticated");
    setFormData({ username: "", password: "", securityQuestion: "" });
  };

  if (isAuthenticated) {
    return (
      <div>
        <div className="bg-[#F26623] text-white p-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">
              Admin Panel - Digital Chain Bank
            </h1>
            <p className="text-orange-100">
              Authenticated as: {ADMIN_CREDENTIALS.username}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="text-white border-white hover:bg-white hover:text-[#F26623] bg-transparent"
          >
            Logout
          </Button>
        </div>
        <AdminDashboard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#F26623] rounded-lg flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <p className="text-gray-600">Digital Chain Bank Administration</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder="Enter admin username"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Enter admin password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="security">
              Security Question: What is the name of the bank?
            </Label>
            <Input
              id="security"
              type="text"
              value={formData.securityQuestion}
              onChange={(e) =>
                setFormData({ ...formData, securityQuestion: e.target.value })
              }
              placeholder="Enter the bank name"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={handleLogin}
            className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
            disabled={
              !formData.username ||
              !formData.password ||
              !formData.securityQuestion
            }
          >
            Access Admin Panel
          </Button>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-800 mb-2">
              Demo Credentials:
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                <strong>Username:</strong> admin
              </p>
              <p>
                <strong>Password:</strong> digitalchain2024
              </p>
              <p>
                <strong>Security Answer:</strong> Digital Chain Bank
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
