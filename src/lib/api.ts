import { useAuth } from '@/store/useAuth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  let { accessToken, refreshToken, login, logout, user } = useAuth.getState()

  const headers = new Headers(options.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const isFullUrl = endpoint.startsWith('http')
  const url = isFullUrl ? endpoint : `${API_URL}${endpoint}`

  let res = await fetch(url, { ...options, headers })

  // Subscription access denied — notify listeners so UI can react
  if (res.status === 403) {
    window.dispatchEvent(new CustomEvent('subscription:access_denied'))
  }

  // If unauthorized (token expired), try to refresh
  if (res.status === 401) {
    if (!refreshToken) {
      logout()
      window.location.href = '/login?reason=session_expired'
      return res
    }

    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      const refreshData = await refreshRes.json()
      if (refreshData.success && refreshData.data.accessToken) {
        login(refreshData.data.accessToken, refreshData.data.refreshToken, user!)
        headers.set('Authorization', `Bearer ${refreshData.data.accessToken}`)
        res = await fetch(url, { ...options, headers })
      } else {
        logout()
        window.location.href = '/login?reason=session_expired'
        return res
      }
    } catch {
      logout()
      window.location.href = '/login?reason=session_expired'
      return res
    }
  }

  return res
}
