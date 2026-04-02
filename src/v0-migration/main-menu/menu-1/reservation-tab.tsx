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
import { AddReservationModal } from "@/components/whateat/add-reservation-modal"

const mealPlans = [
  {
    id: 1,
    date: "2026-03-15",
    menu: "삼겹살",
    mealType: "외식" as const,
    place: "고기굽는집 강남점",
    memo: "회식",
    time: "점심",
    thumbnail: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=100&h=100&fit=crop"
  },
  {
    id: 2,
    date: "2026-03-22",
    menu: "파스타",
    mealType: "집밥" as const,
    place: null,
    memo: "집에서 직접 만들기",
    time: "저녁",
    thumbnail: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=100&h=100&fit=crop"
  },
  {
    id: 3,
    date: "2026-04-05",
    menu: "치킨",
    mealType: "배달" as const,
    place: "BHC치킨 강남점",
    memo: "",
    time: "저녁",
    thumbnail: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=100&h=100&fit=crop"
  }
]

const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"]

interface CalendarDay {
  day: number
  isCurrentMonth: boolean
  hasPlan?: boolean
  isSelected?: boolean
  isToday?: boolean
  fullDate?: string
}

export function ReservationTab() {
  const [urlInput, setUrlInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState({ year: 2025, month: 2 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [urlForModal, setUrlForModal] = useState("")
  const [mealTypeFilter, setMealTypeFilter] = useState<"전체" | "집밥" | "배달" | "외식">("전체")
  const [editingPlan, setEditingPlan] = useState<typeof mealPlans[0] | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

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
    const planDates = mealPlans.map(p => p.date)
    
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
  const filteredPlans = mealPlans.filter(plan => {
    const matchesSearch = !searchQuery || 
      plan.menu.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.place?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDate = !selectedDate || plan.date === selectedDate
    const matchesMealType = mealTypeFilter === "전체" || plan.mealType === mealTypeFilter
    return matchesSearch && matchesDate && matchesMealType
  })

  const mealTypeOptions = [
  { id: "전체", label: "전체", icon: null },
  { id: "집밥", label: "집밥", icon: ChefHat },
  { id: "배달", label: "배달", icon: Bike },
  { id: "외식", label: "외식", icon: UtensilsCrossed },
] as const

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky Search + Filter */}
      <div className="sticky top-0 z-30 -mx-5 px-5 pt-4 pb-3 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex flex-col gap-3">
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
        <button className="flex items-center gap-1.5 px-3 py-2.5 bg-white/60 border border-white/80 rounded-xl text-sm font-medium text-muted-foreground hover:border-primary/30 transition-all whitespace-nowrap">
          <ArrowUpDown className="size-3.5" />
          날짜순
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
                  "px-3 py-1.5 rounded-full text-[13px] font-bold transition-all flex items-center gap-1 whitespace-nowrap",
                  mealTypeFilter === option.id
                    ? "bg-primary text-white shadow-md"
                    : "bg-white/70 text-muted-foreground hover:bg-white"
                )}
              >
                {Icon && <Icon className="size-3.5" />}
                {option.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="size-9 bg-primary text-white rounded-full shadow-md shadow-primary/30 flex items-center justify-center hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </button>
      </div>
      </div>{/* end sticky */}

      {/* Results Header */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-bold text-primary bg-orange-50 px-2.5 py-1 rounded-full">
          {filteredPlans.length}개
        </span>
      </div>

      {/* Meal Plan Cards */}
      {filteredPlans.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filteredPlans.map((plan) => {
            const TypeIcon = getMealTypeIcon(plan.mealType)
            return (
              <div 
                key={plan.id} 
                className="bg-white rounded-2xl p-4 shadow-sm border border-white/80"
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
                      <p className="text-xs text-muted-foreground/70 mt-1.5">
                        {plan.memo}
                      </p>
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
      />
    </div>
  )
}
