'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
      }
      return;
    }

    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.workbox !== undefined
    ) {
      const wb = window.workbox;
      
      // Service Worker 등록
      wb.register();
      
      wb.addEventListener('installed', (event) => {
        // Service Worker 설치 완료
      });

      wb.addEventListener('controlling', (event) => {
        // Service Worker 제어 시작
      });

      wb.addEventListener('activated', (event) => {
        // Service Worker 활성화 완료
      });
    } else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Fallback for manual service worker registration
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Service Worker 등록 성공
        })
        .catch((error) => {
          // Service Worker 등록 실패
        });
    }
  }, []);

  return null;
}
