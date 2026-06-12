"use client"

import { useState, useRef, useEffect } from "react"
import { Lightbulb, BookOpen, Star, MessageSquare, Pencil, Search, ChevronDown, ArrowUpDown, ChefHat, Bike, UtensilsCrossed, ExternalLink, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddLogModal, type MealLogData } from "@/components/whateat/add-log-modal"
import { ImageViewer } from "@/components/whateat/image-viewer"

const defaultMealLogs = [
  {
    id: 1,
    date: "2026. 04. 10",
    type: "외식",
    title: "채끝 스테이크",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&fit=crop",
    rating: 5,
    tips: ["미디움 레어로 굽기가 딱 좋음", "소금과 와사비 조합 추천"],
    tipTitle: "추천 메뉴",
    linkUrl: "https://naver.me/placeholder1",
    linkThumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&fit=crop",
    placeName: "아웃백 스테이크하우스"
  },
  {
    id: 2,
    date: "2026. 03. 25",
    type: "집밥",
    title: "바질 페스토 파스타",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=500&fit=crop",
    rating: 4,
    tips: ["면수는 버리지 말고 농도 맞출 때 사용", "생 바질 잎을 고명으로 얹으면 향이 배가됨"],
    tipTitle: "조리 팁",
    healthy: true
  },
  {
    id: 3,
    date: "2026. 03. 18",
    type: "배달",
    title: "반반 치킨 (후라이드/양념)",
    image: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&fit=crop",
    rating: 5,
    tips: ["리뷰 이벤트로 감자튀김 받기", "양념 소스가 매콤달콤해서 밥이랑 어울림"],
    tipTitle: "추천 메뉴",
    linkUrl: "https://naver.me/placeholder2",
    linkThumbnail: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=100&fit=crop",
    placeName: "처갓집 양념치킨"
  }
]

const mealTypeOptions = [
  { id: "전체", label: "전체", icon: null },
  { id: "집밥", label: "집밥", icon: ChefHat },
  { id: "배달", label: "배달", icon: Bike },
  { id: "외식", label: "외식", icon: UtensilsCrossed },
] as const

interface MealLogTabProps {
  jumpToDate?: { date: string; key: number } | null
  showBackToCalendar?: boolean
  onBackToCalendar?: () => void
}

export function MealLogTab({ jumpToDate, showBackToCalendar = false, onBackToCalendar }: MealLogTabProps) {
  const [viewerImage, setViewerImage] = useState<string | null>(null)
  const [mealLogs, setMealLogs] = useState<any[]>(defaultMealLogs)

  // Load initial logs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("whateat_meal_logs")
    if (saved) {
      try {
        setMealLogs(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse saved meal logs", e)
      }
    } else {
      localStorage.setItem("whateat_meal_logs", JSON.stringify(defaultMealLogs))
    }
  }, [])

  // Save logs to localStorage on changes
  useEffect(() => {
    if (mealLogs !== defaultMealLogs) {
      localStorage.setItem("whateat_meal_logs", JSON.stringify(mealLogs))
    }
  }, [mealLogs])
  const [focusedMealId, setFocusedMealId] = useState<number | null>(null)
  const [expandedMemoId, setExpandedMemoId] = useState<number | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealLogData | null>(null)
  const [mealTypeFilter, setMealTypeFilter] = useState("전체")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOption, setSortOption] = useState<"날짜순" | "별점순" | "기간">("날짜순")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null)
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null)
  const [showDateRangePicker, setShowDateRangePicker] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
        setShowDateRangePicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Helper to parse date string
  const parseDateString = (dateStr: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T00:00:00`)
    }
    const parts = dateStr.replace(/\. /g, "-").replace(".", "").split("-")
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }

  const toDisplayDate = (isoDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
    const [y, m, d] = isoDate.split("-")
    return `${y}. ${m}. ${d}`
  }

  const toIsoDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  useEffect(() => {
    if (!jumpToDate) return

    setMealTypeFilter("전체")
    setSearchQuery("")
    setSortOption("날짜순")
    setSortDirection("desc")
    setDateRangeStart(null)
    setDateRangeEnd(null)

    const target = mealLogs.find((meal) => toIsoDate(parseDateString(meal.date)) === jumpToDate.date)
    if (!target) return

    setFocusedMealId(target.id)
    const timer = setTimeout(() => {
      cardRefs.current[target.id]?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)

    return () => clearTimeout(timer)
  }, [jumpToDate, mealLogs])

  useEffect(() => {
    if (focusedMealId === null) return
    const timer = setTimeout(() => setFocusedMealId(null), 1800)
    return () => clearTimeout(timer)
  }, [focusedMealId])

  useEffect(() => {
    if (expandedMemoId === null) return

    const handleOutsideMemoClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element | null
      if (!target) return

      if (target.closest(`[data-memo-box="${expandedMemoId}"]`)) {
        return
      }

      setExpandedMemoId(null)
    }

    document.addEventListener("mousedown", handleOutsideMemoClick)
    document.addEventListener("touchstart", handleOutsideMemoClick)

    return () => {
      document.removeEventListener("mousedown", handleOutsideMemoClick)
      document.removeEventListener("touchstart", handleOutsideMemoClick)
    }
  }, [expandedMemoId])

  // Filter and sort logs
  const filteredLogs = mealLogs
    .filter(log => {
      const matchesSearch = !searchQuery || 
        log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesMealType = mealTypeFilter === "전체" || log.type === mealTypeFilter
      
      // Date range filter
      let matchesDateRange = true
      if (sortOption === "기간" && (dateRangeStart || dateRangeEnd)) {
        const logDate = parseDateString(log.date)
        if (dateRangeStart) {
          const startDate = new Date(dateRangeStart)
          if (logDate < startDate) matchesDateRange = false
        }
        if (dateRangeEnd) {
          const endDate = new Date(dateRangeEnd)
          if (logDate > endDate) matchesDateRange = false
        }
      }
      
      return matchesSearch && matchesMealType && matchesDateRange
    })
    .sort((a, b) => {
      const descBase =
        sortOption === "별점순"
          ? b.rating - a.rating
          : parseDateString(b.date).getTime() - parseDateString(a.date).getTime()

      return sortDirection === "desc" ? descBase : -descBase
    })

  const getOptionCount = (optionId: (typeof mealTypeOptions)[number]["id"]) => {
    if (optionId === "전체") return mealLogs.length
    return mealLogs.filter((log) => log.type === optionId).length
  }

  const handleRatingChange = (mealId: number, newRating: number) => {
    setMealLogs(logs => 
      logs.map(log => 
        log.id === mealId ? { ...log, rating: newRating } : log
      )
    )
  }

  const handleEditClick = (meal: typeof initialMealLogs[0]) => {
    const editData: MealLogData = {
      id: meal.id,
      date: toIsoDate(parseDateString(meal.date)),
      mealType: meal.type as "집밥" | "배달" | "외식",
      menuName: meal.title,
      image: meal.image,
      description: meal.description,
      rating: meal.rating,
      recipe: meal.tips?.join("\n"),
      recipeType: "manual",
      linkUrl: meal.linkUrl,
    }
    setEditingMeal(editData)
    setEditModalOpen(true)
  }

  const handleEditSave = (data: MealLogData) => {
    if (data.id) {
      setMealLogs(logs =>
        logs.map(log =>
          log.id === data.id
            ? {
                ...log,
                date: data.date ? toDisplayDate(data.date) : log.date,
                title: data.menuName,
                type: data.mealType,
                tips: data.recipe?.split("\n").filter(t => t.trim()) || log.tips,
                linkUrl: data.linkUrl || log.linkUrl,
                image: data.image || log.image,
              }
            : log
        )
      )
    } else {
      const newLog = {
        id: Date.now(),
        date: data.date ? toDisplayDate(data.date) : toDisplayDate(toIsoDate(new Date())),
        title: data.menuName,
        type: data.mealType,
        image: data.image || "/images/placeholder-food.jpg",
        rating: data.rating || 5,
        tips: data.recipe?.split("\n").filter(t => t.trim()) || [],
        tipTitle: data.mealType === "집밥" ? "조리 팁" : "추천 메뉴",
        linkUrl: data.linkUrl,
        aiTag: !!data.image,
        healthy: data.mealType === "집밥",
      }
      setMealLogs(logs => [newLog, ...logs])
    }
    setEditModalOpen(false)
    setEditingMeal(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky Search + Filter */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex flex-col gap-2">
      {/* Search + Date Filter Row */}
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="식당, 메뉴, 장소 검색"
            className="w-full pl-12 pr-4 py-3 bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-base placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-base font-medium transition-all border cursor-pointer",
              sortOption !== "날짜순" || dateRangeStart || dateRangeEnd
                ? "bg-cyan-500 text-white border-cyan-500 shadow-sm shadow-cyan-200"
                : "bg-white/60 text-muted-foreground border-white/80 hover:border-primary/30"
            )}
          >
            <span
              onClick={(e) => {
                e.stopPropagation()
                setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
              }}
              className="inline-flex"
            >
              <ArrowUpDown className="size-4" />
            </span>
            <span>{sortOption}</span>
            <span className="text-[11px] font-bold">{sortDirection === "desc" ? "↓" : "↑"}</span>
            <ChevronDown className="size-3" />
          </button>

          {/* Sort Dropdown Menu */}
          {showSortDropdown && !showDateRangePicker && (
            <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-xl border border-muted/20 py-2 z-50">
              {(["날짜순", "별점순", "기간"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    if (option === "기간") {
                      setShowDateRangePicker(true)
                    } else {
                      setSortOption(option)
                      setDateRangeStart(null)
                      setDateRangeEnd(null)
                      setShowSortDropdown(false)
                    }
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm transition-all",
                    sortOption === option
                      ? "bg-orange-50 text-primary font-bold"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Date Range Picker */}
          {showDateRangePicker && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-muted/20 p-4 z-50">
              <h4 className="font-bold text-sm text-foreground mb-3">기간 설정</h4>
              
              {/* Start Date */}
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1 block">시작 날짜</label>
                <input
                  type="date"
                  value={dateRangeStart || ""}
                  onChange={(e) => setDateRangeStart(e.target.value || null)}
                  className="w-full px-3 py-2 border border-muted/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              {/* End Date */}
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">종료 날짜</label>
                <input
                  type="date"
                  value={dateRangeEnd || ""}
                  onChange={(e) => setDateRangeEnd(e.target.value || null)}
                  className="w-full px-3 py-2 border border-muted/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDateRangeStart(null)
                    setDateRangeEnd(null)
                    setSortOption("날짜순")
                    setShowDateRangePicker(false)
                    setShowSortDropdown(false)
                  }}
                  className="flex-1 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-lg transition-all"
                >
                  초기화
                </button>
                <button
                  onClick={() => {
                    setSortOption("기간")
                    setShowDateRangePicker(false)
                    setShowSortDropdown(false)
                  }}
                  className="flex-1 py-2 text-sm bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all"
                >
                  적용
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meal Type Filter Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {mealTypeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setMealTypeFilter(option.id)}
                className={cn(
                  "relative px-4.5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                  mealTypeFilter === option.id
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-white/70 text-muted-foreground hover:bg-white"
                )}
              >
                <span className="absolute -top-1.5 right-1 z-10 text-xs leading-none font-black text-cyan-600">
                  {getOptionCount(option.id)}
                </span>
                {Icon && <Icon className="size-4" />}
                {option.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          {showBackToCalendar && onBackToCalendar && (
            <button
              onClick={onBackToCalendar}
              className="px-4 py-2.5 rounded-full text-sm font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors cursor-pointer"
            >
              ← 캘린더
            </button>
          )}
          <button
            onClick={() => {
              setEditingMeal(null)
              setEditModalOpen(true)
            }}
            className="size-11 bg-orange-500 text-white rounded-full border-2 border-orange-100 shadow-md shadow-orange-300/60 flex items-center justify-center hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-5.5" strokeWidth={2.8} />
          </button>
        </div>
      </div>
      </div>{/* end sticky */}

      {/* Meal Cards - PC에서 2열 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredLogs.map((meal) => (
          <div
            key={meal.id}
            ref={(el) => {
              cardRefs.current[meal.id] = el
            }}
            className={cn(
              "bg-white rounded-[2rem] overflow-hidden shadow-[0_10px_25px_rgba(0,0,0,0.04)] transition-all hover:ring-2 hover:ring-cyan-300 hover:shadow-cyan-100",
              focusedMealId === meal.id && "ring-2 ring-cyan-400 shadow-cyan-100"
            )}
          >
            {/* Card Content */}
            <div className="flex h-[200px]">
              {/* Image Section */}
              <div
                className="w-1/2 relative overflow-hidden cursor-zoom-in"
                onClick={() => setViewerImage(meal.image)}
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-300 hover:scale-105"
                  style={{ backgroundImage: `url("${meal.image}")` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {meal.aiTag && (
                    <span className="w-fit px-2 py-0.5 bg-primary text-white text-[8px] font-black rounded-md">AI TAG</span>
                  )}
                  {meal.healthy && (
                    <span className="w-fit px-2 py-0.5 bg-green-600 text-white text-[8px] font-black rounded-md">HEALTHY</span>
                  )}
                  <span className="w-fit px-2 py-0.5 bg-white/20 backdrop-blur-md text-white text-[8px] font-bold rounded-md border border-white/30">
                    {meal.type}
                  </span>
                </div>
              </div>

              {/* Right Section */}
              <div className="w-1/2 bg-gray-50/80 border-l border-muted flex overflow-hidden relative">
                {/* Edit Button */}
                <button 
                  onClick={() => handleEditClick(meal)}
                  className="absolute top-2 right-2 size-6 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-white/80 rounded-md transition-all z-10"
                >
                  <Pencil className="size-3" />
                </button>

                {/* Case 1: linkUrl 있음 -> 썸네일만 (레시피 내용 없음) */}
                {meal.linkUrl && meal.linkThumbnail ? (
                  <a
                    href={meal.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full relative group overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundImage: `url("${meal.linkThumbnail}")` }}
                    />
                    <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors" />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                      {(meal.type === "외식" || meal.type === "배달") ? (
                        <>
                          <div className="size-4 rounded-full bg-[#03C75A] flex items-center justify-center">
                            <span className="text-white text-[7px] font-black">N</span>
                          </div>
                          <span className="text-[10px] font-bold text-foreground">Place</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="size-3 text-primary" />
                          <span className="text-[10px] font-bold text-foreground">recipe</span>
                        </>
                      )}
                    </div>
                  </a>
                ) : (
                  <>
                    {/* Case 2: linkUrl 없음 -> 직접 작성한 레시피/팁 표시 */}
                    <div className="flex-1 p-3 flex flex-col overflow-hidden">
                      <h4 className="text-[10px] font-bold text-primary mb-1.5 flex items-center gap-1">
                        {meal.healthy ? (
                          <BookOpen className="size-3" />
                        ) : (
                          <Lightbulb className="size-3" />
                        )}
                        {meal.tipTitle}
                      </h4>
                      <div className="overflow-y-auto flex-1 hide-scrollbar">
                        {meal.tips.map((tip, index) => (
                          <div key={index} className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-tight mb-1.5">
                            <div className="mt-1.5 size-1 bg-primary/40 rounded-full shrink-0" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Naver Place info bar - 외식/배달 with link */}
            {(meal.type === "외식" || meal.type === "배달") && meal.linkUrl && meal.placeName && (
              <a
                href={meal.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-5 py-2 bg-gray-50/50 border-t border-muted/20 hover:bg-gray-100/60 transition-all group"
              >
                <div className="size-5 rounded-md bg-[#03C75A] flex items-center justify-center shrink-0">
                  <span className="text-white text-[8px] font-black">N</span>
                </div>
                <span className="text-[11px] font-bold text-foreground truncate">{meal.placeName}</span>
                {meal.placeRating && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Star className="size-2.5 text-[#03C75A] fill-[#03C75A]" />
                    <span className="text-[11px] font-bold text-[#03C75A]">{meal.placeRating}</span>
                  </div>
                )}
              </a>
            )}

            {/* Card Footer */}
            <div className="px-5 pt-4 pb-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{meal.date}</p>
                <div className="flex items-center gap-0.5 text-orange-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRatingChange(meal.id, star)}
                      className="hover:scale-110 transition-transform"
                    >
                      <Star 
                        className={cn(
                          "size-4",
                          star <= meal.rating ? "fill-current" : ""
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <h3 className="font-bold text-foreground text-lg mb-2">{meal.title}</h3>
              {/* Memo Section */}
              {meal.description ? (
                <button
                  onClick={() => setExpandedMemoId(expandedMemoId === meal.id ? null : meal.id)}
                  data-memo-box={meal.id}
                  className="w-full text-left bg-gray-50/50 p-3 rounded-xl border border-muted/50 hover:border-primary/30 hover:bg-white transition-all"
                >
                  <p
                    className={cn(
                      "text-[13px] leading-[22px] text-muted-foreground",
                      expandedMemoId === meal.id ? "line-clamp-none" : "line-clamp-3"
                    )}
                  >
                    {meal.description}
                  </p>
                </button>
              ) : (
                <button
                  onClick={() => handleEditClick(meal)}
                  className="w-full py-3 flex items-center justify-center gap-2 text-muted-foreground/50 hover:text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-muted/50 hover:border-primary/30 transition-all"
                >
                  <MessageSquare className="size-4" />
                  <span className="text-sm">메모 추가하기</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <AddLogModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditingMeal(null)
        }}
        editData={editingMeal}
        onSave={handleEditSave}
      />

      {/* Image Viewer */}
      <ImageViewer
        src={viewerImage ?? ""}
        isOpen={viewerImage !== null}
        onClose={() => setViewerImage(null)}
      />
    </div>
  )
}
