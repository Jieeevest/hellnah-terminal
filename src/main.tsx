import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
// @ts-ignore
import '@fontsource/space-grotesk'
import './index.css'
import App from './App'
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'masukkan_google_client_id_anda';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </HelmetProvider>
  </StrictMode>,
)
