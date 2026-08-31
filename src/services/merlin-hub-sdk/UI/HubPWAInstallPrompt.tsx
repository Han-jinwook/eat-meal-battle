/**
 * Version: v2.1.0
 * Last Updated: 2026-08-27
 * Merlin Hub SDK — PWA 바로가기 추가 유도 및 인앱 브라우저 탈출 프롬프트
 */
'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function HubPWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    // 1차 차단: 모바일 기기 여부 확인 (PC/데스크톱에서는 설치 권장 안내를 띄우지 않음)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 2차 강력 차단: UserAgent가 변조되었더라도 화면 가로폭이 768px 초과(PC/태블릿 가로)면 절대 띄우지 않음
    const isDesktopScreen = window.innerWidth > 768;
    
    if (!isMobile || isDesktopScreen) {
      return;
    }

    // 1. PWA가 이미 설치되어 독립 창(standalone)으로 구동 중인지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // 2. 🚀 모바일 브라우저 공식 getInstalledRelatedApps() API로 기기 내 실제 설치 여부 실시간 확인
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((relatedApps: any[]) => {
        if (relatedApps && relatedApps.length > 0) {
          setIsInstalled(true);
          setShowInstallPrompt(false);
        }
      }).catch(() => {});
    }

    // 인앱 브라우저 (카카오톡, 카카오워크, 네이버, 인스타그램 등) 감지
    const inApp = /KAKAOTALK|kakaowork|NAVER|Instagram|FB_IAB|Line/i.test(navigator.userAgent);
    setIsInAppBrowser(inApp);

    // 3. 인앱 브라우저인 경우: 항상 외부 브라우저 탈출 안내 노출 (세션 내 닫기만 방어)
    if (inApp) {
      const inAppDismissed = sessionStorage.getItem('pwa-inapp-dismissed');
      if (!inAppDismissed) {
        const timer = setTimeout(() => {
          setShowInstallPrompt(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
      return;
    }

    // 4. 일반 브라우저: 사용자가 '나중에'를 눌렀을 때 3일 동안 다시 묻지 않는 정중한 톤앤매너 준수
    const installDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (installDismissed && !window.location.search.includes('t=') && !window.location.search.includes('test=') && !window.location.search.includes('debug=')) {
      const dismissedTime = parseInt(installDismissed);
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < threeDaysInMs) {
        return;
      }
    }

    // iOS Safari의 경우 beforeinstallprompt가 없으므로 2초 후 수동 안내 노출
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    let safariTimer: NodeJS.Timeout | null = null;
    if (isIOSSafari) {
      safariTimer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 2000);
    }

    // 안드로이드 (Chrome, 삼성인터넷 등): 기기에 앱이 실제로 미설치 상태일 때만 OS/브라우저가 beforeinstallprompt를 발행함
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (safariTimer) clearTimeout(safariTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // 1. 카카오톡 / 카카오워크 등 인앱 브라우저 탈출 로직
    if (isInAppBrowser) {
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        // 안드로이드: Chrome / 삼성인터넷 외부 브라우저로 즉시 강제 호출
        const cleanHost = window.location.host;
        const cleanPath = window.location.pathname + window.location.search;
        window.location.href = `intent://${cleanHost}${cleanPath}#Intent;scheme=https;package=com.android.chrome;end`;
      } else {
        // iOS: 사파리로 열기 유도 알림
        alert('카카오톡/카카오워크에서는 홈 화면 추가가 제한됩니다.\n\n우측 상단 또는 하단의 메뉴(⋮ 또는 📤)를 눌러 "Safari로 열기"를 선택해 주세요!');
      }
      setShowInstallPrompt(false);
      sessionStorage.setItem('pwa-prompt-dismissed', '1');
      return;
    }

    // 2. 안드로이드 크롬 / 삼성인터넷 Native PWA 추가
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('홈 화면 추가 완료');
      }
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      return;
    }

    // 3. deferredPrompt가 잡히지 않은 안드로이드 브라우저 안내
    const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      alert('홈 화면에 추가하려면:\n\n우측 상단 메뉴(⋮) 터치 ➔ [홈 화면에 추가 / 앱 설치]를 선택해 주세요!');
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      return;
    }

    // 4. iOS Safari 수동 홈화면 추가 안내
    const isIOSSafari = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOSSafari) {
      alert('홈 화면에 아이콘을 추가하려면:\n\n1. 하단의 공유 버튼(📤) 터치\n2. "홈 화면에 추가" 선택\n3. "추가" 버튼 터치');
      setShowInstallPrompt(false);
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    if (isInAppBrowser) {
      sessionStorage.setItem('pwa-inapp-dismissed', '1');
    } else {
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    }
  };

  // 이미 설치되었거나 프롬프트를 띄우지 않는 경우
  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  const isIOSSafari = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-sm">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-slate-900 tracking-tight">
              {isInAppBrowser ? '홈 화면에 바로가기 추가 안내' : '홈 화면에 바로가기 추가'}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-snug">
              {isInAppBrowser 
                ? '카카오 안에서는 홈 화면 추가가 제한됩니다. 기본 브라우저로 열어주세요!'
                : '스마트폰 앱처럼 홈 화면에서 터치 한 번으로 바로 열 수 있어요!'}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3.5 flex space-x-2">
          <button
            onClick={handleInstallClick}
            className="flex-1 bg-brand-primary text-white text-xs sm:text-sm font-extrabold py-2.5 px-3 rounded-xl shadow-md hover:bg-brand-primary/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            {isInAppBrowser 
              ? '기본 브라우저로 열기 ↗' 
              : (isIOSSafari ? '추가 방법 보기 👈' : '홈 화면에 추가하기 ⚡')}
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
