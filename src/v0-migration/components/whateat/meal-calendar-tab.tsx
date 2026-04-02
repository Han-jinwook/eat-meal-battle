"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, ChefHat, Bike, UtensilsCrossed, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

interface MealCalendarTabProps {
  onNavigateToLog?: (date: string) => void
  onNavigateToReservation?: (date: string) => void
}

type CalendarMode = "log" | "reservation"

// 실제 먹로그 데이터와 연동
const sampleLogData: Record<string, { type: "home" | "delivery" | "out"; label: string; id: number }[]> = {
  "2026-04-10": [{ type: "out", label: "채끝 스테이크", id: 1 }],
  "2026-03-25": [{ type: "home", label: "바질 페스토", id: 2 }],
  "2026-03-18": [{ type: "delivery", label: "양념치킨", id: 3 }],
}

// 실제 먹예약 데이터와 연동
const sampleReservationData: Record<string, { name: string; type: "home" | "delivery" | "out"; memo: string; id: number }[]> = {
  "2026-03-15": [{ name: "삼겹살", type: "out", memo: "회식", id: 1 }],
  "2026-03-22": [{ name: "파스타", type: "home", memo: "집에서 만들기", id: 2 }],
  "2026-04-05": [{ name: "치킨", type: "delivery", memo: "", id: 3 }],
}

const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"]

export function MealCalendarTab({ onNavigateToLog, onNavigateToReservation }: MealCalendarTabProps) {
  const [mode, setMode] = useState<CalendarMode>("log")
  const [currentMonth, setCurrentMonth] = useState({ year: 2026, month: 3 })

  const goToPrevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 }
      }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 }
      }
      return { ...prev, month: prev.month + 1 }
    })
  }

  // 캘린더 날짜 생성
  const generateCalendarDays = () => {
    const firstDay = new Date(currentMonth.year, currentMonth.month - 1, 1)
    const lastDay = new Date(currentMonth.year, currentMonth.month, 0)
    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: { day: number; isCurrentMonth: boolean; fullDate: string }[] = []

    // 이전 달 날짜
    const prevMonthLastDay = new Date(currentMonth.year, currentMonth.month - 1, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i
      const prevMonth = currentMonth.month === 1 ? 12 : currentMonth.month - 1
      const prevYear = currentMonth.month === 1 ? currentMonth.year - 1 : currentMonth.year
      days.push({
        day,
        isCurrentMonth: false,
        fullDate: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      })
    }

    // 현재 달 날짜
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        fullDate: `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      })
    }

    // 다음 달 날짜 (6주 채우기)
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = currentMonth.month === 12 ? 1 : currentMonth.month + 1
      const nextYear = currentMonth.month === 12 ? currentMonth.year + 1 : currentMonth.year
      days.push({
        day: i,
        isCurrentMonth: false,
        fullDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      })
    }

    return days
  }

  const calendarDays = generateCalendarDays()

  // 통계 계산
  const calculateStats = () => {
    let home = 0, delivery = 0, out = 0
    Object.values(sampleLogData).forEach(dayData => {
      dayData.forEach(item => {
        if (item.type === "home") home += item.count
        else if (item.type === "delivery") delivery += item.count
        else if (item.type === "out") out += item.count
      })
    })
    const total = home + delivery + out
    return {
      home: total > 0 ? Math.round((home / total) * 100) : 0,
      delivery: total > 0 ? Math.round((delivery / total) * 100) : 0,
      out: total > 0 ? Math.round((out / total) * 100) : 0,
      total
    }
  }

  const stats = calculateStats()

  const handleDateClick = (date: string) => {
    if (mode === "log") {
      onNavigateToLog?.(date)
    } else {
      onNavigateToReservation?.(date)
    }
  }

  const getLogIndicators = (date: string) => {
    return sampleLogData[date] || []
  }

  const getReservationIndicators = (date: string) => {
    return sampleReservationData[date] || []
  }

  const getTypeColor = (type: "home" | "delivery" | "out") => {
    switch (type) {
      case "home": return "bg-emerald-500"
      case "delivery": return "bg-cyan-500"
      case "out": return "bg-violet-500"
    }
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-5 pt-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setMode("log")}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold transition-all",
            mode === "log"
              ? "bg-primary text-white shadow-md"
              : "bg-white/70 text-muted-foreground hover:bg-white"
          )}
        >
          먹로그
        </button>
        <button
          onClick={() => setMode("reservation")}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold transition-all",
            mode === "reservation"
              ? "bg-cyan-500 text-white shadow-md"
              : "bg-white/70 text-muted-foreground hover:bg-white"
          )}
        >
          먹예약
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-white/80 rounded-3xl p-5 shadow-sm border border-white/50">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-5">
          <button 
            onClick={goToPrevMonth}
            className="size-9 rounded-full hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h3 className="font-bold text-lg text-foreground">
            {currentMonth.year}년 {currentMonth.month}월
          </h3>
          <button 
            onClick={goToNextMonth}
            className="size-9 rounded-full hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {daysOfWeek.map((day, index) => (
            <div 
              key={day} 
              className={cn(
                "text-xs font-bold py-2",
                index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-muted-foreground"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid - 메모형 셀 */}
        <div className="grid grid-cols-7 gap-px">
          {calendarDays.map((dayObj, index) => {
            const isToday = dayObj.fullDate === todayStr
            const logData = getLogIndicators(dayObj.fullDate)
            const reservationData = getReservationIndicators(dayObj.fullDate)
            const activeData = mode === "log" ? logData : reservationData
            const hasData = activeData.length > 0
            const dayOfWeek = index % 7

            return (
              <div
                key={`${dayObj.fullDate}-${index}`}
                className={cn(
                  "min-h-[64px] flex flex-col rounded-lg border transition-all",
                  dayObj.isCurrentMonth
                    ? "border-muted/20 bg-white/40"
                    : "border-transparent bg-transparent",
                  isToday && "border-primary/40 bg-primary/5 ring-1 ring-primary/30",
                  hasData && dayObj.isCurrentMonth && "bg-white/80"
                )}
              >
                {/* 날짜 숫자 */}
                <div className={cn(
                  "text-[11px] font-bold px-1.5 pt-1 leading-none",
                  !dayObj.isCurrentMonth && "text-muted-foreground/30",
                  dayObj.isCurrentMonth && dayOfWeek === 0 && "text-red-400",
                  dayObj.isCurrentMonth && dayOfWeek === 6 && "text-blue-400",
                  dayObj.isCurrentMonth && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-foreground/70",
                  isToday && "text-primary font-extrabold"
                )}>
                  {dayObj.day}
                </div>

                {/* 배경색 블록 내용 - 모드별 단일 색상 */}
                {dayObj.isCurrentMonth && hasData && (
                  <div className="flex-1 px-1 pb-1 mt-0.5">
                    {activeData.slice(0, 1).map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleDateClick(dayObj.fullDate)}
                        className={cn(
                          "w-full text-left text-[9px] font-medium leading-tight px-1.5 py-1 rounded-lg truncate transition-all hover:opacity-80 active:scale-95",
                          mode === "log"
                            ? "bg-cyan-500/20 text-cyan-700 border border-cyan-500/30"
                            : "bg-violet-500/20 text-violet-700 border border-violet-500/30"
                        )}
                      >
                        {"label" in item ? item.label : item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-muted/20">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">집밥</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-cyan-500" />
            <span className="text-xs text-muted-foreground">배달</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-violet-500" />
            <span className="text-xs text-muted-foreground">외식</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white/80 rounded-3xl p-5 shadow-sm border border-white/50">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="size-5 text-primary" />
          <h3 className="font-bold text-foreground">이번 달 식사 패턴</h3>
          <span className="text-xs text-muted-foreground ml-auto">총 {stats.total}끼</span>
        </div>

        {/* Progress Bars */}
        <div className="space-y-3">
          {/* 집밥 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-16">
              <ChefHat className="size-4 text-emerald-500" />
              <span className="text-xs font-medium">집밥</span>
            </div>
            <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.home}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-600 w-10 text-right">{stats.home}%</span>
          </div>

          {/* 배달 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-16">
              <Bike className="size-4 text-cyan-500" />
              <span className="text-xs font-medium">배달</span>
            </div>
            <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.delivery}%` }}
              />
            </div>
            <span className="text-xs font-bold text-cyan-500 w-10 text-right">{stats.delivery}%</span>
          </div>

          {/* 외식 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-16">
              <UtensilsCrossed className="size-4 text-violet-500" />
              <span className="text-xs font-medium">외식</span>
            </div>
            <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.out}%` }}
              />
            </div>
            <span className="text-xs font-bold text-violet-500 w-10 text-right">{stats.out}%</span>
          </div>
        </div>

        {/* Summary Message */}
        <div className="mt-4 pt-4 border-t border-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            {stats.home >= stats.delivery && stats.home >= stats.out 
              ? "집밥을 가장 많이 드셨어요! 건강한 식습관을 유지하고 계시네요."
              : stats.delivery >= stats.out
              ? "배달 음식을 자주 드시네요. 가끔은 집밥도 어떨까요?"
              : "외식을 자주 하시네요! 맛있는 곳 많이 발견하셨나요?"}
          </p>
        </div>
      </div>
    </div>
  )
}
