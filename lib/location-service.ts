export interface LocationInfo {
  ip: string
  country?: string
  country_code?: string
  city?: string
  region?: string
}

// Get user's IP address
export async function getUserIP(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json")
    const data = await response.json()
    return data.ip || ""
  } catch (error) {
    console.error("Failed to get IP:", error)
    return ""
  }
}

// Get location from IP
export async function getLocationFromIP(ip: string): Promise<LocationInfo> {
  if (!ip) return { ip: "" }

  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
    const data = await response.json()

    return {
      ip,
      country: data.country_name || "Unknown",
      country_code: data.country_code || "",
      city: data.city || "Unknown",
      region: data.region || "",
    }
  } catch (error) {
    console.error("Failed to get location:", error)
    return { ip }
  }
}
