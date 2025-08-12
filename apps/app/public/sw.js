// Service Worker for PWA
const CACHE_NAME = 'whateat-v2-' + Date.now(); // 동적 버전으로 변경
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  // 즉시 활성화 (기존 SW 대체)
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - Network First 전략으로 변경
self.addEventListener('fetch', (event) => {
  // HTML 요청은 항상 네트워크 우선
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 네트워크 성공 시 캐시 업데이트
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 네트워크 실패 시만 캐시 사용
          return caches.match(event.request);
        })
    );
  } else {
    // 정적 리소스는 캐시 우선
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});

// Activate event
self.addEventListener('activate', (event) => {
  // 즉시 클라이언트 제어 시작
  event.waitUntil(
    Promise.all([
      // 이전 캐시 모두 삭제
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('이전 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 모든 클라이언트 즉시 제어
      self.clients.claim()
    ])
  );
});
