"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, ChefHat, Bike, UtensilsCrossed, CalendarDays, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDynamicDefaultPlans } from "./reservation-tab"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { createClient } from "@/lib/supabase"
import { ReservationDetailModal, DetailPlanData } from "./reservation-detail-modal"
import { LogDetailModal, DetailLogData } from "./log-detail-modal"

interface MealCalendarTabProps {
  onNavigateToLog?: (date: string) => void
  onNavigateToReservation?: (date: string) => void
  onSelectReservation?: (item: any) => void
  onSelectLog?: (item: any) => void
  isGroupMode?: boolean
  modeType?: "solo" | "family" | "group"
  familyUserIds?: string[]
  groupId?: string | null
  initialReservations?: any[]
  initialLogs?: any[]
}

type CalendarMode = "log" | "reservation"

// 실제 먹로그 데이터와 연동 (동적 샘플 데이터 생성)
const generateDynamicSampleLogData = (baseDate?: Date) => {
  const ref = baseDate || new Date()
  const d1 = new Date(ref)
  d1.setDate(ref.getDate() - 2)
  const d2 = new Date(ref)
  d2.setDate(ref.getDate() - 5)
  const d3 = new Date(ref)
  d3.setDate(ref.getDate() - 9)

  const fmt = (d: Date) => d.toISOString().split("T")[0]

  const data: Record<string, any[]> = {}
  data[fmt(d1)] = [{
    id: "sample-solo-log-1",
    label: "채끝 스테이크",
    title: "채끝 스테이크",
    menu: "채끝 스테이크",
    type: "out",
    mealType: "외식",
    date: fmt(d1),
    isSample: true,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&fit=crop",
    placeName: "아웃백 스테이크하우스",
    placeAddress: "경기 부천시 원미구 신흥로 190",
    rating: 5,
    memo: "부드럽고 육즙 가득한 채끝 스테이크 외식"
  }]
  data[fmt(d2)] = [{
    id: "sample-solo-log-2",
    label: "바질 페스토",
    title: "바질 페스토",
    menu: "바질 페스토",
    type: "home",
    mealType: "집밥",
    date: fmt(d2),
    isSample: true,
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&fit=crop",
    placeName: "",
    rating: 5,
    memo: "향긋한 생바질과 올리브오일로 만든 홈메이드 페스토 파스타"
  }]
  data[fmt(d3)] = [{
    id: "sample-solo-log-3",
    label: "양념치킨",
    title: "양념치킨",
    menu: "양념치킨",
    type: "delivery",
    mealType: "배달",
    date: fmt(d3),
    isSample: true,
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&fit=crop",
    placeName: "교촌치킨",
    rating: 4,
    memo: "바삭하고 달콤매콤한 오리지널 양념치킨 배달 주문"
  }]
  return data
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

export function MealCalendarTab({ 
  onNavigateToLog, 
  onNavigateToReservation, 
  onSelectReservation,
  onSelectLog,
  isGroupMode,
  modeType,
  familyUserIds,
  groupId,
  initialReservations,
  initialLogs
}: MealCalendarTabProps) {
  const [mode, setMode] = useState<CalendarMode>("reservation")
  const { isLoggedIn, user } = useHub()
  const [baseDate, setBaseDate] = useState<Date | undefined>(undefined)
  const [realReservations, setRealReservations] = useState<Record<string, any[]>>({})
  const [realLogs, setRealLogs] = useState<Record<string, any[]>>({})
  const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<DetailPlanData | null>(null)
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<DetailLogData | null>(null)
  const [typeFilter, setTypeFilter] = useState<"all" | "home" | "delivery" | "out">("all")

  const effectiveMode = modeType || (isGroupMode ? "group" : "solo")

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

      // 2. 먹예약 데이터 구성
      const resMap: Record<string, any[]> = {}
      const hasType = { home: false, delivery: false, out: false }

      if (initialReservations && initialReservations.length > 0) {
        // 상위 패밀리/모임 컴포넌트에서 전달된 실데이터(또는 모드별 샘플) 사용
        initialReservations.forEach(row => {
          if (!row.date) return
          let type: "home" | "delivery" | "out" = "home"
          if (row.mealType === "배달") { type = "delivery"; hasType.delivery = true }
          else if (row.mealType === "외식") { type = "out"; hasType.out = true }
          else { type = "home"; hasType.home = true }

          if (!resMap[row.date]) resMap[row.date] = []
          resMap[row.date].push({
            id: row.id,
            name: row.name || row.menu,
            menu: row.menu || row.name,
            mealType: row.mealType,
            type,
            time: row.time || "",
            place: row.place || "",
            memo: row.memo || "",
            thumbnail: row.thumbnail,
            url: row.url,
            userId: row.userId,
            nickname: row.nickname,
            author: row.author,
            sharedBy: row.sharedBy,
            createdAt: row.createdAt,
            isSample: row.isSample || false
          })
        })
      } else if (!initialReservations) {
        // 직접 Supabase DB 조회
        let resQuery = supabase.from("meal_reservations").select("*").order("date", { ascending: true })
        if (effectiveMode === "group") {
          if (groupId) {
            resQuery = resQuery.eq("group_id", groupId)
          } else {
            resQuery = resQuery.eq("source", "group")
          }
        } else if (effectiveMode === "family") {
          if (familyUserIds && familyUserIds.length > 0) {
            resQuery = resQuery.in("created_by", familyUserIds).eq("source", "family")
          } else {
            resQuery = resQuery.eq("created_by", user.id).eq("source", "family")
          }
        } else {
          // solo
          resQuery = resQuery.eq("created_by", user.id)
        }

        const { data: resData } = await resQuery

        if (resData && resData.length > 0) {
          resData.forEach(row => {
            let type: "home" | "delivery" | "out" = "home"
            if (row.meal_type === "배달") { type = "delivery"; hasType.delivery = true }
            else if (row.meal_type === "외식") { type = "out"; hasType.out = true }
            else { type = "home"; hasType.home = true }

            if (!resMap[row.date]) resMap[row.date] = []
            resMap[row.date].push({
              id: row.id,
              name: row.menu_name || row.title,
              menu: row.menu_name || row.title,
              mealType: row.meal_type,
              type,
              time: row.meal_time || "",
              place: row.place_name || "",
              memo: row.memo || "",
              thumbnail: row.thumbnail_url,
              url: row.source_url || row.url,
              isSample: false
            })
          })
        }

        // 솔로 모드에서만 미등록 유형에 대해 샘플 예약 보충
        if (effectiveMode === "solo") {
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
        }
      }

      setRealReservations(resMap)

      // 3. 먹로그 데이터 구성
      const logMap: Record<string, any[]> = {}
      const hasLogType = { home: false, delivery: false, out: false }

      if (initialLogs && initialLogs.length > 0) {
        // 상위 패밀리/모임 컴포넌트에서 전달된 공유 먹로그 목록 사용
        initialLogs.forEach(row => {
          const dateKey = row.sharedAtIso ? row.sharedAtIso.split("T")[0] : (row.created_at ? row.created_at.split("T")[0] : "")
          if (!dateKey) return
          let type: "home" | "delivery" | "out" = "home"
          if (row.mealType === "배달" || row.mealType === "delivery") { type = "delivery"; hasLogType.delivery = true }
          else if (row.mealType === "외식" || row.mealType === "dining" || row.mealType === "dineout" || row.mealType === "out") { type = "out"; hasLogType.out = true }
          else { type = "home"; hasLogType.home = true }

          if (!logMap[dateKey]) logMap[dateKey] = []
          logMap[dateKey].push({
            id: row.id,
            label: row.title || "맛있는 식사",
            title: row.title || "맛있는 식사",
            type,
            mealType: row.mealType || (type === "delivery" ? "배달" : type === "out" ? "외식" : "집밥"),
            date: dateKey,
            image: row.image || row.image_url || row.thumbnail,
            placeName: row.placeName || row.place_name,
            placeAddress: row.placeAddress || row.place_address,
            linkUrl: row.linkUrl || row.link_url,
            rating: row.rating || 5,
            memo: row.memo || row.explanation || "",
            userId: row.userId || row.uploaded_by,
            author: row.author || row.sharedBy || row.nickname || "가족",
            createdAt: row.createdAt || row.created_at,
            isSample: false
          })
        })
      } else if (!initialLogs) {
        // 직접 Supabase DB 조회
        let logQuery = supabase.from("meal_images").select("*").order("created_at", { ascending: false })
        if (effectiveMode === "group") {
          if (groupId) {
            logQuery = logQuery.eq("group_id", groupId)
          } else {
            logQuery = logQuery.eq("source", "group")
          }
        } else if (effectiveMode === "family") {
          if (familyUserIds && familyUserIds.length > 0) {
            logQuery = logQuery.in("uploaded_by", familyUserIds).eq("source", "family-shared")
          } else {
            logQuery = logQuery.eq("uploaded_by", user.id).eq("source", "family-shared")
          }
        } else {
          // solo
          logQuery = logQuery.eq("uploaded_by", user.id)
        }

        const { data: logData } = await logQuery

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
                title: row.title || row.explanation || "맛있는 식사",
                type,
                mealType: row.meal_type === "homemade" ? "집밥" : row.meal_type === "delivery" ? "배달" : "외식",
                date: dateKey,
                image: row.image_url || row.image,
                placeName: row.place_name,
                placeAddress: row.place_address,
                linkUrl: row.link_url,
                linkThumbnail: row.link_thumbnail,
                rating: row.rating || 5,
                memo: row.memo || row.explanation || "",
                userId: row.uploaded_by || row.user_id,
                author: row.user_nickname || "나",
                createdAt: row.created_at,
                isSample: false
              })
            }
          })
        }

        // 솔로 모드에서만 미등록 유형 샘플 먹로그 보충
        if (effectiveMode === "solo") {
          const sampleLogs = generateDynamicSampleLogData(userBaseDate)
          Object.entries(sampleLogs).forEach(([dateKey, items]) => {
            items.forEach(item => {
              if (!hasLogType[item.type]) {
                if (!logMap[dateKey]) logMap[dateKey] = []
                logMap[dateKey].push({ ...item, isSample: true })
              }
            })
          })
        }
      }

      setRealLogs(logMap)
    } catch (e) {
      console.error("Failed to load calendar data", e)
    }
  }, [isLoggedIn, user?.id, effectiveMode, groupId, JSON.stringify(familyUserIds), initialReservations, initialLogs])

  useEffect(() => {
    fetchData()

    const handleUpdate = () => {
      fetchData()
    }
    window.addEventListener("whateat:reservation-updated", handleUpdate)
    window.addEventListener("whateat:meal-updated", handleUpdate)
    return () => {
      window.removeEventListener("whateat:reservation-updated", handleUpdate)
      window.removeEventListener("whateat:meal-updated", handleUpdate)
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

    const dynamicSampleLogs = generateDynamicSampleLogData(baseDate)
    const activeDataMap = mode === "log" 
      ? (Object.keys(realLogs).length > 0 ? realLogs : (effectiveMode === "solo" ? dynamicSampleLogs : {}))
      : (Object.keys(realReservations).length > 0 ? realReservations : (effectiveMode === "solo" ? dynamicSampleReservationData : {}))

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
      const logsOnDate = getLogIndicators(date)
      if (logsOnDate && logsOnDate.length > 0) {
        handleItemClick(logsOnDate[0], date)
      } else if (onNavigateToLog) {
        onNavigateToLog(date)
      }
    } else {
      const resOnDate = getReservationIndicators(date)
      if (resOnDate && resOnDate.length > 0) {
        handleItemClick(resOnDate[0], date)
      } else if (onNavigateToReservation) {
        onNavigateToReservation(date)
      }
    }
  }

  const handleItemClick = (item: any, date: string) => {
    if (mode === "reservation") {
      if (onSelectReservation) {
        onSelectReservation({
          ...item,
          date: item.date || date
        })
      } else {
        setSelectedPlanForDetail({
          id: item.id,
          date: item.date || date,
          time: item.time || "",
          mealType: item.mealType || (item.type === "delivery" ? "배달" : item.type === "out" ? "외식" : "집밥"),
          menu: item.menu || item.name || "식사 예약",
          place: item.place || "",
          memo: item.memo || "",
          thumbnail: item.thumbnail,
          url: item.url,
          userId: item.userId,
          nickname: item.nickname,
          author: item.author,
          sharedBy: item.sharedBy,
          createdAt: item.createdAt,
          isSample: item.isSample
        })
      }
    } else {
      if (onSelectLog) {
        onSelectLog({
          ...item,
          date: item.date || date
        })
      } else {
        setSelectedLogForDetail({
          id: item.id,
          date: item.date || date,
          mealType: item.mealType || (item.type === "delivery" ? "배달" : item.type === "out" ? "외식" : "집밥"),
          title: item.title || item.label || item.menu || "식사 기록",
          placeName: item.placeName || item.place || "",
          placeAddress: item.placeAddress || "",
          memo: item.memo || item.explanation || "",
          image: item.image || item.image_url || item.thumbnail,
          linkUrl: item.linkUrl || item.link_url,
          rating: item.rating || 5,
          userId: item.userId || item.uploaded_by,
          author: item.author || item.nickname || "나",
          createdAt: item.createdAt || item.created_at,
          isSample: item.isSample
        })
      }
    }
  }

  const getLogIndicators = (date: string) => {
    return realLogs[date] || (effectiveMode === "solo" && Object.keys(realLogs).length === 0 ? (generateDynamicSampleLogData(baseDate)[date] || []) : [])
  }

  const getReservationIndicators = (date: string) => {
    return realReservations[date] || (effectiveMode === "solo" && Object.keys(realReservations).length === 0 ? (dynamicSampleReservationData[date] || []) : [])
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
                  <div 
                    className={cn(
                      "absolute z-30 bottom-full pb-1.5 w-52 pointer-events-auto animate-in fade-in zoom-in-95 duration-150",
                      dayOfWeek >= 5 ? "right-0" : (dayOfWeek === 0 ? "left-0" : "left-1/2 -translate-x-1/2")
                    )}
                  >
                    <div className="bg-white rounded-2xl shadow-xl border border-orange-200/80 p-2.5">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100">
                        <span className="text-[11px] font-bold text-foreground">
                          {new Date(dayObj.fullDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ({activeData.length}건)
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto overflow-x-hidden pr-0.5">
                        {activeData.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleItemClick(item, dayObj.fullDate)
                            }}
                            className={cn(
                              "w-full flex items-center gap-1.5 p-1.5 rounded-xl text-left text-[11px] font-bold transition-all border hover:brightness-95 active:scale-98",
                              getItemBadgeStyle(item.type)
                            )}
                          >
                            <span className="shrink-0">{getItemIcon(item.type)}</span>
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

      {/* Log Detail Modal (Solo mode or standalone calendar) */}
      <LogDetailModal
        isOpen={!!selectedLogForDetail}
        onClose={() => setSelectedLogForDetail(null)}
        log={selectedLogForDetail}
      />
    </div>
  )
}
