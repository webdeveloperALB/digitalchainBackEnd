"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DatabaseTest() {
  const [testResults, setTestResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    const results = []

    // Test 1: Check connection
    try {
      const { data, error } = await supabase.from("profiles").select("count").limit(1)
      results.push({
        test: "Database Connection",
        status: error ? "FAILED" : "PASSED",
        message: error ? error.message : "Connection successful",
      })
    } catch (error: any) {
      results.push({
        test: "Database Connection",
        status: "FAILED",
        message: error.message,
      })
    }

    // Test 2: Check user authentication
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      results.push({
        test: "User Authentication",
        status: error || !user ? "FAILED" : "PASSED",
        message: error ? error.message : user ? `User ID: ${user.id}` : "No user found",
      })
    } catch (error: any) {
      results.push({
        test: "User Authentication",
        status: "FAILED",
        message: error.message,
      })
    }

    // Test 3: Check each table
    const tables = [
      "profiles",
      "crypto_balances",
      "euro_balances",
      "cad_balances",
      "usd_balances",
      "transactions",
      "transfers",
      "deposits",
      "payments",
      "cards",
      "crypto_transactions",
      "external_accounts",
    ]

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select("*").limit(1)
        results.push({
          test: `Table: ${table}`,
          status: error ? "FAILED" : "PASSED",
          message: error ? error.message : `Table accessible`,
        })
      } catch (error: any) {
        results.push({
          test: `Table: ${table}`,
          status: "FAILED",
          message: error.message,
        })
      }
    }

    setTestResults(results)
    setLoading(false)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Database Connection Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runTests} disabled={loading} className="w-full bg-[#F26623] hover:bg-[#E55A1F]">
          {loading ? "Running Tests..." : "Run Database Tests"}
        </Button>

        {testResults.length > 0 && (
          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded border-l-4 ${
                  result.status === "PASSED" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{result.test}</span>
                  <span
                    className={`text-sm font-bold ${result.status === "PASSED" ? "text-green-600" : "text-red-600"}`}
                  >
                    {result.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{result.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
