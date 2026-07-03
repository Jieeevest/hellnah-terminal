import { useEffect, useRef, useState } from 'react'
import { useAuth, isProActive } from '@/store/useAuth'
import { fetchWithAuth } from '@/lib/api'

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // re-fetch every 5 minutes

/**
 * Keeps subscription state in sync with the backend.
 * - Polls /api/users/me/subscription every 5 minutes
 * - Reacts immediately to 403 responses (subscription:access_denied event from api.ts)
 * - Returns subscriptionExpired=true when user had pro but it has since expired
 */
export function useSubscriptionSync() {
  const { user, updateUser, isAuthenticated } = useAuth()
  const [subscriptionExpired, setSubscriptionExpired] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sync = async () => {
    if (!useAuth.getState().isAuthenticated) return
    try {
      const res = await fetchWithAuth('/api/users/me/subscription')
      if (!res.ok) return
      const data = await res.json()
      if (!data.success || !data.data) return

      const current = useAuth.getState().user
      if (!current) return

      const fresh = {
        ...current,
        ...(data.data.subscription_tier    !== undefined && { subscription_tier: data.data.subscription_tier }),
        ...(data.data.subscription_expires_at !== undefined && { subscription_expires_at: data.data.subscription_expires_at }),
      }

      updateUser(fresh)
      setSubscriptionExpired(!isProActive(fresh))
    } catch {
      // network error — keep current UI state
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return

    // Immediate client-side check from cached state
    if (user && user.subscription_tier === 'pro') {
      setSubscriptionExpired(!isProActive(user))
    }

    // React to 403 from any API call
    window.addEventListener('subscription:access_denied', sync)

    // Periodic background sync
    timerRef.current = setInterval(sync, SYNC_INTERVAL_MS)

    return () => {
      window.removeEventListener('subscription:access_denied', sync)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  return { subscriptionExpired }
}
