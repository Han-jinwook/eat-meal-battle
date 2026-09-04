"use client"

import React, { useState, useEffect, useRef } from "react"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { getSessionToken } from "@/services/merlin-hub-sdk/CoreLogic/client"
import { secureWrite } from "@/lib/supabase-safe"
import { createClient } from "@/lib/supabase"
import { toast } from "react-hot-toast"
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

export interface SaveSourceCard {
  id?: string | number
  menu: string
  place?: string
  url?: string
  thumbnail?: string | null
  mealType?: string
  source: "solo_log" | "solo_wish" | "solo_schedule" | "family_wish" | "family_schedule" | "group_wish" | "group_schedule" | "family_log" | "group_log" | "talk"
  groupId?: string
}

export interface SaveDropdownProps {
  isOpen: boolean
  onClose: () => void
  sourceCard: SaveSourceCard | null
  groups?: { id: string; name: string }[]
  direction?: "up" | "down"
  align?: "right" | "left"
  className?: string
}

export const SaveDropdown: React.FC<SaveDropdownProps> = ({
  isOpen,
  onClose,
  sourceCard,
  groups = [],
  direction = "up",
  align = "right",
  className
}) => {
  const { isLoggedIn, user } = useHub()
  const supabase = createClient()
  const [internalGroups, setInternalGroups] = useState<{ id: string; name: string }[]>(groups || [])
  const [isSaving, setIsSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. 모임 목록 동기화
  useEffect(() => {
    if (groups && groups.length > 0) {
      setInternalGroups(groups)
    }
  }, [groups])

  // 2. 모임 목록 미전달 시 자체 조회
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
        console.error("SaveDropdown group fetch error", err)
      }
    }
    fetchGroups()
  }, [isOpen, isLoggedIn, user?.id, groups])

  // 3. 글로벌 바깥 터치/클릭 감지 (모바일 및 전역 터치 100% 닫기 보장)
  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Capture phase로 등록하여 어떤 상위/하위 요소가 버블링을 막아도 무조건 닫기 실행
    window.addEventListener("pointerdown", handleOutsideClick, true)
    window.addEventListener("touchstart", handleOutsideClick, true)
    return () => {
      window.removeEventListener("pointerdown", handleOutsideClick, true)
      window.removeEventListener("touchstart", handleOutsideClick, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || !sourceCard) return null

  const effectiveGroups = (groups && groups.length > 0) ? groups : internalGroups

  const isSoloDisabled = sourceCard.source === "solo_wish" || sourceCard.source === "solo_schedule"
  const isFamilyDisabled = sourceCard.source === "family_wish" || sourceCard.source === "family_schedule"

  const handleSaveToTarget = async (target: "solo" | "family" | "group", targetGroupId?: string) => {
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent("openLoginModal"))
      toast.error("로그인이 필요한 기능입니다.")
      onClose()
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
        finalGroupId = targetGroupId || (effectiveGroups.length > 0 ? effectiveGroups[0].id : null)
        if (!finalGroupId) {
          try {
            const { data: gData } = await supabase
              .from("whateat_group_members")
              .select("group_id")
              .eq("user_id", user.id)
              .limit(1)
              .maybeSingle()
            if (gData?.group_id) {
              finalGroupId = gData.group_id
            }
          } catch (e) {}
        }

        if (!finalGroupId && effectiveGroups.length === 0) {
          toast("가입된 모임이 없습니다. 먼저 모임을 만들어보세요!", { icon: "💡", duration: 3000 })
          setIsSaving(false)
          onClose()
          return
        }

        const grp = effectiveGroups.find(g => g.id === finalGroupId)
        targetLabel = grp ? grp.name : "모임"
        source = "group_wishlist"
      }

      // 1. 중복 검사
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

      const typeMap: Record<string, "집밥" | "배달" | "외식"> = {
        homemade: "집밥",
        home: "집밥",
        delivery: "배달",
        dining: "외식",
        dineout: "외식",
        집밥: "집밥",
        배달: "배달",
        외식: "외식"
      }
      const finalMealType = typeMap[sourceCard.mealType || ""] || (sourceCard.mealType === "집밥" || sourceCard.mealType === "배달" || sourceCard.mealType === "외식" ? sourceCard.mealType : "외식")

      if (existing && existing.length > 0) {
        toast(`💡 '${sourceCard.menu}' 메뉴는 이미 ${targetLabel} 위시리스트에 담겨 있습니다!`, { icon: "💡", duration: 3000 })
      } else {
        const wishId = generateUUID()
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

        // 먹로그/맛톡 카드인 경우 좋아요 자동 연동
        if (
          sourceCard.id &&
          (sourceCard.source === "solo_log" || sourceCard.source === "family_log" || (sourceCard.source as any) === "group_log" || sourceCard.source === "talk") &&
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
            mealType: finalMealType,
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
      console.error("SaveDropdown save failed", err)
      toast.error("담기 저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // 모임 대상 필터링 (현재 모임 위시 카드인 경우 해당 모임 제외)
  const availableGroups = effectiveGroups.filter(g => g.id !== sourceCard.groupId)

  return (
    <>
      {/* 바깥 클릭 시 닫기용 투명 백드롭 */}
      <div 
        className="fixed inset-0 z-40 bg-transparent" 
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }} 
      />

      {/* 맛톡 규격 표준 플로팅 드롭다운 */}
      <div 
        ref={dropdownRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute bg-white/95 backdrop-blur-md border border-orange-200/90 rounded-2xl shadow-xl z-50 overflow-hidden min-w-[155px] max-w-[220px] animate-in fade-in zoom-in-95 duration-150 text-left",
          direction === "up" ? "bottom-7 mb-0.5" : "top-full mt-1.5",
          align === "right" ? "right-0" : "left-0",
          className
        )}
      >
        {/* 1. 솔로 위시로 담기 */}
        {!isSoloDisabled && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveToTarget("solo")}
            className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-orange-500 hover:text-white active:bg-orange-600 flex items-center gap-2.5 transition-all duration-150 cursor-pointer group"
          >
            <span className="text-sm shrink-0 group-hover:scale-110 transition-transform">👤</span>
            <span className="font-extrabold tracking-tight">솔로 위시로 담기</span>
          </button>
        )}

        {!isSoloDisabled && !isFamilyDisabled && <div className="h-px bg-orange-100/70" />}

        {/* 2. 가족 위시로 담기 */}
        {!isFamilyDisabled && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveToTarget("family")}
            className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-orange-500 hover:text-white active:bg-orange-600 flex items-center gap-2.5 transition-all duration-150 cursor-pointer group"
          >
            <span className="text-sm shrink-0 group-hover:scale-110 transition-transform">👨‍👩‍👧</span>
            <span className="font-extrabold tracking-tight">가족 위시로 담기</span>
          </button>
        )}

        {(!isSoloDisabled || !isFamilyDisabled) && availableGroups.length > 0 && <div className="h-px bg-orange-100/70" />}

        {/* 3. 모임 위시로 담기 */}
        {availableGroups.length > 1 ? (
          availableGroups.map((g, idx) => (
            <React.Fragment key={g.id}>
              {idx > 0 && <div className="h-px bg-orange-100/70" />}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveToTarget("group", g.id)}
                className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-orange-500 hover:text-white active:bg-orange-600 flex items-center gap-2.5 transition-all duration-150 truncate cursor-pointer group"
                title={`${g.name} 위시로 담기`}
              >
                <span className="text-sm shrink-0 group-hover:scale-110 transition-transform">👥</span>
                <span className="truncate font-extrabold tracking-tight">[{g.name}] 위시로</span>
              </button>
            </React.Fragment>
          ))
        ) : availableGroups.length === 1 ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveToTarget("group", availableGroups[0].id)}
            className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-orange-500 hover:text-white active:bg-orange-600 flex items-center gap-2.5 transition-all duration-150 truncate cursor-pointer group"
            title={`${availableGroups[0].name} 위시로 담기`}
          >
            <span className="text-sm shrink-0 group-hover:scale-110 transition-transform">👥</span>
            <span className="truncate font-extrabold tracking-tight">[{availableGroups[0].name}] 위시로</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveToTarget("group")}
            className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-800 hover:bg-orange-500 hover:text-white active:bg-orange-600 flex items-center gap-2.5 transition-all duration-150 cursor-pointer group"
          >
            <span className="text-sm shrink-0 group-hover:scale-110 transition-transform">👥</span>
            <span className="font-extrabold tracking-tight">모임 위시로 담기</span>
          </button>
        )}

        {/* 4. 명시적 취소 버튼 */}
        <div className="h-px bg-orange-100/70" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="w-full text-center py-2 text-[11px] font-bold text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 active:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="text-xs">✕</span>
          <span>취소</span>
        </button>
      </div>
    </>
  )
}
