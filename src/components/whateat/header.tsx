"use client"

import Image from "next/image"
import { Bell, MessageSquare, User, Users, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import whatEatLogo from "@/v0-migration/public/logo.png"

export type HeaderNavTab = "solo" | "family" | "talk" | "meal"

interface HeaderProps {
  activeNavTab?: HeaderNavTab
  onNavTabChange?: (tab: HeaderNavTab) => void
}

const navItems = [
  { id: "solo" as HeaderNavTab, label: "솔로", icon: User },
  { id: "family" as HeaderNavTab, label: "패밀리", icon: Users },
  { id: "talk" as HeaderNavTab, label: "맛톡", icon: MessageSquare },
  { id: "meal" as HeaderNavTab, label: "급식", icon: UtensilsCrossed },
]

export function Header({ activeNavTab = "solo", onNavTabChange }: HeaderProps) {
  const router = useRouter()

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="flex min-h-[62px] items-center gap-2 px-4 py-3">
        {/* Logo */}
        <Image 
          src={whatEatLogo}
          alt="뭐먹지?" 
          width={120}
          height={56}
          className="mr-1 h-9 w-auto shrink-0 object-contain"
        />
        {/* Main Nav - 텍스트만, 아이콘 없음 */}
        <div className="flex flex-1 items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavTabChange?.(item.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold leading-none transition-all whitespace-nowrap",
                activeNavTab === item.id
                  ? "text-cyan-600 bg-cyan-50"
                  : "text-gray-400 hover:text-cyan-500"
              )}
            >
              <item.icon className="hidden size-3.5 md:inline-block" />
              {item.label}
            </button>
          ))}
        </div>
        {/* 알림 + 프로필 */}
        <div className="flex shrink-0 items-center gap-2">
          <button className="flex size-8 items-center justify-center rounded-full border border-cyan-100 bg-cyan-50 text-cyan-600 transition-colors hover:bg-cyan-100">
            <Bell className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="size-8 shrink-0 rounded-full bg-gradient-to-br from-cyan-100 to-cyan-200 ring-2 ring-cyan-200 transition-colors hover:ring-cyan-300"
            aria-label="프로필 설정 열기"
          />
        </div>
      </div>
    </header>
  )
}
