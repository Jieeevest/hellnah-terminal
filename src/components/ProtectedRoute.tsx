import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/store/useAuth'

const DEV_MODE = import.meta.env.VITE_DEV_MODE === '1'

export function ProtectedRoute() {
  const isAuthenticated = useAuth((state) => state.isAuthenticated)

  if (!DEV_MODE && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function AdminRoute() {
  const { isAuthenticated, user } = useAuth()

  if (!DEV_MODE && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!DEV_MODE && user?.role !== 'admin') {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
