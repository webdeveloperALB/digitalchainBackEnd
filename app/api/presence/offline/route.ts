import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, is_online, last_seen, updated_at } = body

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const { error } = await supabase.from("user_presence").upsert(
      {
        user_id,
        is_online,
        last_seen,
        updated_at,
      },
      {
        onConflict: "user_id",
      },
    )

    if (error) {
      console.error("Error updating presence:", error)
      return NextResponse.json({ error: "Failed to update presence" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in presence API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
