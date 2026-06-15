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

  const [autoSharePref, setAutoSharePref] = useState<'ask' | 'approved' | 'rejected'>('ask');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pref = localStorage.getItem('whateat_auto_share_5star');
      if (pref === 'approved') setAutoSharePref('approved');
      else if (pref === 'rejected') setAutoSharePref('rejected');
      else setAutoSharePref('ask');
    }
  }, []);

  const handlePrefChange = (newPref: 'ask' | 'approved' | 'rejected') => {
    setAutoSharePref(newPref);
    if (typeof window !== 'undefined') {
      if (newPref === 'ask') {
        localStorage.removeItem('whateat_auto_share_5star');
      } else {
        localStorage.setItem('whateat_auto_share_5star', newPref);
      }
    }
  };

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

                {/* 왓잇 식단 공개 범위 설정 카드 */}
                <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm space-y-3.5">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span className="text-orange-500">✨</span> 왓잇 식단 설정
                  </h3>
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      5점 평점을 받은 식사의 맛톡(동네 맛집 피드) 공개 여부를 설정합니다.
                    </div>
                    
                    <div className="flex flex-col gap-2.5 pt-1">
                      <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="radio"
                          name="autoShare5Star"
                          checked={autoSharePref === 'ask'}
                          onChange={() => handlePrefChange('ask')}
                          className="text-orange-500 focus:ring-orange-500 size-4 border-gray-300 cursor-pointer"
                        />
                        <span>매번 승낙 여부 물어보기 (기본값)</span>
                      </label>
                      
                      <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="radio"
                          name="autoShare5Star"
                          checked={autoSharePref === 'approved'}
                          onChange={() => handlePrefChange('approved')}
                          className="text-orange-500 focus:ring-orange-500 size-4 border-gray-300 cursor-pointer"
                        />
                        <span>5점 부여 시 항상 자동 공개</span>
                      </label>
                      
                      <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                        <input
                          type="radio"
                          name="autoShare5Star"
                          checked={autoSharePref === 'rejected'}
                          onChange={() => handlePrefChange('rejected')}
                          className="text-orange-500 focus:ring-orange-500 size-4 border-gray-300 cursor-pointer"
                        />
                        <span>5점 부여 시 항상 비공개 (기기/가족방만 보관)</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* 허브 통합 로그아웃 카드 */}
                <HubLogoutCard onLogout={() => router.replace('/')} />
              </div>
            </div>
            
            <div className="mt-8">
              <Footer />
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}
