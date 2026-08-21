"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, ChefHat, Bike, UtensilsCrossed, CalendarDays, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDynamicDefaultPlans } from "./reservation-tab"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { createClient } from "@/lib/supabase"
import { ReservationDetailModal, DetailPlanData } from "./reservation-detail-modal"

interface MealCalendarTabProps {
  onNavigateToLog?: (date: string) => void
  onNavigateToReservation?: (date: string) => void
  isGroupMode?: boolean
}

type CalendarMode = "log" | "reservation"

// 실제 먹로그 데이터와 연동
const sampleLogData: Record<string, { type: "home" | "delivery" | "out"; label: string; id: number }[]> = {
  "2026-04-10": [{ type: "out", label: "채끝 스테이크", id: 1 }],
  "2026-03-25": [{ type: "home", label: "바질 페스토", id: 2 }],
  "2026-03-18": [{ type: "delivery", label: "양념치킨", id: 3 }],
}

// 실제 먹예약 데이터 연동을 위한 함수형 변환 (임시 하드코딩 제거)
const generateDynamicSampleReservationData = (baseDate?: Date) => {
  const dynamicPlans = getDynamicDefaultPlans(baseDate)
  const data: Record<string, any[]> = {}
  dynamicPlans.forEach(plan => {
    let type: "home" | "delivery" | "out" = "home"
    if (plan.mealType === "배달") type = "delivery"
    if (plan.mealType === "외식") type = "out"
    
    if (!data[plan.date]) {
      data[plan.date] = []
    }
    data[plan.date].push({
      id: plan.id,
      name: plan.menu,
      menu: plan.menu,
      mealType: plan.mealType,
      type,
      time: plan.time || "점심",
      place: plan.place || "",
      memo: plan.memo || "",
      thumbnail: plan.thumbnail,
      url: plan.url
    })
  })
  return data
}

const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"]

export function MealCalendarTab({ onNavigateToLog, onNavigateToReservation, isGroupMode }: MealCalendarTabProps) {
  const [mode, setMode] = useState<CalendarMode>("reservation")
  const { isLoggedIn, user } = useHub()
  const [baseDate, setBaseDate] = useState<Date | undefined>(undefined)
  const [realReservations, setRealReservations] = useState<Record<string, any[]>>({})
  const [realLogs, setRealLogs] = useState<Record<string, any[]>>({})
  const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<DetailPlanData | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "home" | "delivery" | "out">("all")

  const handleToggleFilter = (type: "home" | "delivery" | "out") => {
    setTypeFilter(prev => prev === type ? "all" : type)
  }

  // 현재 날짜(오늘) 기준으로 초기 캘린더 월 설정
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() + 1 }
  })

  const fetchData = useCallback(async () => {
    if (!isLoggedIn || !user?.id) return
    try {
      const supabase = createClient()
      
      // 1. 유저 가입일(created_at) 조회
      const { data: userData } = await supabase.from("users").select("created_at").eq("id", user.id).single()
      let userBaseDate = new Date()
      if (userData?.created_at) {
        userBaseDate = new Date(userData.created_at)
        setBaseDate(userBaseDate)
      }

      // 2. 실제 먹예약 (meal_reservations) DB 조회
      const { data: resData } = await supabase
        .from("meal_reservations")
        .select("*")
        .eq("user_id", user.id)
        .eq("source", "solo")

      const resMap: Record<string, any[]> = {}
      const hasType = { home: false, delivery: false, out: false }

      if (resData && resData.length > 0) {
        resData.forEach(row => {
          let type: "home" | "delivery" | "out" = "home"
          if (row.meal_type === "배달") { type = "delivery"; hasType.delivery = true }
          else if (row.meal_type === "외식") { type = "out"; hasType.out = true }
          else { type = "home"; hasType.home = true }

          if (!resMap[row.date]) resMap[row.date] = []
          resMap[row.date].push({
            id: row.id,
            name: row.menu,
            menu: row.menu,
            mealType: row.meal_type,
            type,
            time: row.time || "",
            place: row.place || "",
            memo: row.memo || "",
            thumbnail: row.thumbnail,
            url: row.source_url || row.url,
            isSample: false
          })
        })
      }

      // 등록 안 한 유형의 샘플 예약 추가
      const samples = getDynamicDefaultPlans(userBaseDate)
      samples.forEach(sample => {
        let type: "home" | "delivery" | "out" = "home"
        if (sample.mealType === "배달") type = "delivery"
        else if (sample.mealType === "외식") type = "out"
        else type = "home"

        if (!hasType[type]) {
          if (!resMap[sample.date]) resMap[sample.date] = []
          resMap[sample.date].push({
            id: sample.id,
            name: sample.menu,
            menu: sample.menu,
            mealType: sample.mealType,
            type,
            time: sample.time || "",
            place: sample.place || "",
            memo: sample.memo || "",
            thumbnail: sample.thumbnail,
            url: sample.url,
            isSample: true
          })
        }
      })
      setRealReservations(resMap)

      // 3. 실제 먹로그 (meal_images) DB 조회
      const { data: logData } = await supabase
        .from("meal_images")
        .select("*")
        .eq("uploaded_by", user.id)
        .order("created_at", { ascending: false })

      const logMap: Record<string, any[]> = {}
      const hasLogType = { home: false, delivery: false, out: false }

      if (logData && logData.length > 0) {
        logData.forEach(row => {
          let type: "home" | "delivery" | "out" = "home"
          if (row.meal_type === "배달" || row.meal_type === "delivery") { type = "delivery"; hasLogType.delivery = true }
          else if (row.meal_type === "외식" || row.meal_type === "dineout" || row.meal_type === "out") { type = "out"; hasLogType.out = true }
          else { type = "home"; hasLogType.home = true }

          const dateKey = row.created_at ? row.created_at.split("T")[0] : ""
          if (dateKey) {
            if (!logMap[dateKey]) logMap[dateKey] = []
            logMap[dateKey].push({
              id: row.id,
              label: row.title || row.explanation || "맛있는 식사",
              type,
              isSample: false
            })
          }
        })
      }

      // 등록 안 한 유형의 샘플 먹로그 추가
      Object.entries(sampleLogData).forEach(([dateKey, items]) => {
        items.forEach(item => {
          if (!hasLogType[item.type]) {
            if (!logMap[dateKey]) logMap[dateKey] = []
            logMap[dateKey].push({ ...item, isSample: true })
          }
        })
      })
      setRealLogs(logMap)
    } catch (e) {
      console.error("Failed to load calendar data", e)
    }
  }, [isLoggedIn, user?.id])

  useEffect(() => {
    fetchData()

    const handleUpdate = () => {
      fetchData()
    }
    window.addEventListener("whateat:reservation-updated", handleUpdate)
    return () => {
      window.removeEventListener("whateat:reservation-updated", handleUpdate)
    }
  }, [fetchData])

  const dynamicSampleReservationData = useMemo(() => generateDynamicSampleReservationData(baseDate), [baseDate])

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

  // 현재 선택 월 + 탭 기준 통계 계산
  const calculateStats = () => {
    let home = 0
    let delivery = 0
    let out = 0
    let total = 0
    let activeDays = 0

    const activeDataMap = mode === "log" 
      ? (Object.keys(realLogs).length > 0 ? realLogs : sampleLogData)
      : (Object.keys(realReservations).length > 0 ? realReservations : dynamicSampleReservationData)

    Object.entries(activeDataMap).forEach(([dateKey, dayData]) => {
      const [year, month] = dateKey.split("-").map(Number)
      const isSameMonth = year === currentMonth.year && month === currentMonth.month
      if (!isSameMonth) return

      if (dayData.length > 0) {
        activeDays += 1
      }

      dayData.forEach((item) => {
        total += 1
        if (item.type === "home") home += 1
        else if (item.type === "delivery") delivery += 1
        else if (item.type === "out") out += 1
      })
    })

    return {
      home: total > 0 ? Math.round((home / total) * 100) : 0,
      delivery: total > 0 ? Math.round((delivery / total) * 100) : 0,
      out: total > 0 ? Math.round((out / total) * 100) : 0,
      homeCount: home,
      deliveryCount: delivery,
      outCount: out,
      total,
      activeDays,
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

  const handleItemClick = (item: any, date: string) => {
    if (mode === "reservation") {
      setSelectedPlanForDetail({
        id: item.id,
        date: item.date || date,
        time: item.time || "",
        mealType: item.mealType || (item.type === "delivery" ? "배달" : item.type === "out" ? "외식" : "집밥"),
        menu: item.menu || item.name || "식사 예약",
        place: item.place || "",
        memo: item.memo || "",
        thumbnail: item.thumbnail,
        url: item.url
      })
    } else {
      onNavigateToLog?.(date)
    }
  }

  const getLogIndicators = (date: string) => {
    return realLogs[date] || (Object.keys(realLogs).length === 0 ? (sampleLogData[date] || []) : [])
  }

  const getReservationIndicators = (date: string) => {
    return realReservations[date] || (Object.keys(realReservations).length === 0 ? (dynamicSampleReservationData[date] || []) : [])
  }

  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const getItemBadgeStyle = (type: "home" | "delivery" | "out") => {
    switch (type) {
      case "home":
        return "bg-emerald-50/90 text-emerald-700 border-emerald-500/30 hover:bg-emerald-100"
      case "delivery":
        return "bg-sky-50/90 text-sky-700 border-sky-500/30 hover:bg-sky-100"
      case "out":
        return "bg-orange-50/90 text-orange-700 border-orange-500/30 hover:bg-orange-100"
      default:
        return "bg-gray-50/90 text-gray-700 border-gray-500/30"
    }
  }

  const getItemIcon = (type: "home" | "delivery" | "out") => {
    switch (type) {
      case "home":
        return <ChefHat className="size-3 text-emerald-500 shrink-0" />
      case "delivery":
        return <Bike className="size-3 text-sky-500 shrink-0" />
      case "out":
        return <UtensilsCrossed className="size-3 text-orange-500 shrink-0" />
      default:
        return null
    }
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Calendar Card */}
      <div className="bg-white/80 rounded-3xl p-4 shadow-sm border border-white/50 space-y-3">
        {/* Single Row Header: Mode Toggle (Center) + Month Selector (Right) */}
        <div className="relative flex items-center justify-between pb-2 border-b border-gray-100/80">
          {/* Dummy spacer for flex balance */}
          <div className="w-24 hidden sm:block" />

          {/* Center: Mode Toggle */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-full sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <button
              onClick={() => setMode("reservation")}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                mode === "reservation"
                  ? "bg-cyan-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              먹예약
            </button>
            <button
              onClick={() => setMode("log")}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                mode === "log"
                  ? "bg-cyan-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              먹로그
            </button>
          </div>

          {/* Right: Month Selector */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button 
              onClick={goToPrevMonth}
              className="size-8 rounded-full hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <h3 className="font-bold text-base text-foreground tracking-tight px-1">
              {currentMonth.year}년 {currentMonth.month}월
            </h3>
            <button 
              onClick={goToNextMonth}
              className="size-8 rounded-full hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {daysOfWeek.map((day, index) => (
            <div 
              key={day} 
              className={cn(
                "text-xs font-bold py-1",
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
            const rawActiveData = mode === "log" ? logData : reservationData
            const activeData = typeFilter === "all"
              ? rawActiveData
              : rawActiveData.filter(item => item.type === typeFilter)
            const hasData = activeData.length > 0
            const dayOfWeek = index % 7

            return (
              <div
                key={`${dayObj.fullDate}-${index}`}
                onMouseEnter={() => setHoveredDate(dayObj.fullDate)}
                onMouseLeave={() => setHoveredDate(null)}
                className={cn(
                  "relative min-h-[58px] flex flex-col rounded-lg border transition-all",
                  dayObj.isCurrentMonth
                    ? "border-muted/20 bg-white/40"
                    : "border-transparent bg-transparent",
                  isToday && "border-primary/40 bg-primary/5 ring-1 ring-primary/30",
                  hasData && dayObj.isCurrentMonth && "bg-white/80"
                )}
              >
                {/* 날짜 숫자 & 식사 유형 아이콘들 (2개든 3개든 모두 표시) */}
                <div className="flex items-center justify-between px-1.5 pt-1">
                  <span className={cn(
                    "text-[11px] font-bold leading-none",
                    !dayObj.isCurrentMonth && "text-muted-foreground/30",
                    dayObj.isCurrentMonth && dayOfWeek === 0 && "text-red-400",
                    dayObj.isCurrentMonth && dayOfWeek === 6 && "text-blue-400",
                    dayObj.isCurrentMonth && dayOfWeek !== 0 && dayOfWeek !== 6 && "text-foreground/70",
                    isToday && "text-primary font-extrabold"
                  )}>
                    {dayObj.day}
                  </span>
                  {dayObj.isCurrentMonth && hasData && (
                    <div className="flex items-center gap-0.5">
                      {Array.from(new Set(activeData.map(item => item.type))).map(type => (
                        <span key={type}>{getItemIcon(type as "home" | "delivery" | "out")}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 배경색 블록 내용 - 대표 1개 + (+N건) 칩 */}
                {dayObj.isCurrentMonth && hasData && (
                  <div className="flex-1 px-1 pb-1 mt-0.5 flex flex-col gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleItemClick(activeData[0], dayObj.fullDate)
                      }}
                      className={cn(
                        "w-full text-left text-[9px] font-medium leading-tight px-1.5 py-0.5 rounded-md truncate transition-all border active:scale-95",
                        getItemBadgeStyle(activeData[0].type)
                      )}
                    >
                      {"label" in activeData[0] ? activeData[0].label : activeData[0].name}
                    </button>

                    {activeData.length > 1 && (
                      <div className="text-[8px] font-bold text-orange-600 bg-orange-50 border border-orange-200/80 rounded-md px-1 py-0.2 self-start flex items-center gap-0.5 shadow-2xs">
                        +{activeData.length - 1}건
                      </div>
                    )}
                  </div>
                )}

                {/* 마우스 오버 팝업 (해당 날짜의 모든 예약/로그 목록 노출) */}
                {hoveredDate === dayObj.fullDate && dayObj.isCurrentMonth && hasData && activeData.length > 1 && (
                  <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 bg-white rounded-2xl shadow-xl border border-orange-200/80 p-2.5 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100">
                      <span className="text-[11px] font-bold text-foreground">
                        {new Date(dayObj.fullDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ({activeData.length}건)
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {activeData.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleItemClick(item, dayObj.fullDate)
                          }}
                          className={cn(
                            "flex items-center gap-1.5 p-1.5 rounded-xl text-left text-[11px] font-bold transition-all border hover:scale-[1.02]",
                            getItemBadgeStyle(item.type)
                          )}
                        >
                          {getItemIcon(item.type)}
                          <span className="truncate flex-1">{"label" in item ? item.label : item.name}</span>
                          {item.time && (
                            <span className="text-[9px] font-medium opacity-75 shrink-0 px-1 py-0.2 bg-white/60 rounded">
                              {item.time}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white/80 rounded-3xl p-4 shadow-sm border border-white/50 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="size-4.5 text-primary" />
          <h3 className="font-bold text-sm text-foreground">
            {mode === "log" ? "이번 달 먹로그 패턴" : "이번 달 먹예약 식사 패턴"}
          </h3>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
            <span>{mode === "log" ? "기록일" : "예약일"} {stats.activeDays}일</span>
            <span>{mode === "log" ? "기록" : "예약"} {stats.total}건</span>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-1.5">
          {/* 집밥 */}
          <div 
            onClick={() => !isGroupMode && handleToggleFilter("home")}
            className={cn(
              "flex items-center gap-3 py-1.5 px-2 rounded-xl cursor-pointer transition-all border select-none",
              typeFilter === "home" 
                ? "bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-400/50 shadow-sm" 
                : typeFilter !== "all" 
                ? "opacity-40 border-transparent hover:opacity-100" 
                : "border-transparent hover:bg-gray-50",
              isGroupMode && "invisible pointer-events-none"
            )}
          >
            <div className="flex items-center gap-1.5 w-16">
              <ChefHat className="size-4 text-emerald-500" />
              <span className="text-xs font-bold">집밥</span>
            </div>
            <div className="relative flex-1">
              <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.home}%` }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="-skew-x-12 bg-white/95 border border-white shadow-sm rounded-sm px-3 py-0.5">
                  <span className="skew-x-12 text-[11px] leading-none font-bold text-foreground/70">{stats.homeCount}건</span>
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 w-10 text-right">{stats.home}%</span>
          </div>

          {/* 배달 */}
          <div 
            onClick={() => !isGroupMode && handleToggleFilter("delivery")}
            className={cn(
              "flex items-center gap-3 py-1.5 px-2 rounded-xl cursor-pointer transition-all border select-none",
              typeFilter === "delivery" 
                ? "bg-sky-50/90 border-sky-300 ring-2 ring-sky-400/50 shadow-sm" 
                : typeFilter !== "all" 
                ? "opacity-40 border-transparent hover:opacity-100" 
                : "border-transparent hover:bg-gray-50",
              isGroupMode && "invisible pointer-events-none"
            )}
          >
            <div className="flex items-center gap-1.5 w-16">
              <Bike className="size-4 text-sky-500" />
              <span className="text-xs font-bold">배달</span>
            </div>
            <div className="relative flex-1">
              <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.delivery}%` }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="-skew-x-12 bg-white/95 border border-white shadow-sm rounded-sm px-3 py-0.5">
                  <span className="skew-x-12 text-[11px] leading-none font-bold text-foreground/70">{stats.deliveryCount}건</span>
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-500 w-10 text-right">{stats.delivery}%</span>
          </div>

          {/* 외식 */}
          <div 
            onClick={() => handleToggleFilter("out")}
            className={cn(
              "flex items-center gap-3 py-1.5 px-2 rounded-xl cursor-pointer transition-all border select-none",
              typeFilter === "out" 
                ? "bg-orange-50/90 border-orange-300 ring-2 ring-orange-400/50 shadow-sm" 
                : typeFilter !== "all" 
                ? "opacity-40 border-transparent hover:opacity-100" 
                : "border-transparent hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-1.5 w-16">
              <UtensilsCrossed className="size-4 text-orange-500" />
              <span className="text-xs font-bold">외식</span>
            </div>
            <div className="relative flex-1">
              <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.out}%` }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="-skew-x-12 bg-white/95 border border-white shadow-sm rounded-sm px-3 py-0.5">
                  <span className="skew-x-12 text-[11px] leading-none font-bold text-foreground/70">{stats.outCount}건</span>
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-orange-500 w-10 text-right">{stats.out}%</span>
          </div>
        </div>
      </div>

      {/* Reservation Detail Modal */}
      <ReservationDetailModal 
        isOpen={!!selectedPlanForDetail} 
        onClose={() => setSelectedPlanForDetail(null)} 
        plan={selectedPlanForDetail} 
      />
    </div>
  )
}
