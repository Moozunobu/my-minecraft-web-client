import { isCypress } from './standaloneUtils'

// might not resolve at all
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator) || process.env.SINGLE_FILE_BUILD) return
  if (process.env.DISABLE_SERVICE_WORKER) return
  if (!isCypress() && process.env.NODE_ENV !== 'development') {
    return new Promise<void>(resolve => {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('./service-worker.js')
          console.log('SW registered:', registration)
          
          // Check for service worker updates immediately
          void registration.update()

          registration.onupdatefound = () => {
            const installingWorker = registration.installing
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New content available, clearing old caches...')
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      for (const name of names) void caches.delete(name)
                    })
                  }
                }
              }
            }
          }
          resolve()
        } catch (registrationError) {
          console.log('SW registration failed:', registrationError)
          resolve()
        }
      })
    })
  } else {
    // force unregister service worker in development mode
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.unregister() // eslint-disable-line no-await-in-loop
    }
    if (registrations.length) {
      location.reload()
    }
  }
}
