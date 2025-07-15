"use client";
import { useState, useEffect, useCallback } from "react";
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

  // Memoized function to update statistics
  const updateStatistics = useCallback((presences: UserPresence[]) => {
    const online = presences.filter((p) => p.is_online).length;
    setOnlineCount(online);
    setTotalUsers(presences.length);
  }, []);

  // Optimized function to handle real-time presence updates
  const handlePresenceUpdate = useCallback(async (payload: any) => {
    console.log("Real-time presence update:", payload);

    if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
      const updatedPresence = payload.new;

      // Get user info for the updated presence
      let userInfo = {};
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("email, first_name, last_name, full_name")
          .eq("id", updatedPresence.user_id)
          .single();

        if (userData) {
          userInfo = {
            user_email: userData.email,
            user_name:
              userData.full_name ||
              `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
            first_name: userData.first_name,
            last_name: userData.last_name,
            full_name: userData.full_name,
          };
        } else {
          // Fallback to profiles table
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", updatedPresence.user_id)
            .single();

          userInfo = {
            user_email: profileData?.email || "Unknown",
            user_name: profileData?.full_name || "Unknown User",
          };
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }

      const presenceWithUserInfo = { ...updatedPresence, ...userInfo };

      // Update the state directly instead of refetching everything
      setUserPresences((prev) => {
        const existingIndex = prev.findIndex(
          (p) => p.user_id === updatedPresence.user_id
        );
        let newPresences;

        if (existingIndex >= 0) {
          // Update existing presence
          newPresences = [...prev];
          newPresences[existingIndex] = presenceWithUserInfo;
        } else {
          // Add new presence
          newPresences = [...prev, presenceWithUserInfo];
        }

        // Sort by online status first, then by last seen
        newPresences.sort((a, b) => {
          if (a.is_online !== b.is_online) {
            return b.is_online ? 1 : -1;
          }
          return (
            new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
          );
        });

        return newPresences;
      });
    } else if (payload.eventType === "DELETE") {
      // Remove deleted presence
      setUserPresences((prev) =>
        prev.filter((p) => p.user_id !== payload.old.user_id)
      );
    }
  }, []);

  const checkForOfflineUsers = async () => {
    try {
      // Mark users as offline if they haven't been seen in the last 3 minutes
      const offlineThreshold = new Date(
        Date.now() - 3 * 60 * 1000
      ).toISOString();

      const { data: staleUsers, error: selectError } = await supabase
        .from("user_presence")
        .select("user_id, last_seen")
        .eq("is_online", true)
        .lt("last_seen", offlineThreshold);

      if (selectError) {
        console.error("Error selecting stale users:", selectError);
        return;
      }

      if (staleUsers && staleUsers.length > 0) {
        console.log(`Found ${staleUsers.length} users to mark offline`);

        const { error: updateError } = await supabase
          .from("user_presence")
          .update({
            is_online: false,
            updated_at: new Date().toISOString(),
          })
          .eq("is_online", true)
          .lt("last_seen", offlineThreshold);

        if (updateError) {
          console.error("Error updating offline users:", updateError);
        } else {
          console.log(`Marked ${staleUsers.length} users as offline`);
        }
      }
    } catch (error) {
      console.error("Error in checkForOfflineUsers:", error);
    }
  };

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
      updateStatistics(presencesWithUserInfo);

      console.log(
        `Presence loaded: ${
          presencesWithUserInfo.filter((p) => p.is_online).length
        } online out of ${presencesWithUserInfo.length} total users`
      );
    } catch (error) {
      console.error("Error fetching user presences:", error);
      setMessage({ type: "error", text: "Failed to load user presence data" });
    } finally {
      setLoading(false);
    }
  };

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
        handlePresenceUpdate
      )
      .subscribe();

    // Check for offline users every 30 seconds
    const offlineCheckInterval = setInterval(() => {
      checkForOfflineUsers();
    }, 30000);

    return () => {
      presenceSubscription.unsubscribe();
      clearInterval(offlineCheckInterval);
    };
  }, [handlePresenceUpdate]);

  // Update statistics when userPresences changes
  useEffect(() => {
    updateStatistics(userPresences);
  }, [userPresences, updateStatistics]);

  const formatLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInSeconds = Math.floor(
      (now.getTime() - lastSeenDate.getTime()) / 1000
    );

    if (diffInSeconds < 30) return "Just now";
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
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
            <Badge variant="outline" className="ml-2 text-xs">
              Live
            </Badge>
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
                  className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 ${
                    presence.is_online
                      ? "hover:bg-green-50 border-green-200 bg-green-25"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-gray-500" />
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white transition-colors duration-200 ${
                          presence.is_online
                            ? "bg-green-500 animate-pulse"
                            : "bg-gray-400"
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

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
