"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserPresence {
  user_id: string
  is_online: boolean
  last_seen: string
  full_name?: string
  email?: string
  client_id?: string
}

export function useUserPresence() {
  const [userPresences, setUserPresences] = useState<UserPresence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserPresences()
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('user_presence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload) => {
          console.log('Presence change:', payload)
          fetchUserPresences()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchUserPresences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select(`
          user_id,
          is_online,
          last_seen,
          users:user_id (
            full_name,
            email,
            first_name,
            last_name
          ),
          profiles:user_id (
            full_name,
            email,
            client_id
          )
        `)
        .order('last_seen', { ascending: false })

      if (error) throw error

      const transformedData = (data || []).map((item: any) => ({
        user_id: item.user_id,
        is_online: item.is_online,
        last_seen: item.last_seen,
        full_name: item.profiles?.full_name || item.users?.full_name || 
                  `${item.users?.first_name || ''} ${item.users?.last_name || ''}`.trim(),
        email: item.profiles?.email || item.users?.email,
        client_id: item.profiles?.client_id || `DCB${item.user_id.slice(0, 6)}`
      }))

      setUserPresences(transformedData)
    } catch (error) {
      console.error('Error fetching user presences:', error)
    } finally {
      setLoading(false)
    }
  }

  return { userPresences, loading, refetch: fetchUserPresences }
}
