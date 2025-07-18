"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function AutoLocationTracker() {
  const [status, setStatus] = useState<string>("Initializing...")

  useEffect(() => {
    const updateLocation = async () => {
      try {
        setStatus("Getting user...")

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setStatus("No user logged in")
          return
        }

        setStatus("Getting IP address...")

        // Get IP
        const ipResponse = await fetch("https://api.ipify.org?format=json")
        const ipData = await ipResponse.json()
        const userIP = ipData.ip

        setStatus(`Got IP: ${userIP}, getting location...`)

        // Get location
        const locationResponse = await fetch(`https://ipapi.co/${userIP}/json/`)
        const locationData = await locationResponse.json()

        setStatus(`Got location: ${locationData.city}, ${locationData.country_name}. Saving...`)

        // Save to database
        const { error } = await supabase.from("user_presence").upsert(
          {
            user_id: user.id,
            is_online: true,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ip_address: userIP,
            country: locationData.country_name || "Unknown",
            country_code: locationData.country_code || "XX",
            city: locationData.city || "Unknown",
            region: locationData.region || "Unknown",
          },
          { onConflict: "user_id" },
        )

        if (error) {
          setStatus(`Error: ${error.message}`)
          console.error("Location update error:", error)
        } else {
          setStatus(`✅ Location updated: ${locationData.city}, ${locationData.country_name}`)
          console.log("Location updated successfully")
        }
      } catch (error) {
        setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
        console.error("Location tracking error:", error)
      }
    }

    updateLocation()

    // Update every 30 seconds
    const interval = setInterval(updateLocation, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-2 rounded text-xs max-w-xs">
      Location Tracker: {status}
    </div>
  )
}
