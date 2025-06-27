"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Message {
  id: string;
  user_id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
}

export function useLatestMessage() {
  const [latestMessage, setLatestMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestMessage = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching latest message:", error.message || error);
        setError(error.message || "Failed to fetch message");
      } else {
        setLatestMessage(data || null);
        setError(null);
      }
    } catch (error: any) {
      console.error("Error fetching latest message:", error.message || error);
      setError(error.message || "Failed to fetch message");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("user_messages")
        .update({ is_read: true })
        .eq("id", messageId);

      if (error) {
        console.error("Error marking message as read:", error);
        throw error;
      }

      // Update local state
      setLatestMessage(null);
    } catch (error: any) {
      console.error("Error marking message as read:", error);
      throw error;
    }
  };

  useEffect(() => {
    fetchLatestMessage();

    // Set up real-time subscription
    const subscription = supabase
      .channel("user_messages_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_messages",
        },
        () => {
          fetchLatestMessage();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    latestMessage,
    loading,
    error,
    markAsRead,
    refetch: fetchLatestMessage,
  };
}
