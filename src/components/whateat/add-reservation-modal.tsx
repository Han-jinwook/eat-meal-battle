"use client"

import { useState, useEffect, useRef } from "react"
import {
  X,
  CalendarDays,
  Clock,
  Sparkles,
  MapPin,
  Search,
  ChevronRight,
  Navigation,
  ChefHat,
  UtensilsCrossed,
  Bike,
  Loader2,
  Link2,
  Sun,
  Coffee,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { toast } from "react-hot-toast"




export interface EditData {
  id: number
  date: string
  menu: string
  mealType: "집밥" | "배달" | "외식"
  place: string | null
  memo: string
  time: string
  thumbnail?: string
}

export interface ReservationPrefillData {
  menuName: string
  mealType: "집밥" | "배달" | "외식"
  placeName?: string
}

interface AddReservationModalProps {
  isOpen: boolean
  onClose: () => void
  initialUrl?: string
  editData?: EditData | null
  onSave?: (data: EditData) => void
  prefillData?: ReservationPrefillData | null
}

type MealType = "집밥" | "외식" | "배달" | ""
type MealTime = "아침" | "점심" | "저녁" | ""
type DateOption = "이번주말" | "다음주" | "다음날" | "직접선택" | ""

interface SelectedPlace {
  name: string
  address: string
  category: string
}

// 샘플 장소 데이터
const samplePlaces = [
  { name: "우미학 청담점", address: "서울 강남구 청담동 123-45", category: "한식" },
  { name: "스시 오마카세 히든", address: "서울 강남구 역삼동 234-56", category: "일식" },
  { name: "라멘 이치란 강남점", address: "서울 강남구 논현동 345-67", category: "일식" },
  { name: "빕스 코엑스점", address: "서울 강남구 삼성동 456-78", category: "양식" },
  { name: "매드포갈릭 청담점", address: "서울 강남구 청담동 567-89", category: "양식" },
]

const mealTypes = [
  { id: "집밥" as MealType, label: "집밥", icon: ChefHat },
  { id: "배달" as MealType, label: "배달", icon: Bike },
  { id: "외식" as MealType, label: "외식", icon: UtensilsCrossed },
]

const mealTimes = [
  { id: "아침" as MealTime, label: "아침", icon: Coffee },
  { id: "점심" as MealTime, label: "점심", icon: Sun },
  { id: "저녁" as MealTime, label: "저녁", icon: Moon },
]

const dateOptions = [
  { id: "다음날" as DateOption, label: "내일" },
  { id: "이번주말" as DateOption, label: "이번 주말" },
  { id: "다음주" as DateOption, label: "다음 주" },
  { id: "직접선택" as DateOption, label: "직접 선택" },
]

// 날짜 계산 함수
function getDateFromOption(option: DateOption): string {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
  
  switch (option) {
    case "다음날":
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    case "이번주말":
      const saturday = new Date(today)
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7
      saturday.setDate(today.getDate() + daysUntilSaturday)
      return saturday.toISOString().split('T')[0]
    case "다음주":
      const nextWeek = new Date(today)
      nextWeek.setDate(today.getDate() + 7)
      return nextWeek.toISOString().split('T')[0]
    default:
      return ""
  }
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
  const weekday = weekdays[date.getDay()]
  return `${month}월 ${day}일 (${weekday})`
}

export function AddReservationModal({ isOpen, onClose, initialUrl, editData, onSave, prefillData }: AddReservationModalProps) {
  const { isLoggedIn } = useHub()
  const [menuName, setMenuName] = useState("")

  const [date, setDate] = useState("")
  const [mealTime, setMealTime] = useState<MealTime>("")
  const [memo, setMemo] = useState("")
  const [mealType, setMealType] = useState<MealType>("")
  const [dateOption, setDateOption] = useState<DateOption>("")
  const [showPlaceSearch, setShowPlaceSearch] = useState(false)
  const [placeSearchQuery, setPlaceSearchQuery] = useState("")
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [deliveryStoreName, setDeliveryStoreName] = useState("")
  const [recipeUrl, setRecipeUrl] = useState("")
  const [urlPreview, setUrlPreview] = useState<{
    thumbnail: string
    aiSuggestedName: string
    url: string
    isLoading: boolean
  } | null>(null)
  const isEditMode = !!editData
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Initialize form with edit data
  useEffect(() => {
    if (editData && isOpen) {
      setMenuName(editData.menu)
      setDate(editData.date)
      setMemo(editData.memo)
      setMealType(editData.mealType)
      setDateOption("직접선택")
      setRecipeUrl("")
      setUrlPreview(null)
      if (editData.place) {
        if (editData.mealType === "외식") {
          setSelectedPlace({ name: editData.place, address: "", category: "" })
        } else if (editData.mealType === "배달") {
          setDeliveryStoreName(editData.place)
        }
      }
      // Parse time to meal time
      if (editData.time) {
        const hour = parseInt(editData.time.split(":")[0])
        if (hour < 11) setMealTime("아침")
        else if (hour < 15) setMealTime("점심")
        else setMealTime("저녁")
      }
    } else if (!editData && !initialUrl) {
      // Reset form when opening fresh
      setDate("")
      setMemo("")
      setDateOption("")
      setMealTime("")
      setRecipeUrl("")
      setUrlPreview(null)

      if (prefillData) {
        // 맛톡 담기 — 메뉴명/식사유형/장소 자동 채움
        setMenuName(prefillData.menuName)
        setMealType(prefillData.mealType)
        if (prefillData.placeName) {
          if (prefillData.mealType === "외식") {
            setSelectedPlace({ name: prefillData.placeName, address: "", category: "" })
          } else if (prefillData.mealType === "배달") {
            setDeliveryStoreName(prefillData.placeName)
          }
        } else {
          setSelectedPlace(null)
          setDeliveryStoreName("")
        }
      } else {
        setMenuName("")
        setMealType("")
        setSelectedPlace(null)
        setDeliveryStoreName("")
      }
    }
  }, [editData, isOpen, initialUrl, prefillData])

  // URL 유효성 검사 함수
  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return url.startsWith("http://") || url.startsWith("https://")
    } catch {
      return false
    }
  }

  // URL 미리보기 가져오기 함수
  const fetchUrlPreview = (url: string) => {
    if (!url || !isValidUrl(url)) {
      setUrlPreview(null)
      return
    }

    setUrlPreview({
      thumbnail: "",
      aiSuggestedName: "",
      url: url,
      isLoading: true
    })
    
    // Simulate AI processing (실제로는 API 호출)
    setTimeout(() => {
      let suggestedName = "맛있는 음식"
      let thumbnail = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
      
      if (url.includes("youtube")) {
        suggestedName = "유튜브 레시피 - 집에서 만드는 파스타"
        thumbnail = "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop"
      } else if (url.includes("instagram")) {
        suggestedName = "인스타 맛집 - 청담동 오마카세"
        thumbnail = "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop"
      } else if (url.includes("naver") || url.includes("place")) {
        suggestedName = "네이버 플레이스 - 강남 스시 오마카세"
        thumbnail = "https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&h=300&fit=crop"
      } else if (url.includes("blog")) {
        suggestedName = "블로그 레시피 - 매콤 닭볶음탕"
        thumbnail = "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop"
      } else if (url.includes("baemin") || url.includes("coupang") || url.includes("yogiyo")) {
        suggestedName = "배달앱 - BHC 뿌링클"
        thumbnail = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop"
      }
      
      setUrlPreview({
        thumbnail,
        aiSuggestedName: suggestedName,
        url: url,
        isLoading: false
      })
      setMenuName(suggestedName)
    }, 1200)
  }

  // URL 입력 디바운스 처리
  useEffect(() => {
    const timer = setTimeout(() => {
      if (recipeUrl && isValidUrl(recipeUrl)) {
        fetchUrlPreview(recipeUrl)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [recipeUrl])

  // initialUrl이 있을 때 처리
  useEffect(() => {
    if (initialUrl && isOpen) {
      setRecipeUrl(initialUrl)
      fetchUrlPreview(initialUrl)
    }
  }, [initialUrl, isOpen])

  const filteredPlaces = samplePlaces.filter(place => 
    place.name.toLowerCase().includes(placeSearchQuery.toLowerCase()) ||
    place.address.toLowerCase().includes(placeSearchQuery.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open")
    } else {
      document.body.classList.remove("modal-open")
    }
    return () => {
      document.body.classList.remove("modal-open")
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleInteraction = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('openLoginModal'))
    }
  }


const handleSubmit = () => {
    if (editData?.id === 1 || editData?.id === 2 || editData?.id === 3) {
      toast("샘플이라 수정이 되지 않습니다.", {
        icon: "💡",
        duration: 3000
      })
      return
    }
    const resolvedMealType = (mealType || editData?.mealType || "집밥") as "집밥" | "배달" | "외식"
    const resolvedPlace =
      resolvedMealType === "외식"
        ? selectedPlace?.name || editData?.place || null
        : resolvedMealType === "배달"
          ? deliveryStoreName || editData?.place || null
          : null

    const payload: EditData = {
      id: editData?.id ?? Date.now(),
      date: date || editData?.date || new Date().toISOString().split("T")[0],
      menu: menuName || urlPreview?.aiSuggestedName || editData?.menu || "메뉴 미정",
      mealType: resolvedMealType,
      place: resolvedPlace,
      memo,
      time: mealTime || editData?.time || "",
      thumbnail: urlPreview?.thumbnail || editData?.thumbnail || undefined,
    }

    onSave?.(payload)
    onClose()
  }

  const openDatePicker = () => {
    const inputEl = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
    if (!inputEl) return

    if (inputEl.showPicker) {
      inputEl.showPicker()
      return
    }

    inputEl.focus()
    inputEl.click()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-orange-50/60 rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.15)] border border-white overflow-hidden max-h-[calc(100vh-180px)] overflow-y-auto hide-scrollbar mt-12">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 z-10 size-9 flex items-center justify-center rounded-full bg-white/50 hover:bg-white text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
              {isEditMode ? "식사 예약 수정" : "나의 식사 예약"}
            </h2>
          </div>

          {/* Form Fields */}
          <div className="space-y-5" onClickCapture={handleInteraction}>
            {/* Meal Type - 유형 선택 (가장 위) */}
            <div className="flex flex-col gap-3">
              
              <div className="grid grid-cols-3 gap-2">
                {mealTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        setMealType(mealType === type.id ? "" : type.id)
                        if (type.id !== "외식") setSelectedPlace(null)
                        if (type.id !== "배달") {
                          setDeliveryStoreName("")
                        }
                      }}
                      className={cn(
                        "py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                        mealType === type.id
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-300/40"
                          : "bg-white border-2 border-gray-100 text-foreground hover:border-orange-300"
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="text-xs">{type.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* URL 입력 + AI 메뉴 추출 (집밥/배달/외식 공통) */}
              {mealType && (
                <div className="mt-2 flex flex-col gap-3">
                  <div className="relative">
                    <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-orange-500" />
                    <input
                      className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/50"
                      placeholder={
                        mealType === "집밥"
                          ? "레시피 URL 입력 (예: https://youtube.com/...)"
                          : mealType === "외식"
                            ? "장소 URL 입력 (예: https://naver.me/...)"
                            : "배달 URL 입력 (예: 배달앱/리뷰 링크)"
                      }
                      type="url"
                      value={recipeUrl}
                      onChange={(e) => setRecipeUrl(e.target.value)}
                    />
                  </div>

                  {recipeUrl &&
                    (urlPreview?.isLoading ? (
                      <div className="bg-white rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="size-16 rounded-xl bg-muted animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 text-orange-500">
                              <Loader2 className="size-4 animate-spin" />
                              <span className="text-sm font-bold">AI가 메뉴명을 분석 중...</span>
                            </div>
                            <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      urlPreview && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="relative h-36 bg-muted">
                            <img
                              src={urlPreview.thumbnail || "/placeholder.svg"}
                              alt="URL preview"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute left-3 top-3 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-medium truncate max-w-[220px]">
                              {urlPreview.url}
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            <label className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Sparkles className="size-4 text-orange-500" />
                              AI 메뉴명 추천
                            </label>
                            <input
                              type="text"
                              value={menuName}
                              onChange={(e) => setMenuName(e.target.value)}
                              className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold text-foreground focus:border-orange-500 focus:bg-white outline-none transition-all"
                              placeholder="AI가 추출한 메뉴명 (수정 가능)"
                            />
                          </div>
                        </div>
                      )
                    ))}

                  {(!recipeUrl || !urlPreview) && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                      <label className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="size-4 text-orange-500" />
                        AI 메뉴명 추천
                      </label>
                      <input
                        type="text"
                        value={menuName}
                        onChange={(e) => setMenuName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold text-foreground focus:border-orange-500 focus:bg-white outline-none transition-all"
                        placeholder="URL 입력 후 추출되며, 직접 수정 가능"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Memo - 한줄메모 (유형 선택 바로 아래) */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground">한줄메모 <span className="text-xs text-muted-foreground font-normal">(선택)</span></label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/50"
                placeholder="특별한 날? 누구와 함께?"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>

            {/* Date - 날짜 (대략적 선택 탭 + 직접 선택) */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="size-4 text-orange-500" />
                날짜
              </label>
              <div className="grid grid-cols-4 gap-2">
                {dateOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      if (option.id === "직접선택") {
                        setDateOption(option.id)
                        openDatePicker()
                      } else {
                        setDateOption(option.id)
                        setDate(getDateFromOption(option.id))
                      }
                    }}
                    className={cn(
                      "py-3 rounded-xl text-xs font-bold transition-all",
                      dateOption === option.id
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-300/40"
                        : "bg-white border-2 border-gray-100 text-foreground hover:border-orange-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDateOption("직접선택")
                  openDatePicker()
                }}
                className="w-full px-4 py-2.5 bg-orange-50 rounded-xl flex items-center justify-between hover:bg-orange-100 transition-colors"
              >
                <span className={cn("text-sm font-medium", date ? "text-orange-500" : "text-muted-foreground")}>{date ? formatDateDisplay(date) : "날짜를 선택해 주세요"}</span>
                <span className="text-lg leading-none" aria-hidden>
                  📅
                </span>
              </button>
              <input
                ref={dateInputRef}
                className="sr-only"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setDateOption("직접선택")
                }}
              />
            </div>

            {/* Meal Time - 식사 시간 (아침/점심/저녁 탭) */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="size-4 text-orange-500" />
                식사 시간 <span className="text-xs text-muted-foreground font-normal">(선택)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {mealTimes.map((time) => {
                  const Icon = time.icon
                  return (
                    <button
                      key={time.id}
                      onClick={() => setMealTime(mealTime === time.id ? "" : time.id)}
                      className={cn(
                        "py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                        mealTime === time.id
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-300/40"
                          : "bg-white border-2 border-gray-100 text-foreground hover:border-orange-300"
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="text-xs">{time.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Place Selection (외식 only) */}
            {mealType === "외식" && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MapPin className="size-4 text-orange-500" />
                  장소 <span className="text-xs text-muted-foreground font-normal">(선택)</span>
                </label>
                {selectedPlace ? (
                  <div className="relative p-3 bg-white border-2 border-orange-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <MapPin className="size-5 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground">{selectedPlace.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{selectedPlace.address}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedPlace(null)}
                        className="size-7 rounded-lg hover:bg-muted/50 flex items-center justify-center shrink-0"
                      >
                        <X className="size-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPlaceSearch(true)}
                    className="w-full px-4 py-3.5 bg-white border-2 border-dashed border-gray-200 hover:border-orange-300 rounded-xl transition-all flex items-center gap-3 group"
                  >
                    <MapPin className="size-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                    <span className="text-sm text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">장소 검색하기</span>
                  </button>
                )}
              </div>
            )}

            {/* Delivery Info (배달 only) */}
            {mealType === "배달" && (
              <div className="flex flex-col gap-3">
                
                
              </div>
            )}

            </div>

{/* Submit Buttons */}
  <div className="mt-8 pb-8 flex gap-3">
  <button
  onClick={onClose}
  className="flex-1 flex items-center justify-center px-6 py-4 bg-white border-2 border-gray-200 text-foreground rounded-xl hover:bg-gray-50 active:scale-95 transition-all font-bold text-sm"
  >
  취소하기
  </button>
  <button
  onClickCapture={handleInteraction}
  onClick={handleSubmit}
  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-300/40 hover:bg-orange-600 hover:scale-[1.02] active:scale-95 transition-all font-bold text-sm"
  >
  
  {isEditMode ? "수정 완료" : "예약 저장하기"}
  </button>
  </div>
        </div>

        {/* Place Search Modal */}
        {showPlaceSearch && (
          <div className="absolute inset-0 z-10 flex flex-col bg-orange-50/95 rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">장소 검색</h3>
                <button 
                  onClick={() => {
                    setShowPlaceSearch(false)
                    setPlaceSearchQuery("")
                  }}
                  className="size-9 rounded-full hover:bg-muted/50 flex items-center justify-center"
                >
                  <X className="size-4 text-foreground" />
                </button>
              </div>
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={placeSearchQuery}
                  onChange={(e) => setPlaceSearchQuery(e.target.value)}
                  placeholder="식당 이름 또는 주소로 검색"
                  className="w-full pl-11 pr-4 py-3 bg-muted/50 rounded-xl text-foreground text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  autoFocus
                />
              </div>
            </div>

            {/* Current Location */}
            <button className="flex items-center gap-3 p-3 mx-4 mt-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors">
              <div className="size-9 rounded-full bg-orange-500 flex items-center justify-center">
                <Navigation className="size-4 text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-foreground">현재 위치로 검색</p>
                <p className="text-xs text-muted-foreground">GPS를 사용하여 주변 식당 찾기</p>
              </div>
            </button>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto hide-scrollbar p-4">
              {placeSearchQuery && (
                <p className="text-xs text-muted-foreground mb-3 px-1">
                  검색 결과 {filteredPlaces.length}개
                </p>
              )}
              
              <div className="flex flex-col gap-2">
                {(placeSearchQuery ? filteredPlaces : samplePlaces).map((place, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedPlace(place)
                      setShowPlaceSearch(false)
                      setPlaceSearchQuery("")
                    }}
                    className="flex items-start gap-3 p-3 bg-white rounded-xl hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="size-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <MapPin className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-foreground">{place.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-muted/50 text-muted-foreground rounded font-medium">
                        {place.category}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-2" />
                  </button>
                ))}
              </div>

              {placeSearchQuery && filteredPlaces.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Search className="size-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">검색 결과가 없습니다</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">다른 검색어로 시도해보세요</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
