// Manual PWA registration so we can avoid caching issues on LAN/local hosts.
import { registerSW } from 'virtual:pwa-register'

const host = window.location.hostname
const isLanHost =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host.startsWith('192.168.') ||
  host.startsWith('10.') ||
  host.endsWith('.local')

// Only register service worker on non-LAN hosts (production/public).
if ('serviceWorker' in navigator && !isLanHost) {
  registerSW({ immediate: true })
}
