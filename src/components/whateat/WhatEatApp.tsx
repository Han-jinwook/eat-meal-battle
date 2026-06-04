"use client"

import { useState } from "react"
import { Header, type HeaderNavTab } from "@/components/whateat/header"
import { TabNavigation } from "@/components/whateat/tab-navigation"
import { MealLogTab } from "@/components/whateat/meal-log-tab"
import { ReservationTab } from "@/components/whateat/reservation-tab"
import { MealCalendarTab } from "@/components/whateat/meal-calendar-tab"
import { FamilyPage } from "@/components/whateat/family-page"
import { TalkPage } from "@/components/whateat/talk-page"
import { AddLogModal } from "@/components/whateat/add-log-modal"
import { AddReservationModal } from "@/components/whateat/add-reservation-modal"
import { Footer } from "@/components/whateat/footer"
import { cn } from "@/lib/utils"
import MealWrapper from "@/app/client-wrapper"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { HomeOnboarding } from "@/components/whateat/home-onboarding"

function LoginNudge({ 
  title, 
  desc, 
  icon 
}: { 
  title: string 
  desc: string 
  icon: string 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-3xl border border-cyan-100/50 shadow-md space-y-6 mx-5 lg:mx-8 my-10 max-w-xl md:mx-auto">
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
  const [bottomNavTab, setBottomNavTab] = useState<HeaderNavTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('activeNavTab') as HeaderNavTab;
      if (saved) {
        localStorage.removeItem('activeNavTab');
        return saved;
      }
    }
    return "home";
  })
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false)

  useEffect(() => {
    if (!isLoading && !hasAutoNavigated) {
      setHasAutoNavigated(true)
      if (isLoggedIn && bottomNavTab === "home") {
        setBottomNavTab("solo")
      }
    }
  }, [isLoading, isLoggedIn, bottomNavTab, hasAutoNavigated])

  const [activeTab, setActiveTab] = useState<"log" | "reservation" | "calendar">("log")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
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
      <TalkPage />
      <Footer />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
      <div className="flex justify-center min-h-screen">


        <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] min-h-screen flex flex-col relative shadow-2xl shadow-black/5 bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
          <Header activeNavTab={bottomNavTab} onNavTabChange={setBottomNavTab} />

          <div className={cn("sticky top-0 z-40 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] px-5 lg:px-8 pt-2", bottomNavTab === "home" ? "pb-0" : "pb-1 border-b border-muted/10")}>
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

          <main className="flex-1 overflow-y-auto custom-scrollbar pb-8 relative">
            {/* Home Onboarding Tab */}
            <div className={cn("absolute inset-0 z-50 bg-white/50 backdrop-blur-md overflow-y-auto", (bottomNavTab !== "home" || isLoading) && "hidden")}>
              <HomeOnboarding onStart={() => setBottomNavTab("solo")} />
            </div>

            {/* Solo Tab Content (Always mounted, toggled by CSS hidden) */}
            <div className={cn("relative px-5 lg:px-8 min-h-[500px]", bottomNavTab !== "solo" && "hidden")}>
              <div className="flex flex-col gap-5">
                <div className={cn(activeTab !== "log" && "hidden")}>
                  <MealLogTab
                    onAdd={() => setIsLogModalOpen(true)}
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

              {!isLoggedIn && !isLoading && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="sticky top-32 flex justify-center pointer-events-auto">
                    <LoginNudge
                      icon="🍔"
                      title="배고픈 순간, 가장 먼저 꺼내는 맛집 서랍"
                      desc="기억하고 싶은 맛, 다시 가고 싶은 곳. 우리 집만의 입맛을 기록하세요."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Other main tabs (Always mounted, toggled by CSS hidden) */}
            <div className={cn("relative min-h-[500px]", bottomNavTab !== "family" && "hidden")}>
              <div>
                {renderFamilyPage()}
              </div>
              {!isLoggedIn && !isLoading && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="sticky top-32 flex justify-center pointer-events-auto">
                    <LoginNudge
                      icon="🏡"
                      title="나와 가족의 맛있는 기억들"
                      desc="여기저기 흩어진 나와 가족의 맛있는 기억들, 밥 먹을 땐 '뭐먹지?' 하나면 충분합니다."
                    />
                  </div>
                </div>
              )}
            </div>
            <div className={cn(bottomNavTab !== "talk" && "hidden")}>
              {renderTalkPage()}
            </div>
            <div className={cn("relative min-h-[500px]", bottomNavTab !== "meal" && "hidden")}>
              <div>
                <MealWrapper />
              </div>
              {!isLoggedIn && !isLoading && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="sticky top-32 flex justify-center pointer-events-auto">
                    <LoginNudge
                      icon="🍱"
                      title="우리 아이 학교 급식 알리미"
                      desc="오늘 메뉴는 뭘까? 아이의 급식 평가를 확인하고, 식단과 연계된 재미있는 AI 퀴즈도 즐겨보세요."
                    />
                  </div>
                </div>
              )}
            </div>
          </main>

          <div className="lg:hidden w-full h-[50px] bg-white/80 border-t border-muted/20 flex items-center justify-center text-muted-foreground/50 text-xs shrink-0">
            MOBILE AD BANNER
          </div>
        </div>

        <aside className="hidden lg:flex w-[160px] shrink-0 items-start justify-center pt-20 sticky top-0 h-screen">
          <div className="w-[140px] h-[400px] bg-white/50 border border-dashed border-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/50 text-xs">
            AD BANNER
          </div>
        </aside>
      </div>

      <AddLogModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} />
      <AddReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} />
    </div>
  )
}
