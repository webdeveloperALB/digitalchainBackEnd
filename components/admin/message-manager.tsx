"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Send,
  Users,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  client_id: string | null;
}

interface Message {
  id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
}

export default function MessageManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchMessages();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching users:", error.message || error);
        setAlert(`Error fetching users: ${error.message || "Unknown error"}`);
        return;
      }

      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error.message || error);
      setAlert(`Error fetching users: ${error.message || "Unknown error"}`);
    }
  };

  const fetchMessages = async () => {
    try {
      // Fetch messages without join - we'll get user info separately
      const { data: messagesData, error } = await supabase
        .from("user_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching messages:", error.message || error);
        setAlert(
          `Error fetching messages: ${error.message || "Unknown error"}`
        );
        return;
      }

      setMessages(messagesData || []);
    } catch (error: any) {
      console.error("Error fetching messages:", error.message || error);
      setAlert(`Error fetching messages: ${error.message || "Unknown error"}`);
    }
  };

  const sendMessage = async () => {
    if (!messageTitle.trim() || !messageContent.trim()) {
      setAlert("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      if (selectedUser === "all") {
        // Send to all users
        const messagePromises = users.map((user) =>
          supabase.from("user_messages").insert({
            user_id: user.id,
            title: messageTitle,
            content: messageContent,
            message_type: messageType,
            is_read: false,
          })
        );

        await Promise.all(messagePromises);
        setAlert(`Message sent to all ${users.length} users successfully!`);
      } else if (selectedUser) {
        // Send to specific user
        const { error } = await supabase.from("user_messages").insert({
          user_id: selectedUser,
          title: messageTitle,
          content: messageContent,
          message_type: messageType,
          is_read: false,
        });

        if (error) throw error;

        const user = users.find((u) => u.id === selectedUser);
        setAlert(
          `Message sent to ${user?.full_name || user?.email} successfully!`
        );
      } else {
        setAlert("Please select a user");
        return;
      }

      // Reset form
      setMessageTitle("");
      setMessageContent("");
      setMessageType("info");
      setSelectedUser("");

      // Refresh messages
      fetchMessages();
    } catch (error: any) {
      console.error("Error sending message:", error.message || error);
      setAlert(`Error sending message: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-100 text-green-800";
      case "alert":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.full_name || user?.email || "Unknown User";
  };

  return (
    <div className="p-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Message Manager
          </h1>
          <p className="text-gray-600">
            Send messages and notifications to users
          </p>
        </div>

        {alert && (
          <Alert className="mb-6">
            <AlertDescription>{alert}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="send" className="space-y-6">
          <TabsList>
            <TabsTrigger value="send">Send Message</TabsTrigger>
            <TabsTrigger value="history">Message History</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Send className="h-5 w-5" />
                  <span>Send New Message</span>
                </CardTitle>
                <CardDescription>
                  Send messages to individual users or broadcast to all users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="user-select">Select Recipient</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user or broadcast to all" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        📢 Broadcast to All Users ({users.length})
                      </SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email} ({user.client_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="message-title">Message Title</Label>
                    <Input
                      id="message-title"
                      placeholder="Enter message title"
                      value={messageTitle}
                      onChange={(e) => setMessageTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="message-type">Message Type</Label>
                    <Select value={messageType} onValueChange={setMessageType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">ℹ️ Information</SelectItem>
                        <SelectItem value="success">✅ Success</SelectItem>
                        <SelectItem value="warning">⚠️ Warning</SelectItem>
                        <SelectItem value="alert">🚨 Alert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="message-content">Message Content</Label>
                  <Textarea
                    id="message-content"
                    placeholder="Enter your message content here..."
                    rows={4}
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                  />
                </div>

                <Button
                  onClick={sendMessage}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Sending..." : "Send Message"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Message History</span>
                </CardTitle>
                <CardDescription>Recent messages sent to users</CardDescription>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No messages sent yet</p>
                    <p className="text-sm">
                      Start sending messages to see them here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {getMessageIcon(message.message_type)}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-semibold">
                                  {message.title}
                                </h4>
                                <Badge
                                  className={getMessageTypeColor(
                                    message.message_type
                                  )}
                                >
                                  {message.message_type}
                                </Badge>
                              </div>
                              <p className="text-gray-600 mb-2">
                                {message.content}
                              </p>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>To: {getUserName(message.user_id)}</span>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    message.created_at
                                  ).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={message.is_read ? "default" : "secondary"}
                          >
                            {message.is_read ? "Read" : "Unread"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>User Management</span>
                </CardTitle>
                <CardDescription>
                  View and manage registered users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                    <p className="text-sm">
                      Users will appear here when they register
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-[#F26623] rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {(user.full_name || user.email || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {user.full_name || "No name"}
                            </p>
                            <p className="text-sm text-gray-600">
                              {user.email}
                            </p>
                            <p className="text-xs text-gray-500">
                              Client ID: {user.client_id}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(user.id)}
                          className="ml-4"
                        >
                          Send Message
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
