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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Trash2,
  Users,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
} from "lucide-react";

interface Message {
  id: string;
  user_id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  client_id: string | null;
}

export default function MessageManager() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState("");
  const [newMessage, setNewMessage] = useState({
    title: "",
    content: "",
    message_type: "info",
    target_user: "all",
  });
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    fetchMessages();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, client_id")
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
      const { data, error } = await supabase
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

      setMessages(data || []);
    } catch (error: any) {
      console.error("Error fetching messages:", error.message || error);
      setAlert(`Error fetching messages: ${error.message || "Unknown error"}`);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!userSearch.trim()) return true;
    const searchTerm = userSearch.toLowerCase();
    const fullName = user.full_name?.toLowerCase() || "";
    const email = user.email?.toLowerCase() || "";
    return fullName.includes(searchTerm) || email.includes(searchTerm);
  });

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.full_name || user?.email || `User ${userId.slice(0, 8)}`;
  };

  const sendMessage = async () => {
    if (!newMessage.title.trim() || !newMessage.content.trim()) {
      setAlert("Please fill in both title and content");
      return;
    }

    setLoading(true);
    try {
      if (newMessage.target_user === "all") {
        // Send to all users
        const messagePromises = users.map((user) =>
          supabase.from("user_messages").insert({
            user_id: user.id,
            title: newMessage.title,
            content: newMessage.content,
            message_type: newMessage.message_type,
            is_read: false,
          })
        );

        const results = await Promise.all(messagePromises);
        const errors = results.filter((result) => result.error);

        if (errors.length > 0) {
          console.error("Some messages failed to send:", errors);
          setAlert(`${errors.length} messages failed to send`);
        } else {
          setAlert(`Message sent to all ${users.length} users successfully!`);
        }
      } else {
        // Send to specific user
        const { error } = await supabase.from("user_messages").insert({
          user_id: newMessage.target_user,
          title: newMessage.title,
          content: newMessage.content,
          message_type: newMessage.message_type,
          is_read: false,
        });

        if (error) {
          console.error("Error sending message:", error);
          setAlert(`Error sending message: ${error.message}`);
        } else {
          setAlert("Message sent successfully!");
        }
      }

      // Reset form
      setNewMessage({
        title: "",
        content: "",
        message_type: "info",
        target_user: "all",
      });

      // Refresh messages
      fetchMessages();
    } catch (error: any) {
      console.error("Error sending message:", error);
      setAlert(`Error sending message: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("user_messages")
        .delete()
        .eq("id", messageId);

      if (error) {
        console.error("Error deleting message:", error);
        setAlert(`Error deleting message: ${error.message}`);
        return;
      }

      setAlert("Message deleted successfully!");
      fetchMessages();
    } catch (error: any) {
      console.error("Error deleting message:", error);
      setAlert(`Error deleting message: ${error.message || "Unknown error"}`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Message Manager</h2>
          <p className="text-gray-600">
            Send messages to users and manage communications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-gray-500" />
          <span className="text-sm text-gray-600">{users.length} users</span>
        </div>
      </div>

      {alert && (
        <Alert className="border-blue-500 bg-blue-50">
          <Info className="h-4 w-4" />
          <AlertDescription>{alert}</AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAlert("")}
            className="ml-auto"
          >
            ×
          </Button>
        </Alert>
      )}

      {/* Send New Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="h-5 w-5 mr-2" />
            Send New Message
          </CardTitle>
          <CardDescription>
            Broadcast messages to users or send to specific individuals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Target Audience
              </label>
              <div className="space-y-2">
                <Input
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full"
                />
                <Select
                  value={newMessage.target_user}
                  onValueChange={(value) =>
                    setNewMessage({ ...newMessage, target_user: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Users ({users.length})
                    </SelectItem>
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email} ({user.client_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {userSearch.trim() && (
                  <p className="text-xs text-gray-500">
                    Showing {filteredUsers.length} of {users.length} users
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Message Type
              </label>
              <Select
                value={newMessage.message_type}
                onValueChange={(value) =>
                  setNewMessage({ ...newMessage, message_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Information</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Title</label>
            <Input
              placeholder="Message title..."
              value={newMessage.title}
              onChange={(e) =>
                setNewMessage({ ...newMessage, title: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Content</label>
            <Textarea
              placeholder="Message content..."
              value={newMessage.content}
              onChange={(e) =>
                setNewMessage({ ...newMessage, content: e.target.value })
              }
              rows={4}
            />
          </div>
          <Button onClick={sendMessage} disabled={loading} className="w-full">
            {loading ? "Sending..." : "Send Message"}
          </Button>
        </CardContent>
      </Card>

      {/* Message History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Message History
          </CardTitle>
          <CardDescription>Recent messages sent to users</CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages sent yet</p>
              <p className="text-sm">Messages you send will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getMessageIcon(message.message_type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{message.title}</h4>
                          <Badge
                            className={getMessageTypeColor(
                              message.message_type
                            )}
                          >
                            {message.message_type}
                          </Badge>
                          {!message.is_read && (
                            <Badge variant="secondary">Unread</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {message.content}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>To: {getUserName(message.user_id)}</span>
                          <span>
                            {new Date(message.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMessage(message.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
