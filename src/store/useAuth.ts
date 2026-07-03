import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  email: string
  phone?: string
  role: string
  auth_provider?: string
  created_at?: string
}

interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  login: (accessToken: string, refreshToken: string, user: User) => void
  logout: () => void
  updateUser: (user: User) => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      login: (accessToken, refreshToken, user) => set({ isAuthenticated: true, accessToken, refreshToken, user }),
      logout: () => set({ isAuthenticated: false, accessToken: null, refreshToken: null, user: null }),
      updateUser: (user) => set({ user }),
    }),
    {
      name: 'hellnah-terminal-auth-storage',
      storage: createJSONStorage(() => sessionStorage), // Keeps user logged in during tab session
    }
  )
)
