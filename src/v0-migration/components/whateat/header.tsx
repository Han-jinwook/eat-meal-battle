"use client"

import Image from "next/image"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"

export type HeaderNavTab = "solo" | "family" | "talk" | "meal"

interface HeaderProps {
  activeNavTab?: HeaderNavTab
  onNavTabChange?: (tab: HeaderNavTab) => void
}

const navItems = [
  { id: "solo" as HeaderNavTab, label: "솔로" },
  { id: "family" as HeaderNavTab, label: "패밀리" },
  { id: "talk" as HeaderNavTab, label: "맛톡" },
  { id: "meal" as HeaderNavTab, label: "급식" },
]

export function Header({ activeNavTab = "solo", onNavTabChange }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="flex items-center gap-1 px-3 py-2">
        {/* Logo */}
        <Image 
          src="/logo.png" 
          alt="뭐먹지?" 
          width={60} 
          height={24} 
          className="h-6 w-auto object-contain shrink-0 mr-1"
        />
        {/* Main Nav - 텍스트만, 아이콘 없음 */}
        <div className="flex items-center gap-0.5 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavTabChange?.(item.id)}
              className={cn(
                "px-2.5 py-1.5 rounded-full text-[12px] font-bold transition-all whitespace-nowrap",
                activeNavTab === item.id
                  ? "text-cyan-600 bg-cyan-50"
                  : "text-gray-400 hover:text-cyan-500"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* 알림 + 프로필 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button className="size-7 flex items-center justify-center rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100 hover:bg-cyan-100 transition-colors">
            <Bell className="size-3.5" />
          </button>
          <div className="size-7 rounded-full ring-2 ring-cyan-200 bg-gradient-to-br from-cyan-100 to-cyan-200 shrink-0" />
        </div>
      </div>
    </header>
  )
}
