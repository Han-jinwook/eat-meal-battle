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

export default function WhatEatApp() {
  const [bottomNavTab, setBottomNavTab] = useState<HeaderNavTab>("solo")
  const [activeTab, setActiveTab] = useState<"log" | "reservation" | "calendar">("log")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false)

  const handleFabClick = () => {
    if (bottomNavTab === "solo") {
      if (activeTab === "reservation") {
        setIsReservationModalOpen(true)
      } else {
        setIsLogModalOpen(true)
      }
    }
  }

  // 패밀리 페이지 렌더링
  const renderFamilyPage = () => (
    <div className="px-5 pt-4 flex flex-col gap-5">
      <FamilyPage />
      <Footer />
    </div>
  )

  // 맛톡 페이지 렌더링
  const renderTalkPage = () => (
    <div className="px-5 pt-4 flex flex-col gap-5">
      <TalkPage />
      <Footer />
    </div>
  )

  // 급식 페이지 (준비 중)
  const renderMealPage = () => (
    <div className="px-5 pt-4 flex flex-col items-center justify-center py-20">
      <div className="size-20 rounded-full bg-orange-50 flex items-center justify-center mb-4">
        <span className="text-4xl">🍽️</span>
      </div>
      <h2 className="font-bold text-lg text-foreground mb-2">급식</h2>
      <p className="text-sm text-muted-foreground text-center">
        학교/직장 급식 정보를 확인하세요
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1">준비 중입니다</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
      {/* 3열 레이아웃: 좌측배너 | 콘텐츠 | 우측배너 */}
      <div className="flex justify-center min-h-screen">
        {/* 좌측 광고 배너 - lg 이상에서만 표시 */}
        <aside className="hidden lg:flex w-[160px] shrink-0 items-start justify-center pt-20 sticky top-0 h-screen">
          <div className="w-[140px] h-[400px] bg-white/50 border border-dashed border-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/50 text-xs">
            AD BANNER
          </div>
        </aside>

        {/* 메인 콘텐츠 컨테이너 */}
        <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] min-h-screen flex flex-col relative shadow-2xl shadow-black/5 bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
          {/* Header - main 밖에서 스크롤 시 올라감 */}
          <Header activeNavTab={bottomNavTab} onNavTabChange={setBottomNavTab} />
          
          {/* TabNavigation - main 밖에서 상단 고정 */}
          <div className="sticky top-0 z-40 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] px-5 lg:px-8 pt-2 pb-1 border-b border-muted/10">
            {bottomNavTab === "solo" && (
              <TabNavigation 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
          </div>
          
          {/* 콘텐츠 - 스크롤만 */}
          <main className="flex-1 overflow-y-auto custom-scrollbar pb-8">
            {bottomNavTab === "solo" && (
              <div className="px-5 lg:px-8 flex flex-col gap-5">
                {activeTab === "log" && <MealLogTab onAdd={() => setIsLogModalOpen(true)} />}
                {activeTab === "reservation" && <ReservationTab />}
                {activeTab === "calendar" && (
                  <MealCalendarTab 
                    onNavigateToLog={(date) => {
                      setActiveTab("log")
                      // TODO: 날짜 필터링 전달
                    }}
                    onNavigateToReservation={(date) => {
                      setActiveTab("reservation")
                      // TODO: 날짜 필터링 전달
                    }}
                  />
                )}

                <Footer />
              </div>
            )}
            {bottomNavTab === "family" && renderFamilyPage()}
            {bottomNavTab === "talk" && renderTalkPage()}
            {bottomNavTab === "meal" && renderMealPage()}
          </main>

          {/* 모바일 하단 광고 배너 - lg 미만에서만 표시 */}
          <div className="lg:hidden w-full h-[50px] bg-white/80 border-t border-muted/20 flex items-center justify-center text-muted-foreground/50 text-xs shrink-0">
            MOBILE AD BANNER
          </div>
        </div>

        {/* 우측 광고 배너 - lg 이상에서만 표시 */}
        <aside className="hidden lg:flex w-[160px] shrink-0 items-start justify-center pt-20 sticky top-0 h-screen">
          <div className="w-[140px] h-[400px] bg-white/50 border border-dashed border-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/50 text-xs">
            AD BANNER
          </div>
        </aside>
      </div>

      {/* Modals - 레이아웃 밖에서 전체 화면 기준 */}
      <AddLogModal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
      />
      <AddReservationModal 
        isOpen={isReservationModalOpen} 
        onClose={() => setIsReservationModalOpen(false)} 
      />
    </div>
  )
}
