import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/useAuth'

const DEV_MODE = import.meta.env.VITE_DEV_MODE === '1'

/**
 * Checks auth session health on every page.
 * - Detects if the user's session has been cleared from sessionStorage
 *   (e.g. session expired or storage was wiped).
 * - Auto-redirects to /login and calls logout() to clean the zustand state.
 */
export function useSessionGuard() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const lastChecked = useRef(0)

  useEffect(() => {
    if (DEV_MODE) return
    const CHECK_INTERVAL_MS = 30_000 // check every 30s

    const check = () => {
      const now = Date.now()
      if (now - lastChecked.current < CHECK_INTERVAL_MS) return
      lastChecked.current = now

      // sessionStorage is per-tab; if it's gone, the user's session is dead
      const stored = sessionStorage.getItem('hellnah-terminal-auth-storage')
      if (!stored) {
        logout()
        navigate('/login', { replace: true })
        return
      }

      // Also validate the parsed token still exists inside the storage
      try {
        const parsed = JSON.parse(stored)
        if (!parsed?.state?.accessToken) {
          logout()
          navigate('/login', { replace: true })
        }
      } catch {
        logout()
        navigate('/login', { replace: true })
      }
    }

    // Run immediately on mount
    if (isAuthenticated) check()

    // Run on focus (user switches back to tab)
    window.addEventListener('focus', check)
    // Run on visibility change (user switches tabs / resumes)
    document.addEventListener('visibilitychange', check)

    // Periodic check while the page is open
    const interval = setInterval(() => {
      if (isAuthenticated) check()
    }, CHECK_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
      clearInterval(interval)
    }
  }, [isAuthenticated, logout, navigate])
}
