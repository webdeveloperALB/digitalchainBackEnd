"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftRight } from "lucide-react"

export default function TransfersSection() {
  const [transfers, setTransfers] = useState<any[]>([])
  const [balances, setBalances] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    from_currency: "",
    to_currency: "",
    amount: "",
  })

  const exchangeRates = {
    EUR_USD: 1.1,
    EUR_CAD: 1.45,
    USD_EUR: 0.91,
    USD_CAD: 1.32,
    CAD_EUR: 0.69,
    CAD_USD: 0.76,
    CRYPTO_EUR: 45000,
    CRYPTO_USD: 49500,
    CRYPTO_CAD: 65000,
  }

  useEffect(() => {
    fetchTransfers()
    fetchBalances()
  }, [])

  const fetchBalances = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const [cryptoResult, euroResult, cadResult, usdResult] = await Promise.all([
          supabase.from("crypto_balances").select("balance").eq("user_id", user.id).single(),
          supabase.from("euro_balances").select("balance").eq("user_id", user.id).single(),
          supabase.from("cad_balances").select("balance").eq("user_id", user.id).single(),
          supabase.from("usd_balances").select("balance").eq("user_id", user.id).single(),
        ])

        setBalances({
          crypto: cryptoResult.data?.balance || 0,
          euro: euroResult.data?.balance || 0,
          cad: cadResult.data?.balance || 0,
          usd: usdResult.data?.balance || 0,
        })
      }
    } catch (error) {
      console.error("Error fetching balances:", error)
    }
  }

  const fetchTransfers = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from("transfers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error
        setTransfers(data || [])
      }
    } catch (error) {
      console.error("Error fetching transfers:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateExchange = (fromCurrency: string, toCurrency: string, amount: number) => {
    const rateKey = `${fromCurrency.toUpperCase()}_${toCurrency.toUpperCase()}`
    const rate = exchangeRates[rateKey as keyof typeof exchangeRates] || 1
    return amount * rate
  }

  const executeTransfer = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const amount = Number.parseFloat(formData.amount)
      const fromCurrency = formData.from_currency.toLowerCase()
      const toCurrency = formData.to_currency.toLowerCase()

      // Check if user has sufficient balance
      const currentBalance = balances[fromCurrency] || 0
      if (currentBalance < amount) {
        alert("Insufficient balance")
        return
      }

      const exchangeRate =
        exchangeRates[`${fromCurrency.toUpperCase()}_${toCurrency.toUpperCase()}` as keyof typeof exchangeRates] || 1
      const toAmount = amount * exchangeRate

      // Create transfer record
      const { error: transferError } = await supabase.from("transfers").insert({
        user_id: user.id,
        from_currency: fromCurrency.toUpperCase(),
        to_currency: toCurrency.toUpperCase(),
        from_amount: amount,
        to_amount: toAmount,
        exchange_rate: exchangeRate,
        status: "Completed",
      })

      if (transferError) throw transferError

      // Update balances
      const fromTable = `${fromCurrency}_balances`
      const toTable = `${toCurrency}_balances`

      await Promise.all([
        supabase
          .from(fromTable)
          .update({ balance: currentBalance - amount })
          .eq("user_id", user.id),
        supabase
          .from(toTable)
          .update({ balance: (balances[toCurrency] || 0) + toAmount })
          .eq("user_id", user.id),
      ])

      // Add transaction records
      await supabase.from("transactions").insert([
        {
          user_id: user.id,
          type: "Transfer Out",
          amount: amount,
          currency: fromCurrency.toUpperCase(),
          description: `Transfer to ${toCurrency.toUpperCase()}`,
          status: "Successful",
        },
        {
          user_id: user.id,
          type: "Transfer In",
          amount: toAmount,
          currency: toCurrency.toUpperCase(),
          description: `Transfer from ${fromCurrency.toUpperCase()}`,
          status: "Successful",
        },
      ])

      setFormData({ from_currency: "", to_currency: "", amount: "" })
      fetchTransfers()
      fetchBalances()
      alert("Transfer completed successfully!")
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const getEstimatedAmount = () => {
    if (formData.from_currency && formData.to_currency && formData.amount) {
      const amount = Number.parseFloat(formData.amount)
      if (!Number.isNaN(amount)) {
        return calculateExchange(formData.from_currency, formData.to_currency, amount).toFixed(2)
      }
    }
    return "0.00"
  }

  if (loading) {
    return <div className="p-6">Loading transfers...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Currency Transfers</h2>

      {/* Current Balances */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Crypto</p>
            <p className="text-xl font-bold">{Number(balances.crypto || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">Euro</p>
            <p className="text-xl font-bold">{Number(balances.euro || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">CAD</p>
            <p className="text-xl font-bold">{Number(balances.cad || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-600">USD</p>
            <p className="text-xl font-bold">{Number(balances.usd || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transfer Form */}
      <Card>
        <CardHeader>
          <CardTitle>New Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <Label>From Currency</Label>
              <Select
                value={formData.from_currency}
                onValueChange={(value) => setFormData({ ...formData, from_currency: value })}
              >
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
            <div className="text-center">
              <ArrowLeftRight className="w-6 h-6 mx-auto text-[#F26623]" />
            </div>
            <div>
              <Label>To Currency</Label>
              <Select
                value={formData.to_currency}
                onValueChange={(value) => setFormData({ ...formData, to_currency: value })}
              >
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount to Transfer</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Estimated Receive</Label>
              <Input value={getEstimatedAmount()} readOnly className="bg-gray-50" />
            </div>
          </div>

          <Button
            onClick={executeTransfer}
            disabled={!formData.from_currency || !formData.to_currency || !formData.amount}
            className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
          >
            Execute Transfer
          </Button>
        </CardContent>
      </Card>

      {/* Transfer History */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transfers yet</p>
          ) : (
            <div className="space-y-4">
              {transfers.map((transfer) => (
                <div key={transfer.id} className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {transfer.from_currency} → {transfer.to_currency}
                    </p>
                    <p className="text-sm text-gray-600">
                      {Number(transfer.from_amount).toLocaleString()} {transfer.from_currency} →{" "}
                      {Number(transfer.to_amount).toLocaleString()} {transfer.to_currency}
                    </p>
                    <p className="text-xs text-gray-500">{new Date(transfer.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">{transfer.status}</p>
                    <p className="text-xs text-gray-500">Rate: {transfer.exchange_rate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
