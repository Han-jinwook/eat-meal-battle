"use client"

import { usePathname } from "next/navigation"
import { HubBottomBanner } from "@/services/merlin-hub-sdk/react"

export function WhatEatBottomBanner() {
  const pathname = usePathname()

  // 뭐먹지는 비과금(Non-Coin) 앱이므로 adFree 로직이 없습니다.
  
  if (pathname?.startsWith('/admin')) return null;

  return (
    <HubBottomBanner
      bannerId="whateat_v1"
      actionButton={
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white hover:bg-white/15 active:scale-[0.99] transition"
        >
          자세히
        </button>
      }
    >
      <div className="text-[10px] font-black tracking-widest text-white/70">AD</div>
      <div className="truncate text-sm font-bold text-white">가족의 식생활 기록, 뭐먹지?</div>
    </HubBottomBanner>
  )
}
