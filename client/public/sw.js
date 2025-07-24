// Simple Service Worker for FitTracker PWA
const CACHE_NAME = 'fittracker-v1'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.svg',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache opened')
        return cache.addAll(urlsToCache)
      })
      .catch(err => {
        console.log('Service Worker: Cache failed', err)
      })
  )
})

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
      })
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache')
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})