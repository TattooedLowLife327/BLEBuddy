import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { BLEProvider } from './contexts/BLEContext'
import { GameProvider } from './contexts/GameContext'
import './styles/globals.css'
import './pwa'

// On LAN/localhost we don't want an old PWA service worker to hijack routes (e.g. /preview/01)
// and serve a stale bundle that redirects to dashboard. Unregister any existing SW in local testing
// and clear caches; reload once if we were previously controlled by a stale worker.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const host = window.location.hostname
  const isLanHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.endsWith('.local')

  if (isLanHost) {
    const alreadyReloaded = sessionStorage.getItem('bb-sw-reloaded') === '1'
    navigator.serviceWorker
      .getRegistrations()
      .then(registrations => Promise.all(registrations.map(reg => reg.unregister())))
      .then(() => caches.keys())
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => {
        if (navigator.serviceWorker.controller && !alreadyReloaded) {
          sessionStorage.setItem('bb-sw-reloaded', '1')
          window.location.reload()
        }
      })
      .catch(() => {
        // ignore SW cleanup errors on local
      })
  }
}

// Mobile: request fullscreen + landscape lock on first user gesture when supported.
if (typeof window !== 'undefined') {
  const requestImmersive = async () => {
    const docEl = document.documentElement
    if (!document.fullscreenElement && docEl.requestFullscreen) {
      try {
        await docEl.requestFullscreen()
      } catch {
        // ignore fullscreen errors (not supported or blocked)
      }
    }
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape')
      }
    } catch {
      // ignore orientation lock errors (not supported or blocked)
    }
  }

  window.addEventListener('touchstart', requestImmersive, { once: true, passive: true })
  window.addEventListener('click', requestImmersive, { once: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BLEProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </BLEProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
