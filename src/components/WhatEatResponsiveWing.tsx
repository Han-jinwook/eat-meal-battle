"use client"

import { usePathname } from "next/navigation"
import { HubResponsiveWing } from "@/services/merlin-hub-sdk/react"

export function WhatEatResponsiveWing() {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin')) return null;

  // TODO: 실제 구글 애드센스 계정 세팅 시 ID를 교체하세요.
  const googleAdClient = "ca-pub-xxxxxxxxxxxx"
  const sideAdSlot = "3333333333"
  const bottomAdSlot = "4444444444"

  return (
    <HubResponsiveWing
      bannerId="whateat_v2"
      shareTitle="식단 관리와 오늘 뭐 먹을지 고민될 땐? 뭐먹지! 🍕"
      shareDescription="우리 가족과 함께 매일의 급식 소식과 맛있는 레시피를 즐겨보세요."
      adClient={googleAdClient}
      sideAdSlot={sideAdSlot}
      bottomAdSlot={bottomAdSlot}
      bottomActionButton={
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white hover:bg-white/15 active:scale-[0.99] transition"
        >
          자세히
        </button>
      }
    />
  )
}
