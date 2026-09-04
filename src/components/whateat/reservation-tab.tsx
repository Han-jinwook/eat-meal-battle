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
  ArrowDown,
  Calendar as CalendarIcon,
  Link2,
  Youtube,
  ExternalLink,
  X,
  Bookmark,
  Clock,
  Trash2,
  User,
  Users,
  CheckCircle2,
  ChevronRight,
  Share2,
  Pin,
} from "lucide-react"
import { cn, formatRegionStr, parseRegionFromAddress } from "@/lib/utils"
import { AddReservationModal, type EditData } from "@/components/whateat/add-reservation-modal"
import { ReservationDetailModal, type DetailPlanData } from "@/components/whateat/reservation-detail-modal"
import { UniversalSaveModal, type SourceCardData } from "@/components/whateat/universal-save-modal"
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

export const getDynamicDefaultWishlist = () => [
  {
    id: "sample-wish-1",
    mealType: "집밥",
    menu: "알리오 올리오 파스타",
    place: "집",
    memo: "유튜브 백종원 알리오 올리오 레시피 참고해서 해먹기",
    thumbnail: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=100&h=100&fit=crop",
    url: "https://www.youtube.com/results?search_query=파스타",
    isSample: true
  },
  {
    id: "sample-wish-2",
    mealType: "배달",
    menu: "뿌링클 치킨",
    place: "BHC 치킨 역삼점",
    memo: "이번 주말 야식으로 배달 주문하기",
    thumbnail: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=100&h=100&fit=crop",
    isSample: true
  },
  {
    id: "sample-wish-3",
    mealType: "외식",
    menu: "숙성 삼겹살",
    place: "우미학 청담점",
    memo: "주말 저녁 친구들과 외식 모임",
    thumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&h=100&fit=crop",
    url: "https://m.place.naver.com/restaurant/37166160",
    isSample: true
  }
]

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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [savedCardIds, setSavedCardIds] = useState<Set<string | number>>(new Set())
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() + 1 }
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [urlForModal, setUrlForModal] = useState("")
  const [plans, setPlans] = useState<any[]>(defaultMealPlans)
  const [wishlistPlans, setWishlistPlans] = useState<any[]>(getDynamicDefaultWishlist())
  const [mobileSubTab, setMobileSubTab] = useState<"wishlist" | "confirmed">("wishlist")
  const [isLoaded, setIsLoaded] = useState(false)
  const [mealTypeFilter, setMealTypeFilter] = useState<"전체" | "집밥" | "배달" | "외식">("전체")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [focusedPlanId, setFocusedPlanId] = useState<string | number | null>(null)
  const [editingPlan, setEditingPlan] = useState<any | null>(null)
  const [selectedDetailPlan, setSelectedDetailPlan] = useState<DetailPlanData | null>(null)
  const [editingMemoId, setEditingMemoId] = useState<string | number | null>(null)
  const [editingMemoText, setEditingMemoText] = useState("")
  const [userBaseDate, setUserBaseDate] = useState<Date>(new Date())
  const [highlightedMenu, setHighlightedMenu] = useState<string | null>(null)
  const [saveModalSourceCard, setSaveModalSourceCard] = useState<SourceCardData | null>(null)
  const [userGroups, setUserGroups] = useState<{ id: string; name: string }[]>([])
  const { isLoggedIn, user } = useHub()

  const supabase = createClient()

  useEffect(() => {
    const fetchUserGroups = async () => {
      if (!isLoggedIn || !user?.id) return
      try {
        const hubToken = getSessionToken() || ""
        const res = await fetch("/api/group/members", {
          headers: hubToken ? { "x-hub-token": hubToken } : undefined
        })
        if (res.ok) {
          const json = await res.json()
          if (json.groups && Array.isArray(json.groups)) {
            setUserGroups(json.groups.map((g: any) => ({ id: g.id, name: g.name })))
          }
        }
      } catch (err) {
        console.error("Failed to fetch user groups for save modal", err)
      }
    }
    fetchUserGroups()
    window.addEventListener("focus", fetchUserGroups)
    return () => window.removeEventListener("focus", fetchUserGroups)
  }, [isLoggedIn, user])

  useEffect(() => {
    const handleOpenFromTalk = (e: Event) => {
      const ev = e as CustomEvent
      if (!ev.detail) return
      const { target, menuName, highlightMenu } = ev.detail
      if (target === "solo") {
        const targetMenu = highlightMenu || menuName
        if (targetMenu) {
          setHighlightedMenu(targetMenu)
          setTimeout(() => setHighlightedMenu(null), 3500)
        }
      }
    }
    const handleCardSaved = (e: any) => {
      if (e.detail?.id) {
        setSavedCardIds(prev => {
          const newSet = new Set(prev)
          newSet.add(e.detail.id)
          return newSet
        })
      }
    }
    window.addEventListener("openReservationFromTalk", handleOpenFromTalk)
    window.addEventListener("whateat:card-saved", handleCardSaved)
    return () => {
      window.removeEventListener("openReservationFromTalk", handleOpenFromTalk)
      window.removeEventListener("whateat:card-saved", handleCardSaved)
    }
  }, [])

  const handleSilentSaveMemo = async (id: string | number, newMemo: string) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, memo: newMemo } : p))
    setWishlistPlans(prev => prev.map(p => p.id === id ? { ...p, memo: newMemo } : p))

    if (isLoggedIn && user?.id) {
      try {
        await secureWrite({
          table: "meal_reservations",
          action: "update",
          data: { memo: newMemo },
          filters: { id }
        })
      } catch (err) {
        console.error("Failed to save inline memo silently", err)
      }
    }
  }

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
        setWishlistPlans(getDynamicDefaultWishlist())
        setIsLoaded(true)
        return
      }
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("meal_reservations")
          .select("*")
          .eq("user_id", user.id)
        
        if (error) throw error

        let baseDateObj = new Date()
        const { data: userData } = await supabase.from("users").select("created_at").eq("id", user.id).single()
        if (userData?.created_at) {
          baseDateObj = new Date(userData.created_at)
          setUserBaseDate(baseDateObj)
        }
        
        const samples = getDynamicDefaultPlans(baseDateObj)
        const defaultWishes = getDynamicDefaultWishlist()

        const soloData = (data || []).filter(row => !row.group_id && (row.source === "solo" || row.source === "solo_wishlist" || !row.source))

        if (soloData && soloData.length > 0) {
          const realConfirmed: any[] = []
          const realWishes: any[] = []

          soloData.forEach(row => {
            const mapped = {
              id: row.id,
              date: row.date || "",
              time: row.time || "",
              mealType: row.meal_type,
              menu: row.menu,
              place: row.place || "",
              memo: row.memo || "",
              thumbnail: row.thumbnail || row.image || "",
              url: row.source_url || row.url || "",
              source: row.source || (row.date ? "solo" : "solo_wishlist")
            }
            if (mapped.source === "solo_wishlist" || !mapped.date) {
              realWishes.push(mapped)
            } else {
              realConfirmed.push(mapped)
            }
          })

          setPlans(realConfirmed)
          setWishlistPlans(realWishes)
        } else {
          setPlans(samples)
          setWishlistPlans(defaultWishes)
        }
      } catch (err) {
        console.error("Failed to fetch reservations", err)
        setPlans(defaultMealPlans)
        setWishlistPlans(getDynamicDefaultWishlist())
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
      default: return Utensils
    }
  }

  useEffect(() => {
    const handleUpdated = () => {
      if (!isLoggedIn || !user?.id) return
      const fetchPlans = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from("meal_reservations")
          .select("*")
          .eq("user_id", user.id)
        if (data && data.length > 0) {
          const soloData = data.filter(row => !row.group_id && (row.source === "solo" || row.source === "solo_wishlist" || !row.source))
          const realConfirmed: any[] = []
          const realWishes: any[] = []
          soloData.forEach(row => {
            const mapped = {
              id: row.id,
              date: row.date || "",
              time: row.time || "",
              mealType: row.meal_type,
              menu: row.menu,
              place: row.place || "",
              memo: row.memo || "",
              thumbnail: row.thumbnail || row.image || "",
              url: row.source_url || row.url || "",
              source: row.source || (row.date ? "solo" : "solo_wishlist")
            }
            if (mapped.source === "solo_wishlist" || !mapped.date) {
              realWishes.push(mapped)
            } else {
              realConfirmed.push(mapped)
            }
          })
          setPlans(realConfirmed)
          setWishlistPlans(realWishes)
        }
      }
      fetchPlans()
    }
    window.addEventListener("whateat:reservation-updated", handleUpdated)
    return () => window.removeEventListener("whateat:reservation-updated", handleUpdated)
  }, [isLoggedIn, user?.id])

  const mealPlans = plans
  const filteredPlans = mealPlans.filter((plan) => {
    if (mealTypeFilter !== "전체" && plan.mealType !== mealTypeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesMenu = plan.menu.toLowerCase().includes(q)
      const matchesPlace = plan.place.toLowerCase().includes(q)
      const matchesMemo = plan.memo ? plan.memo.toLowerCase().includes(q) : false
      if (!matchesMenu && !matchesPlace && !matchesMemo) return false
    }
    return true
  })

  const filteredWishlist = wishlistPlans.filter((item) => {
    if (mealTypeFilter !== "전체" && item.mealType !== mealTypeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesMenu = item.menu.toLowerCase().includes(q)
      const matchesPlace = item.place.toLowerCase().includes(q)
      const matchesMemo = item.memo ? item.memo.toLowerCase().includes(q) : false
      if (!matchesMenu && !matchesPlace && !matchesMemo) return false
    }
    return true
  })

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    const timeA = new Date(a.date).getTime()
    const timeB = new Date(b.date).getTime()
    return sortDirection === "desc" ? timeB - timeA : timeA - timeB
  })

  const getOptionCount = (optionId: "전체" | "집밥" | "배달" | "외식") => {
    const all = [...mealPlans, ...wishlistPlans]
    if (optionId === "전체") return all.length
    return all.filter(p => p.mealType === optionId).length
  }

  const mealTypeOptions = [
    { id: "전체" as const, label: "전체", icon: null },
    { id: "집밥" as const, label: "집밥", icon: ChefHat },
    { id: "배달" as const, label: "배달", icon: Bike },
    { id: "외식" as const, label: "외식", icon: UtensilsCrossed },
  ]

  const handleModalSave = async (saved: EditData) => {
    const isWish = !saved.date || saved.isWishlist
    const targetSource = isWish ? "solo_wishlist" : "solo"

    const nextPlan = {
      id: saved.id || (typeof window !== "undefined" && window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now()),
      date: saved.date || "",
      time: saved.time || "",
      mealType: saved.mealType,
      menu: saved.menuName,
      place: saved.place?.name || saved.deliveryStoreName || saved.placeName || "",
      memo: saved.recipe || "",
      thumbnail: saved.linkThumbnail || saved.recipeThumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
      url: saved.recipe || saved.source_url || "",
      source: targetSource
    }

    if (isLoggedIn && user?.id) {
      try {
        await secureWrite({
          table: "meal_reservations",
          action: "upsert",
          data: {
            id: nextPlan.id,
            user_id: user.id,
            date: nextPlan.date || null,
            time: nextPlan.time || null,
            meal_type: nextPlan.mealType,
            menu: nextPlan.menu,
            place: nextPlan.place,
            memo: nextPlan.memo,
            thumbnail: nextPlan.thumbnail,
            source_url: nextPlan.url || null,
            source: targetSource
          }
        })
      } catch (err) {
        console.error("Failed to save reservation", err)
        toast.error("저장에 실패했습니다.")
        return
      }
    }

    if (isWish) {
      setWishlistPlans(prev => {
        const realWishes = prev.filter(p => !p.isSample && !String(p.id).startsWith("sample-"))
        const exists = realWishes.some(p => p.id === nextPlan.id)
        return exists ? realWishes.map(p => p.id === nextPlan.id ? nextPlan : p) : [nextPlan, ...realWishes]
      })
    } else {
      setPlans(prev => {
        const realPlans = prev.filter(p => !p.isSample && p.id !== 1 && p.id !== 2 && p.id !== 3)
        const exists = realPlans.some(p => p.id === nextPlan.id)
        const updated = exists ? realPlans.map(p => p.id === nextPlan.id ? nextPlan : p) : [nextPlan, ...realPlans]
        return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      })
      setWishlistPlans(prev => prev.filter(p => p.id !== nextPlan.id))
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("whateat:reservation-updated"))
    }
    toast.success(isWish ? "위시리스트에 저장되었습니다!" : "식사 예약이 확정되었습니다!")
  }

  const handleDeleteClick = async (id: string | number) => {
    if (id === 1 || id === 2 || id === 3 || String(id).startsWith("sample-")) {
      toast("샘플이라 삭제가 안 되며, 식사를 등록하면 샘플은 사라집니다.", {
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
        toast.error("삭제에 실패했습니다.")
        return
      }
    }

    setPlans(prev => prev.filter(p => p.id !== id))
    setWishlistPlans(prev => prev.filter(p => p.id !== id))
    
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("whateat:reservation-updated"))
    }
    toast.success("삭제되었습니다.")
  }

  const renderCard = (plan: any, isWishlist = false) => {
    const isSample = plan.isSample || plan.id === 1 || plan.id === 2 || plan.id === 3 || String(plan.id).startsWith("sample-")
    const TypeIcon = getMealTypeIcon(plan.mealType)
    const borderClass = isWishlist
      ? "border border-slate-200/80 shadow-2xs"
      : plan.mealType === "집밥"
        ? "border-l-4 border-l-emerald-500 border-y-gray-200/80 border-r-gray-200/80"
        : plan.mealType === "배달"
          ? "border-l-4 border-l-sky-500 border-y-gray-200/80 border-r-gray-200/80"
          : "border-l-4 border-l-orange-500 border-y-gray-200/80 border-r-gray-200/80"

    const dateStr = (() => {
      if (!plan.date) return ""
      try {
        const d = new Date(plan.date)
        const m = d.getMonth() + 1
        const day = d.getDate()
        return `${m}월 ${day}일`
      } catch (e) {
        return plan.date
      }
    })()

    const isHighlighted = highlightedMenu && plan.menu && plan.menu.trim().toLowerCase() === highlightedMenu.trim().toLowerCase()

    return (
      <div 
        key={plan.id} 
        ref={(el) => {
          cardRefs.current[plan.id] = el
        }}
        className={cn(
          "rounded-3xl bg-white shadow-sm hover:shadow-md relative overflow-hidden transition-all duration-200 flex flex-col justify-between mb-4",
          borderClass,
          focusedPlanId === plan.id && "ring-2 ring-orange-400 shadow-orange-100",
          isSample && "opacity-95",
          isHighlighted && "ring-2 ring-orange-400 border-orange-400 shadow-xl bg-orange-50/40 animate-[bounce_1s_ease-in-out_3] z-20"
        )}
      >
        {isSample && (
          <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 z-10 pointer-events-none">
            <div className="absolute top-3 -right-6 w-24 bg-yellow-400 text-yellow-900 text-[8px] font-black py-0.5 text-center rotate-45 shadow-sm">
              💡 SAMPLE
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2">
            <div className={cn(
              "px-2 py-0.5 rounded-lg flex items-center gap-1.5 border text-xs font-bold shrink-0 shadow-2xs",
              plan.mealType === "집밥" && "bg-emerald-50 text-emerald-700 border-emerald-200/80",
              plan.mealType === "배달" && "bg-sky-50 text-sky-700 border-sky-200/80",
              plan.mealType === "외식" && "bg-orange-50 text-orange-700 border-orange-200/80",
              !plan.mealType && "bg-gray-50 text-gray-700 border-gray-200"
            )}>
              <TypeIcon className="size-3.5 shrink-0" strokeWidth={2.2} />
              <span>{plan.mealType || "식사"}</span>
            </div>

            {plan.date && (
              <div className="flex items-center gap-1 text-xs font-bold text-gray-800">
                <CalendarDays className="size-3.5 text-gray-400 shrink-0" />
                <span>{dateStr}{plan.time ? ` · ${plan.time}` : ""}</span>
              </div>
            )}
          </div>

          <div className={cn("flex items-center gap-1.5 shrink-0", isSample && "mr-10")}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSaveModalSourceCard({
                    id: plan.id,
                    menu: plan.menu,
                    place: plan.place,
                    url: plan.url,
                    thumbnail: plan.thumbnail,
                    mealType: plan.mealType,
                    source: isWishlist ? "solo_wish" : "solo_schedule"
                  })
                }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors px-1"
                title="다른 곳으로 담기"
              >
                <Pin className={cn("size-4 rotate-45 transition-colors", savedCardIds.has(plan.id) ? "fill-red-500 text-red-500 scale-110" : "")} />
                <span className={cn("text-xs font-bold", savedCardIds.has(plan.id) ? "text-red-500" : "")}>담기</span>
              </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isSample) {
                  toast("샘플이라 수정이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
                  return
                }
                setSelectedDetailPlan(plan)
              }}
              className="p-1 text-muted-foreground hover:text-orange-500 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer"
              title="식사 카드 상세 / 수정"
            >
              <Pencil className="size-3.5 text-gray-400 hover:text-orange-500" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-3.5 pt-1 flex items-stretch justify-between gap-3 flex-1">
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-foreground text-sm sm:text-base leading-snug line-clamp-2">
                {plan.menu}
              </h4>

              {plan.place ? (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 text-orange-500 shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {(() => {
                      if (plan.place.includes("/")) return plan.place
                      if (plan.place.includes(" ")) {
                        const reg = parseRegionFromAddress(plan.place)
                        const formatted = formatRegionStr(reg.city, reg.gu, reg.dong)
                        if (formatted) return formatted
                      }
                      return plan.place === plan.menu ? "식당 지도" : plan.place
                    })()}
                  </span>
                </div>
              ) : (
                plan.url && (plan.url.includes("youtube.com") || plan.url.includes("youtu.be") || plan.url.includes("tiktok.com") || plan.url.includes("instagram.com")) && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/70 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                      <Youtube className="size-3 text-red-500 shrink-0" />
                      <span>숏폼</span>
                    </span>
                  </div>
                )
              )}
            </div>

            {/* 2줄 메모 (하단 썸네일 라인 밀착 정렬 & 항시 2줄 공간 확보) */}
            <div 
              className="mt-auto pt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-1.5 px-2 bg-orange-50/60 rounded-xl border border-orange-100/80 focus-within:border-orange-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-orange-300 transition-all">
                <textarea
                  rows={2}
                  key={plan.memo || "empty"}
                  defaultValue={plan.memo || ""}
                  readOnly={isSample}
                  placeholder={isSample ? "" : "+ 메모 입력"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                  }}
                  onBlur={(e) => {
                    if (isSample) return
                    const val = e.target.value.trim()
                    if (val !== (plan.memo || "")) {
                      handleSilentSaveMemo(plan.id, val)
                    }
                  }}
                  className="w-full bg-transparent text-xs font-medium text-foreground/90 outline-none placeholder:text-muted-foreground/50 placeholder:italic resize-none leading-snug h-[38px] overflow-hidden block"
                />
              </div>
            </div>
          </div>

          {plan.thumbnail && (
            <div 
              className={cn(
                "size-24 sm:size-28 rounded-2xl overflow-hidden shrink-0 relative bg-muted border border-muted/40 shadow-sm",
                plan.url && "cursor-pointer group"
              )}
              onClick={(e) => {
                if (plan.url) {
                  e.stopPropagation()
                  window.open(plan.url, '_blank')
                }
              }}
              title={plan.url ? "클릭 시 해당 링크로 이동합니다" : undefined}
            >
              <img 
                src={plan.thumbnail || "/placeholder.svg"} 
                alt={plan.menu}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
                }}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {plan.url && (
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-end justify-end p-1.5">
                  <div className="size-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white">
                    <ExternalLink className="size-3" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isWishlist && (
          <div className="px-4 py-2 bg-orange-50/40 border-t border-orange-100/60 flex items-center justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isSample) {
                  toast("샘플이라 날짜 잡기가 안 되며, 위시를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
                  return
                }
                setEditingPlan({ ...plan, isWishlistToSchedule: true })
                setIsModalOpen(true)
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-95 cursor-pointer"
            >
              <CalendarIcon className="size-3.5" />
              <span>날짜 잡기</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="sticky top-[116px] z-30 -mx-5 px-5 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar flex-shrink-0 max-w-[50%] sm:max-w-[60%] pt-1.5 pb-1">
          {mealTypeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setMealTypeFilter(option.id)}
                className={cn(
                  "relative px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                  mealTypeFilter === option.id
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-white/70 text-muted-foreground hover:bg-white flex-shrink-0"
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

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-1 min-w-0">
          <div className={cn("relative transition-all duration-300 ease-in-out", isSearchExpanded || searchQuery ? "flex-1 min-w-[120px] sm:min-w-[150px]" : "w-[38px] flex-shrink-0")}>
            {isSearchExpanded || searchQuery ? (
              <>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => { if (!searchQuery) setIsSearchExpanded(false) }}
                  placeholder="식당, 메뉴 검색"
                  className="w-full pl-8 pr-7 h-[38px] bg-white border border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 outline-none text-sm shadow-xs transition-all duration-300"
                />
                <button
                  onClick={() => { setSearchQuery(''); setIsSearchExpanded(false) }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground p-1.5 transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className="w-[38px] h-[38px] flex items-center justify-center bg-white/60 text-muted-foreground border border-white/80 rounded-xl shadow-sm hover:bg-white hover:text-foreground transition-colors cursor-pointer"
              >
                <Search className="size-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
            className={cn("items-center gap-1.5 px-3.5 h-[38px] bg-white/60 border border-white/80 rounded-xl text-sm font-medium text-muted-foreground hover:border-primary/30 transition-all whitespace-nowrap cursor-pointer flex-shrink-0", (isSearchExpanded || searchQuery) ? "hidden lg:flex" : "flex")}
          >
            <ArrowDown className={cn("size-3.5 transition-transform duration-300", sortDirection === "asc" && "rotate-180")} />
            <span className="hidden sm:inline">날짜순</span>
          </button>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {showBackToCalendar && onBackToCalendar && (
              <button
                onClick={onBackToCalendar}
                className="px-3.5 py-2 rounded-full text-sm font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors cursor-pointer"
              >
                ← 캘린더
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="size-10 bg-orange-500 text-white rounded-full border-2 border-orange-100 shadow-md shadow-orange-300/60 flex items-center justify-center hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
              title="새 식사 예약/위시 추가"
            >
              <Plus className="size-5" strokeWidth={2.8} />
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 서브탭 스위처 (위시리스트 ↔ 확정 예약) */}
      <div className="md:hidden flex items-center gap-2 mb-3 bg-orange-50/60 p-1 rounded-2xl border border-orange-100">
        <button
          onClick={() => setMobileSubTab("wishlist")}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer",
            mobileSubTab === "wishlist"
              ? "bg-white text-orange-600 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          📋 나의 위시리스트 ({filteredWishlist.length})
        </button>
        <button
          onClick={() => setMobileSubTab("confirmed")}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer",
            mobileSubTab === "confirmed"
              ? "bg-white text-orange-600 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          📅 확정 예약 목록 ({filteredPlans.length})
        </button>
      </div>

      {/* 2열 Split-View (PC: 2열 나란히 노출, 모바일: 서브탭 토글) */}
      <div className="hidden md:grid md:grid-cols-2 gap-4 items-start mt-2">
        {/* 좌측: 📋 나의 위시리스트 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/80">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <span>📋 나의 위시리스트</span>
              <span className="text-xs text-orange-500 font-bold">({filteredWishlist.length})</span>
            </h3>
            <button
              onClick={() => {
                setEditingPlan({ isWishlist: true })
                setIsModalOpen(true)
              }}
              className="text-xs text-orange-500 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
            >
              <Plus className="size-3" /> 추가
            </button>
          </div>

          {filteredWishlist.length > 0 ? (
            filteredWishlist.map(plan => renderCard(plan, true))
          ) : (
            <div className="bg-white/60 rounded-2xl p-6 text-center border border-muted/30">
              <p className="text-xs text-muted-foreground">위시리스트가 비어있어요.</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">맛톡에서 담거나 + 버튼으로 추가해보세요!</p>
            </div>
          )}
        </div>

        {/* 우측: 📅 확정 예약 목록 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/80">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <span>📅 확정 예약 목록</span>
              <span className="text-xs text-orange-500 font-bold">({sortedPlans.length})</span>
            </h3>
          </div>

          {sortedPlans.length > 0 ? (
            sortedPlans.map(plan => renderCard(plan, false))
          ) : (
            <div className="bg-white/60 rounded-2xl p-6 text-center border border-muted/30">
              <p className="text-xs text-muted-foreground">확정된 식사 예약이 없어요.</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">위시리스트에서 [날짜 잡기]로 일정을 확정해보세요!</p>
            </div>
          )}
        </div>
      </div>

      {/* 모바일 뷰 (단일 영역 선택적 노출) */}
      <div className="md:hidden">
        {mobileSubTab === "wishlist" ? (
          <div className="space-y-3">
            {filteredWishlist.length > 0 ? (
              filteredWishlist.map(plan => renderCard(plan, true))
            ) : (
              <div className="bg-white/60 rounded-2xl p-6 text-center border border-muted/30">
                <p className="text-xs text-muted-foreground">위시리스트가 비어있어요.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">맛톡에서 담거나 + 버튼으로 추가해보세요!</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedPlans.length > 0 ? (
              sortedPlans.map(plan => renderCard(plan, false))
            ) : (
              <div className="bg-white/60 rounded-2xl p-6 text-center border border-muted/30">
                <p className="text-xs text-muted-foreground">확정된 식사 예약이 없어요.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">위시리스트에서 [날짜 잡기]로 일정을 확정해보세요!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reservation Modal */}
      <AddReservationModal
        isOpen={isModalOpen}
        contextName="솔로"
        onClose={() => {
          setIsModalOpen(false)
          setUrlForModal("")
          setEditingPlan(null)
        }}
        initialUrl={urlForModal}
        editData={editingPlan}
        isWishlist={editingPlan?.isWishlist}
        isScheduling={editingPlan?.isWishlistToSchedule}
        onSave={handleModalSave}
        onDelete={handleDeleteClick}
      />

      {/* Reservation Detail Modal */}
      <ReservationDetailModal 
        isOpen={!!selectedDetailPlan}
        onClose={() => setSelectedDetailPlan(null)}
        plan={selectedDetailPlan}
      />

      {/* Universal Save Modal */}
      <UniversalSaveModal
        isOpen={!!saveModalSourceCard}
        onClose={() => setSaveModalSourceCard(null)}
        sourceCard={saveModalSourceCard}
        groups={userGroups}
      />
    </div>
  )
}
