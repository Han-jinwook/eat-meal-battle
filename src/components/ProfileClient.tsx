'use client';

import { useRouter } from 'next/navigation';
import { useHub } from '@/services/merlin-hub-sdk/react';
import { HubProfileCard, HubNotificationCard, HubLogoutCard } from '@/services/merlin-hub-sdk/react';
import { useEffect } from 'react';
import { Header } from '@/components/whateat/header';
import { Footer } from '@/components/whateat/footer';

export default function ProfileClient() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useHub();

  useEffect(() => {
    // 세션 로딩이 완료된 시점에 로그인되어 있지 않다면 홈(/)으로 이동하고 로그인 모달 트리거
    if (!isLoading && !isLoggedIn) {
      router.replace('/');
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openLoginModal'));
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fffaf5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-cyan-600 rounded-full animate-spin"></div>
          <span className="text-sm text-slate-500 font-medium">프로필 정보 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
      <div className="flex justify-center min-h-screen">
        {/* Left Ad Banner */}
        <aside className="hidden lg:flex w-[160px] shrink-0 items-start justify-center pt-20 sticky top-0 h-screen">
          <div className="w-[140px] h-[400px] bg-white/50 border border-dashed border-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/50 text-xs">
            AD BANNER
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] min-h-screen flex flex-col relative shadow-2xl shadow-black/5 bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] border-x border-gray-100/50">
          {/* Header Integration */}
          <Header
            activeNavTab="solo"
            onNavTabChange={(tab) => {
              localStorage.setItem('activeNavTab', tab);
              router.push('/');
            }}
          />

          <main className="flex-1 overflow-y-auto custom-scrollbar py-8 px-5 lg:px-8">
            <div className="max-w-xl mx-auto space-y-6">
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

              <Footer />
            </div>
          </main>

          {/* Mobile Ad Banner */}
          <div className="lg:hidden w-full h-[50px] bg-white/80 border-t border-muted/20 flex items-center justify-center text-muted-foreground/50 text-xs shrink-0">
            MOBILE AD BANNER
          </div>
        </div>

        {/* Right Ad Banner */}
        <aside className="hidden lg:flex w-[160px] shrink-0 items-start justify-center pt-20 sticky top-0 h-screen">
          <div className="w-[140px] h-[400px] bg-white/50 border border-dashed border-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/50 text-xs">
            AD BANNER
          </div>
        </aside>
      </div>
    </div>
  );
}
