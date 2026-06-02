'use client';

import { useRouter } from 'next/navigation';
import { useHubSession } from '@/services/merlin-hub-sdk/react';
import { HubProfileCard, HubNotificationCard, HubLogoutCard } from '@/services/merlin-hub-sdk/react';
import { useEffect } from 'react';

export default function ProfileClient() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useHubSession();

  useEffect(() => {
    // 세션 로딩이 완료된 시점에 로그인되어 있지 않다면 로그인 페이지로 이동
    if (!isLoading && !isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <span className="text-sm text-slate-500 font-medium">프로필 정보 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4 max-w-xl">
        <div className="w-full space-y-6">
          {/* 허브 통합 프로필 카드 */}
          <HubProfileCard />
          
          {/* 허브 통합 알림 설정 카드 */}
          <HubNotificationCard
            title="알림 설정"
            toggleLabel="🔔 스마트 알림"
            description="급식 소식과 뭐먹지? 서비스의 새로운 기능·혜택 알림을 받아보세요."
          />
          
          {/* 허브 통합 로그아웃 카드 */}
          <HubLogoutCard onLogout={() => router.replace('/')} />
        </div>
      </div>
    </main>
  );
}
