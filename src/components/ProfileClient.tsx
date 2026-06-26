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
import { createClient } from '@/lib/supabase';
import { secureWrite } from '@/lib/supabase-safe';

export default function ProfileClient() {
  const router = useRouter();
  const { isLoggedIn, isLoading, user } = useHub();
  const { getReferralHistory, isLoading: isReferralsLoading } = useHubReferral();
  const [referrals, setReferrals] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('merlin_cached_referral_history');
      return cached ? JSON.parse(cached) : [];
    }
    return [];
  });

  // 거주 지역(시도, 시군구, 읍면동) 및 학교 상태 관리
  const [regionCity, setRegionCity] = useState("");
  const [regionGu, setRegionGu] = useState("");
  const [regionDong, setRegionDong] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;
      try {
        const supabase = createClient();
        
        // users 테이블에서 region 조회
        const { data: userData } = await supabase
          .from('users')
          .select('region')
          .eq('id', user.id)
          .single();
          
        if (userData && userData.region) {
          try {
            const parsedRegion = JSON.parse(userData.region);
            setRegionCity(parsedRegion.city || "");
            setRegionGu(parsedRegion.gu || "");
            setRegionDong(parsedRegion.dong || "");
          } catch (e) {
            setRegionDong(userData.region || "");
          }
        }

        // school_infos 테이블에서 school_name 조회 (읽기 전용 매핑)
        const { data: schoolData } = await supabase
          .from('school_infos')
          .select('school_name')
          .eq('user_id', user.id)
          .single();

        if (schoolData) {
          setSchoolName(schoolData.school_name || "");
        }
      } catch (err) {
        console.error("Failed to load profile region/school info:", err);
      }
    };

    if (isLoggedIn && user?.id) {
      fetchUserData();
    }
  }, [isLoggedIn, user]);

  const handleSaveSettings = async () => {
    if (!user?.id) return;
    try {
      setIsSaving(true);
      const supabase = createClient();

      const regionData = {
        city: regionCity.trim(),
        gu: regionGu.trim(),
        dong: regionDong.trim()
      };

      // 1. users 테이블의 region 컬럼 업데이트
      await secureWrite({
        table: 'users',
        action: 'update',
        data: { region: JSON.stringify(regionData) },
        filters: { id: user.id }
      });

      // 2. school_infos 테이블의 school_name 업데이트 (자녀들의 급식용 기초 데이터)
      const { data: existingSchool } = await supabase
        .from('school_infos')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSchool) {
        await secureWrite({
          table: 'school_infos',
          action: 'update',
          data: { school_name: schoolName.trim() },
          filters: { user_id: user.id }
        });
      } else {
        await secureWrite({
          table: 'school_infos',
          action: 'insert',
          data: {
            user_id: user.id,
            school_name: schoolName.trim(),
          }
        });
      }

      alert("지역 및 학교 정보가 성공적으로 저장되었습니다!");
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("정보 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
    }
  };

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
                
                {/* 왓잇 거주지역 및 학교 설정 */}
                <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span className="text-orange-500">📍</span> 왓잇 지역 및 학교 설정
                  </h3>
                  
                  <div className="space-y-3">
                    {/* 지역 설정 (시도 / 시군구 / 읍면동) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground block">거주 지역 (맛톡 범위 설정용)</label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <input
                            type="text"
                            placeholder="시/도 (예: 인천)"
                            value={regionCity}
                            onChange={(e) => setRegionCity(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="시/군/구 (예: 서구)"
                            value={regionGu}
                            onChange={(e) => setRegionGu(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="읍/면/동 (예: 청라동)"
                            value={regionDong}
                            onChange={(e) => setRegionDong(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 학교 설정 */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground block">학교 이름 (자녀 급식용)</label>
                      <input
                        type="text"
                        placeholder="학교명 (예: 청라초등학교)"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                      />
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      disabled={isSaving}
                      className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:bg-orange-300 flex items-center justify-center gap-1.5"
                    >
                      {isSaving ? "저장 중..." : "지역 및 학교 정보 저장"}
                    </button>
                  </div>
                </div>

                <HubNotificationCard />

                {/* 왓잇 식단 공개 범위 설정 카드 */}
                <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm space-y-3.5">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span className="text-orange-500">✨</span> 왓잇 식단 설정
                  </h3>
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      5점 별점을 준 식사의 맛톡(동네 맛집 피드) 공개 여부를 설정합니다.
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
