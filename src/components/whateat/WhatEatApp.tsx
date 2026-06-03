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

export default function WhatEatApp() {
  const [bottomNavTab, setBottomNavTab] = useState<HeaderNavTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('activeNavTab') as HeaderNavTab;
      if (saved) {
        localStorage.removeItem('activeNavTab');
        return saved;
      }
    }
    return "solo";
  })
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
            {bottomNavTab === "meal" && <div className="h-1" />}
          </div>

          <main className="flex-1 overflow-y-auto custom-scrollbar pb-8">
            {/* Solo Tab Content (Always mounted, toggled by CSS hidden) */}
            <div className={cn("px-5 lg:px-8 flex flex-col gap-5", bottomNavTab !== "solo" && "hidden")}>
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

            {/* Other main tabs (Always mounted, toggled by CSS hidden) */}
            <div className={cn(bottomNavTab !== "family" && "hidden")}>
              {renderFamilyPage()}
            </div>
            <div className={cn(bottomNavTab !== "talk" && "hidden")}>
              {renderTalkPage()}
            </div>
            <div className={cn(bottomNavTab !== "meal" && "hidden")}>
              <MealWrapper />
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
