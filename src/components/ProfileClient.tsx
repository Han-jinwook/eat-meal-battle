'use client';

import { useRouter } from 'next/navigation';
import { 
  useHub, 
  HubProfileCard, 
  HubNotificationCard, 
  HubLogoutCard,
  useHubReferral,
  HubHistoryList,
  HubShareSquare
} from '@/services/merlin-hub-sdk/react';
import { useEffect, useState } from 'react';
import { Header } from '@/components/whateat/header';
import { Footer } from '@/components/whateat/footer';

export default function ProfileClient() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useHub();
  const { getReferralHistory, isLoading: isReferralsLoading } = useHubReferral();
  const [referrals, setReferrals] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('merlin_cached_referral_history');
      return cached ? JSON.parse(cached) : [];
    }
    return [];
  });

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

  useEffect(() => {
    if (isLoggedIn) {
      getReferralHistory().then((data) => {
        if (data) {
          setReferrals(data);
          localStorage.setItem('merlin_cached_referral_history', JSON.stringify(data));
        }
      });
    }
  }, [isLoggedIn, getReferralHistory]);

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
      {/* 고정(fixed) 헤더 */}
      <Header
        activeNavTab={null}
        onNavTabChange={(tab) => {
          router.push('/#' + tab);
        }}
      />

      <div className="relative flex justify-center min-h-screen pt-[62px]">
        {/* Main Content Area (800px 본문 정렬선 보장) */}
        <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] min-h-screen flex flex-col relative shadow-2xl shadow-black/5 bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] border-x border-gray-100/50 shrink-0 z-10">
          
          <main className="flex-1 overflow-y-auto custom-scrollbar pt-4 pb-8 px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
              {/* 좌측 컬럼: 앱 초대 실적 리스트 */}
              <div className="space-y-6">
                <HubHistoryList history={referrals} isLoading={isReferralsLoading && referrals.length === 0} />
              </div>

              {/* 우측 컬럼: 프로필, 알림 설정, 로그아웃 */}
              <div className="space-y-6">
                {/* 허브 통합 프로필 카드 */}
                <HubProfileCard />
                
                <HubNotificationCard />
                
                {/* 허브 통합 로그아웃 카드 */}
                <HubLogoutCard onLogout={() => router.replace('/')} />
              </div>
            </div>
            
            <div className="mt-8">
              <Footer />
            </div>
          </main>

          {/* Mobile Ad Banner */}
          <div className="lg:hidden w-full h-[50px] bg-white/80 border-t border-muted/20 flex items-center justify-center text-muted-foreground/50 text-xs shrink-0">
            MOBILE AD BANNER
          </div>
        </div>

        {/* 
          우측 사이드 윙 (공유 카드 + 광고 배너 복합 배치)
          - absolute 포지셔닝으로 격리 배치하여 프로필 페이지의 800px 본문 정렬선이 정중앙에 올 수 있게 보장합니다.
          - 가이드 공식: top-[62px] left-[calc(50%+400px+8px)] h-[calc(100vh-62px)]
        */}
        <aside className="hidden lg:flex w-[160px] shrink-0 items-start justify-center absolute left-[calc(50%+400px+8px)]" style={{ top: '62px' }}>
          <div className="flex flex-col gap-4 w-full items-center fixed top-[78px] w-[160px] h-[calc(100vh-78px)] overflow-y-auto custom-scrollbar pb-4">
            {/* 1. 공유 카드 */}
            <HubShareSquare 
              customTitle="식단 관리와 오늘 뭐 먹을지 고민될 땐? 뭐먹지! 🍕"
              description="우리 가족과 함께 매일의 급식 소식과 맛있는 레시피를 즐겨보세요."
            />
            {/* 2. 광고 배너 (우측 사이드) */}
            <div className="w-full shrink-0 h-[300px] bg-white/50 border border-dashed border-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/50 text-xs shadow-sm">
              AD BANNER
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
