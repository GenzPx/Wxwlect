// ==========================================
// SAKAFFAH SERVICE WORKER v3.0.0
// Created by GENZX4K
// ==========================================

const CACHE_NAME = 'sakaffah-v3.0.0';
const OFFLINE_URL = '/';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Poppins:wght@300;400;500;600;700;800&display=swap',
    'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/sakaffah.logo.jpg',
    'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/ads.png',
    'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/partner.jpeg',
    'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/footer.bg.jpeg'
];

// API endpoints to cache with network-first strategy
const API_CACHE_URLS = [
    'api.aladhan.com',
    'api.alquran.cloud'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => {
                    return new Request(url, { mode: 'cors' });
                })).catch(err => {
                    console.log('[ServiceWorker] Cache addAll error:', err);
                    // Continue even if some assets fail to cache
                    return Promise.resolve();
                });
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName !== CACHE_NAME)
                        .map((cacheName) => {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Check if this is an API request
    const isApiRequest = API_CACHE_URLS.some(apiUrl => url.hostname.includes(apiUrl));
    
    if (isApiRequest) {
        // Network first, fallback to cache for API requests
        event.respondWith(
            networkFirstStrategy(request)
        );
    } else {
        // Cache first, fallback to network for static assets
        event.respondWith(
            cacheFirstStrategy(request)
        );
    }
});

// Cache first strategy
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            // Return cached response and update cache in background
            updateCache(request);
            return cachedResponse;
        }
        
        // Not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache the response if successful
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[ServiceWorker] Fetch failed:', error);
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const cache = await caches.open(CACHE_NAME);
            return cache.match(OFFLINE_URL);
        }
        
        // Return empty response for other requests
        return new Response('', {
            status: 408,
            statusText: 'Request Timeout'
        });
    }
}

// Network first strategy
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache the response if successful
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[ServiceWorker] Network request failed, trying cache:', error);
        
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return error response
        return new Response(JSON.stringify({
            error: 'Network request failed and no cache available'
        }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

// Update cache in background
async function updateCache(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse);
        }
    } catch (error) {
        // Silently fail - cache update is not critical
        console.log('[ServiceWorker] Background cache update failed:', error);
    }
}

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push received');
    
    let data = {
        title: 'Sakaffah',
        body: 'Waktunya sholat!',
        icon: 'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/sakaffah.logo.jpg',
        badge: 'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/sakaffah.logo.jpg',
        tag: 'sakaffah-notification',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
            {
                action: 'open',
                title: 'Buka Aplikasi'
            },
            {
                action: 'close',
                title: 'Tutup'
            }
        ]
    };
    
    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, data)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a window is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Otherwise, open a new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Handle background sync
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Background sync:', event.tag);
    
    if (event.tag === 'sync-dzikir') {
        event.waitUntil(syncDzikirData());
    }
    
    if (event.tag === 'sync-checklist') {
        event.waitUntil(syncChecklistData());
    }
});

// Sync dzikir data (placeholder for future implementation)
async function syncDzikirData() {
    console.log('[ServiceWorker] Syncing dzikir data...');
    // Future: Sync with server
}

// Sync checklist data (placeholder for future implementation)
async function syncChecklistData() {
    console.log('[ServiceWorker] Syncing checklist data...');
    // Future: Sync with server
}

// Periodic background sync for prayer time notifications
self.addEventListener('periodicsync', (event) => {
    console.log('[ServiceWorker] Periodic sync:', event.tag);
    
    if (event.tag === 'check-prayer-times') {
        event.waitUntil(checkPrayerTimes());
    }
});

// Check prayer times and send notifications
async function checkPrayerTimes() {
    console.log('[ServiceWorker] Checking prayer times...');
    
    try {
        // Get current location from cache or use default
        const cache = await caches.open(CACHE_NAME);
        
        // Fetch prayer times
        const today = new Date();
        const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
        
        const response = await fetch(
            `https://api.aladhan.com/v1/timings/${dateStr}?latitude=-6.2088&longitude=106.8456&method=20`
        );
        
        if (response.ok) {
            const data = await response.json();
            const timings = data.data.timings;
            
            // Check if any prayer time is within the next minute
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            const prayers = {
                'Subuh': timings.Fajr,
                'Dzuhur': timings.Dhuhr,
                'Ashar': timings.Asr,
                'Maghrib': timings.Maghrib,
                'Isya': timings.Isha
            };
            
            for (const [name, time] of Object.entries(prayers)) {
                const [hours, minutes] = time.split(':').map(Number);
                const prayerMinutes = hours * 60 + minutes;
                
                // If prayer time is within the next minute
                if (prayerMinutes === currentMinutes || prayerMinutes === currentMinutes + 1) {
                    await self.registration.showNotification(`Waktu ${name}`, {
                        body: `Saatnya sholat ${name}. Waktu: ${time}`,
                        icon: 'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/sakaffah.logo.jpg',
                        badge: 'https://raw.githubusercontent.com/GenzPx/Wxwlect/refs/heads/main/sakaffah.logo.jpg',
                        tag: `prayer-${name.toLowerCase()}`,
                        renotify: true,
                        requireInteraction: true,
                        vibrate: [200, 100, 200, 100, 200],
                        actions: [
                            { action: 'open', title: 'Buka Aplikasi' },
                            { action: 'done', title: 'Sudah Sholat' }
                        ]
                    });
                    break;
                }
            }
        }
    } catch (error) {
        console.log('[ServiceWorker] Check prayer times failed:', error);
    }
}