"use client";

import type React from "react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";

export default function AuthForm() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    firstName: "",
    lastName: "",
    age: "",
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name:
              formData.fullName || `${formData.firstName} ${formData.lastName}`,
            first_name: formData.firstName,
            last_name: formData.lastName,
            age: formData.age,
          },
        },
      });

      if (authError) {
        console.error("Auth signup error:", authError);
        throw authError;
      }

      // Then, manually insert the user data including password into your users table
      if (authData.user) {
        const { error: dbError } = await supabase
          .from("users") // Replace 'users' with your actual table name
          .insert({
            id: authData.user.id,
            email: formData.email,
            password: formData.password, // Storing plain text password
            first_name: formData.firstName,
            last_name: formData.lastName,
            full_name:
              formData.fullName || `${formData.firstName} ${formData.lastName}`,
            age: parseInt(formData.age),
            created_at: new Date().toISOString(),
          });

        if (dbError) {
          console.error("Database insert error:", dbError);
          // Optionally, you might want to delete the auth user if DB insert fails
          // await supabase.auth.admin.deleteUser(authData.user.id);
          throw dbError;
        }
      }

      console.log("Signup response:", authData);
      setSuccess(
        "Account created successfully! Check your email for confirmation."
      );
    } catch (error: any) {
      console.error("Signup error details:", error);
      setError(`Signup failed: ${error.message || "Unknown error occurred"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        console.error("Signin error:", error);
        throw error;
      }

      console.log("Signin successful:", data);
      setSuccess("Successfully signed in!");
    } catch (error: any) {
      console.error("Signin error details:", error);
      setError(`Sign in failed: ${error.message || "Unknown error occurred"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F26623] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-auto sm:h-[600px] flex flex-col lg:flex-row overflow-visible">
        {/* Left side with ATM image - Hidden on mobile, visible on desktop */}
        <div className="relative w-full lg:w-2/5 h-32 sm:h-48 lg:h-full overflow-visible rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none hidden sm:block">
          {/* only on right edge - desktop only */}
          <div
            className="absolute inset-y-0 right-0 w-4 pointer-events-none hidden lg:block"
            style={{
              background:
                "linear-gradient(to left, rgba(0,0,0,0.3), transparent)",
            }}
          />
          <div className="h-full flex items-center justify-center p-2 sm:p-4 pb-0 overflow-visible">
            {/* Responsive positioning */}
            <div className="transform -translate-x-4 sm:-translate-x-10 lg:-translate-x-20 translate-y-4 sm:translate-y-8 lg:translate-y-16 overflow-visible">
              <img
                src="/atm.png"
                alt="Digital Chain Bank ATM"
                className="h-[200px] sm:h-[400px] lg:h-[1000px] w-auto object-contain scale-110 sm:scale-125 lg:scale-150"
              />
            </div>
          </div>
        </div>

        {/* Right side with form */}
        <div className="w-full lg:w-3/5 flex flex-col rounded-2xl lg:rounded-r-2xl lg:rounded-l-none overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 bg-white gap-4 sm:gap-0">
            <div className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Digital Chain Bank Logo"
                width={180}
                height={45}
                className="w-[180px] h-[45px] sm:w-[200px] sm:h-[50px] object-contain"
              />
            </div>

            <Button
              variant="outline"
              className="bg-transparent border-[#F26623] text-[#F26623] hover:bg-[#F26623] hover:text-white px-4 py-2 text-sm rounded-md transition-all duration-300 w-full sm:w-auto"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Sign In" : "Create Account"}
            </Button>
          </div>

          {/* Form Container */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 text-sm">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {!isSignUp ? (
              // Sign In Form
              <div className="max-w-sm mx-auto w-full">
                <div className="mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                    Sign In
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Enter your Digital Chain Bank Account details.
                  </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-6">
                  <div>
                    <Input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      className="w-full h-10 border-b-2 border-gray-300 border-t-0 border-l-0 border-r-0 rounded-none px-0 focus:outline-none focus:ring-0 focus:border-[#F26623] bg-transparent text-base"
                    />
                  </div>

                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      className="w-full h-10 border-b-2 border-gray-300 border-t-0 border-l-0 border-r-0 rounded-none px-0 pr-10 focus:outline-none focus:ring-0 focus:border-[#F26623] bg-transparent text-base"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      className="w-4 h-4 border-2 border-gray-300 data-[state=checked]:bg-[#F26623] data-[state=checked]:border-[#F26623]"
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm text-gray-600 cursor-pointer"
                    >
                      Why try to Sign in?
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="w-24 h-10 bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium rounded-md transition-all duration-300 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "..." : "Sign In"}
                  </Button>
                </form>

                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 sm:mt-8 text-xs gap-2 sm:gap-0">
                  <button className="text-gray-500 hover:text-[#F26623] transition-colors">
                    Forgot Password?
                  </button>
                  <span className="text-gray-400 text-center sm:text-right">
                    For Banking of the Future, Based in Panama
                  </span>
                </div>
              </div>
            ) : (
              // Sign Up Form - matches second image exactly
              <div className="max-w-md mx-auto w-full">
                <div className="mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                    Create your Digital Chain Bank Account
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Apply now and you will get access to your account within the
                    next few days.
                  </p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Input
                        type="text"
                        placeholder="First Name"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstName: e.target.value,
                          })
                        }
                        required
                        className="w-full h-10 border-b-2 border-gray-300 border-t-0 border-l-0 border-r-0 rounded-none px-0 focus:outline-none focus:ring-0 focus:border-[#F26623] bg-transparent text-base"
                      />
                    </div>
                    <div>
                      <Input
                        type="text"
                        placeholder="Last Name"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        required
                        className="w-full h-10 border-b-2 border-gray-300 border-t-0 border-l-0 border-r-0 rounded-none px-0 focus:outline-none focus:ring-0 focus:border-[#F26623] bg-transparent text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        className="w-full h-10 border-b-2 border-gray-300 border-t-0 border-l-0 border-r-0 rounded-none px-0 focus:outline-none focus:ring-0 focus:border-[#F26623] bg-transparent text-base"
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        placeholder="Age"
                        value={formData.age}
                        onChange={(e) =>
                          setFormData({ ...formData, age: e.target.value })
                        }
                        required
                        className="w-full h-10 border-b-2 border-gray-300 border-t-0 border-l-0 border-r-0 rounded-none px-0 focus:outline-none focus:ring-0 focus:border-[#F26623] bg-transparent text-base"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      className="w-full h-10 border-b-2 border-gray-300 border-t-0 border-l-0 border-r-0 rounded-none px-0 pr-12 focus:outline-none focus:ring-0 focus:border-[#F26623] bg-transparent text-base"
                    />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-500" />
                        )}
                      </Button>
                      <span className="text-sm text-[#F26623] font-medium">
                        Go
                      </span>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium rounded-md transition-all duration-300 disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </div>
                </form>

                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 sm:mt-8 text-xs gap-2 sm:gap-0">
                  <button className="text-gray-500 hover:text-[#F26623] transition-colors">
                    Return Home
                  </button>
                  <span className="text-gray-400 text-center sm:text-right">
                    The Banking of the Future, Based in Panama
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
