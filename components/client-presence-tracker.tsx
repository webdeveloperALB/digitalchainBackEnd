"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UsePresenceTrackerProps {
  userId: string;
  enabled?: boolean;
  heartbeatInterval?: number;
}

export function usePresenceTracker({
  userId,
  enabled = true,
  heartbeatInterval = 30000, // 30 seconds
}: UsePresenceTrackerProps) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const lastPresenceUpdateRef = useRef(0);
  const [userIP, setUserIP] = useState<string>("");

  // Get user's IP address on component mount
  useEffect(() => {
    const getUserIP = async () => {
      try {
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        setUserIP(data.ip);
        console.log("User IP detected:", data.ip);
      } catch (error) {
        console.error("Failed to get user IP:", error);
      }
    };

    if (enabled && userId) {
      getUserIP();
    }
  }, [enabled, userId]);

  // Update presence in database WITH LOCATION
  const updatePresence = useCallback(
    async (isOnline: boolean, force = false) => {
      if (!userId || !enabled) return;

      // Prevent too frequent updates (minimum 10 seconds between updates)
      const now = Date.now();
      if (!force && now - lastPresenceUpdateRef.current < 10000) {
        return;
      }

      try {
        const timestamp = new Date().toISOString();
        let updateData: any = {
          user_id: userId,
          is_online: isOnline,
          last_seen: timestamp,
          updated_at: timestamp,
        };

        // If user is coming online and we have an IP, get location data
        if (isOnline && userIP) {
          try {
            console.log("Getting location for IP:", userIP);
            const locationResponse = await fetch(
              `https://ipapi.co/${userIP}/json/`
            );
            const locationData = await locationResponse.json();

            if (!locationData.error) {
              updateData = {
                ...updateData,
                ip_address: userIP,
                country: locationData.country_name || "Unknown",
                country_code: locationData.country_code || "",
                city: locationData.city || "Unknown",
                region: locationData.region || "",
              };
              console.log("Location data added:", {
                ip: userIP,
                country: locationData.country_name,
                city: locationData.city,
              });
            } else {
              console.warn("Location API error:", locationData.reason);
              updateData.ip_address = userIP; // Save IP even if location fails
            }
          } catch (locationError) {
            console.error("Error getting location:", locationError);
            updateData.ip_address = userIP; // Save IP even if location fails
          }
        }

        const { error } = await supabase
          .from("user_presence")
          .upsert(updateData, {
            onConflict: "user_id",
          });

        if (error) {
          console.error("Error updating presence:", error);
        } else {
          console.log(
            `Presence updated with location: ${
              isOnline ? "online" : "offline"
            } for user ${userId}`
          );
          isOnlineRef.current = isOnline;
          lastPresenceUpdateRef.current = now;
        }
      } catch (error) {
        console.error("Error in updatePresence:", error);
      }
    },
    [userId, enabled, userIP]
  );

  // Mark user offline (exposed function)
  const markOffline = useCallback(async () => {
    if (!userId) return;
    console.log("Marking user offline:", userId);
    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: false,
          last_seen: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id",
        }
      );
      if (error) {
        console.error("Error marking user offline:", error);
      } else {
        console.log("Successfully marked user offline");
        isOnlineRef.current = false;
      }
    } catch (error) {
      console.error("Error in markOffline:", error);
    }
  }, [userId]);

  // Track user activity
  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    // If user was offline, mark them as online
    if (!isOnlineRef.current) {
      console.log("User became active, marking online with location");
      updatePresence(true);
    }
  }, [updatePresence]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled || !userId) return;

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "focus",
    ];

    // Add throttling to prevent too many calls
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandleActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        handleActivity();
        throttleTimeout = null;
      }, 3000); // Throttle to once every 3 seconds
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledHandleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledHandleActivity, true);
      });
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [handleActivity, enabled, userId]);

  // Set up heartbeat with proper inactivity detection
  useEffect(() => {
    if (!enabled || !userId) return;

    // Initial presence update with location
    console.log("Starting presence tracking with location for user:", userId);
    updatePresence(true, true);

    // Set up heartbeat
    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      const inactivityThreshold = 120000; // 2 minutes of inactivity

      console.log(
        `Heartbeat check: ${timeSinceLastActivity}ms since last activity`
      );

      if (timeSinceLastActivity > inactivityThreshold) {
        // User has been inactive for more than 2 minutes
        if (isOnlineRef.current) {
          console.log("User inactive for 2+ minutes, marking offline");
          updatePresence(false, true);
        }
      } else {
        // User has been active recently
        if (!isOnlineRef.current) {
          console.log("User has recent activity, marking online with location");
          updatePresence(true, true);
        } else {
          // Just update last_seen and refresh location data
          console.log("User still active, updating presence with location");
          updatePresence(true);
        }
      }
    }, heartbeatInterval);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [updatePresence, enabled, userId, heartbeatInterval]);

  // Handle page visibility changes
  useEffect(() => {
    if (!enabled || !userId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Page hidden, will mark offline in 60 seconds");
        // Page is hidden, mark as offline after a shorter delay
        setTimeout(() => {
          if (document.hidden) {
            console.log("Page still hidden after 60s, marking offline");
            updatePresence(false, true);
          }
        }, 60000); // Wait 1 minute before marking offline
      } else {
        console.log("Page visible, marking online with location");
        // Page is visible, mark as online and update activity
        lastActivityRef.current = Date.now();
        updatePresence(true, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updatePresence, enabled, userId]);

  // Handle beforeunload to mark user offline
  useEffect(() => {
    if (!enabled || !userId) return;

    const handleBeforeUnload = () => {
      console.log("Page unloading, marking offline");
      // Use sendBeacon for reliable offline marking on page unload
      const data = JSON.stringify({
        user_id: userId,
        is_online: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Try to use sendBeacon for better reliability
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/presence/offline", data);
      }
    };

    const handlePageHide = () => {
      console.log("Page hiding, marking offline");
      handleBeforeUnload();
    };

    // Use both events for better coverage
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [updatePresence, enabled, userId]);

  return {
    updatePresence,
    markOffline,
    isOnline: isOnlineRef.current,
    userIP,
  };
}

// Main component that handles authentication and presence tracking
export default function PresenceTracker() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const presenceTrackerRef = useRef<{
    markOffline: () => Promise<void>;
  } | null>(null);

  // Store the presence tracker functions
  const { updatePresence, markOffline, isOnline, userIP } = usePresenceTracker({
    userId: user?.id || "",
    enabled: !!user && !loading,
    heartbeatInterval: 30000,
  });

  // Store markOffline function in ref for cleanup
  useEffect(() => {
    presenceTrackerRef.current = { markOffline };
  }, [markOffline]);

  // Get current user and set up auth listener
  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
      console.log("Initial user:", user?.id);
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);

      // Handle logout events
      if (event === "SIGNED_OUT") {
        console.log("User signed out, marking offline");
        // Mark the current user offline before clearing the user state
        if (user?.id) {
          try {
            const timestamp = new Date().toISOString();
            await supabase.from("user_presence").upsert(
              {
                user_id: user.id,
                is_online: false,
                last_seen: timestamp,
                updated_at: timestamp,
              },
              {
                onConflict: "user_id",
              }
            );
            console.log("Successfully marked user offline on sign out");
          } catch (error) {
            console.error("Error marking user offline on sign out:", error);
          }
        }
      }

      // Handle token refresh events
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed, maintaining online status");
        // Don't change user state on token refresh
        return;
      }

      // Update user state for other events
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Cleanup on unmount - mark user offline
  useEffect(() => {
    return () => {
      if (user?.id && presenceTrackerRef.current) {
        console.log("Component unmounting, marking user offline");
        presenceTrackerRef.current.markOffline();
      }
    };
  }, [user?.id]);

  // Show debug info in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && user && userIP) {
      console.log("Location tracking active:", {
        userId: user.id,
        userIP,
        isOnline,
      });
    }
  }, [user, userIP, isOnline]);

  return null; // This component doesn't render anything
}

// Export a hook for manual logout handling
export function usePresenceLogout() {
  const markUserOffline = useCallback(async (userId: string) => {
    if (!userId) return;
    console.log("Manual logout - marking user offline:", userId);
    try {
      const timestamp = new Date().toISOString();
      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: false,
          last_seen: timestamp,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id",
        }
      );
      if (error) {
        console.error("Error marking user offline on manual logout:", error);
      } else {
        console.log("Successfully marked user offline on manual logout");
      }
    } catch (error) {
      console.error("Error in manual logout presence update:", error);
    }
  }, []);

  return { markUserOffline };
}
