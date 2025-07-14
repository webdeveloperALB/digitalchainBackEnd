"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Users, Circle, Clock, Wifi, WifiOff } from "lucide-react";

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

export default function UserPresenceTracker() {
  const [userPresences, setUserPresences] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  useEffect(() => {
    fetchUserPresences();

    // Set up real-time subscription for presence updates
    const presenceSubscription = supabase
      .channel("user_presence_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
        },
        (payload) => {
          console.log("Presence change detected:", payload);
          fetchUserPresences(); // Refresh the list when changes occur
        }
      )
      .subscribe();

    // Set up periodic check for offline users (users who haven't been seen recently)
    const offlineCheckInterval = setInterval(() => {
      checkForOfflineUsers();
      fetchUserPresences();
    }, 15000); // Check every 15 seconds

    return () => {
      presenceSubscription.unsubscribe();
      clearInterval(offlineCheckInterval);
    };
  }, []);

  const fetchUserPresences = async () => {
    try {
      setLoading(true);

      // First, run offline check
      await checkForOfflineUsers();

      // Get all user presences with user information
      const { data: presenceData, error: presenceError } = await supabase
        .from("user_presence")
        .select("*")
        .order("is_online", { ascending: false })
        .order("last_seen", { ascending: false });

      if (presenceError) {
        console.error("Error fetching presence data:", presenceError);
        throw presenceError;
      }

      if (!presenceData || presenceData.length === 0) {
        console.log("No presence data found");
        setUserPresences([]);
        setOnlineCount(0);
        setTotalUsers(0);
        return;
      }

      // Get user details for each presence record
      const presencesWithUserInfo = await Promise.all(
        presenceData.map(async (presence) => {
          // Try to get user info from users table first
          const { data: userData } = await supabase
            .from("users")
            .select("email, first_name, last_name, full_name")
            .eq("id", presence.user_id)
            .single();

          if (userData) {
            return {
              ...presence,
              user_email: userData.email,
              user_name:
                userData.full_name ||
                `${userData.first_name || ""} ${
                  userData.last_name || ""
                }`.trim(),
              first_name: userData.first_name,
              last_name: userData.last_name,
              full_name: userData.full_name,
            };
          }

          // Fallback to profiles table
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", presence.user_id)
            .single();

          return {
            ...presence,
            user_email: profileData?.email || "Unknown",
            user_name: profileData?.full_name || "Unknown User",
          };
        })
      );

      setUserPresences(presencesWithUserInfo);

      // Calculate statistics
      const online = presencesWithUserInfo.filter((p) => p.is_online).length;
      setOnlineCount(online);
      setTotalUsers(presencesWithUserInfo.length);

      console.log(
        `Presence updated: ${online} online out of ${presencesWithUserInfo.length} total users`
      );
    } catch (error) {
      console.error("Error fetching user presences:", error);
      setMessage({ type: "error", text: "Failed to load user presence data" });
    } finally {
      setLoading(false);
    }
  };

  const checkForOfflineUsers = async () => {
    try {
      // Mark users as offline if they haven't been seen in the last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from("user_presence")
        .update({
          is_online: false,
          updated_at: new Date().toISOString(),
        })
        .eq("is_online", true)
        .lt("last_seen", twoMinutesAgo);

      if (error) {
        console.error("Error updating offline users:", error);
      } else {
        console.log("Checked for offline users");
      }
    } catch (error) {
      console.error("Error in checkForOfflineUsers:", error);
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = Math.floor(
      (now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? "text-green-500" : "text-gray-400";
  };

  const getStatusBadge = (isOnline: boolean) => {
    return isOnline ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <Circle className="w-2 h-2 mr-1 fill-current" />
        Online
      </Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200">
        <Circle className="w-2 h-2 mr-1 fill-current" />
        Offline
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            User Presence Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-3 border rounded-lg animate-pulse"
              >
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="w-16 h-6 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Online Users
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {onlineCount}
                </p>
              </div>
              <Wifi className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Offline Users
                </p>
                <p className="text-2xl font-bold text-gray-600">
                  {totalUsers - onlineCount}
                </p>
              </div>
              <WifiOff className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-blue-600">{totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Presence List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Real-Time User Presence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {userPresences.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              userPresences.map((presence) => (
                <div
                  key={presence.user_id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-gray-500" />
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                          presence.is_online ? "bg-green-500" : "bg-gray-400"
                        }`}
                      ></div>
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {presence.user_name ||
                          presence.user_email ||
                          "Unknown User"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {presence.user_email}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {presence.is_online
                            ? "Active now"
                            : `Last seen ${formatLastSeen(presence.last_seen)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(presence.is_online)}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
