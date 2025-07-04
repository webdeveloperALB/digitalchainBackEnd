"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Mail,
  MessageCircle,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";

export default function SupportSection() {
  const { toast } = useToast();
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "",
    priority: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!ticketForm.subject.trim()) {
      newErrors.subject = "Subject is required";
    }
    if (!ticketForm.category) {
      newErrors.category = "Please select a category";
    }
    if (!ticketForm.priority) {
      newErrors.priority = "Please select a priority";
    }
    if (!ticketForm.description.trim()) {
      newErrors.description = "Description is required";
    } else if (ticketForm.description.trim().length < 10) {
      newErrors.description = "Description must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitTicket = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Ticket Submitted Successfully!",
        description:
          "We'll get back to you within 24 hours. Ticket ID: #" +
          Math.random().toString(36).substr(2, 9).toUpperCase(),
      });

      // Reset form
      setTicketForm({
        subject: "",
        category: "",
        priority: "",
        description: "",
      });
      setErrors({});
    } catch (error) {
      toast({
        title: "Submission Failed",
        description:
          "There was an error submitting your ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startLiveChat = () => {
    setChatOpen(true);
    // In a real app, this would initialize your chat widget
    toast({
      title: "Live Chat Starting",
      description: "Connecting you with a support agent...",
    });
  };

  const faqItems = [
    {
      question: "How do I transfer money between currencies?",
      answer:
        "Go to the Transfers section, select your source and destination currencies, enter the amount, and click Execute Transfer.",
    },
    {
      question: "How long do deposits take to process?",
      answer:
        "Bank transfers typically take 1-3 business days, while card deposits are usually instant.",
    },
    {
      question: "Can I freeze my card if it's lost?",
      answer:
        "Yes, go to the Cards section and click the lock icon next to your card to freeze it immediately.",
    },
    {
      question: "How do I update my account information?",
      answer:
        "You can update your profile information in the Accounts section under Personal Details.",
    },
  ];

  const systemStatus = [
    { service: "Banking Services", status: "operational" },
    { service: "Card Payments", status: "operational" },
    { service: "Cryptocurrency Trading", status: "maintenance" },
    { service: "Mobile App", status: "operational" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="w-4 h-4 mr-1 text-green-600" />;
      case "maintenance":
        return <Clock className="w-4 h-4 mr-1 text-yellow-600" />;
      case "down":
        return <AlertCircle className="w-4 h-4 mr-1 text-red-600" />;
      default:
        return <CheckCircle className="w-4 h-4 mr-1 text-green-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "text-green-600";
      case "maintenance":
        return "text-yellow-600";
      case "down":
        return "text-red-600";
      default:
        return "text-green-600";
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h2 className="text-2xl font-bold">Support Center</h2>
          <p className="text-gray-600 mt-1">Get help when you need it</p>
        </div>

        {/* Contact Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="text-center hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Phone className="w-8 h-8 mx-auto mb-3 text-[#F26623]" />
              <h3 className="font-medium mb-2">Phone Support</h3>
              <p className="text-sm text-gray-600 mb-3">Available 24/7</p>
              <p className="font-mono text-sm">+1 (555) 123-4567</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 bg-transparent"
              >
                Call Now
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Mail className="w-8 h-8 mx-auto mb-3 text-[#F26623]" />
              <h3 className="font-medium mb-2">Email Support</h3>
              <p className="text-sm text-gray-600 mb-3">Response within 24h</p>
              <p className="text-sm">support@digitalchainbank.com</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 bg-transparent"
              >
                Send Email
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <MessageCircle className="w-8 h-8 mx-auto mb-3 text-[#F26623]" />
              <h3 className="font-medium mb-2">Live Chat</h3>
              <p className="text-sm text-gray-600 mb-3">Mon-Fri 9AM-6PM</p>
              <Dialog open={chatOpen} onOpenChange={setChatOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-[#F26623] hover:bg-[#E55A1F] mt-3"
                    onClick={startLiveChat}
                  >
                    Start Chat
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Live Chat Support</DialogTitle>
                    <DialogDescription>
                      You're being connected to a support agent. Please wait...
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-[#F26623]" />
                    <span className="ml-2">Connecting...</span>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Submit Ticket */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Send className="w-5 h-5 mr-2" />
              Submit Support Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={ticketForm.subject}
                  onChange={(e) => {
                    setTicketForm({ ...ticketForm, subject: e.target.value });
                    if (errors.subject) {
                      setErrors({ ...errors, subject: "" });
                    }
                  }}
                  placeholder="Brief description of your issue"
                  className={errors.subject ? "border-red-500" : ""}
                />
                {errors.subject && (
                  <p className="text-sm text-red-500 mt-1">{errors.subject}</p>
                )}
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={ticketForm.category}
                  onValueChange={(value) => {
                    setTicketForm({ ...ticketForm, category: value });
                    if (errors.category) {
                      setErrors({ ...errors, category: "" });
                    }
                  }}
                >
                  <SelectTrigger
                    className={errors.category ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Account Issues</SelectItem>
                    <SelectItem value="payments">
                      Payments & Transfers
                    </SelectItem>
                    <SelectItem value="cards">Card Issues</SelectItem>
                    <SelectItem value="crypto">Cryptocurrency</SelectItem>
                    <SelectItem value="technical">Technical Support</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-500 mt-1">{errors.category}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={ticketForm.priority}
                onValueChange={(value) => {
                  setTicketForm({ ...ticketForm, priority: value });
                  if (errors.priority) {
                    setErrors({ ...errors, priority: "" });
                  }
                }}
              >
                <SelectTrigger
                  className={errors.priority ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {errors.priority && (
                <p className="text-sm text-red-500 mt-1">{errors.priority}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={ticketForm.description}
                onChange={(e) => {
                  setTicketForm({ ...ticketForm, description: e.target.value });
                  if (errors.description) {
                    setErrors({ ...errors, description: "" });
                  }
                }}
                placeholder="Please provide detailed information about your issue..."
                rows={4}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.description}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {ticketForm.description.length}/500 characters
              </p>
            </div>

            <Button
              onClick={submitTicket}
              disabled={isSubmitting}
              className="bg-[#F26623] hover:bg-[#E55A1F]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Ticket
                </>
              )}
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
                <h4 className="font-medium mb-2 text-gray-900">
                  {item.question}
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
