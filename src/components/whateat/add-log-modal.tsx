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
  }
  deliveryStoreName?: string
  recipe?: string
  recipeType?: "url" | "manual"
  rating?: number
  description?: string
  linkUrl?: string
}

interface AddLogModalProps {
  isOpen: boolean
  onClose: () => void
  editData?: MealLogData | null
  onSave?: (data: MealLogData) => void
  onDelete?: (id: number) => void
  mode?: "solo" | "family"
}

type MealType = "집밥" | "배달" | "외식"
type RecipeInputType = "url" | "manual"

interface SelectedPlace {
  name: string
  address: string
  category: string
  distance?: string
}

export function AddLogModal({ isOpen, onClose, editData, onSave, onDelete, mode = "solo" }: AddLogModalProps) {
  const { isLoggedIn } = useHub()
  const [mealType, setMealType] = useState<MealType>("집밥")

  const [date, setDate] = useState("")
  const [menuName, setMenuName] = useState("")
  const [recipeInputType, setRecipeInputType] = useState<RecipeInputType>("url")
  const [recipeContent, setRecipeContent] = useState("")
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [deliveryStoreName, setDeliveryStoreName] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
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

  // GPS 위치 기반 주변 장소 로드 (외식 또는 배달 선택 시)
  useEffect(() => {
    if ((mealType === "외식" || mealType === "배달") && isOpen) {
      setIsLoadingLocation(true)
      // 실제로는 navigator.geolocation + API 연동
      const timer = setTimeout(() => {
        if (mealType === "외식") {
          setNearbyPlaces([
            { name: "스시 오마카세 히든", address: "서울 강남구 역삼동 234-56", category: "일식", distance: "50m" },
            { name: "라멘 이치란 강남점", address: "서울 강남구 논현동 345-67", category: "일식", distance: "120m" },
            { name: "우미학 청담점", address: "서울 강남구 청담동 123-45", category: "한식", distance: "200m" },
          ])
        } else if (mealType === "배달") {
          setNearbyDeliveryStores([
            { name: "BHC치킨 강남점", address: "서울 강남구 역삼동 111-22", category: "치킨", distance: "500m" },
            { name: "도미노피자 역삼점", address: "서울 강남구 역삼동 222-33", category: "피자", distance: "700m" },
            { name: "맘스터치 강남역점", address: "서울 강남구 역삼동 333-44", category: "버거", distance: "400m" },
            { name: "족발야시장 강남점", address: "서울 강남구 논현동 444-55", category: "족발", distance: "600m" },
            { name: "교촌치킨 역삼점", address: "서울 강남구 역삼동 555-66", category: "치킨", distance: "800m" },
          ])
        }
        setIsLoadingLocation(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [mealType, isOpen])

  // 배달 식당 필터링
  const filteredDeliveryStores = nearbyDeliveryStores.filter(store =>
    store.name.toLowerCase().includes(deliverySearchQuery.toLowerCase()) ||
    store.category.toLowerCase().includes(deliverySearchQuery.toLowerCase())
  )

  // 외식 장소 필터링
  const filteredPlaces = nearbyPlaces.filter(place =>
    place.name.toLowerCase().includes(placeSearchQuery.toLowerCase()) ||
    place.category.toLowerCase().includes(placeSearchQuery.toLowerCase()) ||
    place.address.toLowerCase().includes(placeSearchQuery.toLowerCase())
  )

  // editData가 변경되면 폼 초기화
  useEffect(() => {
    if (editData) {
      setMealType(editData.mealType)
      setDate(editData.date || new Date().toISOString().split("T")[0])
      setMenuName(editData.menuName)
      setSelectedPlace(editData.place || null)
      setDeliveryStoreName(editData.deliveryStoreName || "")
      setRecipeContent(editData.recipe || "")
      setRecipeInputType(editData.recipeType || "url")
      setLinkUrl(editData.linkUrl || "")
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
      setLinkUrl("")
      setImagePreview(null)
    }
  }, [editData, isOpen])

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-orange-50/60 rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.15)] border border-white overflow-hidden max-h-[calc(100vh-160px)] overflow-y-auto hide-scrollbar">
        {/* Close Button & Delete Button in Edit Mode */}
        <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
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
              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="size-3" />
              삭제
            </button>
          )}
          <button 
            onClick={onClose}
            className="size-9 flex items-center justify-center rounded-full bg-white/50 hover:bg-white text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
              {mode === "family"
                ? (isEditMode ? "(패밀리) 먹로그 수정하기" : "(패밀리) 먹로그 기록하기")
                : (isEditMode ? "(솔로) 먹로그 수정하기" : "(솔로) 먹로그 기록하기")
              }
            </h2>
          </div>

          {/* Form Fields */}
          <div className="space-y-5" onClickCapture={handleInteraction}>
            {/* 1. Meal Type - 제일 먼저 */}
            <div className="flex flex-col gap-3">
              
              <div className="grid grid-cols-3 gap-2">
                {mealTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setMealType(type.id)
                      if (type.id !== "외식") {
                        setSelectedPlace(null)
                      }
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
                    {type.icon && <type.icon className="size-4" />}
                    <span className="text-xs">{type.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CalendarDays className="size-4 text-orange-500" />
                  날짜
                </label>
                <button
                  type="button"
                  onClick={openDatePicker}
                  className="w-full px-4 py-2.5 bg-orange-50 rounded-xl flex items-center justify-between hover:bg-orange-100 transition-colors"
                >
                  <span className={cn("text-sm font-medium", date ? "text-orange-500" : "text-muted-foreground")}>
                    {date ? formatDateDisplay(date) : "날짜를 선택해 주세요"}
                  </span>
                  <span className="text-lg leading-none" aria-hidden>
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
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground">사진</label>
              <div 
                className="relative group cursor-pointer aspect-video w-full rounded-xl border-2 border-dashed border-gray-200 bg-white flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-orange-50/30 transition-all overflow-hidden"
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
                  <span className="text-xs text-muted-foreground font-normal">(집 주소 기반)</span>
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
                          setDeliverySearchQuery("")
                        }}
                        className="size-7 rounded-lg hover:bg-muted/50 flex items-center justify-center shrink-0"
                      >
                        <X className="size-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ) : isLoadingLocation ? (
                  <div className="p-6 bg-white border-2 border-gray-100 rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground">집 주소 주변 식당을 찾고 있어요...</p>
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
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {deliverySearchQuery ? `검색 결과 ${filteredDeliveryStores.length}개` : "배달 히스토리"}
                      </p>
                    </div>
                    <div>
                      {filteredDeliveryStores.length > 0 ? (
                        filteredDeliveryStores.map((store, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setDeliveryStoreName(store.name)
                              setDeliverySearchQuery("")
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-orange-50/50 transition-colors text-left border-b border-gray-50 last:border-0"
                          >
                            <div className="size-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                              <Bike className="size-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-xs text-foreground truncate">{store.name}</h4>
                              <p className="text-[10px] text-muted-foreground truncate">{store.category}</p>
                            </div>
                            <span className="text-[10px] text-primary font-bold shrink-0">{store.distance}</span>
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
                ) : isLoadingLocation ? (
                  <div className="p-6 bg-white border-2 border-gray-100 rounded-xl">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-6 text-primary animate-spin" />
                      <p className="text-xs text-muted-foreground">현재 위치를 찾고 있어요...</p>
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
                        filteredPlaces.map((place, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedPlace(place)
                              setPlaceSearchQuery("")
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
                            <span className="text-[10px] text-primary font-bold shrink-0">{place.distance}</span>
                          </button>
                        ))
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
                        <div className="p-4 text-center">
                          <p className="text-xs text-muted-foreground">주변 장소가 없어요</p>
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
                  <input
                    className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground/50"
                    placeholder="Youtube 또는 Instagram 링크를 입력하세요"
                    type="text"
                    value={recipeContent}
                    onChange={(e) => setRecipeContent(e.target.value)}
                  />
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

            {/* 5. N플레이스 링크 - 외식/배달일 경우에만 */}
            {(mealType === "외식" || mealType === "배달") && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Link className="size-4 text-orange-500" />
                  N플레이스 링크 <span className="text-xs text-muted-foreground font-normal">(선택)</span>
                </label>
                <input
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground/50"
                  placeholder="네이버 플레이스 링크를 입력하세요"
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                {linkUrl && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="size-5 rounded-full bg-[#03C75A] flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-black">N</span>
                    </div>
                    <span className="text-xs text-green-700 font-medium truncate flex-1">{linkUrl}</span>
                    <button onClick={() => setLinkUrl("")} className="shrink-0">
                      <X className="size-3.5 text-green-600" />
                    </button>
                  </div>
                )}
              </div>
            )}

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
                onClick={() => {
                  if (editData?.id === 1 || editData?.id === 2 || editData?.id === 3) {
                    toast("샘플이라 수정이 되지 않습니다.", {
                      icon: "💡",
                      duration: 3000
                    })
                    return
                  }
                  const data: MealLogData = {
                    id: editData?.id,
                    date,
                    mealType,
                    menuName,
                    place: selectedPlace || undefined,
                    deliveryStoreName: deliveryStoreName || undefined,
                    recipe: recipeContent || undefined,
                    recipeType: recipeInputType,
                    linkUrl: linkUrl || undefined,
                    image: imagePreview || undefined,
                    rating: editData?.rating,
                    description: editData?.description,
                  }
                  onSave?.(data)
                  onClose()
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-300/40 hover:bg-orange-600 hover:scale-[1.02] active:scale-95 transition-all font-bold text-sm"
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
