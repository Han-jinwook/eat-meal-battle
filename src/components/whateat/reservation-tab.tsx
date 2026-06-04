"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AddReservationModal, type EditData } from "@/components/whateat/add-reservation-modal"

const mealPlans: any[] = []

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
  const [currentMonth, setCurrentMonth] = useState({ year: 2025, month: 2 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [urlForModal, setUrlForModal] = useState("")
  const [plans, setPlans] = useState(mealPlans)
  const [mealTypeFilter, setMealTypeFilter] = useState<"전체" | "집밥" | "배달" | "외식">("전체")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [focusedPlanId, setFocusedPlanId] = useState<number | null>(null)
  const [editingPlan, setEditingPlan] = useState<typeof mealPlans[number] | null>(null)
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
      plan.place?.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleModalSave = (saved: EditData) => {
    const nextPlan = {
      ...saved,
      thumbnail: saved.thumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop",
    }

    setPlans((prev) => {
      const exists = prev.some((plan) => plan.id === saved.id)
      if (exists) {
        return prev.map((plan) => (plan.id === saved.id ? { ...plan, ...nextPlan } : plan))
      }
      return [nextPlan, ...prev]
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Sticky Search + Filter */}
      <div className="sticky top-0 z-30 -mx-5 px-5 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex flex-col gap-2">
      {/* Search Row - 날짜순 정렬 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="식당, 메뉴, 장소 검색"
            className="w-full pl-11 pr-4 py-2.5 bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-white/60 border border-white/80 rounded-xl text-sm font-medium text-muted-foreground hover:border-primary/30 transition-all whitespace-nowrap"
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
                className={cn(
                  "bg-white rounded-2xl p-4 shadow-sm border border-white/80 transition-all hover:ring-2 hover:ring-cyan-300 hover:shadow-cyan-100",
                  focusedPlanId === plan.id && "ring-2 ring-cyan-400 shadow-cyan-100"
                )}
              >
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
                      onClick={() => handleEditClick(plan)}
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
      />
    </div>
  )
}
