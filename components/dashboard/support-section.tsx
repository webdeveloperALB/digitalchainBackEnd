"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Mail, MessageCircle, HelpCircle, Clock, CheckCircle } from "lucide-react"

export default function SupportSection() {
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "",
    priority: "",
    description: "",
  })

  const submitTicket = () => {
    // In a real app, this would submit to your support system
    alert("Support ticket submitted successfully! We'll get back to you within 24 hours.")
    setTicketForm({ subject: "", category: "", priority: "", description: "" })
  }

  const faqItems = [
    {
      question: "How do I transfer money between currencies?",
      answer:
        "Go to the Transfers section, select your source and destination currencies, enter the amount, and click Execute Transfer.",
    },
    {
      question: "How long do deposits take to process?",
      answer: "Bank transfers typically take 1-3 business days, while card deposits are usually instant.",
    },
    {
      question: "Can I freeze my card if it's lost?",
      answer: "Yes, go to the Cards section and click the lock icon next to your card to freeze it immediately.",
    },
    {
      question: "How do I update my account information?",
      answer: "You can update your profile information in the Accounts section under Personal Details.",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Support Center</h2>

      {/* Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="p-6">
            <Phone className="w-8 h-8 mx-auto mb-3 text-[#F26623]" />
            <h3 className="font-medium mb-2">Phone Support</h3>
            <p className="text-sm text-gray-600 mb-3">Available 24/7</p>
            <p className="font-mono text-sm">+1 (555) 123-4567</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-6">
            <Mail className="w-8 h-8 mx-auto mb-3 text-[#F26623]" />
            <h3 className="font-medium mb-2">Email Support</h3>
            <p className="text-sm text-gray-600 mb-3">Response within 24h</p>
            <p className="text-sm">support@digitalchainbank.com</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-6">
            <MessageCircle className="w-8 h-8 mx-auto mb-3 text-[#F26623]" />
            <h3 className="font-medium mb-2">Live Chat</h3>
            <p className="text-sm text-gray-600 mb-3">Mon-Fri 9AM-6PM</p>
            <Button size="sm" className="bg-[#F26623] hover:bg-[#E55A1F]">
              Start Chat
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Submit Ticket */}
      <Card>
        <CardHeader>
          <CardTitle>Submit Support Ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Subject</Label>
              <Input
                value={ticketForm.subject}
                onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                placeholder="Brief description of your issue"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={ticketForm.category}
                onValueChange={(value) => setTicketForm({ ...ticketForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Account Issues</SelectItem>
                  <SelectItem value="payments">Payments & Transfers</SelectItem>
                  <SelectItem value="cards">Card Issues</SelectItem>
                  <SelectItem value="crypto">Cryptocurrency</SelectItem>
                  <SelectItem value="technical">Technical Support</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Priority</Label>
            <Select
              value={ticketForm.priority}
              onValueChange={(value) => setTicketForm({ ...ticketForm, priority: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={ticketForm.description}
              onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
              placeholder="Please provide detailed information about your issue..."
              rows={4}
            />
          </div>

          <Button onClick={submitTicket} className="bg-[#F26623] hover:bg-[#E55A1F]">
            Submit Ticket
          </Button>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <HelpCircle className="w-5 h-5 mr-2" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqItems.map((item, index) => (
            <div key={index} className="border-b pb-4 last:border-b-0">
              <h4 className="font-medium mb-2">{item.question}</h4>
              <p className="text-sm text-gray-600">{item.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span>Banking Services</span>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              Operational
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Card Payments</span>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              Operational
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Cryptocurrency Trading</span>
            <div className="flex items-center text-yellow-600">
              <Clock className="w-4 h-4 mr-1" />
              Maintenance
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Mobile App</span>
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              Operational
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
