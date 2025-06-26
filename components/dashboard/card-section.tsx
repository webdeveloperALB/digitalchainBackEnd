"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard, Eye, EyeOff, Lock, Unlock, Plus } from "lucide-react"

export default function CardSection() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCardForm, setShowCardForm] = useState(false)
  const [showCardDetails, setShowCardDetails] = useState<{ [key: string]: boolean }>({})
  const [formData, setFormData] = useState({
    card_type: "Virtual",
    spending_limit: "5000",
  })

  useEffect(() => {
    fetchCards()
  }, [])

  const fetchCards = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from("cards")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error
        setCards(data || [])
      }
    } catch (error) {
      console.error("Error fetching cards:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateCardNumber = () => {
    return (
      "4532" +
      Math.floor(Math.random() * 1000000000000)
        .toString()
        .padStart(12, "0")
    )
  }

  const createCard = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

        const { error } = await supabase.from("cards").insert({
          user_id: user.id,
          card_number: generateCardNumber(),
          card_holder_name: profile?.full_name?.toUpperCase() || "CARD HOLDER",
          expiry_month: 12,
          expiry_year: new Date().getFullYear() + 3,
          card_type: formData.card_type,
          spending_limit: Number.parseFloat(formData.spending_limit),
          status: "Active",
        })

        if (error) throw error

        setFormData({ card_type: "Virtual", spending_limit: "5000" })
        setShowCardForm(false)
        fetchCards()
        alert("New card created successfully!")
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const toggleCardStatus = async (cardId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "Active" ? "Frozen" : "Active"

      const { error } = await supabase.from("cards").update({ status: newStatus }).eq("id", cardId)

      if (error) throw error

      fetchCards()
      alert(`Card ${newStatus.toLowerCase()} successfully!`)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const toggleCardDetails = (cardId: string) => {
    setShowCardDetails((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }))
  }

  const formatCardNumber = (cardNumber: string, show: boolean) => {
    if (show) {
      return cardNumber.replace(/(.{4})/g, "$1 ").trim()
    }
    return "**** **** **** " + cardNumber.slice(-4)
  }

  if (loading) {
    return <div className="p-6">Loading cards...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Cards</h2>
        <Button onClick={() => setShowCardForm(true)} className="bg-[#F26623] hover:bg-[#E55A1F]">
          <Plus className="w-4 h-4 mr-2" />
          Request New Card
        </Button>
      </div>

      {showCardForm && (
        <Card>
          <CardHeader>
            <CardTitle>Request New Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Card Type</Label>
                <Select
                  value={formData.card_type}
                  onValueChange={(value) => setFormData({ ...formData, card_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Virtual">Virtual Card</SelectItem>
                    <SelectItem value="Physical">Physical Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Spending Limit</Label>
                <Input
                  type="number"
                  step="100"
                  value={formData.spending_limit}
                  onChange={(e) => setFormData({ ...formData, spending_limit: e.target.value })}
                  placeholder="5000"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={createCard} className="bg-[#F26623] hover:bg-[#E55A1F]">
                Create Card
              </Button>
              <Button variant="outline" onClick={() => setShowCardForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards Display */}
      <div className="grid gap-6">
        {cards.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No cards found. Request your first card!</p>
            </CardContent>
          </Card>
        ) : (
          cards.map((card) => (
            <div key={card.id} className="space-y-4">
              {/* Card Visual */}
              <div className="relative">
                <div className="w-full max-w-md mx-auto bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-xl p-6 text-white shadow-lg">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-sm opacity-80">Digital Chain Bank</p>
                      <p className="text-xs opacity-60">{card.card_type} Card</p>
                    </div>
                    <div className="w-8 h-8 bg-white rounded-full opacity-80"></div>
                  </div>

                  <div className="mb-6">
                    <p className="text-lg font-mono tracking-wider">
                      {formatCardNumber(card.card_number, showCardDetails[card.id])}
                    </p>
                  </div>

                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs opacity-60">CARD HOLDER</p>
                      <p className="text-sm font-medium">{card.card_holder_name}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-60">EXPIRES</p>
                      <p className="text-sm font-medium">
                        {card.expiry_month.toString().padStart(2, "0")}/{card.expiry_year.toString().slice(-2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Controls */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="font-medium">{card.card_type} Card</p>
                      <p className="text-sm text-gray-600">
                        Spending Limit: ${Number(card.spending_limit).toLocaleString()}
                      </p>
                      <p
                        className={`text-sm font-medium ${card.status === "Active" ? "text-green-600" : "text-red-600"}`}
                      >
                        Status: {card.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => toggleCardDetails(card.id)}>
                        {showCardDetails[card.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleCardStatus(card.id, card.status)}
                        className={card.status === "Active" ? "text-red-600" : "text-green-600"}
                      >
                        {card.status === "Active" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {showCardDetails[card.id] && (
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Full Number:</span> {card.card_number}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">CVV:</span> {Math.floor(Math.random() * 900) + 100}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Created:</span> {new Date(card.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
