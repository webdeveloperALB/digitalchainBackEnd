"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function BalanceUpdater() {
  const [userId, setUserId] = useState("")
  const [currency, setCurrency] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const updateBalance = async () => {
    if (!userId || !currency || !amount) {
      setMessage("Please fill all fields")
      return
    }

    setLoading(true)
    try {
      const tableName = `${currency.toLowerCase()}_balances`

      const { error } = await supabase
        .from(tableName)
        .update({ balance: Number.parseFloat(amount) })
        .eq("user_id", userId)

      if (error) throw error

      setMessage(`Successfully updated ${currency} balance to ${amount}`)

      // Clear form
      setUserId("")
      setCurrency("")
      setAmount("")
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Update User Balance (Admin)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="userId">User ID</Label>
          <Input id="userId" placeholder="Enter user UUID" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crypto">Crypto</SelectItem>
              <SelectItem value="euro">Euro</SelectItem>
              <SelectItem value="cad">CAD</SelectItem>
              <SelectItem value="usd">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <Button onClick={updateBalance} disabled={loading} className="w-full bg-[#F26623] hover:bg-[#E55A1F]">
          {loading ? "Updating..." : "Update Balance"}
        </Button>

        {message && (
          <p className={`text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>{message}</p>
        )}
      </CardContent>
    </Card>
  )
}
