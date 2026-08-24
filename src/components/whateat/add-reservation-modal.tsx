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
  Trash2,
  Youtube,
} from "lucide-react"
import { parseSourceUrls, stringifySourceUrls } from "./reservation-detail-modal"
import { cn } from "@/lib/utils"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { toast } from "react-hot-toast"




export interface EditData {
  id: string | number
  date: string
  menu: string
  mealType: "집밥" | "배달" | "외식"
  place: string | null
  memo: string
  time: string
  thumbnail?: string
  url?: string
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
  onDelete?: (id: string | number) => void
  prefillData?: ReservationPrefillData | null
  isWishlist?: boolean
  isScheduling?: boolean
  isGroupMode?: boolean
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

function generateUUID() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function AddReservationModal({ isOpen, onClose, initialUrl, editData, onSave, onDelete, prefillData, isWishlist = false, isScheduling = false, isGroupMode = false }: AddReservationModalProps) {
  // If isGroupMode, force mealType to "외식"
  useEffect(() => {
    if (isGroupMode && isOpen) {
      setMealType("외식")
    }
  }, [isGroupMode, isOpen])
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
  const [placeUrlInput, setPlaceUrlInput] = useState("")
  const [urlPreview, setUrlPreview] = useState<{
    thumbnail: string
    aiSuggestedName: string
    url: string
    isLoading: boolean
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      
      const parsedUrls = parseSourceUrls(editData.url)
      setRecipeUrl(parsedUrls.videoUrl || (!parsedUrls.placeUrl ? editData.url || "" : ""))
      setPlaceUrlInput(parsedUrls.placeUrl)
      
      if (editData.thumbnail) {
        setUrlPreview({
          thumbnail: editData.thumbnail,
          aiSuggestedName: editData.menu,
          url: editData.url || "",
          isLoading: false
        })
      } else if (parsedUrls.placeUrl && isValidUrl(parsedUrls.placeUrl)) {
        fetchUrlPreview(parsedUrls.placeUrl)
      } else if (parsedUrls.videoUrl && isValidUrl(parsedUrls.videoUrl)) {
        fetchUrlPreview(parsedUrls.videoUrl)
      } else {
        setUrlPreview(null)
      }
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
      setRecipeUrl(initialUrl ? parseSourceUrls(initialUrl).videoUrl || initialUrl : "")
      setPlaceUrlInput(initialUrl ? parseSourceUrls(initialUrl).placeUrl : "")
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
        setMealType(isGroupMode ? "외식" : "")
        setSelectedPlace(null)
        setDeliveryStoreName("")
      }
    }
  }, [editData, isOpen, initialUrl, prefillData, isGroupMode])

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
  const fetchUrlPreview = async (url: string) => {
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

    const extractMenuName = (title: string) => {
      if (!title) return "웹사이트 링크"
      
      // placePath= 등 쿼리스트링 문자열 지우기
      let clean = title.replace(/\d+\?placePath=.*$/, "").trim()
      clean = clean.split(/[-|:]/)[0].trim()
      
      // 1. 따옴표 안의 단어 추출 (예: '수육')
      const quoteMatch = clean.match(/['"‘“](.*?)['"’”]/)
      if (quoteMatch && quoteMatch[1] && quoteMatch[1].length < 15) {
        clean = quoteMatch[1]
      }
      
      // 2. 괄호 안의 내용 제거
      clean = clean.replace(/\[.*?\]|\(.*?\)/g, "").trim()
      
      // 3. 불필요한 수식어 및 기호 제거
      const stopWords = [
        "만드는 법", "만드는 방법", "삶는 방법", "삶는 법", "만들기", "레시피", "황금레시피", 
        "초간단", "간단", "진짜 맛있는", "맛있는", "비법", "알려드릴게요", "겁나불게", 
        "부드러운", "최고의", "완벽한", "실패없는", "대박", "1분", "쇼츠", "shorts", "백종원", "류수영",
        "네이버 MY플레이스", "네이버 지도", "네이버 플레이스", "네이버지도", "MY플레이스", "카카오맵", "배달의민족", "쿠팡이츠", "요기요"
      ]
      const regex = new RegExp(stopWords.join("|"), "gi")
      clean = clean.replace(regex, "").replace(/\s+/g, " ").replace(/[!?,~'"‘“’”]/g, "").trim()
      
      const fallback = title.split(/[-|:]/)[0].replace(/[!?,~'"‘“’”]/g, "").trim()
      return clean || fallback || "식당/메뉴 링크"
    }

    try {
      // 1. YouTube 링크 (Shorts, Watch, YouTu.be) 전용 oEmbed 처리 (Microlink 타임아웃/차단 방지)
      const ytMatch = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
      if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1]
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
          const ytResp = await fetch(oembedUrl)
          if (ytResp.ok) {
            const ytData = await ytResp.json()
            const rawTitle = ytData.title || ""
            const title = extractMenuName(rawTitle)
            const imageUrl = ytData.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

            setUrlPreview({
              thumbnail: imageUrl,
              aiSuggestedName: title,
              url: url,
              isLoading: false
            })
            setMenuName(title)
            return
          }
        } catch (e) {
          console.warn("YouTube oEmbed failed, falling back to direct thumbnail", e)
        }

        // oEmbed 실패 시 YouTube 직접 썸네일 제공
        setUrlPreview({
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          aiSuggestedName: "유튜브 영상 레시피",
          url: url,
          isLoading: false
        })
        setMenuName("유튜브 영상 레시피")
        return
      }

      // 2. 일반 웹페이지 & 네이버 지도 / 플레이스 링크 처리 (Microlink API)
      let response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      let result = await response.json()

      // 네이버 지도 / shortlink (naver.me) / SPA 리다이렉트 자동 감지 및 모바일 플레이스 재조회
      if (result.status === "success" && result.data) {
        const finalUrl = result.data.url || url
        const rawTitle = result.data.title || ""
        const placeIdMatch = finalUrl.match(/\/place\/(\d+)/) || url.match(/\/place\/(\d+)/)
        const isNaverMapGarbage = rawTitle.includes("placePath=") || rawTitle.includes("네이버지도") || rawTitle === "네이버 지도"

        if (placeIdMatch && (isNaverMapGarbage || finalUrl.includes("map.naver.com"))) {
          const placeId = placeIdMatch[1]
          if (placeId) {
            const placeMobileUrl = `https://m.place.naver.com/restaurant/${placeId}/home`
            const retryResp = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(placeMobileUrl)}`)
            const retryResult = await retryResp.json()
            if (retryResult.status === "success" && retryResult.data && retryResult.data.title) {
              result = retryResult
            }
          }
        }
      }

      if (result.status === "success" && result.data) {
        const rawTitle = result.data.title || "웹사이트 링크"
        const title = extractMenuName(rawTitle)
        let imageUrl = result.data.image?.url || result.data.logo?.url

        // 네이버 지도 로고 등 기본 맵 아이콘인 경우 일반 음식 썸네일로 대체
        if (!imageUrl || imageUrl.includes("static/maps") || imageUrl.includes("og-map") || imageUrl.includes("android-icon-512x512")) {
          imageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
        }

        // 네이버/카카오 지도 장소 링크인 경우 식당(장소) 이름 자동 채움
        const isPlaceUrl = url.includes("naver.me") || url.includes("map.naver.com") || url.includes("place.naver.com") || url.includes("kakao.com")
        if (isPlaceUrl && title && title !== "웹사이트 링크" && title !== "식당/메뉴 링크") {
          setSelectedPlace({ name: title, address: "네이버/카카오 지도 링크", category: "" })
        }

        setUrlPreview({
          thumbnail: imageUrl,
          aiSuggestedName: title,
          url: url,
          isLoading: false
        })
        if (!menuName || isPlaceUrl) {
          setMenuName(title)
        }
      } else {
        throw new Error("Invalid response from microlink")
      }
    } catch (err) {
      console.error("Failed to fetch URL preview:", err)
      // Fallback
      setUrlPreview({
        thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
        aiSuggestedName: "직접 입력해주세요",
        url: url,
        isLoading: false
      })
    }
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

    if ((resolvedMealType === "외식" || resolvedMealType === "배달") && !placeUrlInput) {
      toast.error("외식/배달의 경우 식당 URL을 입력해야 합니다.")
      return
    }
    if (resolvedMealType === "집밥" && placeUrlInput) {
      toast.error("집밥인 경우 식당 URL을 등록할 수 없습니다. URL을 지워주세요.")
      return
    }
    const resolvedPlace =
      resolvedMealType === "외식"
        ? selectedPlace?.name || editData?.place || null
        : resolvedMealType === "배달"
          ? deliveryStoreName || editData?.place || null
          : null

    const finalUrl = stringifySourceUrls(placeUrlInput, recipeUrl)

    const payload: EditData = {
      id: editData?.id ?? generateUUID(),
      date: isWishlist ? "" : (date || editData?.date || new Date().toISOString().split("T")[0]),
      menu: menuName || urlPreview?.aiSuggestedName || editData?.menu || "메뉴 미정",
      mealType: resolvedMealType,
      place: resolvedPlace,
      memo,
      time: mealTime || editData?.time || "",
      thumbnail: urlPreview?.thumbnail || editData?.thumbnail || undefined,
      url: finalUrl || editData?.url || undefined,
    }

    onSave?.(payload)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("whateat:reservation-updated"))
    }
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 pb-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-foreground/20 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-orange-50/95 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.2)] border border-white/80 overflow-hidden max-h-[calc(100vh-5.5rem)] overflow-y-auto hide-scrollbar my-auto">
        {/* Close Button & Delete Button in Edit Mode */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {isEditMode && editData?.id && (
            <button
              onClick={() => {
                if (editData.id === 1 || editData.id === 2 || editData.id === 3) {
                  toast("샘플이라 삭제 안 되며, 식사를 등록하면 샘플은 사라집니다.", {
                    icon: "💡",
                    duration: 3000
                  })
                  return
                }
                if (confirm("이 예약 일정을 정말 삭제하시겠습니까?")) {
                  onDelete?.(editData.id)
                  onClose()
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="size-3" />
              삭제
            </button>
          )}
          <button 
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full bg-white/60 hover:bg-white text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {/* Header */}
          <div className="mb-3">
            <h2 className="text-lg font-extrabold tracking-tight text-foreground">
              {isScheduling 
                ? "식사 예약 잡기"
                : isEditMode 
                  ? (isWishlist ? "식사 위시 수정" : "식사 예약 수정") 
                  : (isWishlist ? "식사 위시리스트 추가" : "나의 식사 예약")}
            </h2>
          </div>

          {/* Form Fields */}
          <div className="space-y-3" onClickCapture={handleInteraction}>
            {isScheduling ? (
              <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                {(urlPreview?.thumbnail || editData?.thumbnail) && (
                  <div className="relative w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0 shadow-sm border border-gray-100">
                    <img
                      src={urlPreview?.thumbnail || editData?.thumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                      alt="Thumbnail"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {mealType === "집밥" && <ChefHat className="size-3.5 text-orange-500" />}
                    {mealType === "배달" && <Bike className="size-3.5 text-orange-500" />}
                    {mealType === "외식" && <UtensilsCrossed className="size-3.5 text-orange-500" />}
                    <span className="text-xs font-bold text-orange-600">{mealType}</span>
                  </div>
                  <div className="text-sm font-extrabold text-foreground truncate">
                    {menuName || "메뉴 이름 없음"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Meal Type - 유형 선택 (가장 위) */}
                {!isGroupMode && (
                <div className="grid grid-cols-3 gap-2">
                  {mealTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        disabled={isEditMode && (editData?.mealType === "집밥" ? type.id !== "집밥" : type.id === "집밥")}
                        onClick={() => {
                          if (isEditMode && mealType === type.id) return // 수정 모드에서는 선택 해제 불가
                          setMealType(mealType === type.id ? "" : type.id)
                          if (type.id !== "외식") setSelectedPlace(null)
                          if (type.id !== "배달") {
                            setDeliveryStoreName("")
                          }
                        }}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                          mealType === type.id
                            ? "bg-orange-500 text-white shadow-md shadow-orange-300/40"
                            : "bg-white border border-gray-200 text-foreground hover:border-orange-300",
                          isEditMode && (editData?.mealType === "집밥" ? type.id !== "집밥" : type.id === "집밥") && "opacity-40 cursor-not-allowed hover:border-gray-200 bg-gray-50 text-gray-400"
                        )}
                      >
                        <Icon className="size-3.5" />
                        <span className="text-xs">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
                )}

                {/* URL 입력 + AI 메뉴 추출 (집밥/배달/외식 공통) */}
                {mealType && (
                  <div className="mt-1 flex flex-col gap-2">
                    {/* 1. 참고 영상 / 숏폼 URL */}
                    <div className="relative">
                      <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-red-500" />
                      <input
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-foreground text-xs placeholder:text-muted-foreground/50"
                        placeholder={
                          mealType === "집밥"
                            ? "🎬 참고 영상/숏폼 레시피 URL (예: https://youtube.com/shorts/...)"
                            : "🎬 참고 영상/숏폼 식당 URL (예: https://youtube.com/shorts/...)"
                        }
                        type="url"
                        value={recipeUrl}
                        onChange={(e) => setRecipeUrl(e.target.value)}
                      />
                    </div>

                    {/* 2. 장소/지도 URL (외식/배달 시) */}
                    {(mealType === "외식" || mealType === "배달") && (
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-indigo-500" />
                        <input
                          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-foreground text-xs placeholder:text-muted-foreground/50"
                          placeholder="📍 장소/지도 URL (예: https://naver.me/...)"
                          type="url"
                          value={placeUrlInput}
                          onChange={(e) => {
                            setPlaceUrlInput(e.target.value)
                            if (e.target.value && isValidUrl(e.target.value) && !recipeUrl) {
                              fetchUrlPreview(e.target.value)
                            }
                          }}
                        />
                      </div>
                    )}

                    {(recipeUrl || placeUrlInput || urlPreview || editData?.thumbnail) &&
                      (urlPreview?.isLoading ? (
                        <div className="bg-white rounded-xl p-2.5 border border-gray-200">
                          <div className="flex items-center gap-2.5">
                            <div className="size-14 rounded-lg bg-muted animate-pulse shrink-0" />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 text-orange-500">
                                <Loader2 className="size-3.5 animate-spin" />
                                <span className="text-xs font-bold">AI가 메뉴명을 분석 중...</span>
                              </div>
                              <div className="h-2.5 bg-muted rounded animate-pulse w-2/3" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        (urlPreview?.thumbnail || editData?.thumbnail) && (
                          <div className="bg-white rounded-xl border border-gray-200 p-2.5 flex items-center gap-3">
                            <div className="relative w-26 h-26 sm:w-28 sm:h-28 rounded-xl bg-muted overflow-hidden shrink-0 shadow-sm border border-gray-100">
                              <img
                                src={urlPreview?.thumbnail || editData?.thumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                                alt="URL preview"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                                <Sparkles className="size-3.5 text-orange-500" />
                                AI 메뉴명 추천
                              </label>
                              <input
                                type="text"
                                value={menuName}
                                onChange={(e) => setMenuName(e.target.value)}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-foreground focus:border-orange-500 focus:bg-white outline-none transition-all"
                                placeholder="AI가 추출한 메뉴명 (수정 가능)"
                              />
                            </div>
                          </div>
                        )
                      ))}

                    {(!recipeUrl && !placeUrlInput && !urlPreview?.thumbnail && !editData?.thumbnail) && (
                      <div className="bg-white rounded-xl border border-gray-200 p-2.5 space-y-1">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-orange-500" />
                          AI 메뉴명 추천
                        </label>
                        <input
                          type="text"
                          value={menuName}
                          onChange={(e) => setMenuName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-transparent rounded-lg text-xs font-bold text-foreground focus:border-orange-500 focus:bg-white outline-none transition-all"
                          placeholder="URL 입력 후 추출되며, 직접 수정 가능"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Memo - 한줄메모 */}
            {!isScheduling && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-foreground">한줄메모 <span className="text-[10px] text-muted-foreground font-normal">(선택)</span></label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-foreground text-xs placeholder:text-muted-foreground/50"
                  placeholder="특별한 날? 누구와 함께?"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            )}

            {/* Date & Meal Time Grid (Side-by-side or Compact vertical) */}
            <div className={cn("grid gap-3 pt-1", isWishlist ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
              {/* Date - 날짜 */}
              {!isWishlist && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-orange-500" />
                    날짜
                  </label>
                  <div className="grid grid-cols-4 gap-1">
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
                          "py-1.5 rounded-lg text-[10px] font-bold transition-all truncate",
                          dateOption === option.id
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-white border border-gray-200 text-foreground hover:border-orange-300"
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
                    className="w-full px-3 py-1.5 bg-orange-50/90 border border-orange-200/60 rounded-lg flex items-center justify-between hover:bg-orange-100 transition-colors"
                  >
                    <span className={cn("text-xs font-bold", date ? "text-orange-600" : "text-muted-foreground")}>{date ? formatDateDisplay(date) : "날짜 선택"}</span>
                    <span className="text-sm leading-none" aria-hidden>
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
              )}

              {/* Meal Time - 식사 시간 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-orange-500" />
                  식사 시간 <span className="text-[10px] text-muted-foreground font-normal">(선택)</span>
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {mealTimes.map((time) => {
                    const Icon = time.icon
                    return (
                      <button
                        key={time.id}
                        onClick={() => setMealTime(mealTime === time.id ? "" : time.id)}
                        className={cn(
                          "py-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1",
                          mealTime === time.id
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-white border border-gray-200 text-foreground hover:border-orange-300"
                        )}
                      >
                        <Icon className="size-3" />
                        <span>{time.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="mt-4 pt-2 flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-white border border-gray-200 text-foreground rounded-xl hover:bg-gray-50 active:scale-95 transition-all font-bold text-xs"
            >
              취소하기
            </button>
            <button
              onClickCapture={handleInteraction}
              onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-300/40 hover:bg-orange-600 hover:scale-[1.02] active:scale-95 transition-all font-bold text-xs"
            >
              {isEditMode ? "수정 완료" : (isWishlist ? "위시리스트 추가" : "예약 저장하기")}
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
