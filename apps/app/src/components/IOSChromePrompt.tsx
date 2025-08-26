'use client';

import { useState, useEffect } from 'react';

interface IOSChromePromptProps {
  onDismiss?: () => void;
}

export default function IOSChromePrompt({ onDismiss }: IOSChromePromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // iOS Safari 감지
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       !(window as any).MSStream &&
                       !navigator.userAgent.includes('CriOS'); // Chrome이 아닌 경우

    if (isIOSSafari) {
      // 이미 크롬 안내를 본 적이 있는지 확인
      const hasSeenChromePrompt = localStorage.getItem('ios-chrome-prompt-seen');
      
      if (!hasSeenChromePrompt) {
        setShowPrompt(true);
      }
    }
  }, []);

  const handleInstallChrome = () => {
    // 현재 URL을 저장 (크롬 설치 후 돌아올 때 사용)
    const currentUrl = window.location.href;
    localStorage.setItem('return-url-after-chrome', currentUrl);
    
    // 크롬 안내를 봤다고 표시
    localStorage.setItem('ios-chrome-prompt-seen', 'true');
    
    // App Store 크롬 다운로드 페이지로 이동
    window.location.href = 'https://apps.apple.com/kr/app/google-chrome/id535886823';
  };

  const handleDismiss = () => {
    localStorage.setItem('ios-chrome-prompt-seen', 'true');
    setShowPrompt(false);
    onDismiss?.();
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm mx-auto shadow-xl">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🍽️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            급식 배틀에 오신 것을 환영합니다!
          </h2>
          <p className="text-lg font-semibold text-blue-600 mb-2">
            아이폰에선 Chrome에서 푸시알림이 가능합니다.
          </p>
          <p className="text-lg font-semibold text-orange-600">
            크롬에서 앱 열기
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleInstallChrome}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            <span className="mr-2">🏪</span>
            크롬에서 앱 열기
          </button>
          
          <button
            onClick={handleDismiss}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Safari로 계속하기 (알림 제한)
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            💡 <strong>팁:</strong> Chrome 설치 후 이 페이지가 자동으로 열립니다!
          </p>
        </div>
      </div>
    </div>
  );
}
