'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.workbox !== undefined
    ) {
      const wb = window.workbox;
      
      // Service Worker 등록
      wb.register();
      
      wb.addEventListener('installed', (event) => {
        console.log('Service Worker가 설치되었습니다');
      });

      wb.addEventListener('controlling', (event) => {
        console.log('Service Worker가 제어를 시작했습니다');
      });

      wb.addEventListener('activated', (event) => {
        console.log('Service Worker가 활성화되었습니다');
      });
    } else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Fallback for manual service worker registration
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker 등록 성공:', registration);
        })
        .catch((error) => {
          console.log('Service Worker 등록 실패:', error);
        });
    }
  }, []);

  return null;
}
