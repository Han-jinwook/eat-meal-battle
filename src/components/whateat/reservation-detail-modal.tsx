import { useState } from "react"
import { X, CalendarDays, MapPin, Search, Youtube, ExternalLink, Utensils, Clock, Link2, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"

export interface DetailPlanData {
  id: number | string
  date: string
  time: string
  mealType: string
  menu: string
  place: string
  memo: string
  thumbnail?: string
  url?: string
}

interface ReservationDetailModalProps {
  isOpen: boolean
  onClose: () => void
  plan: DetailPlanData | null
}

export function parseSourceUrls(urlStr?: string | null) {
  if (!urlStr) return { placeUrl: "", videoUrl: "" }
  if (urlStr.startsWith("{")) {
    try {
      const parsed = JSON.parse(urlStr)
      return {
        placeUrl: parsed.placeUrl || "",
        videoUrl: parsed.videoUrl || ""
      }
    } catch (e) {}
  }
  if (urlStr.includes("youtube.com") || urlStr.includes("youtu.be") || urlStr.includes("instagram.com") || urlStr.includes("tiktok.com")) {
    return { placeUrl: "", videoUrl: urlStr }
  } else {
    return { placeUrl: urlStr, videoUrl: "" }
  }
}

export function stringifySourceUrls(placeUrl?: string, videoUrl?: string): string | undefined {
  const p = placeUrl?.trim() || ""
  const v = videoUrl?.trim() || ""
  if (p && v) {
    return JSON.stringify({ placeUrl: p, videoUrl: v })
  }
  return p || v || undefined
}

export function ReservationDetailModal({ isOpen, onClose, plan }: ReservationDetailModalProps) {
  const [showDeliveryApps, setShowDeliveryApps] = useState(false)

  if (!isOpen || !plan) return null

  const { placeUrl, videoUrl } = parseSourceUrls(plan.url)

  const getActionButtons = () => {
    const buttons = []

    if (placeUrl) {
      buttons.push({
        id: "place-link",
        icon: Link2,
        label: "저장된 장소 지도 열기",
        color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 ring-indigo-200",
        url: placeUrl
      })
    }

    if (videoUrl) {
      buttons.push({
        id: "video-link",
        icon: Youtube,
        label: "참고 영상 / 쇼츠 열기",
        color: "bg-red-50 text-red-600 hover:bg-red-100 ring-red-200",
        url: videoUrl
      })
    }

    // Fallbacks if no URL is explicitly saved
    if (buttons.length === 0) {
      if (plan.mealType === "외식") {
        buttons.push({
          id: "map-search",
          icon: MapPin,
          label: "지도 검색",
          color: "bg-blue-50 text-blue-600 hover:bg-blue-100 ring-blue-200",
          url: `https://map.naver.com/v5/search/${encodeURIComponent(plan.place || plan.menu)}`
        })
      } else if (plan.mealType === "집밥") {
        buttons.push({
          id: "recipe-search",
          icon: Youtube,
          label: "레시피 검색",
          color: "bg-red-50 text-red-600 hover:bg-red-100 ring-red-200",
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(plan.menu + " 레시피")}`
        })
      }
    }

    return buttons
  }

  const actionButtons = getActionButtons()

  const handleDeliveryAppClick = (appUrl: string) => {
    const textToCopy = plan.place || plan.menu
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        toast.success(`'${textToCopy}' 복사 완료! 앱 검색창에 붙여넣으세요.`, { icon: '📋' })
      }).catch(() => {
        toast.error("클립보드 복사에 실패했습니다.")
      })
    }
    window.open(appUrl, '_blank')
  }

  const DELIVERY_APPS = [
    { name: "배달의민족", url: "https://www.baemin.com/", color: "bg-[#2ac1bc] text-white hover:bg-[#23a5a1]" },
    { name: "쿠팡이츠", url: "https://www.coupangeats.com/", color: "bg-[#00a8e1] text-white hover:bg-[#0092c4]" },
    { name: "요기요", url: "https://www.yogiyo.co.kr/", color: "bg-[#fa0050] text-white hover:bg-[#de0047]" }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-white rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Thumbnail Image */}
        <div className="relative h-48 bg-orange-50 overflow-hidden group">
          {plan.thumbnail ? (
            <img 
              src={plan.thumbnail} 
              alt={plan.menu} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-primary/40">
              <Utensils className="size-16 mb-2" />
              <span className="text-sm font-medium">No Image</span>
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 size-8 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
          >
            <X className="size-5" />
          </button>
          
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-lg border border-white/20">
                {plan.mealType}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white drop-shadow-sm leading-tight">
              {plan.menu}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          <div className="space-y-4">
            
            {/* Time & Date */}
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0 text-primary">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {new Date(plan.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                </p>
                {plan.time && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="size-3" />
                    {plan.time}
                  </p>
                )}
              </div>
            </div>

            {/* Place */}
            {plan.place && (
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0 text-primary">
                  <MapPin className="size-5" />
                </div>
                <div className="flex-1 min-w-0 flex items-center h-10">
                  <p className="text-sm font-medium text-foreground truncate">
                    {plan.place}
                  </p>
                </div>
              </div>
            )}

            {/* Memo */}
            {plan.memo && (
              <div className="mt-2 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {plan.memo}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {actionButtons.length > 0 && plan.mealType !== "배달" && (
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col gap-2">
              {actionButtons.map((btn) => (
                <a 
                  key={btn.id}
                  href={btn.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold transition-all ring-1 ring-inset",
                    btn.color
                  )}
                >
                  <btn.icon className="size-4.5" />
                  <span>{btn.label}</span>
                  <ExternalLink className="size-3.5 opacity-50 ml-1" />
                </a>
              ))}
            </div>
          )}

          {plan.mealType === "배달" && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              {!showDeliveryApps ? (
                <button 
                  onClick={() => setShowDeliveryApps(true)}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold transition-all ring-1 ring-inset bg-teal-50 text-teal-600 hover:bg-teal-100 ring-teal-200"
                >
                  <Search className="size-4.5" />
                  <span>배달앱 선택하기</span>
                  <ExternalLink className="size-3.5 opacity-50 ml-1" />
                </button>
              ) : (
                <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="text-center mb-1">
                    <p className="text-sm font-bold text-gray-700 flex items-center justify-center gap-1.5">
                      <Copy className="size-3.5 text-gray-400" />
                      어떤 앱으로 주문할까요?
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">앱을 열고 이름이 자동 복사되면 붙여넣으세요</p>
                  </div>
                  <div className="flex gap-2">
                    {DELIVERY_APPS.map(app => (
                      <button
                        key={app.name}
                        onClick={() => handleDeliveryAppClick(app.url)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex flex-col items-center justify-center gap-1",
                          app.color
                        )}
                      >
                        {app.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
