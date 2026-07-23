"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { createClient } from "@/lib/supabase"
import { secureWrite } from "@/lib/supabase-safe"
import {
  Search,
  CalendarDays,
  Utensils,
  MapPin,
  ChefHat,
  Bike,
  UtensilsCrossed,
  Pencil,
  Plus,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Link2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AddReservationModal, type EditData } from "@/components/whateat/add-reservation-modal"
import { ReservationDetailModal, type DetailPlanData } from "@/components/whateat/reservation-detail-modal"
import { toast } from "react-hot-toast"

export const getDynamicDefaultPlans = (baseDate?: Date) => {
  const today = baseDate || new Date()
  let targetYear = today.getFullYear()
  let targetMonth = today.getMonth() + 1 // Next month (0-indexed, so today.getMonth() + 1)
  if (targetMonth > 11) {
    targetMonth = 0
    targetYear += 1
  }

  // 1. 파스타 (집밥) - 다음 달 초 주중 (5일 기준 가장 가까운 주중)
  const dateHomemade = new Date(targetYear, targetMonth, 5)
  while (dateHomemade.getDay() === 0 || dateHomemade.getDay() === 6) {
    dateHomemade.setDate(dateHomemade.getDate() + 1)
  }

  // 2. 치킨 (배달) - 다음 달 중순 주중 (12일 기준 가장 가까운 주중)
  const dateDelivery = new Date(targetYear, targetMonth, 12)
  while (dateDelivery.getDay() === 0 || dateDelivery.getDay() === 6) {
    dateDelivery.setDate(dateDelivery.getDate() + 1)
  }

  // 3. 삼겹살 (외식) - 다음 달 초/중순 주말 (10일 기준 가장 가까운 주말)
  const dateDineout = new Date(targetYear, targetMonth, 10)
  while (dateDineout.getDay() !== 0 && dateDineout.getDay() !== 6) {
    dateDineout.setDate(dateDineout.getDate() + 1)
  }

  const formatDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${date}`
  }

  return [
    {
      id: 1,
      date: formatDate(dateDelivery),
      time: "19:00",
      mealType: "배달",
      menu: "치킨",
      place: "도미노피자 역삼점",
      memo: "가족들과 저녁 배달 치맥",
      thumbnail: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=100&h=100&fit=crop"
    },
    {
      id: 2,
      date: formatDate(dateHomemade),
      time: "12:30",
      mealType: "집밥",
      menu: "파스타",
      place: "집",
      memo: "집에서 직접 만들기 실습",
      thumbnail: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=100&h=100&fit=crop",
      url: "https://www.youtube.com/results?search_query=집밥+파스타+만들기"
    },
    {
      id: 3,
      date: formatDate(dateDineout),
      time: "18:30",
      mealType: "외식",
      menu: "삼겹살",
      place: "우미학 청담점",
      memo: "주말 저녁 외식 패밀리 데이",
      thumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&h=100&fit=crop",
      url: "https://m.place.naver.com/restaurant/37166160"
    }
  ]
}

const defaultMealPlans = getDynamicDefaultPlans()

const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"]

interface CalendarDay {
  day: number
  isCurrentMonth: boolean
  hasPlan?: boolean
  isSelected?: boolean
  isToday?: boolean
  fullDate?: string
}

interface ReservationTabProps {
  jumpToDate?: { date: string; key: number } | null
  showBackToCalendar?: boolean
  onBackToCalendar?: () => void
}

export function ReservationTab({ jumpToDate, showBackToCalendar = false, onBackToCalendar }: ReservationTabProps) {
  const [urlInput, setUrlInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() + 1 }
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [urlForModal, setUrlForModal] = useState("")
  const [plans, setPlans] = useState<any[]>(defaultMealPlans)
  const [isLoaded, setIsLoaded] = useState(false)
  const [mealTypeFilter, setMealTypeFilter] = useState<"전체" | "집밥" | "배달" | "외식">("전체")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [focusedPlanId, setFocusedPlanId] = useState<number | null>(null)
  const [editingPlan, setEditingPlan] = useState<any | null>(null)
  const [selectedDetailPlan, setSelectedDetailPlan] = useState<DetailPlanData | null>(null)
  const [userBaseDate, setUserBaseDate] = useState<Date>(new Date())
  const { isLoggedIn, user } = useHub()

  const mergeRealAndSamplePlans = (realPlans: any[], bDate: Date) => {
    const samples = getDynamicDefaultPlans(bDate)
    let finalPlans = [...realPlans]
    
    const hasDelivery = realPlans.some(p => p.mealType === "배달")
    const hasHomemade = realPlans.some(p => p.mealType === "집밥")
    const hasDineout = realPlans.some(p => p.mealType === "외식")
    
    if (!hasDelivery) finalPlans.push(samples.find(s => s.mealType === "배달") as any)
    if (!hasHomemade) finalPlans.push(samples.find(s => s.mealType === "집밥") as any)
    if (!hasDineout) finalPlans.push(samples.find(s => s.mealType === "외식") as any)
    
    finalPlans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return finalPlans
  }

  // Load initial plans from Supabase
  useEffect(() => {
    const fetchPlans = async () => {
      if (!isLoggedIn || !user?.id) {
        setPlans(defaultMealPlans)
        setIsLoaded(true)
        return
      }
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("meal_reservations")
          .select("*")
          .eq("user_id", user.id)
          .eq("source", "solo")
        
        if (error) throw error

        let baseDateObj = new Date()
        const { data: userData } = await supabase.from("users").select("created_at").eq("id", user.id).single()
        if (userData?.created_at) {
          baseDateObj = new Date(userData.created_at)
          setUserBaseDate(baseDateObj)
        }
        
        const samples = getDynamicDefaultPlans(baseDateObj)

        if (data && data.length > 0) {
          const mapped = data.map(row => ({
            id: row.id,
            date: row.date,
            time: row.time || "",
            mealType: row.meal_type,
            menu: row.menu,
            place: row.place || "",
            memo: row.memo || "",
            thumbnail: row.thumbnail || "",
            url: row.source_url || ""
          }))
          
          setPlans(mergeRealAndSamplePlans(mapped, baseDateObj))
        } else {
          setPlans(samples)
        }
      } catch (err) {
        console.error("Failed to fetch reservations", err)
        setPlans(defaultMealPlans)
      } finally {
        setIsLoaded(true)
      }
    }
    fetchPlans()
  }, [isLoggedIn, user?.id])

  const calendarRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const handleEditClick = (plan: typeof mealPlans[0]) => {
    setEditingPlan(plan)
    setIsModalOpen(true)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!jumpToDate) return

    setSearchQuery("")
    setMealTypeFilter("전체")
    setSortDirection("desc")
    setSelectedDate(null)

    const target = plans.find((plan) => plan.date === jumpToDate.date)
    if (!target) return

    setFocusedPlanId(target.id)
    const timer = setTimeout(() => {
      cardRefs.current[target.id]?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)

    return () => clearTimeout(timer)
  }, [jumpToDate, plans])

  useEffect(() => {
    if (focusedPlanId === null) return
    const timer = setTimeout(() => setFocusedPlanId(null), 1800)
    return () => clearTimeout(timer)
  }, [focusedPlanId])

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setUrlForModal(urlInput)
      setIsModalOpen(true)
      setUrlInput("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUrlSubmit()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text")
    if (pastedText.trim()) {
      // Delay to allow the paste to complete in the input field
      setTimeout(() => {
        setUrlForModal(pastedText.trim())
        setIsModalOpen(true)
        setUrlInput("")
      }, 0)
    }
  }

  // Generate calendar days
  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = []
    const firstDay = new Date(currentMonth.year, currentMonth.month - 1, 1).getDay()
    const totalDays = new Date(currentMonth.year, currentMonth.month, 0).getDate()
    const prevMonthDays = new Date(currentMonth.year, currentMonth.month - 1, 0).getDate()
    
    // Plans dates for marking
    const planDates = plans.map(p => p.date)
    
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false })
    }
    
    const today = new Date()
    for (let i = 1; i <= totalDays; i++) {
      const fullDate = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const isToday = today.getFullYear() === currentMonth.year && 
                      today.getMonth() + 1 === currentMonth.month && 
                      today.getDate() === i
      days.push({ 
        day: i, 
        isCurrentMonth: true,
        hasPlan: planDates.includes(fullDate),
        isSelected: fullDate === selectedDate,
        isToday,
        fullDate
      })
    }
    
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false })
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()

  const getDayColor = (dayIndex: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return "text-muted-foreground/30"
    const dayOfWeek = dayIndex % 7
    if (dayOfWeek === 0) return "text-red-400"
    if (dayOfWeek === 6) return "text-blue-400"
    return "text-foreground"
  }

  const goToPrevMonth = () => {
    if (currentMonth.month === 1) {
      setCurrentMonth({ year: currentMonth.year - 1, month: 12 })
    } else {
      setCurrentMonth({ ...currentMonth, month: currentMonth.month - 1 })
    }
  }

  const goToNextMonth = () => {
    if (currentMonth.month === 12) {
      setCurrentMonth({ year: currentMonth.year + 1, month: 1 })
    } else {
      setCurrentMonth({ ...currentMonth, month: currentMonth.month + 1 })
    }
  }

  const formatSelectedDate = () => {
    if (!selectedDate) return "날짜"
    const date = new Date(selectedDate)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const getMealTypeIcon = (type: "집밥" | "배달" | "외식") => {
    switch (type) {
      case "집밥": return ChefHat
      case "배달": return Bike
      case "외식": return UtensilsCrossed
    }
  }

  // Filter plans
  const filteredPlans = plans.filter(plan => {
    const matchesSearch = !searchQuery || 
      plan.menu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.place?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.memo?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDate = !selectedDate || plan.date === selectedDate
    const matchesMealType = mealTypeFilter === "전체" || plan.mealType === mealTypeFilter
    return matchesSearch && matchesDate && matchesMealType
  })

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    const descBase = new Date(b.date).getTime() - new Date(a.date).getTime()
    return sortDirection === "desc" ? descBase : -descBase
  })

  const mealTypeOptions = [
  { id: "전체", label: "전체", icon: null },
  { id: "집밥", label: "집밥", icon: ChefHat },
  { id: "배달", label: "배달", icon: Bike },
  { id: "외식", label: "외식", icon: UtensilsCrossed },
] as const

  const getOptionCount = (optionId: (typeof mealTypeOptions)[number]["id"]) => {
    if (optionId === "전체") return plans.length
    return plans.filter((plan) => plan.mealType === optionId).length
  }

  const handleModalSave = async (saved: EditData) => {
    if (saved.id === 1 || saved.id === 2 || saved.id === 3) {
      return
    }
    const nextPlan = {
      ...saved,
      thumbnail: saved.thumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop",
    }

    if (isLoggedIn && user?.id) {
      try {
        await secureWrite({
          table: "meal_reservations",
          action: "upsert",
          data: {
            id: saved.id,
            user_id: user.id,
            date: saved.date,
            time: saved.time,
            meal_type: saved.mealType,
            menu: saved.menu,
            place: saved.place,
            memo: saved.memo,
            thumbnail: nextPlan.thumbnail,
            source_url: saved.url || null,
            source: "solo"
          }
        })
      } catch (err) {
        console.error("Failed to save reservation", err)
        toast.error("예약 저장에 실패했습니다.")
        return
      }
    }

    setPlans((prev) => {
      const realPlans = prev.filter(p => p.id !== 1 && p.id !== 2 && p.id !== 3)
      const exists = realPlans.some((plan) => plan.id === saved.id)
      const updatedRealPlans = exists
        ? realPlans.map((plan) => (plan.id === saved.id ? { ...plan, ...nextPlan } : plan))
        : [nextPlan, ...realPlans]

      return mergeRealAndSamplePlans(updatedRealPlans, userBaseDate)
    })
  }

  const handleDeleteClick = async (id: string | number) => {
    if (id === 1 || id === 2 || id === 3) {
      toast("샘플이라 삭제 안 되며, 식사를 등록하면 샘플은 사라집니다.", {
        icon: "💡",
        duration: 3000,
      })
      return
    }

    if (isLoggedIn && user?.id) {
      try {
        await secureWrite({
          table: "meal_reservations",
          action: "delete",
          filters: { id }
        })
      } catch (err) {
        console.error("Failed to delete reservation", err)
        toast.error("예약 삭제에 실패했습니다.")
        return
      }
    }

    setPlans((prev) => {
      const updatedRealPlans = prev.filter((plan) => plan.id !== id && plan.id !== 1 && plan.id !== 2 && plan.id !== 3)
      return mergeRealAndSamplePlans(updatedRealPlans, userBaseDate)
    })
    toast.success("예약 일정이 삭제되었습니다.")
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Sticky Search + Filter */}
      <div className="sticky top-0 z-30 -mx-5 px-5 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="식당, 메뉴, 장소 검색"
            className="w-full pl-9 pr-4 h-[38px] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
          className="flex items-center gap-1.5 px-3.5 h-[38px] bg-white/60 border border-white/80 rounded-xl text-sm font-medium text-muted-foreground hover:border-primary/30 transition-all whitespace-nowrap cursor-pointer"
        >
          <ArrowUpDown className="size-3.5" />
          날짜순
          <span className="text-[11px] font-bold">{sortDirection === "desc" ? "↓" : "↑"}</span>
        </button>
      </div>

      {/* Meal Type Filter + Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {mealTypeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setMealTypeFilter(option.id)}
                className={cn(
                  "relative px-3 py-1.5 rounded-full text-[13px] font-bold transition-all flex items-center gap-1 whitespace-nowrap",
                  mealTypeFilter === option.id
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-white/70 text-muted-foreground hover:bg-white"
                )}
              >
                <span className="absolute -top-2 right-0 z-10 text-[11px] leading-none font-black text-cyan-600">
                  {getOptionCount(option.id)}
                </span>
                {Icon && <Icon className="size-3.5" />}
                {option.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          {showBackToCalendar && onBackToCalendar && (
            <button
              onClick={onBackToCalendar}
              className="px-3 py-1.5 rounded-full text-[12px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors"
            >
              ← 캘린더
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="size-10 bg-orange-500 text-white rounded-full border-2 border-orange-100 shadow-md shadow-orange-300/60 flex items-center justify-center hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="size-5" strokeWidth={2.8} />
          </button>
        </div>
      </div>
      </div>{/* end sticky */}

      {/* Meal Plan Cards */}
      {filteredPlans.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sortedPlans.map((plan) => {
            const TypeIcon = getMealTypeIcon(plan.mealType)
            return (
              <div 
                key={plan.id} 
                ref={(el) => {
                  cardRefs.current[plan.id] = el
                }}
                onClick={() => setSelectedDetailPlan(plan)}
                className={cn(
                  "bg-white rounded-2xl p-4 shadow-sm border border-white/80 transition-all hover:ring-2 hover:ring-cyan-300 hover:shadow-cyan-100 relative overflow-hidden cursor-pointer",
                  focusedPlanId === plan.id && "ring-2 ring-cyan-400 shadow-cyan-100",
                  (plan.id === 1 || plan.id === 2 || plan.id === 3) && "opacity-90"
                )}
              >
                {/* 샘플 리본 */}
                {(plan.id === 1 || plan.id === 2 || plan.id === 3) && (
                  <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 z-10 pointer-events-none">
                    <div className="absolute top-3 -right-6 w-24 bg-yellow-400 text-yellow-900 text-[8px] font-black py-0.5 text-center rotate-45 shadow-sm">
                      💡 SAMPLE
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  {/* Meal Type Badge */}
                  <div className="size-11 rounded-xl bg-orange-50 flex flex-col items-center justify-center shrink-0">
                    <TypeIcon className="size-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Menu Name & Time */}
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-foreground">{plan.menu}</h4>
                      {plan.time && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-muted rounded-md text-muted-foreground">
                          {plan.time}
                        </span>
                      )}
                    </div>
                    
                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <CalendarDays className="size-3.5" />
                      <span>{new Date(plan.date).getMonth() + 1}월 {new Date(plan.date).getDate()}일</span>
                      <span className="text-muted-foreground/50">|</span>
                      <span className="text-primary font-medium">{plan.mealType}</span>
                    </div>
                    
                    {/* Place */}
                    {plan.place && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 text-primary" />
                        <span>{plan.place}</span>
                      </div>
                    )}
                    
                    {/* Memo */}
                    {plan.memo && (
                      <div className="mt-1.5 rounded-md border border-orange-100 bg-orange-50/60 px-2.5 py-1.5">
                        <p className="text-[11px] leading-4 text-muted-foreground/80 line-clamp-2">
                          {plan.memo}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 relative">
                    {plan.thumbnail && (
                      <div className="size-20 rounded-xl overflow-hidden">
                        <img 
                          src={plan.thumbnail || "/placeholder.svg"} 
                          alt={plan.menu}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditClick(plan)
                      }}
                      className="absolute -top-1.5 -right-1.5 size-6 flex items-center justify-center bg-white text-muted-foreground hover:text-primary rounded-full shadow-md border border-gray-100 transition-all z-10"
                    >
                      <Pencil className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white/60 rounded-2xl p-8 text-center">
          <div className="size-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <Utensils className="size-8 text-primary/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            {searchQuery || selectedDate ? "검색 결과가 없어요" : "식사 계획이 없어요"}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            + 버튼을 눌러 계획을 세워보세요
          </p>
        </div>
      )}

      {/* Reservation Modal */}
      <AddReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setUrlForModal("")
          setEditingPlan(null)
        }}
        initialUrl={urlForModal}
        editData={editingPlan}
        onSave={handleModalSave}
        onDelete={handleDeleteClick}
      />

      {/* Reservation Detail Modal */}
      <ReservationDetailModal 
        isOpen={!!selectedDetailPlan}
        onClose={() => setSelectedDetailPlan(null)}
        plan={selectedDetailPlan}
      />
    </div>
  )
}
