"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Message {
  id: string;
  title: string;
  content: string;
  message_type: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
}

export function useLatestMessage() {
  const [latestMessage, setLatestMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestMessage();

    // Set up real-time subscription
    const channel = supabase
      .channel("latest-message")
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
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLatestMessage = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLatestMessage(null);
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
        setError(error.message || "Unknown error");
      } else {
        setLatestMessage(data || null);
        setError(null);
      }
    } catch (err: any) {
      console.error("Error in fetchLatestMessage:", err.message || err);
      setError(err.message || "Unknown error");
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
        console.error("Error marking message as read:", error.message || error);
        throw error;
      }

      // Refresh latest message
      await fetchLatestMessage();
    } catch (err: any) {
      console.error("Error in markAsRead:", err.message || err);
      throw err;
    }
  };

  return {
    latestMessage,
    loading,
    error,
    markAsRead,
    refetch: fetchLatestMessage,
  };
}
