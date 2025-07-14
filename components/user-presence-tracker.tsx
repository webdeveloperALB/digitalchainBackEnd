"use client"
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function UserPresenceTracker() {
  useEffect(() => {
    let heartbeatInterval: NodeJS.Timeout

    const updatePresence = async (isOnline: boolean) => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { error } = await supabase
          .from('user_presence')
          .upsert({
            user_id: user.id,
            is_online: isOnline,
            last_seen: new Date().toISOString()
          })
        
        if (error) {
          console.error('Error updating presence:', error)
        }
      }
    }

    const startHeartbeat = () => {
      // Update presence every 30 seconds while online
      heartbeatInterval = setInterval(() => {
        updatePresence(true)
      }, 30000)
    }

    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await updatePresence(true)
          startHeartbeat()
        } else if (event === 'SIGNED_OUT') {
          stopHeartbeat()
          // Don't update presence on sign out - let it timeout naturally
        }
      }
    )

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopHeartbeat()
        updatePresence(false)
      } else {
        updatePresence(true)
        startHeartbeat()
      }
    }

    // Handle page unload
    const handleBeforeUnload = () => {
      updatePresence(false)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Initial presence update if user is already signed in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        updatePresence(true)
        startHeartbeat()
      }
    })

    return () => {
      stopHeartbeat()
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  return null // This component doesn't render anything
}
