"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Header, type HeaderNavTab } from "@/components/whateat/header"
import { TabNavigation } from "@/components/whateat/tab-navigation"
import { MealLogTab } from "@/components/whateat/meal-log-tab"
import { ReservationTab } from "@/components/whateat/reservation-tab"
import { MealCalendarTab } from "@/components/whateat/meal-calendar-tab"
import { FamilyPage } from "@/components/whateat/family-page"
import { TalkPage } from "@/components/whateat/talk-page"
import { AddReservationModal } from "@/components/whateat/add-reservation-modal"
import { Footer } from "@/components/whateat/footer"
import { cn } from "@/lib/utils"
import MealWrapper from "@/app/client-wrapper"
import { useHub, HubShareSquare, useHubReferral } from "@/services/merlin-hub-sdk/react"
import { HomeOnboarding } from "@/components/whateat/home-onboarding"
import PWAInstallPrompt from "@/components/PWAInstallPrompt"

function LoginNudge({ 
  title, 
  desc, 
  icon,
  onClose
}: { 
  title: string 
  desc: string 
  icon: string 
  onClose?: () => void
}) {
  return (
    <div className="relative w-full flex flex-col items-center justify-center py-10 px-6 text-center bg-white rounded-3xl border border-cyan-100/50 shadow-xl space-y-5 max-w-xl mx-auto">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          aria-label="닫기"
        >
          <X className="size-5" />
        </button>
      )}
      <div className="text-5xl animate-bounce duration-1000 select-none">{icon}</div>
      <div className="space-y-2 max-w-sm">
        <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed font-medium">{desc}</p>
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
        className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all text-sm cursor-pointer"
      >
        이메일로 3초 로그인하기 ⚡
      </button>
    </div>
  )
}

export default function WhatEatApp() {
  const { isLoggedIn, isLoading } = useHub()
  const { registerInviter } = useHubReferral()
  const [hoveredTab, setHoveredTab] = useState<HeaderNavTab | null>(null)
  const [bottomNavTab, setBottomNavTab] = useState<HeaderNavTab>("home")
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false)
  const [showFamilyJoinConfirm, setShowFamilyJoinConfirm] = useState(false)
  const [pendingRefCode, setPendingRefCode] = useState("")
  const [isNudgeDismissed, setIsNudgeDismissed] = useState(false)

  // 0. 오늘 세션 동안 넛지 닫힘 상태 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('login_nudge_dismissed') === 'true'
      setIsNudgeDismissed(dismissed)
    }
  }, [])

  const handleDismissNudge = () => {
    sessionStorage.setItem('login_nudge_dismissed', 'true')
    setIsNudgeDismissed(true)
  }

  // 1. URL의 ref 파라미터 감지 및 캐싱 & 주소창 정돈
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
      localStorage.setItem('pending_family_ref', refCode);

      // 주소창에서 ?ref=... 파라미터를 조용히 제거하여 새로고침 시 무한 팝업 방지
      try {
        const urlObj = new URL(window.location.href);
        urlObj.searchParams.delete('ref');
        window.history.replaceState({}, '', urlObj.toString());
      } catch (e) {}
    }
  }, []);

  // 2. 로그인 완료 감지 시 가족 합류 컨펌 노출
  useEffect(() => {
    if (isLoggedIn && !isLoading) {
      const pendingRef = localStorage.getItem('pending_family_ref');
      if (pendingRef) {
        setPendingRefCode(pendingRef);
        setShowFamilyJoinConfirm(true);
      }
    }
  }, [isLoggedIn, isLoading]);

  const handleAcceptFamilyJoin = async () => {
    if (!pendingRefCode) return;
    
    const success = await registerInviter(pendingRefCode);
    
    if (success) {
      localStorage.removeItem('pending_family_ref');
      setShowFamilyJoinConfirm(false);
      
      alert("가족으로 성공적으로 연동되었습니다! 🏡");
      
      handleTabChange("family");
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      }
    } else {
      alert("가족 연동에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const handleDeclineFamilyJoin = () => {
    localStorage.removeItem('pending_family_ref');
    setShowFamilyJoinConfirm(false);
  };

  // 1. 브라우저 뒤로가기/앞으로가기 및 마우스 뒤로가기 버튼 연동
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 초기 상태 세팅 (URL 파라미터나 hash 또는 로컬스토리지 분석)
    const handleInitialTab = () => {
      const hash = window.location.hash.replace('#', '') as HeaderNavTab;
      const validTabs: HeaderNavTab[] = ["home", "solo", "family", "talk", "meal"];
      if (validTabs.includes(hash)) {
        setBottomNavTab(hash);
      } else {
        const saved = localStorage.getItem('activeNavTab') as HeaderNavTab;
        if (saved && validTabs.includes(saved)) {
          localStorage.removeItem('activeNavTab');
          setBottomNavTab(saved);
        } else {
          setBottomNavTab("home");
        }
      }
    };

    handleInitialTab();

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setBottomNavTab(event.state.tab);
      } else {
        // popstate에 state가 없으면 해시 분석 후 폴백
        const hash = window.location.hash.replace('#', '') as HeaderNavTab;
        const validTabs: HeaderNavTab[] = ["home", "solo", "family", "talk", "meal"];
        if (validTabs.includes(hash)) {
          setBottomNavTab(hash);
        } else {
          setBottomNavTab("home");
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as HeaderNavTab;
      const validTabs: HeaderNavTab[] = ["home", "solo", "family", "talk", "meal"];
      if (validTabs.includes(hash)) {
        setBottomNavTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // 2. 탭 상태가 변경될 때 브라우저 히스토리에 적재 (이중 적재 및 무한 뒤로가기 루프 방지)
  const handleTabChange = (newTab: HeaderNavTab) => {
    if (bottomNavTab === newTab) return;
    setBottomNavTab(newTab);
    
    if (typeof window !== 'undefined') {
      const targetHash = `#${newTab}`;
      // 현재 브라우저의 state와 다를 때만 pushState 실행
      if (window.history.state?.tab !== newTab) {
        window.history.pushState({ tab: newTab }, '', targetHash);
      }
    }
  };

  // Listen for navigation requests to Talk tab
  useEffect(() => {
    const handleNavigateToTalk = () => {
      handleTabChange("talk");
    };
    window.addEventListener("navigateToTalk", handleNavigateToTalk);
    return () => {
      window.removeEventListener("navigateToTalk", handleNavigateToTalk);
    };
  }, [bottomNavTab]);

  useEffect(() => {
    if (!isLoading && !hasAutoNavigated) {
      setHasAutoNavigated(true)
      if (isLoggedIn && bottomNavTab === "home") {
        handleTabChange("solo");
      }
    }
  }, [isLoading, isLoggedIn, bottomNavTab, hasAutoNavigated])

  const [activeTab, setActiveTab] = useState<"log" | "reservation" | "calendar">("log")
  const [searchQuery, setSearchQuery] = useState("")
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)
  const [logJumpRequest, setLogJumpRequest] = useState<{ date: string; key: number } | null>(null)
  const [reservationJumpRequest, setReservationJumpRequest] = useState<{ date: string; key: number } | null>(null)
  const [showBackToCalendar, setShowBackToCalendar] = useState(false)

  const handleSoloTabChange = (tab: "log" | "reservation" | "calendar") => {
    setActiveTab(tab)
    if (tab === "calendar") {
      setShowBackToCalendar(false)
    }
  }

  const renderFamilyPage = () => (
    <div className="px-5 pt-4 flex flex-col gap-5">
      <FamilyPage />
      <Footer />
    </div>
  )

  const renderTalkPage = () => (
    <div className="px-5 pt-4 flex flex-col gap-5">
      <TalkPage isActive={bottomNavTab === "talk"} />
      <Footer />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
      {/* 고정(fixed) 헤더 */}
      <Header 
        activeNavTab={bottomNavTab} 
        onNavTabChange={handleTabChange} 
        hoveredTab={hoveredTab}
      />

      {/* 헤더 높이(62px)만큼 상단 여백을 주어 본문이 가려지지 않도록 하고, 화면 전체 중앙 정렬 */}
      <div className="relative flex justify-center min-h-screen pt-[62px]">
        {/* 본문 콘텐츠 컨테이너: 최대 가로폭 800px 고정 및 헤더 내부 컨테이너와 동일한 정렬선 확보 */}
        <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] min-h-screen flex flex-col relative shadow-2xl shadow-black/5 bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] shrink-0 z-10">
          
          <div className={cn("sticky top-[62px] z-40 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] px-4 pt-2", bottomNavTab === "home" ? "pb-0" : "pb-1 border-b border-muted/10")}>
            {bottomNavTab === "solo" && (
              <TabNavigation
                activeTab={activeTab}
                onTabChange={handleSoloTabChange}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
            {bottomNavTab === "meal" && <div className="h-1" />}
          </div>

          <main className={cn(
            "flex-1 overflow-y-auto custom-scrollbar relative",
            (!isLoggedIn && !isLoading && bottomNavTab !== "home" && bottomNavTab !== "talk" && !isNudgeDismissed) ? "pb-[300px]" : "pb-8"
          )}>
            {/* Home Onboarding Tab */}
            <div className={cn("absolute inset-0 z-50 bg-white/50 backdrop-blur-md overflow-hidden", (bottomNavTab !== "home" || isLoading) && "hidden")}>
              <HomeOnboarding 
                onStart={(target) => handleTabChange(target || "solo")} 
                onHoverTab={setHoveredTab}
              />
            </div>

            {/* Solo Tab Content (Always mounted, toggled by CSS hidden) */}
            <div className={cn("relative px-5 lg:px-8 min-h-[500px]", bottomNavTab !== "solo" && "hidden")}>
              <div className="flex flex-col gap-5">
                <div className={cn(activeTab !== "log" && "hidden")}>
                  <MealLogTab
                    jumpToDate={logJumpRequest}
                    showBackToCalendar={showBackToCalendar}
                    onBackToCalendar={() => {
                      setActiveTab("calendar")
                      setShowBackToCalendar(false)
                    }}
                  />
                </div>
                <div className={cn(activeTab !== "reservation" && "hidden")}>
                  <ReservationTab
                    jumpToDate={reservationJumpRequest}
                    showBackToCalendar={showBackToCalendar}
                    onBackToCalendar={() => {
                      setActiveTab("calendar")
                      setShowBackToCalendar(false)
                    }}
                  />
                </div>
                <div className={cn(activeTab !== "calendar" && "hidden")}>
                  <MealCalendarTab
                    onNavigateToLog={(date) => {
                      setActiveTab("log")
                      setLogJumpRequest({ date, key: Date.now() })
                      setShowBackToCalendar(true)
                    }}
                    onNavigateToReservation={(date) => {
                      setActiveTab("reservation")
                      setReservationJumpRequest({ date, key: Date.now() })
                      setShowBackToCalendar(true)
                    }}
                  />
                </div>
                <Footer />
              </div>
            </div>

            {/* Other main tabs (Always mounted, toggled by CSS hidden) */}
            <div className={cn("relative min-h-[500px]", bottomNavTab !== "family" && "hidden")}>
              <div>
                {renderFamilyPage()}
              </div>
            </div>
            <div className={cn(bottomNavTab !== "talk" && "hidden")}>
              {renderTalkPage()}
            </div>
            <div className={cn("relative min-h-[500px]", bottomNavTab !== "meal" && "hidden")}>
              <div>
                <MealWrapper />
              </div>
            </div>
          </main>

        </div>
      </div>

      <AddReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} />

      {/* Global Login Nudge for Guest Users */}
      {!isLoggedIn && !isLoading && bottomNavTab !== "home" && bottomNavTab !== "talk" && !isNudgeDismissed && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center pb-6 px-4">
          <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] px-5 lg:px-8 flex justify-center pointer-events-auto">
            <LoginNudge
              icon={
                bottomNavTab === "solo" ? "🍔" :
                bottomNavTab === "family" ? "🏡" : "🍱"
              }
              title={
                bottomNavTab === "solo" ? "배고픈 순간, 가장 먼저 꺼내는 맛집 서랍" :
                bottomNavTab === "family" ? "나와 가족의 맛있는 기억들" : "우리 아이 학교 급식 알리미"
              }
              desc={
                bottomNavTab === "solo" ? "기억하고 싶은 맛, 다시 가고 싶은 곳. 우리 집만의 입맛을 기록하세요." :
                bottomNavTab === "family" ? "여기저기 흩어진 나와 가족의 맛있는 기억들, 밥 먹을 땐 '뭐먹지?' 하나면 충분합니다." :
                "오늘 메뉴는 뭘까? 아이의 급식 평가를 확인하고, 식단과 연계된 재미있는 AI 퀴즈도 즐겨보세요."
              }
              onClose={handleDismissNudge}
            />
          </div>
        </div>
      )}

      {/* 가족 합류 컨펌 모달 */}
      {showFamilyJoinConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-gray-100 shadow-2xl space-y-5 transform transition-all scale-100">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="size-16 rounded-2xl bg-orange-50 flex items-center justify-center text-4xl animate-bounce">
                🏡
              </div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight font-sans">우리가족으로 함께할까요?</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                초대 코드를 통해 방문하셨습니다.<br/>
                가족 그룹으로 합류하시면 함께 식사를 기록하고, 투표를 통해 식단을 결정할 수 있습니다.
              </p>
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleAcceptFamilyJoin}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all text-xs cursor-pointer"
              >
                수락하고 가족 합류하기 🧡
              </button>
              <button
                onClick={handleDeclineFamilyJoin}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-[0.98] transition-all text-xs cursor-pointer"
              >
                그냥 일반 모드로 둘러보기
              </button>
            </div>
          </div>
        </div>
      )}

      <PWAInstallPrompt />
    </div>
  )
}
