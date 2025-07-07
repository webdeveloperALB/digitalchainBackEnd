"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useKYCStatus(userId: string | null) {
  const [kycStatus, setKycStatus] = useState<
    "not_started" | "pending" | "approved" | "rejected" | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkKYCStatus = async () => {
      try {
        // First check user's KYC status
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("kyc_status")
          .eq("id", userId)
          .single();

        if (userError) throw userError;

        setKycStatus(userData?.kyc_status || "not_started");
      } catch (error) {
        console.error("Error checking KYC status:", error);
        setKycStatus("not_started");
      } finally {
        setLoading(false);
      }
    };

    checkKYCStatus();
  }, [userId]);

  return { kycStatus, loading };
}
