'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrivacyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // /privacy -> /privacy-policy 리다이렉트
    router.replace('/privacy-policy');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">개인정보처리방침으로 이동 중...</p>
      </div>
    </div>
  );
}
