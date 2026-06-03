'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();

  useEffect(() => {
    // 즉시 홈으로 이동하면서 로그인 모달 트리거
    router.replace('/');
    
    // 홈 화면 진입 후 자연스럽게 모달이 팝업되도록 미세 지연 처리
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openLoginModal'));
    }, 150);

    return () => clearTimeout(timer);
  }, [router]);

  // 징검다리 페이지이므로 찰나에도 화면에 아무것도 렌더링하지 않음 (투명 처리)
  return null;
}
