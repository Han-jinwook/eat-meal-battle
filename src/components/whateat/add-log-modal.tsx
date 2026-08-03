"use client"

import { useState, useEffect, useRef } from "react"
import {
  X,
  Camera,
  Sparkles,
  CalendarDays,
  UtensilsCrossed,
  ChefHat,
  Bike,
  Link,
  MapPin,
  Navigation,
  Loader2,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { toast } from "react-hot-toast"
import exifr from "exifr"


export interface MealLogData {
  id?: string | number
  date?: string
  mealType: "집밥" | "배달" | "외식"
  menuName: string
  image?: string
  place?: {
    name: string
    address: string
    category: string
    distance?: string
    dong?: string
    lastOrderedAt?: string
  }
  deliveryStoreName?: string
  recipe?: string
  recipeType?: "url" | "manual"
  rating?: number
  description?: string
  linkUrl?: string
  linkThumbnail?: string
}

interface AddLogModalProps {
  isOpen: boolean
  onClose: () => void
  editData?: MealLogData | null
  onSave?: (data: MealLogData) => void
  onDelete?: (id: number) => void
  mode?: "solo" | "family"
  registeredDeliveryStores?: SelectedPlace[]
}

type MealType = "집밥" | "배달" | "외식"
type RecipeInputType = "url" | "manual"

interface SelectedPlace {
  name: string
  address: string
  category: string
  distance?: string
  dong?: string
  lastOrderedAt?: string
  isSample?: boolean
}

export function AddLogModal({ isOpen, onClose, editData, onSave, onDelete, mode = "solo", registeredDeliveryStores = [] }: AddLogModalProps) {
  const { isLoggedIn } = useHub()
  const [mealType, setMealType] = useState<MealType>("집밥")

  const [date, setDate] = useState("")
  const [menuName, setMenuName] = useState("")
  const [recipeInputType, setRecipeInputType] = useState<RecipeInputType>("url")
  const [recipeContent, setRecipeContent] = useState("")
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [deliveryStoreName, setDeliveryStoreName] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [linkThumbnail, setLinkThumbnail] = useState("")
  const [visiblePlacesCount, setVisiblePlacesCount] = useState(10)
  const [isCrawlingLink, setIsCrawlingLink] = useState(false)
  const [linkBrand, setLinkBrand] = useState<"naver" | "kakao" | "google">("naver")
  const [recipeTitle, setRecipeTitle] = useState("")
  const [recipeThumbnail, setRecipeThumbnail] = useState("")
  const [recipeBrand, setRecipeBrand] = useState<"youtube" | "instagram" | "tiktok" | "generic">("generic")
  const [isCrawlingRecipe, setIsCrawlingRecipe] = useState(false)
  const [lastCrawledUrl, setLastCrawledUrl] = useState("")
  const [lastCrawledRecipeUrl, setLastCrawledRecipeUrl] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string>("")
  const [photoGps, setPhotoGps] = useState<{lat: number, lng: number} | null>(null)
  const [nearbyPlaces, setNearbyPlaces] = useState<SelectedPlace[]>([])

  const isEditMode = !!editData

  // 배달용 주변 식당 데이터 (집 주소 GPS 기반)
  const [nearbyDeliveryStores, setNearbyDeliveryStores] = useState<SelectedPlace[]>([])
  const [deliverySearchQuery, setDeliverySearchQuery] = useState("")
  const [placeSearchQuery, setPlaceSearchQuery] = useState("")
  const dateInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ""
    const parsed = new Date(dateStr)
    if (Number.isNaN(parsed.getTime())) return ""
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일 (${weekdays[parsed.getDay()]})`
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

  // GPS 위치 기반 주변 장소 로드 함수 (외식용)
  const loadGpsNearbyPlaces = (paramLat?: number, paramLng?: number, keyword?: string) => {
    const fetchPlaces = async (lat: number, lng: number, kw?: string) => {
      try {
        const queryParams = new URLSearchParams({ lat: String(lat), lng: String(lng) })
        if (kw) queryParams.append('keyword', kw)
        const res = await fetch(`/api/nearby-places?${queryParams.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setNearbyPlaces(data.places || [])
          setVisiblePlacesCount(10)
          if (data.places?.length === 0) {
            setLocationError("해당 위치(GPS) 주변에 식당 정보가 없습니다.")
          }
        } else {
          setLocationError("서버에서 주변 장소를 가져오지 못했습니다.")
        }
      } catch (err) {
        console.error("Failed to load GPS nearby places:", err)
        setLocationError("주변 장소 검색 중 오류가 발생했습니다.")
      } finally {
        setIsLoadingLocation(false)
      }
    }

    setLocationError("")
    setIsLoadingLocation(true)

    // 1. 사진 EXIF 등 명시적 좌표가 있으면 브라우저 GPS 생략
    if (paramLat !== undefined && paramLng !== undefined) {
      fetchPlaces(paramLat, paramLng, keyword)
      return
    }

    // 2. 명시적 좌표가 없으면 브라우저 현재 위치 사용 (폴백)
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.")
      setLocationError("이 브라우저에서는 위치 기능을 지원하지 않습니다.")
      setIsLoadingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchPlaces(position.coords.latitude, position.coords.longitude, keyword)
      },
      (error) => {
        console.error("Geolocation error:", error)
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("위치 권한이 차단되었습니다. 브라우저 설정에서 허용해주세요.")
        } else {
          setLocationError("위치를 가져올 수 없습니다. (PC 등에서는 제한될 수 있음)")
        }
        setIsLoadingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // GPS 위치 기반 주변 장소 로드 (외식 또는 배달 선택 시)
  useEffect(() => {
    if ((mealType === "외식" || mealType === "배달") && isOpen) {
      if (mealType === "외식") {
        loadGpsNearbyPlaces(photoGps?.lat, photoGps?.lng)
      } else if (mealType === "배달") {
        setIsLoadingLocation(true)
        const timer = setTimeout(() => {
          if (registeredDeliveryStores && registeredDeliveryStores.length > 0) {
            setNearbyDeliveryStores(registeredDeliveryStores)
          } else {
            setNearbyDeliveryStores([
              { 
                name: "BHC치킨 강남점", 
                address: "서울 강남구 역삼동 111-22", 
                category: "치킨", 
                dong: "역삼동", 
                lastOrderedAt: "6월 28일",
                isSample: true 
              }
            ])
          }
          setIsLoadingLocation(false)
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [mealType, isOpen, registeredDeliveryStores])

  // 배달 식당 필터링
  const filteredDeliveryStores = (() => {
    const filtered = nearbyDeliveryStores.filter(store =>
      store.name.toLowerCase().includes(deliverySearchQuery.toLowerCase()) ||
      store.category.toLowerCase().includes(deliverySearchQuery.toLowerCase())
    )

    if (deliverySearchQuery.trim() !== "" && filtered.length === 0) {
      const query = deliverySearchQuery.trim()
      return [
        {
          name: `${query} 역삼본점`,
          address: "서울 강남구 역삼동 736-24",
          category: "배달음식",
          dong: "역삼동",
          lastOrderedAt: "최근"
        },
        {
          name: `착한 ${query} 강남역점`,
          address: "서울 강남구 역삼동 820-15",
          category: "배달음식",
          dong: "역삼동",
          lastOrderedAt: "최근"
        },
        {
          name: `${query}에 반하다 역삼점`,
          address: "서울 강남구 역삼동 642-3",
          category: "배달음식",
          dong: "역삼동",
          lastOrderedAt: "최근"
        }
      ]
    }
    return filtered
  })()

  // 외식 장소 필터링
  const filteredPlaces = (() => {
    const filtered = nearbyPlaces.filter(place =>
      place.name.toLowerCase().includes(placeSearchQuery.toLowerCase()) ||
      place.category.toLowerCase().includes(placeSearchQuery.toLowerCase()) ||
      place.address.toLowerCase().includes(placeSearchQuery.toLowerCase())
    )

    return filtered
  })()

  // editData가 변경되면 폼 초기화
  useEffect(() => {
    if (editData) {
      setMealType(editData.mealType)
      setDate(editData.date || new Date().toISOString().split("T")[0])
      setMenuName(editData.menuName)
      setSelectedPlace(editData.place || null)
      setDeliveryStoreName(editData.deliveryStoreName || "")
      const rContent = editData.recipe || ""
      setRecipeContent(rContent)
      
      const derivedType = editData.recipeType || (rContent && !rContent.trim().startsWith("http") ? "manual" : "url")
      setRecipeInputType(derivedType)
      
      setRecipeThumbnail(editData.linkThumbnail || "")
      setRecipeTitle(editData.place?.name || "레시피 정보")
      
      let brand: "youtube" | "instagram" | "tiktok" | "generic" = "generic"
      if (rContent.includes("youtube.com") || rContent.includes("youtu.be")) brand = "youtube"
      else if (rContent.includes("instagram.com")) brand = "instagram"
      else if (rContent.includes("tiktok.com")) brand = "tiktok"
      setRecipeBrand(brand)

      setLinkUrl(editData.linkUrl || "")
      setLinkThumbnail(editData.linkThumbnail || "")
      setLastCrawledUrl(editData.linkUrl || "")
      setLastCrawledRecipeUrl(derivedType === "url" ? rContent : "")
      setImagePreview(editData.image || null)
    } else {
      // 새 기록 모드일 때 초기화
      setMealType("집밥")
      setDate(new Date().toISOString().split("T")[0])
      setMenuName("")
      setSelectedPlace(null)
      setDeliveryStoreName("")
      setRecipeContent("")
      setRecipeInputType("url")
      setRecipeTitle("")
      setRecipeThumbnail("")
      setRecipeBrand("generic")
      setLinkUrl("")
      setLinkThumbnail("")
      setLastCrawledUrl("")
      setLastCrawledRecipeUrl("")
      setImagePreview(null)
    }
  }, [editData, isOpen])

  // 지도/식당 링크 감지 시 크롤링 수행
  useEffect(() => {
    if (!linkUrl) return

    const trimmedLink = linkUrl.trim()
    if (!trimmedLink.startsWith("http")) return

    // naver, kakao, google 지도 링크 감지
    const isNaverPlace = trimmedLink.includes("naver.me") || trimmedLink.includes("naver.com")
    const isKakaoPlace = trimmedLink.includes("kko.to") || trimmedLink.includes("kakao.com")
    const isGooglePlace = trimmedLink.includes("google.com") || trimmedLink.includes("google.co.kr") || trimmedLink.includes("goo.gl")
    
    if (!isNaverPlace && !isKakaoPlace && !isGooglePlace) return

    // 중복 요청 방지 (마지막으로 크롤링에 성공한 URL과 같다면 생략)
    if (trimmedLink === lastCrawledUrl) return

    let isMounted = true
    setIsCrawlingLink(true)

    const fetchMeta = async () => {
      try {
        const response = await fetch(`/api/naver-place-meta?url=${encodeURIComponent(trimmedLink)}`)
        if (!response.ok) throw new Error("Failed to fetch meta")
        
        const data = await response.json()
        if (!isMounted) return

        if (data.title) {
          setLinkThumbnail(data.image || "")
          setLinkBrand(data.brand || "naver")
          setLastCrawledUrl(trimmedLink)
          
          let platformName = "N플레이스"
          if (data.brand === "kakao") platformName = "카카오맵"
          else if (data.brand === "google") platformName = "구글 지도"

          if (mealType === "배달") {
            setDeliveryStoreName(data.title)
            setSelectedPlace({
              name: data.title,
              address: data.address || "",
              category: "음식점"
            })
          } else if (mealType === "외식") {
            setSelectedPlace({
              name: data.title,
              address: data.address || "",
              category: "음식점"
            })
            setDeliveryStoreName("")
          }
        }
      } catch (err) {
        console.error("Map Link Crawling failed:", err)
      } finally {
        if (isMounted) {
          setIsCrawlingLink(false)
        }
      }
    }

    fetchMeta()

    return () => {
      isMounted = false
    }
  }, [linkUrl, mealType])

  // 레시피 링크 감지 시 크롤링 수행
  useEffect(() => {
    if (mealType !== "집밥" || recipeInputType !== "url" || !recipeContent) return

    const trimmedLink = recipeContent.trim()
    if (!trimmedLink.startsWith("http")) return

    // 중복 요청 방지 (마지막으로 크롤링에 성공한 URL과 같다면 생략)
    if (trimmedLink === lastCrawledRecipeUrl) return

    let isMounted = true
    setIsCrawlingRecipe(true)

    const fetchRecipeMeta = async () => {
      try {
        const response = await fetch(`/api/naver-place-meta?url=${encodeURIComponent(trimmedLink)}`)
        if (!response.ok) throw new Error("Failed to fetch recipe meta")
        
        const data = await response.json()
        if (!isMounted) return

        if (data.title) {
          setRecipeTitle(data.title)
          setRecipeThumbnail(data.image || "")
          setRecipeBrand(data.brand || "generic")
          setLastCrawledRecipeUrl(trimmedLink)
        }
      } catch (err) {
        console.error("Recipe Link Crawling failed:", err)
      } finally {
        if (isMounted) {
          setIsCrawlingRecipe(false)
        }
      }
    }

    fetchRecipeMeta()

    return () => {
      isMounted = false
    }
  }, [recipeContent, recipeInputType, mealType])

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1024
          const MAX_HEIGHT = 1024
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/webp', 0.75))
        }
        img.onerror = (error) => reject(error)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setImagePreview(url)
      
      // 1. 사진에서 EXIF GPS 추출
      let photoLat: number | undefined
      let photoLng: number | undefined
      try {
        const gps = await exifr.gps(file)
        if (gps && gps.latitude && gps.longitude) {
          setPhotoGps({ lat: gps.latitude, lng: gps.longitude })
          photoLat = gps.latitude
          photoLng = gps.longitude
        } else {
          setPhotoGps(null)
        }
      } catch (err) {
        console.warn("Failed to extract EXIF:", err)
        setPhotoGps(null)
      }

      // 2. 외식일 경우 좌표를 기반으로 식당 로드
      if (mealType === "외식") {
        loadGpsNearbyPlaces(photoLat, photoLng)
      }

      setIsAnalyzingAi(true)
      try {
        const compressedBase64 = await compressImage(file)
        setImagePreview(compressedBase64)
        const response = await fetch('/api/ai/analyze-food-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compressedBase64 })
        })
        const data = await response.json()
        if (data.menuName) {
          setMenuName(data.menuName)
          // AI 분석 결과(메뉴명)가 나오면, 외식일 경우 해당 메뉴명으로 장소를 다시 검색합니다.
          if (mealType === "외식") {
            loadGpsNearbyPlaces(photoLat, photoLng, data.menuName)
          }
        }
      } catch (error) {
        console.error("AI Analysis failed:", error)
      } finally {
        setIsAnalyzingAi(false)
      }
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open")
    } else {
      document.body.classList.remove("modal-open")
      setNearbyPlaces([])
      setNearbyDeliveryStores([])
      setPhotoGps(null)
      setLocationError("")
      setIsLoadingLocation(true)
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


  const mealTypes = [
    { id: "집밥" as MealType, label: "집밥", icon: ChefHat },
    { id: "배달" as MealType, label: "배달", icon: Bike },
    { id: "외식" as MealType, label: "외식", icon: UtensilsCrossed },
  ]

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
        <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-2">
          {isEditMode && editData?.id && (
            <button
              onClick={() => {
                if (editData.id === 1 || editData.id === 2 || editData.id === 3) {
                  onDelete?.(editData.id)
                  return
                }
                if (confirm("이 식사 기록을 정말 삭제하시겠습니까?")) {
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
            className="size-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-foreground transition-colors shadow-xs"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {/* Header */}
          <div className="mb-2.5">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-foreground">
              {mode === "family"
                ? (isEditMode ? "(패밀리) 먹로그 수정하기" : "(패밀리) 먹로그 기록하기")
                : (isEditMode ? "(솔로) 먹로그 수정하기" : "(솔로) 먹로그 기록하기")
              }
            </h2>
          </div>

          {/* Form Fields */}
          <div className="space-y-2.5" onClickCapture={handleInteraction}>
            {/* 1. Meal Type & Date (Side-by-side) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-foreground">식사 유형</label>
                <div className="grid grid-cols-3 gap-1">
                  {mealTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setMealType(type.id)
                        if (type.id !== "외식" && type.id !== "배달") {
                          setSelectedPlace(null)
                        }
                        if (type.id !== "배달") {
                          setDeliveryStoreName("")
                        }
                      }}
                      className={cn(
                        "py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1",
                        mealType === type.id
                          ? "bg-orange-500 text-white shadow-md shadow-orange-300/40"
                          : "bg-white border border-gray-200 text-foreground hover:border-orange-300"
                      )}
                    >
                      {type.icon && <type.icon className="size-3.5" />}
                      <span className="text-[11px]">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-orange-500" />
                  날짜
                </label>
                <button
                  type="button"
                  onClick={openDatePicker}
                  className="w-full px-3 py-1.5 bg-orange-50/90 border border-orange-200/60 rounded-xl flex items-center justify-between hover:bg-orange-100 transition-colors"
                >
                  <span className={cn("text-xs font-bold", date ? "text-orange-600" : "text-muted-foreground")}>
                    {date ? formatDateDisplay(date) : "날짜 선택"}
                  </span>
                  <span className="text-sm leading-none" aria-hidden>
                    📅
                  </span>
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="sr-only"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* 2. Image Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-foreground">사진</label>
              <div 
                className="relative group cursor-pointer h-36 sm:h-40 w-full rounded-xl border-2 border-dashed border-gray-200 bg-white flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-orange-50/30 transition-all overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <Camera className="size-8 text-white" />
                      <p className="text-xs font-medium text-white">사진 변경하기</p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="size-8 text-muted-foreground/50 group-hover:text-orange-500 transition-colors" />
                    <p className="text-xs font-medium text-muted-foreground text-center px-4">
                      {mealType === "외식" 
                        ? "식당에서 찍은 음식 사진을 추가해주세요" 
                        : "음식 사진을 추가해주세요"}
                    </p>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageChange}
              />
            </div>

            {/* 3. Menu Name with AI */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                {isAnalyzingAi ? (
                  <Loader2 className="size-4 text-orange-500 animate-spin" />
                ) : (
                  <Sparkles className="size-4 text-orange-500" />
                )}
                AI 메뉴명 추천
                <span className="text-xs text-muted-foreground font-normal">(사진 기반)</span>
              </label>
              <div className="relative">
                {isAnalyzingAi && (
                  <div className="absolute inset-0 z-10 flex items-center px-4 bg-gray-50/80 rounded-xl border-2 border-gray-100">
                    <span className="text-sm font-bold text-orange-500 animate-pulse">AI가 사진을 분석하고 있어요...</span>
                  </div>
                )}
                <input
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/50"
                  placeholder="사진을 추가하면 AI가 메뉴를 입력해요"
                  type="text"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                />
              </div>
            </div>

            {/* 배달: GPS 기반 식당 선택 */}
            {mealType === "배달" && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Navigation className="size-4 text-orange-500" />
                  식당 선택
                  <span className="text-xs text-muted-foreground font-normal">(배달 히스토리)</span>
                </label>
                
                {deliveryStoreName ? (
                  <div className="relative p-4 bg-white border-2 border-gray-100 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <Bike className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground">{deliveryStoreName}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">배달 주문</p>
                      </div>
                      <button 
                        onClick={() => {
                          setDeliveryStoreName("")
                          setSelectedPlace(null)
                          setDeliverySearchQuery("")
                        }}
                        className="size-7 rounded-lg hover:bg-muted/50 flex items-center justify-center shrink-0"
                      >
                        <X className="size-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ) : (isLoadingLocation || isCrawlingLink || isAnalyzingAi) ? (
                  <div className="p-6 bg-white border-2 border-gray-100 rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground">
                        {isCrawlingLink ? "링크 정보를 분석하고 있어요..." : 
                         isAnalyzingAi ? "음식 사진을 분석하고 있어요..." : 
                         "배달 히스토리 식당을 불러오고 있어요..."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-gray-100 rounded-xl overflow-hidden">
                    {/* 검색 입력 */}
                    <div className="p-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={deliverySearchQuery}
                        onChange={(e) => setDeliverySearchQuery(e.target.value)}
                        placeholder="식당명 또는 음식 종류로 검색"
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                      />
                    </div>
                    {deliverySearchQuery && (
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          검색 결과 {filteredDeliveryStores.length}개
                        </p>
                      </div>
                    )}
                    <div>
                      {filteredDeliveryStores.length > 0 ? (
                        filteredDeliveryStores.map((store, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedPlace({
                                name: store.name,
                                address: store.address || "",
                                category: store.category
                              })
                              setDeliveryStoreName(store.name)
                              setDeliverySearchQuery("")
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-orange-50/50 transition-colors text-left border-b border-gray-50 last:border-0 relative"
                          >
                            <div className="size-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                              <Bike className="size-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-xs text-foreground truncate">{store.name}</h4>
                              <p className="text-[10px] text-muted-foreground truncate">{store.category}</p>
                            </div>
                            {store.isSample && (
                              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold shadow-sm pointer-events-none tracking-widest">
                                샘플
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                              {store.isSample ? "가상 주문" : `${store.dong} | ${store.lastOrderedAt}`}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-xs text-muted-foreground">검색 결과가 없어요</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 외식: GPS 기반 장소 추천 */}
            {mealType === "외식" && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Navigation className="size-4 text-orange-500" />
                  장소 추가
                  <span className="text-xs text-muted-foreground font-normal">(GPS 기반)</span>
                </label>
                
                {selectedPlace ? (
                  <div className="relative p-4 bg-white border-2 border-gray-100 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <MapPin className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground">{selectedPlace.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedPlace.address}</p>
                        {selectedPlace.distance && (
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-orange-50 text-primary rounded-full font-bold">
                            {selectedPlace.distance}
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => setSelectedPlace(null)}
                        className="size-7 rounded-lg hover:bg-muted/50 flex items-center justify-center shrink-0"
                      >
                        <X className="size-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ) : (isLoadingLocation || isCrawlingLink || isAnalyzingAi) ? (
                  <div className="p-6 bg-white border-2 border-gray-100 rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground">
                        {isCrawlingLink ? "링크 정보를 분석하고 있어요..." : 
                         isAnalyzingAi ? "음식 사진을 분석하고 있어요..." : 
                         "현재 위치를 찾고 있어요..."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-gray-100 rounded-xl overflow-hidden">
                    {/* 검색 입력 - 상단 배치 */}
                    <div className="p-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={placeSearchQuery}
                        onChange={(e) => setPlaceSearchQuery(e.target.value)}
                        placeholder="식당명 검색 또는 직접 입력"
                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && placeSearchQuery.trim() && filteredPlaces.length === 0) {
                            setSelectedPlace({
                              name: placeSearchQuery.trim(),
                              address: "직접 입력",
                              category: "기타"
                            })
                            setPlaceSearchQuery("")
                          }
                        }}
                      />
                    </div>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {placeSearchQuery ? `검색 결과 ${filteredPlaces.length}개` : "주변 장소"}
                      </p>
                    </div>
                    <div>
                      {filteredPlaces.length > 0 ? (
                        <>
                          {filteredPlaces.slice(0, visiblePlacesCount).map((place, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedPlace(place)
                                setPlaceSearchQuery("")
                                if (place.link) {
                                  setLinkUrl(place.link)
                                }
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-orange-50/50 transition-colors text-left border-b border-gray-50 last:border-0"
                            >
                              <div className="size-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                                <MapPin className="size-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-xs text-foreground truncate">{place.name}</h4>
                                <p className="text-[10px] text-muted-foreground truncate">{place.address}</p>
                              </div>
                              {place.distance && <span className="text-[10px] text-primary font-bold shrink-0">{place.distance}</span>}
                            </button>
                          ))}
                          {visiblePlacesCount < filteredPlaces.length && (
                            <button
                              onClick={() => setVisiblePlacesCount(prev => prev + 10)}
                              className="w-full p-3 text-xs text-primary font-bold hover:bg-orange-50/50 transition-colors text-center"
                            >
                              검색 결과 더보기 ({filteredPlaces.length - visiblePlacesCount}개)
                            </button>
                          )}
                        </>
                      ) : placeSearchQuery ? (
                        <button
                          onClick={() => {
                            setSelectedPlace({
                              name: placeSearchQuery.trim(),
                              address: "직접 입력",
                              category: "기타"
                            })
                            setPlaceSearchQuery("")
                          }}
                          className="w-full p-4 text-left hover:bg-orange-50/50 transition-colors"
                        >
                          <p className="text-xs text-foreground font-bold">"{placeSearchQuery}" 직접 추가하기</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">목록에 없는 식당을 직접 입력해요</p>
                        </button>
                      ) : (
                        <div className="p-4 text-center flex flex-col items-center justify-center gap-1">
                          <p className="text-xs text-muted-foreground">{locationError || "주변 장소가 없어요"}</p>
                          {locationError && (
                            <button onClick={() => loadGpsNearbyPlaces(photoGps?.lat, photoGps?.lng)} className="text-[10px] text-orange-500 hover:underline mt-1">
                              다시 시도하기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Recipe Input - 집밥일 경우에만 */}
            {mealType === "집밥" && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Link className="size-4 text-orange-500" />
                  레시피 <span className="text-xs text-muted-foreground font-normal">(선택)</span>
                </label>
                <div className="flex gap-2 mb-1">
                  <button
                    onClick={() => setRecipeInputType("url")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                      recipeInputType === "url"
                        ? "bg-orange-500 text-white shadow-md shadow-orange-300/40"
                        : "bg-white border-2 border-gray-100 text-foreground hover:border-orange-300"
                    )}
                  >
                    URL 첨부
                  </button>
                  <button
                    onClick={() => setRecipeInputType("manual")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                      recipeInputType === "manual"
                        ? "bg-orange-500 text-white shadow-md shadow-orange-300/40"
                        : "bg-white border-2 border-gray-100 text-foreground hover:border-orange-300"
                    )}
                  >
                    직접 작성
                  </button>
                </div>
                
                {recipeInputType === "url" ? (
                  <div className="flex flex-col gap-2.5">
                    <input
                      className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground/50"
                      placeholder="Youtube 또는 Instagram 링크를 입력하세요"
                      type="text"
                      value={recipeContent}
                      onChange={(e) => setRecipeContent(e.target.value)}
                    />
                    {isCrawlingRecipe ? (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <Loader2 className="size-4 text-primary animate-spin" />
                        <span className="text-xs text-muted-foreground font-medium">레시피 정보 불러오는 중...</span>
                      </div>
                    ) : recipeContent && recipeContent.trim().startsWith("http") && (
                      <div className={cn(
                        "flex flex-col gap-2.5 p-3.5 border rounded-xl transition-colors",
                        recipeBrand === "youtube" && "bg-red-50/70 border-red-200",
                        recipeBrand === "instagram" && "bg-pink-50/70 border-pink-200",
                        recipeBrand === "tiktok" && "bg-slate-50/70 border-slate-300",
                        recipeBrand === "generic" && "bg-orange-50/70 border-orange-200"
                      )}>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "size-5 rounded-full flex items-center justify-center shrink-0 shadow-sm text-[10px] font-black",
                            recipeBrand === "youtube" && "bg-[#FF0000] text-white",
                            recipeBrand === "instagram" && "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white",
                            recipeBrand === "tiktok" && "bg-[#010101] text-white border border-slate-700",
                            recipeBrand === "generic" && "bg-orange-500 text-white"
                          )}>
                            <span>
                              {recipeBrand === "youtube" ? "Y" : recipeBrand === "instagram" ? "I" : recipeBrand === "tiktok" ? "T" : "R"}
                            </span>
                          </div>
                          <span className={cn(
                            "text-xs font-medium truncate flex-1",
                            recipeBrand === "youtube" && "text-red-700",
                            recipeBrand === "instagram" && "text-pink-700",
                            recipeBrand === "tiktok" && "text-slate-800",
                            recipeBrand === "generic" && "text-orange-700"
                          )}>{recipeContent}</span>
                          <button 
                            onClick={() => { 
                              setRecipeContent(""); 
                              setRecipeThumbnail("");
                              setRecipeTitle("");
                              setLastCrawledRecipeUrl("");
                            }} 
                            className={cn(
                              "shrink-0 size-5 rounded flex items-center justify-center transition-colors",
                              recipeBrand === "youtube" && "hover:bg-red-100/50 text-red-600",
                              recipeBrand === "instagram" && "hover:bg-pink-100/50 text-pink-600",
                              recipeBrand === "tiktok" && "hover:bg-slate-200 text-slate-700",
                              recipeBrand === "generic" && "hover:bg-orange-100/50 text-orange-600"
                            )}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        
                        {/* 레시피명 및 크롤링된 썸네일 노출 */}
                        {recipeTitle && (
                          <div className={cn(
                            "flex items-center gap-3 mt-1.5 pt-2.5 border-t",
                            recipeBrand === "youtube" && "border-red-100",
                            recipeBrand === "instagram" && "border-pink-100",
                            recipeBrand === "tiktok" && "border-slate-200",
                            recipeBrand === "generic" && "border-orange-100"
                          )}>
                            {recipeThumbnail ? (
                              <img 
                                src={recipeThumbnail} 
                                alt="Recipe Thumbnail" 
                                className={cn(
                                  "size-11 rounded-lg object-cover bg-white border shrink-0 shadow-sm",
                                  recipeBrand === "youtube" && "border-red-200",
                                  recipeBrand === "instagram" && "border-pink-200",
                                  recipeBrand === "tiktok" && "border-slate-300",
                                  recipeBrand === "generic" && "border-orange-200"
                                )} 
                              />
                            ) : (
                              <div className={cn(
                                "size-11 rounded-lg flex items-center justify-center shrink-0 border",
                                recipeBrand === "youtube" && "bg-red-100 border-red-200 text-[#FF0000]",
                                recipeBrand === "instagram" && "bg-pink-100 border-pink-200 text-pink-600",
                                recipeBrand === "tiktok" && "bg-slate-100 border-slate-300 text-slate-700",
                                recipeBrand === "generic" && "bg-orange-100 border-orange-200 text-orange-600"
                              )}>
                                <Navigation className="size-5" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h5 className={cn(
                                "text-xs font-bold truncate",
                                recipeBrand === "youtube" && "text-red-950",
                                recipeBrand === "instagram" && "text-pink-950",
                                recipeBrand === "tiktok" && "text-slate-950",
                                recipeBrand === "generic" && "text-orange-950"
                              )}>
                                {recipeTitle}
                              </h5>
                              <p className={cn(
                                "text-[10px] font-medium",
                                recipeBrand === "youtube" && "text-red-700/60",
                                recipeBrand === "instagram" && "text-pink-700/60",
                                recipeBrand === "tiktok" && "text-slate-700/60",
                                recipeBrand === "generic" && "text-orange-700/60"
                              )}>
                                {recipeBrand === "youtube" ? "유튜브 영상 연동 완료" : recipeBrand === "instagram" ? "인스타그램 릴스 연동 완료" : recipeBrand === "tiktok" ? "틱톡 영상 연동 완료" : "레시피 링크 연동 완료"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground/50 resize-none"
                    placeholder="조리 순서나 핵심 레시피를 자유롭게 기록하세요"
                    rows={3}
                    value={recipeContent}
                    onChange={(e) => setRecipeContent(e.target.value)}
                  />
                )}
              </div>
            )}

            {/* 5. 식당 링크 - 외식/배달일 경우에만 */}
            {(mealType === "외식" || mealType === "배달") && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Link className="size-4 text-orange-500" />
                  식당 링크 <span className="text-xs text-muted-foreground font-normal">(선택 - N플레이스, 카카오맵, 구글맵)</span>
                </label>
                <input
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground/50"
                  placeholder="네이버 플레이스, 카카오맵, 구글맵 링크를 입력하세요"
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                {isCrawlingLink ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <Loader2 className="size-4 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground font-medium">식당 정보 불러오는 중...</span>
                  </div>
                ) : linkUrl && (
                  <div className={cn(
                    "flex flex-col gap-2.5 p-3.5 border rounded-xl transition-colors",
                    linkBrand === "kakao" && "bg-amber-50/70 border-amber-200",
                    linkBrand === "google" && "bg-blue-50 border-blue-200",
                    linkBrand === "naver" && "bg-green-50 border-green-200"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "size-5 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                        linkBrand === "kakao" && "bg-[#FEE500] border border-amber-300 text-[#3C1E1E]",
                        linkBrand === "google" && "bg-[#4285F4] text-white",
                        linkBrand === "naver" && "bg-[#03C75A] text-white"
                      )}>
                        <span className="text-[10px] font-black">
                          {linkBrand === "kakao" ? "K" : linkBrand === "google" ? "G" : "N"}
                        </span>
                      </div>
                      <span className={cn(
                        "text-xs font-medium truncate flex-1",
                        linkBrand === "kakao" && "text-amber-800",
                        linkBrand === "google" && "text-blue-700",
                        linkBrand === "naver" && "text-green-700"
                      )}>{linkUrl}</span>
                      <button 
                        onClick={() => { 
                          setLinkUrl(""); 
                          setLinkThumbnail(""); 
                          setLastCrawledUrl("");
                          if (mealType === "배달") {
                            setSelectedPlace(null);
                          } else if (mealType === "외식") {
                            setSelectedPlace(null);
                          }
                        }} 
                        className={cn(
                          "shrink-0 size-5 rounded flex items-center justify-center transition-colors",
                          linkBrand === "kakao" && "hover:bg-amber-100/50 text-amber-700",
                          linkBrand === "google" && "hover:bg-blue-100/50 text-blue-600",
                          linkBrand === "naver" && "hover:bg-green-100/50 text-green-600"
                        )}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    
                    {/* 식당명 및 크롤링된 썸네일 노출 */}
                    {(deliveryStoreName || selectedPlace?.name) && (
                      <div className={cn(
                        "flex items-center gap-3 mt-1.5 pt-2.5 border-t",
                        linkBrand === "kakao" && "border-amber-100",
                        linkBrand === "google" && "border-blue-100",
                        linkBrand === "naver" && "border-green-100"
                      )}>
                        {linkThumbnail ? (
                          <img 
                            src={linkThumbnail} 
                            alt="Store Thumbnail" 
                            className={cn(
                              "size-11 rounded-lg object-cover bg-white border shrink-0 shadow-sm",
                              linkBrand === "kakao" && "border-amber-200",
                              linkBrand === "google" && "border-blue-200",
                              linkBrand === "naver" && "border-green-200"
                            )} 
                          />
                        ) : (
                          <div className={cn(
                            "size-11 rounded-lg flex items-center justify-center shrink-0 border",
                            linkBrand === "kakao" && "bg-amber-100 border-amber-200 text-amber-700",
                            linkBrand === "google" && "bg-blue-100 border-blue-200 text-[#4285F4]",
                            linkBrand === "naver" && "bg-green-100 border-green-200 text-[#03C75A]"
                          )}>
                            <Navigation className="size-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h5 className={cn(
                            "text-xs font-bold truncate",
                            linkBrand === "kakao" && "text-amber-950",
                            linkBrand === "google" && "text-blue-900",
                            linkBrand === "naver" && "text-green-900"
                          )}>
                            {mealType === "배달" ? deliveryStoreName : selectedPlace?.name}
                          </h5>
                          <p className={cn(
                            "text-[10px] font-medium truncate",
                            linkBrand === "kakao" && "text-amber-700/70",
                            linkBrand === "google" && "text-blue-700/60",
                            linkBrand === "naver" && "text-green-700/60"
                          )}>
                            {selectedPlace?.address
                              ? selectedPlace.address
                              : linkBrand === "kakao" ? "카카오맵 연동 완료" : linkBrand === "google" ? "구글 지도 연동 완료" : "네이버 플레이스 연동 완료"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
 
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
                 onClick={() => {
                   if (editData?.id === 1 || editData?.id === 2 || editData?.id === 3) {
                     toast("샘플이라 수정이 되지 않습니다.", {
                       icon: "💡",
                       duration: 3000
                     })
                     return
                   }
                   const isRecipeUrl = mealType === "집밥" && recipeInputType === "url"
                    const finalLinkUrl = isRecipeUrl ? recipeContent : (linkUrl || undefined)
                    const finalLinkThumbnail = isRecipeUrl ? recipeThumbnail : (linkThumbnail || undefined)
                    const finalRecipe = isRecipeUrl ? recipeContent : (recipeInputType === "manual" ? recipeContent : undefined)
                    const finalPlace = isRecipeUrl 
                      ? { name: recipeTitle || "레시피 영상", address: "", category: "레시피" }
                      : (selectedPlace || undefined)

                    const data: MealLogData = {
                      id: editData?.id,
                      date,
                      mealType,
                      menuName,
                      place: finalPlace,
                      deliveryStoreName: deliveryStoreName || undefined,
                      recipe: finalRecipe,
                      recipeType: recipeInputType,
                      linkUrl: finalLinkUrl,
                      linkThumbnail: finalLinkThumbnail,
                      image: imagePreview || undefined,
                      rating: editData?.rating,
                      description: editData?.description,
                    }
                   onSave?.(data)
                   onClose()
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-500 text-white rounded-xl shadow-md shadow-orange-300/40 hover:bg-orange-600 hover:scale-[1.02] active:scale-95 transition-all font-bold text-xs"
              >
                {isEditMode ? "수정 완료" : "기록하기"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
