"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { User, Session } from "@supabase/supabase-js"

interface SessionState {
    user: User | null
    session: Session | null
    loading: boolean
    error: string | null
    isRefreshing: boolean
}

export function useSessionManager() {
    const [sessionState, setSessionState] = useState<SessionState>({
        user: null,
        session: null,
        loading: true,
        error: null,
        isRefreshing: false,
    })

    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const lastActivityRef = useRef<number>(Date.now())
    const isRefreshingRef = useRef<boolean>(false)

    // Proactive session refresh function
    const refreshSession = useCallback(
        async (force = false) => {
            // Prevent multiple simultaneous refresh attempts
            if (isRefreshingRef.current && !force) {
                console.log("Session refresh already in progress, skipping...")
                return sessionState.session
            }

            isRefreshingRef.current = true
            setSessionState((prev) => ({ ...prev, isRefreshing: true, error: null }))

            try {
                console.log("Refreshing Supabase session...")

                // Get current session
                const {
                    data: { session },
                    error: sessionError,
                } = await supabase.auth.getSession()

                if (sessionError) {
                    console.error("Session fetch error:", sessionError)
                    throw new Error(`Session fetch failed: ${sessionError.message}`)
                }

                if (!session) {
                    console.log("No active session found")
                    setSessionState({
                        user: null,
                        session: null,
                        loading: false,
                        error: null,
                        isRefreshing: false,
                    })
                    return null
                }

                // Check if session is close to expiring (refresh if less than 10 minutes left)
                const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
                const now = Date.now()
                const timeUntilExpiry = expiresAt - now
                const shouldRefresh = timeUntilExpiry < 10 * 60 * 1000 // 10 minutes instead of 5

                if (shouldRefresh || force) {
                    console.log("Session needs refresh, refreshing token...")

                    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

                    if (refreshError) {
                        console.error("Session refresh error:", refreshError)
                        throw new Error(`Session refresh failed: ${refreshError.message}`)
                    }

                    if (refreshData.session) {
                        console.log("Session refreshed successfully")

                        // Validate the refreshed session with a test query
                        const { error: testError } = await supabase
                            .from("users")
                            .select("id")
                            .eq("id", refreshData.session.user.id)
                            .limit(1)

                        if (testError) {
                            console.error("Session validation failed:", testError)
                            throw new Error("Refreshed session is invalid")
                        }

                        setSessionState({
                            user: refreshData.session.user,
                            session: refreshData.session,
                            loading: false,
                            error: null,
                            isRefreshing: false,
                        })

                        // Schedule next refresh
                        scheduleNextRefresh(refreshData.session)

                        return refreshData.session
                    }
                } else {
                    // Even if session doesn't need refresh, still validate it every 2 minutes
                    console.log("Session still valid, performing validation check...")

                    // Quick validation check
                    const { error: testError } = await supabase.from("users").select("id").eq("id", session.user.id).limit(1)

                    if (testError) {
                        console.error("Session validation failed, forcing refresh:", testError)
                        // Force refresh if validation fails
                        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

                        if (refreshError) {
                            throw new Error(`Session refresh failed: ${refreshError.message}`)
                        }

                        if (refreshData.session) {
                            setSessionState({
                                user: refreshData.session.user,
                                session: refreshData.session,
                                loading: false,
                                error: null,
                                isRefreshing: false,
                            })
                            scheduleNextRefresh(refreshData.session)
                            return refreshData.session
                        }
                    } else {
                        // Session is valid, just update state and schedule next check
                        setSessionState({
                            user: session.user,
                            session: session,
                            loading: false,
                            error: null,
                            isRefreshing: false,
                        })
                        scheduleNextRefresh(session)
                        return session
                    }
                }
            } catch (error: any) {
                console.error("Session refresh failed:", error)
                setSessionState({
                    user: null,
                    session: null,
                    loading: false,
                    error: error.message || "Session refresh failed",
                    isRefreshing: false,
                })
                return null
            } finally {
                isRefreshingRef.current = false
            }
        },
        [sessionState.session],
    )

    // Schedule the next automatic refresh
    const scheduleNextRefresh = useCallback(
        (session: Session) => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
            }

            const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
            const now = Date.now()
            const timeUntilExpiry = expiresAt - now

            // Refresh every 2 minutes, or 5 minutes before expiry if that's sooner
            const refreshIn = Math.min(timeUntilExpiry - 5 * 60 * 1000, 2 * 60 * 1000) // 2 minutes

            if (refreshIn > 0) {
                console.log(`Scheduling next session refresh in ${Math.round(refreshIn / 1000 / 60)} minutes`)
                refreshTimeoutRef.current = setTimeout(() => {
                    refreshSession(true)
                }, refreshIn)
            }
        },
        [refreshSession],
    )

    // Update last activity timestamp
    const updateActivity = useCallback(() => {
        lastActivityRef.current = Date.now()
    }, [])

    // Initialize session and set up listeners
    useEffect(() => {
        let mounted = true

        const initializeSession = async () => {
            try {
                await refreshSession(true)
            } catch (error) {
                console.error("Failed to initialize session:", error)
                if (mounted) {
                    setSessionState((prev) => ({ ...prev, loading: false }))
                }
            }
        }

        initializeSession()

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth state changed:", event)

            if (!mounted) return

            if (event === "SIGNED_OUT" || !session) {
                setSessionState({
                    user: null,
                    session: null,
                    loading: false,
                    error: null,
                    isRefreshing: false,
                })

                // Clear timers
                if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
                if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
            } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                setSessionState({
                    user: session.user,
                    session: session,
                    loading: false,
                    error: null,
                    isRefreshing: false,
                })

                scheduleNextRefresh(session)
            }
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        }
    }, [refreshSession, scheduleNextRefresh])

    // Set up activity-based session management
    useEffect(() => {
        // Activity events that should trigger session refresh check
        const activityEvents = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"]

        const handleActivity = () => {
            updateActivity()

            // If user has been inactive for more than 10 minutes, refresh session
            const timeSinceLastActivity = Date.now() - lastActivityRef.current
            if (timeSinceLastActivity > 10 * 60 * 1000 && sessionState.session) {
                // Changed from 30 to 10 minutes
                console.log("User became active after inactivity, refreshing session...")
                refreshSession()
            }
        }

        // Add activity listeners
        activityEvents.forEach((event) => {
            document.addEventListener(event, handleActivity, { passive: true })
        })

        // Set up heartbeat to keep session alive during active use
        heartbeatIntervalRef.current = setInterval(
            () => {
                const timeSinceLastActivity = Date.now() - lastActivityRef.current

                // If user has been active in the last 5 minutes, refresh session
                if (timeSinceLastActivity < 5 * 60 * 1000 && sessionState.session) {
                    refreshSession()
                }
            },
            2 * 60 * 1000, // Check every 2 minutes instead of 15
        )

        return () => {
            activityEvents.forEach((event) => {
                document.removeEventListener(event, handleActivity)
            })
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current)
            }
        }
    }, [refreshSession, updateActivity, sessionState.session])

    // Handle visibility change
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (!document.hidden && sessionState.session) {
                console.log("Tab became visible, checking session...")
                updateActivity()

                // Check if we need to refresh due to inactivity
                const timeSinceLastActivity = Date.now() - lastActivityRef.current
                if (timeSinceLastActivity > 5 * 60 * 1000) {
                    // Changed from 10 to 5 minutes
                    await refreshSession(true)
                }
            }
        }

        const handleFocus = async () => {
            if (sessionState.session) {
                console.log("Window focused, checking session...")
                updateActivity()
                await refreshSession()
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("focus", handleFocus)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            window.removeEventListener("focus", handleFocus)
        }
    }, [refreshSession, updateActivity, sessionState.session])

    // Manual refresh function for components
    const manualRefresh = useCallback(async () => {
        return await refreshSession(true)
    }, [refreshSession])

    // Sign out with cleanup
    const signOut = useCallback(async () => {
        // Clear all timers
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)

        // Clean up presence tracking
        if (window.presenceCleanup) {
            window.presenceCleanup()
        }

        // Sign out from Supabase
        await supabase.auth.signOut()
    }, [])

    return {
        user: sessionState.user,
        session: sessionState.session,
        loading: sessionState.loading,
        error: sessionState.error,
        isRefreshing: sessionState.isRefreshing,
        refreshSession: manualRefresh,
        signOut,
        updateActivity,
    }
}
