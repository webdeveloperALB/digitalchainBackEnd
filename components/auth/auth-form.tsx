"use client"

import type React from "react"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"

export default function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    firstName: "",
    lastName: "",
    age: "",
  })

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName || `${formData.firstName} ${formData.lastName}`,
            first_name: formData.firstName,
            last_name: formData.lastName,
            age: formData.age,
          },
        },
      })

      if (error) {
        console.error("Signup error:", error)
        throw error
      }

      console.log("Signup response:", data)
      setSuccess("Check your email for the confirmation link!")
    } catch (error: any) {
      console.error("Signup error details:", error)
      setError(`Signup failed: ${error.message || "Unknown error occurred"}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        console.error("Signin error:", error)
        throw error
      }

      console.log("Signin successful:", data)
      setSuccess("Successfully signed in!")
    } catch (error: any) {
      console.error("Signin error details:", error)
      setError(`Sign in failed: ${error.message || "Unknown error occurred"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F26623] via-[#E55A1F] to-[#D4501B] flex">
      {/* Left side with ATM image */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-black/10 rounded-r-3xl"></div>
        <div className="w-full max-w-md relative z-10">
          <img src="/atm.png" alt="Digital Chain Bank ATM" className="w-full h-auto drop-shadow-2xl" />
        </div>
        {/* Decorative elements */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-32 right-20 w-24 h-24 bg-white/5 rounded-full blur-lg"></div>
      </div>

      {/* Right side with form */}
      <div className="w-full lg:w-1/2 flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 lg:p-8 relative z-10">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-3 shadow-lg">
              <div className="w-7 h-7 bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded transform rotate-45"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white drop-shadow-sm">DIGITAL</h1>
              <p className="text-sm text-white/90 font-medium">Chain Bank</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white hover:text-[#F26623] px-6 py-2 text-sm font-medium rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Sign In" : "Create Account"}
          </Button>
        </div>

        {/* Form Container */}
        <div className="flex-1 bg-white rounded-tl-3xl lg:rounded-tl-none lg:rounded-l-3xl p-8 lg:p-12 shadow-2xl relative">
          {/* Decorative gradient overlay */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F26623] via-[#E55A1F] to-[#F26623] rounded-t-3xl lg:rounded-tl-none lg:rounded-l-3xl"></div>

          {error && (
            <Alert
              variant="destructive"
              className="mb-6 border-red-200 bg-red-50 animate-in slide-in-from-top-2 duration-300"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50 animate-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 font-medium">{success}</AlertDescription>
            </Alert>
          )}

          {!isSignUp ? (
            // Enhanced Sign In Form
            <div className="max-w-md mx-auto animate-in fade-in-50 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h2>
                <p className="text-gray-600">Enter your Digital Chain Bank Account details.</p>
                <div className="w-16 h-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F] mx-auto mt-4 rounded-full"></div>
              </div>

              <form onSubmit={handleSignIn} className="space-y-8">
                <div className="relative group">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full h-12 border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-[#F26623] focus:ring-0 px-0 placeholder:text-gray-400 text-gray-900 transition-all duration-300 group-hover:border-gray-300"
                  />
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#F26623] to-[#E55A1F] transition-all duration-300 group-focus-within:w-full"></div>
                </div>

                <div className="relative group">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full h-12 border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-[#F26623] focus:ring-0 px-0 pr-10 placeholder:text-gray-400 text-gray-900 transition-all duration-300 group-hover:border-gray-300"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#F26623]/10 rounded-full transition-all duration-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#F26623] to-[#E55A1F] transition-all duration-300 group-focus-within:w-full"></div>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="remember"
                    className="w-5 h-5 border-2 border-gray-300 data-[state=checked]:bg-[#F26623] data-[state=checked]:border-[#F26623] rounded transition-all duration-200"
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600 font-medium cursor-pointer">
                    Why try to Sign in?
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-40 h-12 bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D4501B] text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="flex justify-between items-center mt-12 text-sm">
                <button className="text-gray-500 hover:text-[#F26623] font-medium transition-colors duration-200 hover:underline">
                  Forgot Password?
                </button>
                <span className="text-gray-400 text-xs">For Banking of the Future, Based in Panama</span>
              </div>
            </div>
          ) : (
            // Enhanced Sign Up Form
            <div className="max-w-lg mx-auto animate-in fade-in-50 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Create your Digital Chain Bank Account</h2>
                <p className="text-gray-600">
                  Apply now and you will get access to your account within the next few days.
                </p>
                <div className="w-20 h-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F] mx-auto mt-4 rounded-full"></div>
              </div>

              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="relative group">
                    <Input
                      type="text"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      className="w-full h-12 border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-[#F26623] focus:ring-0 px-0 placeholder:text-gray-400 text-gray-900 transition-all duration-300 group-hover:border-gray-300"
                    />
                    <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#F26623] to-[#E55A1F] transition-all duration-300 group-focus-within:w-full"></div>
                  </div>
                  <div className="relative group">
                    <Input
                      type="text"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      className="w-full h-12 border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-[#F26623] focus:ring-0 px-0 placeholder:text-gray-400 text-gray-900 transition-all duration-300 group-hover:border-gray-300"
                    />
                    <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#F26623] to-[#E55A1F] transition-all duration-300 group-focus-within:w-full"></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="relative group">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="w-full h-12 border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-[#F26623] focus:ring-0 px-0 placeholder:text-gray-400 text-gray-900 transition-all duration-300 group-hover:border-gray-300"
                    />
                    <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#F26623] to-[#E55A1F] transition-all duration-300 group-focus-within:w-full"></div>
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      placeholder="Age"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      required
                      className="w-full h-12 border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-[#F26623] focus:ring-0 px-0 placeholder:text-gray-400 text-gray-900 transition-all duration-300 group-hover:border-gray-300"
                    />
                    <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#F26623] to-[#E55A1F] transition-all duration-300 group-focus-within:w-full"></div>
                  </div>
                </div>

                <div className="relative group">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full h-12 border-0 border-b-2 border-gray-200 rounded-none bg-transparent focus:border-[#F26623] focus:ring-0 px-0 pr-16 placeholder:text-gray-400 text-gray-900 transition-all duration-300 group-hover:border-gray-300"
                  />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 p-0 hover:bg-[#F26623]/10 rounded-full transition-all duration-200"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                    <span className="text-sm text-[#F26623] font-medium">Go</span>
                  </div>
                  <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-[#F26623] to-[#E55A1F] transition-all duration-300 group-focus-within:w-full"></div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D4501B] text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 mt-8 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <div className="flex justify-between items-center mt-12 text-sm">
                <button className="text-gray-500 hover:text-[#F26623] font-medium transition-colors duration-200 hover:underline">
                  Return Home
                </button>
                <span className="text-gray-400 text-xs">The Banking of the Future, Based in Panama</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
