'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useHub } from '@/services/merlin-hub-sdk/react';

function LoginContent() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useHub();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const handleClose = () => {
      setIsRedirecting(true);
    };
    window.addEventListener('loginModalClosed', handleClose);
    return () => {
      window.removeEventListener('loginModalClosed', handleClose);
    };
  }, []);

  useEffect(() => {
    if (isLoading || isRedirecting) return;

    if (isLoggedIn) {
      // 이미 로그인되어 있으면 홈으로 이동
      router.replace('/');
    } else {
      // 로그인되어 있지 않으면 전역 로그인 모달 트리거
      const triggerLogin = () => {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      };
      
      // 마운트 후 약간의 지연시간을 두어 글로벌 모달 리스너가 준비된 후 실행되게 함
      const timer = setTimeout(triggerLogin, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, isLoading, isRedirecting, router]);

  if (isRedirecting || isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cyan-50/30 text-slate-800 p-4">
      <div className="text-center space-y-4 max-w-sm">
        {/* 아름다운 마이크로 스피너 애니메이션 (하늘색 테마) */}
        <div className="relative flex items-center justify-center w-16 h-16 mx-auto mb-6">
          <div className="absolute w-12 h-12 border-4 border-cyan-500/10 rounded-full"></div>
          <div className="absolute w-12 h-12 border-4 border-t-cyan-500 border-r-cyan-500 rounded-full animate-spin"></div>
          <svg className="w-6 h-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-bold tracking-tight text-slate-900">로그인 창을 열고 있습니다</h2>
        <p className="text-sm text-slate-500 leading-relaxed font-medium">
          안전하고 빠른 로그인을 위해 뭐먹지? 통합 인증 창을 실행하는 중입니다. 잠시만 기다려 주세요.
        </p>
        
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
          className="mt-4 px-5 py-2 text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-white rounded-full transition-all duration-200 shadow-md active:scale-95"
        >
          로그인 창이 안 뜨나요? (직접 열기)
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-cyan-50/10 text-slate-500 font-bold">
        로딩 중...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
