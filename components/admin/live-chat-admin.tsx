"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  Send,
  User,
  X,
  Minimize2,
  Maximize2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ChatSession {
  id: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  unread_count?: number;
}

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

export default function LiveChatAdmin() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionsPollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);
  const lastSessionCountRef = useRef(0);
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

  // Fetch chat sessions
  const fetchSessions = async (silent = false) => {
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      // Get unread counts for each session
      const sessionsWithUnread = await Promise.all(
        (data || []).map(async (session) => {
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id)
            .eq("sender_type", "client")
            .eq("read_by_admin", false);

          return {
            ...session,
            unread_count: count || 0,
          };
        })
      );

      // Only update if session count changed (silent updates)
      if (sessionsWithUnread.length !== lastSessionCountRef.current) {
        console.log(
          `ADMIN: Found ${sessionsWithUnread.length} sessions (was ${lastSessionCountRef.current})`
        );
        setSessions(sessionsWithUnread);
        lastSessionCountRef.current = sessionsWithUnread.length;
      } else {
        // Update silently for unread counts
        setSessions(sessionsWithUnread);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setIsConnected(false);
    }
  };

  // Fetch messages for active session
  const fetchMessages = async (sessionId: string, silent = false) => {
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
          `ADMIN: Found ${newMessages.length} messages (was ${lastMessageCountRef.current})`
        );

        // Check for new client messages for notifications
        const currentMessageIds = messages.map((m) => m.id);
        const newClientMessages = newMessages.filter(
          (msg) =>
            msg.sender_type === "client" && !currentMessageIds.includes(msg.id)
        );

        setMessages(newMessages);
        lastMessageCountRef.current = newMessages.length;

        // Always scroll to bottom when messages are loaded/updated
        if (newMessages.length > 0 && !isMinimized) {
          console.log("ADMIN: Messages updated, scrolling to bottom");
          forceScrollToBottom();
        }

        // Show notification for new client messages (only if not silent)
        if (!silent && newClientMessages.length > 0) {
          toast({
            title: "New Message",
            description: `New message from ${
              newClientMessages[0].sender_name || "Client"
            }`,
          });
        }

        // Mark client messages as read by admin
        const unreadClientMessages = newMessages.filter(
          (msg) => msg.sender_type === "client" && !msg.read_by_admin
        );

        if (unreadClientMessages.length > 0) {
          await supabase
            .from("chat_messages")
            .update({ read_by_admin: true })
            .in(
              "id",
              unreadClientMessages.map((msg) => msg.id)
            );
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setIsConnected(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !activeSession) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const messageData = {
        session_id: activeSession,
        sender_type: "admin" as const,
        sender_name: "Support Agent",
        message: messageText,
        read_by_admin: true,
        read_by_client: false,
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
        .eq("id", activeSession);
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

  // Close session
  const closeSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ status: "closed" })
        .eq("id", sessionId);

      if (error) throw error;

      if (activeSession === sessionId) {
        setActiveSession(null);
        setMessages([]);
        lastMessageCountRef.current = 0;
      }

      toast({
        title: "Session Closed",
        description: "Chat session has been closed",
      });
    } catch (error) {
      console.error("Error closing session:", error);
    }
  };

  // Setup polling for sessions every 2 seconds
  useEffect(() => {
    console.log("ADMIN: Starting sessions polling");

    // Initial fetch
    fetchSessions(true);

    // Setup polling interval for sessions
    sessionsPollingRef.current = setInterval(() => {
      fetchSessions(true); // Silent updates
    }, 2000);

    return () => {
      if (sessionsPollingRef.current) {
        clearInterval(sessionsPollingRef.current);
        sessionsPollingRef.current = null;
      }
    };
  }, []);

  // Setup polling for messages when active session changes
  useEffect(() => {
    if (!activeSession) {
      // Clean up message polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setMessages([]);
      lastMessageCountRef.current = 0;
      return;
    }

    console.log("ADMIN: Starting message polling for session:", activeSession);

    // Initial fetch
    fetchMessages(activeSession, true);

    // Setup polling interval for messages
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages(activeSession, true); // Silent updates
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeSession]);

  // Real-time subscriptions (as backup to polling)
  useEffect(() => {
    console.log("ADMIN: Setting up real-time subscriptions");

    // Set up real-time subscription for sessions
    const sessionsChannel = supabase
      .channel("admin-sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
        },
        () => {
          console.log("ADMIN: Real-time session change detected");
          fetchSessions(true);
        }
      )
      .subscribe((status) => {
        console.log("ADMIN: Sessions subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    // Set up real-time subscription for messages
    const messagesChannel = supabase
      .channel("admin-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          console.log("ADMIN: Real-time message received:", payload);
          const newMessage = payload.new as ChatMessage;

          // Update messages if it's for the active session
          if (activeSession && newMessage.session_id === activeSession) {
            console.log("ADMIN: Message is for active session, updating UI");

            setMessages((currentMessages) => {
              // Check if message already exists
              const exists = currentMessages.find(
                (msg) => msg.id === newMessage.id
              );
              if (exists) {
                console.log("ADMIN: Message already exists, skipping");
                return currentMessages;
              }

              console.log("ADMIN: Adding new message via real-time");
              const updated = [...currentMessages, newMessage];
              lastMessageCountRef.current = updated.length;

              // Force scroll to bottom for new messages
              if (!isMinimized) {
                forceScrollToBottom();
              }

              // Mark client messages as read
              if (newMessage.sender_type === "client") {
                supabase
                  .from("chat_messages")
                  .update({ read_by_admin: true })
                  .eq("id", newMessage.id);
              }

              return updated;
            });
          }

          // Always refresh sessions for unread counts
          fetchSessions(true);

          // Show notification for new client messages
          if (newMessage.sender_type === "client") {
            toast({
              title: "New Message",
              description: `New message from ${
                newMessage.sender_name || "Client"
              }`,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("ADMIN: Messages subscription status:", status);
      });

    return () => {
      console.log("ADMIN: Cleaning up real-time subscriptions");
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [activeSession, toast, isMinimized]);

  // Scroll to bottom whenever messages change and not minimized
  useEffect(() => {
    if (messages.length > 0 && !isMinimized && activeSession) {
      forceScrollToBottom();
    }
  }, [messages, isMinimized, activeSession]);

  // Handle minimize/maximize
  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    // Force scroll when maximizing
    if (messages.length > 0 && activeSession) {
      console.log("ADMIN: Maximizing chat, scrolling to bottom");
      setTimeout(() => forceScrollToBottom(), 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (sessionsPollingRef.current) {
        clearInterval(sessionsPollingRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const activeSessions = sessions.filter((s) => s.status === "active");
  const closedSessions = sessions.filter((s) => s.status === "closed");

  if (isMinimized) {
    return (
      <Card className="fixed bottom-4 right-4 w-80 z-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <MessageCircle className="w-4 h-4 mr-2" />
              Live Chat ({activeSessions.length})
              {isConnected ? (
                <Wifi className="w-3 h-3 ml-2 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 ml-2 text-gray-400" />
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleMaximize}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[500px] h-[650px] z-50 flex flex-col shadow-2xl">
      <CardHeader className="pb-2 flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center">
            <MessageCircle className="w-4 h-4 mr-2" />
            Live Chat Support
            {isConnected ? (
              <Wifi className="w-3 h-3 ml-2 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 ml-2 text-gray-400" />
            )}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <Badge variant="secondary" className="text-xs">
              {activeSessions.length} Active
            </Badge>
            <span className="text-xs text-gray-500">
              {isConnected ? "• Real-time" : "• Polling"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleMinimize}>
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <Tabs defaultValue="active" className="flex-1 flex flex-col h-full">
          <TabsList className="mx-4 mb-2 mt-2">
            <TabsTrigger value="active" className="text-xs">
              Active ({activeSessions.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              Closed ({closedSessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="active"
            className="flex-1 flex h-full overflow-hidden"
          >
            <div className="flex w-full h-full">
              {/* Sessions List - Fixed width */}
              <div className="w-[200px] border-r bg-gray-50 flex-shrink-0">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-2">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg cursor-pointer text-xs transition-colors ${
                          activeSession === session.id
                            ? "bg-blue-100 border-2 border-blue-300 shadow-sm"
                            : "bg-white hover:bg-gray-100 border border-gray-200"
                        }`}
                        onClick={() => setActiveSession(session.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center min-w-0">
                              <User className="w-3 h-3 mr-2 text-gray-600 flex-shrink-0" />
                              <span className="font-medium truncate text-gray-800">
                                {session.client_name || "Anonymous"}
                              </span>
                            </div>
                            {session.client_email && (
                              <div className="text-xs text-gray-500 truncate ml-5">
                                {session.client_email}
                              </div>
                            )}
                          </div>
                          {session.unread_count! > 0 && (
                            <Badge
                              variant="destructive"
                              className="text-xs px-2 py-1 ml-1 flex-shrink-0"
                            >
                              {session.unread_count}
                            </Badge>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {formatTime(session.last_message_at)}
                        </div>
                      </div>
                    ))}
                    {activeSessions.length === 0 && (
                      <div className="text-center text-gray-500 text-xs py-8">
                        No active chats
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Chat Area - Flexible width */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {activeSession ? (
                  <>
                    {/* Chat Header - Fixed height */}
                    <div className="p-3 border-b bg-gray-50 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium truncate">
                            {sessions.find((s) => s.id === activeSession)
                              ?.client_name || "Anonymous"}
                          </div>
                          {sessions.find((s) => s.id === activeSession)
                            ?.client_email && (
                            <div className="text-xs text-gray-500 truncate">
                              {
                                sessions.find((s) => s.id === activeSession)
                                  ?.client_email
                              }
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => closeSession(activeSession)}
                          className="text-xs h-6 px-2 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Messages - Flexible height with proper scrolling */}
                    <div className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="p-3 space-y-3">
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${
                                message.sender_type === "admin"
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[80%] p-3 rounded-lg text-xs shadow-sm break-words ${
                                  message.sender_type === "admin"
                                    ? "bg-blue-500 text-white rounded-br-sm"
                                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                                }`}
                              >
                                <div className="leading-relaxed whitespace-pre-wrap">
                                  {message.message}
                                </div>
                                <div
                                  className={`text-xs mt-2 ${
                                    message.sender_type === "admin"
                                      ? "text-blue-100"
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
                    </div>

                    {/* Message Input - Fixed height */}
                    <div className="p-3 border-t bg-white flex-shrink-0">
                      <div className="flex space-x-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          className="text-sm flex-1"
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className="px-3 bg-blue-500 hover:bg-blue-600 flex-shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    Select a chat to start messaging
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="closed" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {closedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-2 rounded bg-gray-50 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          <span className="font-medium">
                            {session.client_name || "Anonymous"}
                          </span>
                        </div>
                        {session.client_email && (
                          <div className="text-xs text-gray-500 ml-4">
                            {session.client_email}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Closed
                      </Badge>
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      {formatDate(session.updated_at)}
                    </div>
                  </div>
                ))}
                {closedSessions.length === 0 && (
                  <div className="text-center text-gray-500 text-xs py-4">
                    No closed chats
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
