"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/auth/auth-form";
import Dashboard from "@/components/dashboard/dashboard";
import type { User } from "@supabase/supabase-js";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <>
        {/* inline keyframes + utility class */}
        <style>
          {`
      @keyframes zoomInOut {
        0%, 100% { transform: scale(1); }
        50%       { transform: scale(1.2); }
      }
      .zoom-breath {
        animation: zoomInOut 2s ease-in-out infinite;
      }
    `}
        </style>

        <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-gradient-to-br from-orange-50 to-orange-100">
          {/* massive logo + breathing effect */}
          <img
            src="/logo.svg"
            alt="Loading logo"
            className="w-64 h-64 object-contain zoom-breath"
          />
          <p className="text-gray-600 text-2xl text-center">Loading...</p>
        </div>
      </>
    );
  }

  return user ? <Dashboard /> : <AuthForm />;
}
