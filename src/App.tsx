import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Landing from '@/pages/Landing'
import Admin from '@/pages/Admin'
import Profile from '@/pages/Profile'
import Support from '@/pages/Support'
import Articles from '@/pages/Articles'
import ArticleDetail from '@/pages/ArticleDetail'
import StaticPage from '@/pages/StaticPage'
import PaymentSuccess from '@/pages/PaymentSuccess'
import PaymentCancel from '@/pages/PaymentCancel'
import Referral from '@/pages/Referral'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/store/useAuth'
import { PromoSnackbar } from '@/components/PromoSnackbar'

export default function App() {
  const isAuthenticated = useAuth((state) => state.isAuthenticated)

  return (
    <BrowserRouter>
      <PromoSnackbar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/articles/:slug" element={<ArticleDetail />} />
        <Route path="/page/:slug" element={<StaticPage />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />

        {/* Login */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/app" replace /> : <Login />}
        />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app"     element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/support" element={<Support />} />
          <Route path="/referral" element={<Referral />} />
        </Route>

        {/* Admin */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}