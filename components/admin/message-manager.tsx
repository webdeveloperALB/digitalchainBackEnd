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
  Search,
  Loader2,
  X,
  CheckCircle2,
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
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  kyc_status: string;
}

export default function MessageManager() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [alert, setAlert] = useState("");
  const [newMessage, setNewMessage] = useState({
    title: "",
    content: "",
    message_type: "info",
    target_type: "all" as "all" | "selected",
  });
  const [userSearch, setUserSearch] = useState("");
  const [totalUserCount, setTotalUserCount] = useState(0);

  useEffect(() => {
    fetchMessages();
    fetchTotalUserCount();
  }, []);

  // Fast user search - only when typing
  useEffect(() => {
    if (userSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select(
            "id, email, full_name, first_name, last_name, created_at, kyc_status"
          )
          .or(`email.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`)
          .limit(10)
          .order("created_at", { ascending: false });

        if (!error && data) {
          const transformedUsers = data.map((user: any) => ({
            id: user.id,
            email: user.email,
            full_name:
              user.full_name ||
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              user.email?.split("@")[0] ||
              "Unknown",
            first_name: user.first_name,
            last_name: user.last_name,
            created_at: user.created_at,
            kyc_status: user.kyc_status,
          }));
          setSearchResults(transformedUsers);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearch]);

  const fetchTotalUserCount = async () => {
    try {
      const { count, error } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      if (error) {
        console.error("Error fetching user count:", error);
        return;
      }

      setTotalUserCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching user count:", error);
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

  const addSelectedUser = (user: User) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUserSearch("");
    setSearchResults([]);
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  const getUserDisplayName = (user: User) => {
    return user.full_name || user.email || `User ${user.id.slice(0, 8)}`;
  };

  const sendMessage = async () => {
    if (!newMessage.title.trim() || !newMessage.content.trim()) {
      setAlert("Please fill in both title and content");
      return;
    }

    if (newMessage.target_type === "selected" && selectedUsers.length === 0) {
      setAlert("Please select at least one user or choose 'All Users'");
      return;
    }

    setLoading(true);
    try {
      if (newMessage.target_type === "all") {
        // Get all users and send messages in batches
        let allUsers: User[] = [];
        let from = 0;
        const batchSize = 1000;

        // Fetch all users in batches
        while (true) {
          const { data, error } = await supabase
            .from("users")
            .select(
              "id, email, full_name, first_name, last_name, created_at, kyc_status"
            )
            .range(from, from + batchSize - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;

          allUsers = [...allUsers, ...data];
          if (data.length < batchSize) break;
          from += batchSize;
        }

        // Send messages in batches
        const messageData = allUsers.map((user) => ({
          user_id: user.id,
          title: newMessage.title,
          content: newMessage.content,
          message_type: newMessage.message_type,
          is_read: false,
        }));

        // Insert in batches of 100
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < messageData.length; i += 100) {
          const batch = messageData.slice(i, i + 100);
          const { error } = await supabase.from("user_messages").insert(batch);

          if (error) {
            console.error("Batch error:", error);
            errorCount += batch.length;
          } else {
            successCount += batch.length;
          }
        }

        if (errorCount > 0) {
          setAlert(
            `Message sent to ${successCount} users, ${errorCount} failed`
          );
        } else {
          setAlert(`Message sent to all ${successCount} users successfully!`);
        }
      } else {
        // Send to selected users
        const messageData = selectedUsers.map((user) => ({
          user_id: user.id,
          title: newMessage.title,
          content: newMessage.content,
          message_type: newMessage.message_type,
          is_read: false,
        }));

        const { error } = await supabase
          .from("user_messages")
          .insert(messageData);

        if (error) {
          console.error("Error sending message:", error);
          setAlert(`Error sending message: ${error.message}`);
        } else {
          setAlert(
            `Message sent to ${selectedUsers.length} users successfully!`
          );
        }
      }

      // Reset form
      setNewMessage({
        title: "",
        content: "",
        message_type: "info",
        target_type: "all",
      });
      setSelectedUsers([]);
      setUserSearch("");

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
          <span className="text-sm text-gray-600">
            {totalUserCount} total users
          </span>
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
            aria-label="Close alert"
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
          {/* Target Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium">Target Audience</label>

            {/* Target Type Selection */}
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="target_type"
                  value="all"
                  checked={newMessage.target_type === "all"}
                  onChange={(e) =>
                    setNewMessage({
                      ...newMessage,
                      target_type: e.target.value as "all" | "selected",
                    })
                  }
                />
                <span>All Users ({totalUserCount})</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="target_type"
                  value="selected"
                  checked={newMessage.target_type === "selected"}
                  onChange={(e) =>
                    setNewMessage({
                      ...newMessage,
                      target_type: e.target.value as "all" | "selected",
                    })
                  }
                />
                <span>Selected Users ({selectedUsers.length})</span>
              </label>
            </div>

            {/* User Search and Selection */}
            {newMessage.target_type === "selected" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>

                {/* Search Results */}
                {userSearch.length >= 2 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => addSelectedUser(user)}
                        >
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-sm">
                                {getUserDisplayName(user)}
                              </p>
                              <p className="text-xs text-gray-500">
                                DCB{user.id.slice(0, 6)} • {user.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : !searching ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No users found matching "{userSearch}"
                      </div>
                    ) : null}
                  </div>
                )}

                {userSearch.length > 0 && userSearch.length < 2 && (
                  <p className="text-xs text-gray-500">
                    Type at least 2 characters to search
                  </p>
                )}

                {/* Selected Users */}
                {selectedUsers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected Users:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                        >
                          <span>{getUserDisplayName(user)}</span>
                          <button
                            onClick={() => removeSelectedUser(user.id)}
                            className="hover:bg-blue-200 rounded-full p-0.5"
                            aria-label="Remove user"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message Type */}
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
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Message"
            )}
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
                          <span>To: User {message.user_id.slice(0, 8)}...</span>
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
