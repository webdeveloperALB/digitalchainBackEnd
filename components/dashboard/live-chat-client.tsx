"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  Maximize2,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: "client" | "admin";
  sender_name: string | null;
  message: string;
  created_at: string;
  read_by_admin: boolean;
  read_by_client: boolean;
}

interface LiveChatClientProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveChatClient({
  isOpen,
  onClose,
}: LiveChatClientProps) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Force scroll to bottom function
  const forceScrollToBottom = () => {
    // Clear any existing scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Multiple attempts to ensure scrolling works
    const scrollAttempts = [0, 50, 100, 200, 300, 500];

    scrollAttempts.forEach((delay) => {
      scrollTimeoutRef.current = setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: delay === 0 ? "auto" : "smooth",
            block: "end",
          });
        }
      }, delay);
    });
  };

  // Load saved session from localStorage when component mounts
  useEffect(() => {
    const savedSession = localStorage.getItem("chat_session");
    if (savedSession && isOpen) {
      try {
        const sessionData = JSON.parse(savedSession);
        setSessionId(sessionData.sessionId);
        setClientName(sessionData.clientName);
        setClientEmail(sessionData.clientEmail || "");
        setIsStarted(true);

        console.log(
          "CLIENT: Loading saved session, will scroll to bottom after messages load"
        );
      } catch (error) {
        console.error("Error loading saved session:", error);
        localStorage.removeItem("chat_session");
      }
    }
  }, [isOpen]);

  // Scroll to bottom when dialog opens or becomes visible
  useEffect(() => {
    if (isOpen && !isMinimized && isStarted && messages.length > 0) {
      console.log(
        "CLIENT: Dialog opened/unminimized with messages, scrolling to bottom"
      );
      forceScrollToBottom();
    }
  }, [isOpen, isMinimized, isStarted, messages.length]);

  // Start chat session
  const startChat = async () => {
    if (!clientName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to start the chat",
        variant: "destructive",
      });
      return;
    }

    if (!clientEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email to start the chat",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      setSessionId(data.id);
      setIsStarted(true);

      // Save session data to localStorage
      localStorage.setItem(
        "chat_session",
        JSON.stringify({
          sessionId: data.id,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || "",
        })
      );

      // Send welcome message
      const welcomeMessage = {
        session_id: data.id,
        sender_type: "client" as const,
        sender_name: clientName.trim(),
        message: `Hi, I'm ${clientName.trim()}. I need help with my account.`,
        read_by_admin: false,
        read_by_client: true,
      };

      const { data: messageData, error: messageError } = await supabase
        .from("chat_messages")
        .insert(welcomeMessage)
        .select()
        .single();

      if (messageError) throw messageError;

      // Add welcome message to local state immediately
      setMessages([messageData]);
      lastMessageCountRef.current = 1;

      toast({
        title: "Chat Started",
        description:
          "You're now connected to support. An agent will be with you shortly.",
      });
    } catch (error) {
      console.error("Error starting chat:", error);
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !sessionId) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const messageData = {
        session_id: sessionId,
        sender_type: "client" as const,
        sender_name: clientName,
        message: messageText,
        read_by_admin: false,
        read_by_client: true,
      };

      const { data, error } = await supabase
        .from("chat_messages")
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Add message to local state immediately
      setMessages((prev) => {
        const updated = [...prev, data];
        lastMessageCountRef.current = updated.length;
        return updated;
      });

      // Update session timestamp
      await supabase
        .from("chat_sessions")
        .update({
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("Error sending message:", error);
      // Restore message text on error
      setNewMessage(messageText);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  // Fetch messages (used by both polling and real-time)
  const fetchMessages = async (silent = false) => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const newMessages = data || [];

      // Always update messages and scroll if count changed or if it's the first load
      if (
        newMessages.length !== lastMessageCountRef.current ||
        messages.length === 0
      ) {
        console.log(
          `CLIENT: Found ${newMessages.length} messages (was ${lastMessageCountRef.current})`
        );

        // Check for new admin messages for notifications
        const currentMessageIds = messages.map((m) => m.id);
        const newAdminMessages = newMessages.filter(
          (msg) =>
            msg.sender_type === "admin" && !currentMessageIds.includes(msg.id)
        );

        setMessages(newMessages);
        lastMessageCountRef.current = newMessages.length;

        // Always scroll to bottom when messages are loaded/updated
        if (newMessages.length > 0) {
          console.log("CLIENT: Messages updated, scrolling to bottom");
          forceScrollToBottom();
        }

        // Show notification for new admin messages (only if not silent)
        if (!silent && newAdminMessages.length > 0) {
          toast({
            title: "New Message",
            description: "Support agent replied to your message",
          });
        }

        // Mark admin messages as read
        const unreadAdminMessages = newMessages.filter(
          (msg) => msg.sender_type === "admin" && !msg.read_by_client
        );

        if (unreadAdminMessages.length > 0) {
          await supabase
            .from("chat_messages")
            .update({ read_by_client: true })
            .in(
              "id",
              unreadAdminMessages.map((msg) => msg.id)
            );
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setIsConnected(false);
    }
  };

  // Setup polling every 2 seconds
  useEffect(() => {
    if (!sessionId || !isStarted) return;

    console.log("CLIENT: Starting polling for session:", sessionId);

    // Initial fetch
    fetchMessages(true);

    // Setup polling interval
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages(true); // Silent updates
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [sessionId, isStarted]);

  // Real-time subscription (as backup to polling)
  useEffect(() => {
    if (!sessionId) return;

    console.log(
      "CLIENT: Setting up real-time subscription for session:",
      sessionId
    );

    // Set up real-time subscription
    const channel = supabase
      .channel(`chat-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("CLIENT: Real-time message received:", payload);
          const newMessage = payload.new as ChatMessage;

          setMessages((currentMessages) => {
            // Check if message already exists
            const exists = currentMessages.find(
              (msg) => msg.id === newMessage.id
            );
            if (exists) {
              console.log("CLIENT: Message already exists, skipping");
              return currentMessages;
            }

            console.log("CLIENT: Adding new message via real-time");
            const updated = [...currentMessages, newMessage];
            lastMessageCountRef.current = updated.length;

            // Force scroll to bottom for new messages
            forceScrollToBottom();

            // Show notification for admin messages
            if (newMessage.sender_type === "admin") {
              toast({
                title: "New Message",
                description: "Support agent replied to your message",
              });

              // Mark as read
              supabase
                .from("chat_messages")
                .update({ read_by_client: true })
                .eq("id", newMessage.id);
            }

            return updated;
          });
        }
      )
      .subscribe((status) => {
        console.log("CLIENT: Subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      console.log("CLIENT: Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0 && isOpen && !isMinimized) {
      forceScrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Handle minimize/maximize
  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    // Force scroll when maximizing
    if (messages.length > 0) {
      console.log("CLIENT: Maximizing chat, scrolling to bottom");
      setTimeout(() => forceScrollToBottom(), 100);
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      const savedSession = localStorage.getItem("chat_session");
      if (!savedSession) {
        // Clean up polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Clean up scroll timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = null;
        }

        setIsStarted(false);
        setSessionId(null);
        setMessages([]);
        setNewMessage("");
        setClientName("");
        setClientEmail("");
        setIsMinimized(false);
        setIsConnected(false);
        lastMessageCountRef.current = 0;
      }
    }
  }, [isOpen]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const endChatSession = () => {
    // Clean up polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Clean up scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    localStorage.removeItem("chat_session");
    setIsStarted(false);
    setSessionId(null);
    setMessages([]);
    setNewMessage("");
    setClientName("");
    setClientEmail("");
    setIsMinimized(false);
    setIsConnected(false);
    lastMessageCountRef.current = 0;
    onClose();
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 w-80 z-50 bg-white border rounded-lg shadow-lg">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm font-medium">
              <MessageCircle className="w-4 h-4 mr-2 text-[#F26623]" />
              Live Chat Support
              {isConnected ? (
                <Wifi className="w-3 h-3 ml-2 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 ml-2 text-gray-400" />
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" onClick={handleMaximize}>
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={endChatSession}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center text-base">
              <MessageCircle className="w-5 h-5 mr-2 text-[#F26623]" />
              Live Chat Support
              {isStarted &&
                (isConnected ? (
                  <Wifi className="w-4 h-4 ml-2 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 ml-2 text-gray-400" />
                ))}
            </DialogTitle>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" onClick={handleMinimize}>
                <Minimize2 className="w-4 h-4 mr-6" />
              </Button>
            </div>
          </div>
          <DialogDescription className="text-sm">
            {isStarted ? (
              <span className="flex items-center">
                You're connected to our support team
                <span className="ml-2 text-xs text-gray-500">
                  {isConnected
                    ? "• Real-time connected"
                    : "• Polling for updates"}
                </span>
              </span>
            ) : (
              "Get instant help from our support team"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col px-4 pb-4">
          {!isStarted ? (
            // Start Chat Form
            <div className="space-y-4">
              <div>
                <Label htmlFor="clientName">Your Name *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <Label htmlFor="clientEmail">Email *</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <Button
                onClick={startChat}
                className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
                disabled={!clientName.trim() || !clientEmail.trim()}
              >
                Start Chat
              </Button>
            </div>
          ) : (
            // Chat Interface
            <>
              <div className="p-2 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">Chat with Support</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={endChatSession}
                    className="text-xs h-6 px-2 text-red-600 hover:text-red-700"
                  >
                    End Chat
                  </Button>
                </div>
              </div>
              {/* Messages */}
              <ScrollArea className="flex-1 mb-2 border rounded-lg p-3 bg-gray-50 min-h-[300px] max-h-[400px]">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_type === "client"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] p-3 rounded-lg text-sm shadow-sm ${
                          message.sender_type === "client"
                            ? "bg-[#F26623] text-white rounded-br-sm"
                            : "bg-white text-gray-800 border rounded-bl-sm"
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <User className="w-3 h-3 mr-1 opacity-70" />
                          <span className="text-xs font-medium opacity-90">
                            {message.sender_type === "client"
                              ? "You"
                              : "Support Agent"}
                          </span>
                        </div>
                        <div className="leading-relaxed break-words">
                          {message.message}
                        </div>
                        <div
                          className={`text-xs mt-2 ${
                            message.sender_type === "client"
                              ? "text-orange-100"
                              : "text-gray-500"
                          }`}
                        >
                          {formatTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-[#F26623] hover:bg-[#E55A1F] px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
