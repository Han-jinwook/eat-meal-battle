"use client"

import React, { useState, useEffect } from "react"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { getSessionToken } from "@/services/merlin-hub-sdk/CoreLogic/client"
import { secureWrite } from "@/lib/supabase-safe"
import { createClient } from "@/lib/supabase"
import { toast } from "react-hot-toast"
import { X, Sparkles, User, Home, Users } from "lucide-react"
import { cn } from "@/lib/utils"

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface SourceCardData {
  id?: string | number
  menu: string
  place?: string
  url?: string
  thumbnail?: string
  mealType?: string
  source: "solo_log" | "solo_wish" | "solo_schedule" | "family_wish" | "family_schedule" | "group_wish" | "group_schedule" | "family_log" | "group_log"
  groupId?: string
}

interface UniversalSaveModalProps {
  isOpen: boolean
  onClose: () => void
  sourceCard: SourceCardData | null
  groups?: { id: string; name: string }[]
}

export const UniversalSaveModal: React.FC<UniversalSaveModalProps> = ({
  isOpen,
  onClose,
  sourceCard,
  groups = []
}) => {
  const { isLoggedIn, user } = useHub()
  const supabase = createClient()
  const [internalGroups, setInternalGroups] = useState<{ id: string; name: string }[]>(groups || [])
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (groups && groups.length > 0) {
      setInternalGroups(groups)
    }
  }, [groups])

  useEffect(() => {
    if (!isOpen || !isLoggedIn || !user?.id) return
    if (groups && groups.length > 0) return

    const fetchGroups = async () => {
      try {
        const hubToken = getSessionToken() || ""
        const res = await fetch(`/api/group/members?userId=${user.id}`, {
          headers: {
            ...(hubToken ? { "x-hub-token": hubToken } : {}),
            "x-user-id": user.id
          }
        })
        if (res.ok) {
          const json = await res.json()
          if (json.groups && Array.isArray(json.groups)) {
            setInternalGroups(json.groups.map((g: any) => ({ id: g.id || g.group_id, name: g.name || g.group_name || "모임" })))
          }
        }
      } catch (err) {
        console.error("UniversalSaveModal self group fetch error", err)
      }
    }
    fetchGroups()
  }, [isOpen, isLoggedIn, user?.id, groups])

  const effectiveGroups = (groups && groups.length > 0) ? groups : internalGroups

  useEffect(() => {
    if (effectiveGroups && effectiveGroups.length > 0) {
      // Default to first group that is not the source group
      const available = effectiveGroups.find(g => g.id !== sourceCard?.groupId)
      setSelectedGroupId(available ? available.id : effectiveGroups[0].id)
    }
  }, [effectiveGroups, sourceCard])

  if (!isOpen || !sourceCard) return null

  // 1. 타겟별 가능 여부 판별
  const canSaveToSolo = sourceCard.source !== "solo_wish" && sourceCard.source !== "solo_schedule"
  const canSaveToFamily = sourceCard.source !== "family_wish" && sourceCard.source !== "family_schedule"

  const getSoloDisabledReason = () => {
    if (sourceCard.source === "solo_wish") return "이미 솔로 위시에 있습니다"
    if (sourceCard.source === "solo_schedule") return "솔로 예약건은 위시 저장 불가"
    return ""
  }

  const getFamilyDisabledReason = () => {
    if (sourceCard.source === "family_wish") return "이미 가족 위시에 있습니다"
    if (sourceCard.source === "family_schedule") return "가족 예약건은 가족위시 저장 불가"
    return ""
  }

  const handleSaveToTarget = async (target: "solo" | "family" | "group") => {
    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 기능입니다.")
      return
    }

    if (isSaving) return
    setIsSaving(true)

    try {
      let targetLabel = "솔로"
      let source = "solo_wishlist"
      let finalGroupId: string | null = null

      if (target === "solo") {
        targetLabel = "솔로"
        source = "solo_wishlist"
      } else if (target === "family") {
        targetLabel = "가족"
        source = "family_wishlist"
      } else if (target === "group") {
        if (!selectedGroupId) {
          toast.error("담을 모임방을 선택해 주세요.")
          setIsSaving(false)
          return
        }
        const grp = effectiveGroups.find(g => g.id === selectedGroupId)
        targetLabel = grp ? grp.name : "모임"
        source = "group_wishlist"
        finalGroupId = selectedGroupId
      }

      // 중복 검사
      let dupQuery = supabase
        .from("meal_reservations")
        .select("id, menu")
        .is("date", null)
        .eq("menu", sourceCard.menu)

      if (target === "solo") {
        dupQuery = dupQuery.eq("user_id", user.id).eq("source", "solo_wishlist")
      } else if (target === "family") {
        dupQuery = dupQuery.eq("source", "family_wishlist")
      } else if (target === "group" && finalGroupId) {
        dupQuery = dupQuery.eq("source", "group_wishlist").eq("group_id", finalGroupId)
      }

      const { data: existing } = await dupQuery

      if (existing && existing.length > 0) {
        toast(`💡 '${sourceCard.menu}' 메뉴는 이미 ${targetLabel} 위시리스트에 담겨 있습니다!`, { icon: "💡", duration: 3000 })
      } else {
        const wishId = generateUUID()
        const typeMap: Record<string, "집밥" | "배달" | "외식"> = {
          homemade: "집밥",
          home: "집밥",
          delivery: "배달",
          dining: "외식",
          집밥: "집밥",
          배달: "배달",
          외식: "외식"
        }
        const finalMealType = typeMap[sourceCard.mealType || ""] || (sourceCard.mealType === "집밥" || sourceCard.mealType === "배달" || sourceCard.mealType === "외식" ? sourceCard.mealType : "외식")
        await secureWrite({
          table: "meal_reservations",
          action: "insert",
          data: {
            id: wishId,
            user_id: user.id,
            date: null,
            time: null,
            meal_type: finalMealType,
            menu: sourceCard.menu,
            place: sourceCard.place || null,
            source_url: sourceCard.url || null,
            thumbnail: sourceCard.thumbnail || null,
            memo: null,
            source: source,
            group_id: finalGroupId
          }
        })
        toast.success(`✨ '${sourceCard.menu}'가 ${targetLabel} 위시리스트에 담겼습니다!`)
      }

      // 전체 탭 실시간 리로드 이벤트 발신
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("whateat:reservation-updated"))
        
        // 먹로그(meal_images) 카드인 경우 좋아요 자동 연동 (백그라운드)
        if (
          sourceCard.id &&
          (sourceCard.source === "solo_log" || sourceCard.source === "family_log" || (sourceCard.source as any) === "group_log") &&
          typeof sourceCard.id === "string" &&
          sourceCard.id.length > 10 &&
          !sourceCard.id.startsWith("sample-")
        ) {
          secureWrite({
            table: "meal_likes",
            action: "insert",
            data: { meal_id: sourceCard.id, user_id: user.id }
          }).catch(console.error)
        }

        // 해당 탭으로 이동 및 하이라이팅 발신
        window.dispatchEvent(new CustomEvent("openReservationFromTalk", {
          detail: {
            target,
            targetGroupId: finalGroupId,
            menuName: sourceCard.menu,
            mealType: sourceCard.mealType,
            placeName: sourceCard.place,
            savedToWishlist: true,
            highlightMenu: sourceCard.menu
          }
        }))
        
        // 담기 성공 상태 발신 (Pin 아이콘 색상 변경용)
        window.dispatchEvent(new CustomEvent("whateat:card-saved", {
          detail: { id: sourceCard.id }
        }))
      }

      onClose()
    } catch (err: any) {
      console.error("Universal save failed", err)
      toast.error("담기 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 선택된 식사 요약 카드 (상단 배치) */}
        <div className="p-4 bg-orange-50/70 border-b border-orange-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {sourceCard.thumbnail ? (
              <img 
                src={sourceCard.thumbnail} 
                alt={sourceCard.menu} 
                referrerPolicy="no-referrer"
                className="size-12 rounded-xl object-cover shrink-0 border border-orange-200/50 shadow-xs"
              />
            ) : (
              <div className="size-12 rounded-xl bg-orange-200/40 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">
                🍽️
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-orange-600 bg-orange-100/90 px-1.5 py-0.5 rounded-md inline-block mb-1">
                {(() => {
                  const typeMap: Record<string, string> = {
                    homemade: "집밥",
                    home: "집밥",
                    delivery: "배달",
                    dining: "외식",
                    집밥: "집밥",
                    배달: "배달",
                    외식: "외식"
                  }
                  return typeMap[sourceCard.mealType || ""] || sourceCard.mealType || "식사"
                })()}
              </div>
              <h4 className="font-extrabold text-gray-900 text-sm truncate">{sourceCard.menu}</h4>
            </div>
          </div>

          {/* 우측: 식당명 및 닫기 버튼 */}
          <div className="flex flex-col items-end justify-between self-stretch shrink-0">
            <button 
              onClick={onClose}
              className="size-7 rounded-full hover:bg-black/5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
            {sourceCard.place && (
              <span className="text-[11px] font-bold text-muted-foreground truncate max-w-[120px] flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-lg border border-orange-100/80 mb-0.5">
                📍 {sourceCard.place}
              </span>
            )}
          </div>
        </div>

        {/* 타이틀 안내 헤더 */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2">
          <div className="size-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0">
            <Sparkles className="size-3.5" />
          </div>
          <h3 className="font-bold text-gray-900 text-sm">어디로 담으시겠어요?</h3>
        </div>

        {/* 담기 선택 옵션 목록 (좌우 여백을 주어 썸네일보다 들여쓰기된 폭) */}
        <div className="px-6 pb-6 space-y-2.5">
          {/* 1. 솔로 위시 */}
          <button
            disabled={!canSaveToSolo || isSaving}
            onClick={() => handleSaveToTarget("solo")}
            className={cn(
              "w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group",
              canSaveToSolo
                ? "border-gray-200 hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-xs cursor-pointer"
                : "border-gray-100 bg-gray-50/80 opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "size-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                canSaveToSolo ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100" : "bg-gray-200 text-gray-400"
              )}>
                <User className="size-4" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">💡 솔로 위시리스트</p>
                <p className="text-[10px] text-gray-500">나 혼자 먹고 싶은 메뉴로 저장</p>
              </div>
            </div>
            {!canSaveToSolo && (
              <span className="text-[10px] font-bold text-gray-400 bg-gray-200/80 px-2 py-0.5 rounded-md shrink-0">
                {getSoloDisabledReason()}
              </span>
            )}
          </button>

          {/* 2. 가족 위시 */}
          <button
            disabled={!canSaveToFamily || isSaving}
            onClick={() => handleSaveToTarget("family")}
            className={cn(
              "w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group",
              canSaveToFamily
                ? "border-gray-200 hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-xs cursor-pointer"
                : "border-gray-100 bg-gray-50/80 opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "size-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                canSaveToFamily ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100" : "bg-gray-200 text-gray-400"
              )}>
                <Home className="size-4" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">🏠 우리 가족 위시리스트</p>
                <p className="text-[10px] text-gray-500">가족 전체와 함께 먹을 메뉴로 저장</p>
              </div>
            </div>
            {!canSaveToFamily && (
              <span className="text-[10px] font-bold text-gray-400 bg-gray-200/80 px-2 py-0.5 rounded-md shrink-0">
                {getFamilyDisabledReason()}
              </span>
            )}
          </button>

          {/* 3. 모임 위시 */}
          <div className="p-3 rounded-2xl border border-gray-200 bg-white hover:border-sky-300 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <Users className="size-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800">👥 모임 위시리스트</p>
                  <p className="text-[10px] text-gray-500">지정한 모임방의 먹예약으로 저장</p>
                </div>
              </div>
            </div>

            {effectiveGroups && effectiveGroups.length > 0 ? (
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-800 outline-none focus:border-sky-400 cursor-pointer"
                >
                  {effectiveGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.id === sourceCard.groupId ? "(현재 모임방)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  disabled={isSaving}
                  onClick={() => handleSaveToTarget("group")}
                  className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  담기
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic mt-1 pl-11">가입된 모임방이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
