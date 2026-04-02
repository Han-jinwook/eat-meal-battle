"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

export default function WhatEatPage() {
  const router = useRouter()

  const [bottomNavTab, setBottomNavTab] = useState<HeaderNavTab>("solo")
  const [activeTab, setActiveTab] = useState<"log" | "reservation" | "calendar">("log")
  const [mealSubTab, setMealSubTab] = useState<"meal" | "battle" | "quiz">("meal")
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

  const renderMealPage = () => {
    const subTabMeta = {
      meal: {
        title: "급식",
        description: "기존 급식 화면으로 이동합니다.",
        href: "/",
      },
      battle: {
        title: "배틀",
        description: "기존 배틀 화면으로 이동합니다.",
        href: "/battle",
      },
      quiz: {
        title: "퀴즈",
        description: "기존 퀴즈 화면으로 이동합니다.",
        href: "/quiz",
      },
    } as const

    const current = subTabMeta[mealSubTab]

    return (
      <div className="px-5 pt-4 flex flex-col gap-4">
        <div className="bg-white/70 border border-cyan-100 rounded-2xl p-5">
          <h2 className="font-bold text-lg text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{current.description}</p>
          <button
            onClick={() => {
              router.push(current.href)
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-600 transition-colors"
          >
            {current.title} 화면으로 이동
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
      <div className="flex justify-center min-h-screen">
        <aside className="hidden lg:flex w-[160px] shrink-0 items-start justify-center pt-20 sticky top-0 h-screen">
          <div className="w-[140px] h-[400px] bg-white/50 border border-dashed border-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/50 text-xs">
            AD BANNER
          </div>
        </aside>

        <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] min-h-screen flex flex-col relative shadow-2xl shadow-black/5 bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2]">
          <Header activeNavTab={bottomNavTab} onNavTabChange={setBottomNavTab} />

          <div className="sticky top-0 z-40 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] px-5 lg:px-8 pt-2 pb-1 border-b border-muted/10">
            {bottomNavTab === "solo" && (
              <TabNavigation
                activeTab={activeTab}
                onTabChange={handleSoloTabChange}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
            {bottomNavTab === "meal" && (
              <div className="flex items-center border-b border-cyan-100">
                {[
                  { id: "meal", label: "급식" },
                  { id: "battle", label: "배틀" },
                  { id: "quiz", label: "퀴즈" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMealSubTab(tab.id as "meal" | "battle" | "quiz")}
                    className={`px-3 py-2.5 text-[14px] font-bold transition-all duration-300 relative whitespace-nowrap rounded-t-lg ${
                      mealSubTab === tab.id
                        ? "text-cyan-600 bg-cyan-50/50 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-cyan-500 after:rounded-full"
                        : "text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50/30"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <main className="flex-1 overflow-y-auto custom-scrollbar pb-8">
            {bottomNavTab === "solo" && (
              <div className="px-5 lg:px-8 flex flex-col gap-5">
                {activeTab === "log" && (
                  <MealLogTab
                    onAdd={() => setIsLogModalOpen(true)}
                    jumpToDate={logJumpRequest}
                    showBackToCalendar={showBackToCalendar}
                    onBackToCalendar={() => {
                      setActiveTab("calendar")
                      setShowBackToCalendar(false)
                    }}
                  />
                )}
                {activeTab === "reservation" && (
                  <ReservationTab
                    jumpToDate={reservationJumpRequest}
                    showBackToCalendar={showBackToCalendar}
                    onBackToCalendar={() => {
                      setActiveTab("calendar")
                      setShowBackToCalendar(false)
                    }}
                  />
                )}
                {activeTab === "calendar" && (
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
                )}
                <Footer />
              </div>
            )}
            {bottomNavTab === "family" && renderFamilyPage()}
            {bottomNavTab === "talk" && renderTalkPage()}
            {bottomNavTab === "meal" && renderMealPage()}
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
