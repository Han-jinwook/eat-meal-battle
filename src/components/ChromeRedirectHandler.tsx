'use client';

import { useEffect } from 'react';

export default function ChromeRedirectHandler() {
  useEffect(() => {
    // Chrome에서 접속했을 때 저장된 URL로 리다이렉트
    const isChrome = navigator.userAgent.includes('CriOS') || 
                    (navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Edg'));
    
    if (isChrome) {
      const returnUrl = localStorage.getItem('return-url-after-chrome');
      
      if (returnUrl && returnUrl !== window.location.href) {
        // 저장된 URL로 리다이렉트
        localStorage.removeItem('return-url-after-chrome');
        window.location.href = returnUrl;
      }
    }
  }, []);

  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
}
