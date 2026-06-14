"use client"

import Image from "next/image"
import { MessageSquare, User, Users, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useHub, HubAvatar } from "@/services/merlin-hub-sdk/react"
import { HubAppSwitcher } from "@/services/merlin-hub-sdk/Navigation/HubAppSwitcher"
import whatEatLogo from "../../../public/images/logo.png"

export type HeaderNavTab = "home" | "solo" | "family" | "talk" | "meal"

interface HeaderProps {
  activeNavTab?: HeaderNavTab | null
  onNavTabChange?: (tab: HeaderNavTab) => void
  hoveredTab?: HeaderNavTab | null
}

const navItems = [
  { id: "solo" as HeaderNavTab, label: "솔로", icon: User },
  { id: "family" as HeaderNavTab, label: "패밀리", icon: Users },
  { id: "talk" as HeaderNavTab, label: "맛톡", icon: MessageSquare },
  { id: "meal" as HeaderNavTab, label: "급식", icon: UtensilsCrossed },
]

export function Header({ activeNavTab = "solo", onNavTabChange, hoveredTab = null }: HeaderProps) {
  const router = useRouter()
  const { user, isLoggedIn, isLoading } = useHub()

  const handleProfileClick = () => {
    if (isLoading) return
    if (isLoggedIn) {
      router.push('/profile')
    } else {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
    }
  }

  return (
    <header 
      className="fixed top-0 left-0 right-0 w-full bg-white/70 backdrop-blur-md border-b border-gray-100/60 flex justify-center z-50"
      style={{ '--app-header-height': '62px' } as React.CSSProperties}
    >
      <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] flex min-h-[62px] items-center px-4 py-3 justify-between">
        {/* Logo */}
        <Image 
          src={whatEatLogo}
          alt="뭐먹지?" 
          width={120}
          height={56}
          className="h-9 w-auto shrink-0 object-contain cursor-pointer"
          onClick={() => onNavTabChange?.("home")}
        />
        {/* Main Nav - 텍스트만, 가운데 정렬 및 온보딩 연동 하이라이트 효과 적용 */}
        <div className="flex items-center justify-center gap-4 flex-1 mx-4">
          {navItems.map((item) => {
            const isHovered = hoveredTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavTabChange?.(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-bold leading-none transition-all whitespace-nowrap cursor-pointer",
                  activeNavTab === item.id
                    ? "text-cyan-600 bg-cyan-50 shadow-sm"
                    : isHovered
                      ? "text-cyan-500 bg-cyan-50/70 animate-pulse ring-2 ring-cyan-400/30 scale-105"
                      : "text-gray-500 hover:text-cyan-500 hover:scale-105"
                )}
              >
                <item.icon className="hidden size-3.5 md:inline-block" />
                {item.label}
              </button>
            );
          })}
        </div>
        {/* 프로필 및 스위처 */}
        <div className="flex shrink-0 items-center gap-2">
          <HubAppSwitcher currentAppId="whateat" joinedAppIds={[]} />
          <button
            type="button"
            onClick={handleProfileClick}
            className="flex items-center gap-2 cursor-pointer group"
            aria-label="프로필 설정 열기"
          >
            {/* 프로필 이미지 - 모바일에서는 숨기고 PC(sm 이상)에서만 노출 */}
            <div className="hidden sm:flex size-8 shrink-0 rounded-full overflow-hidden border border-cyan-100 ring-2 ring-cyan-200 transition-colors group-hover:ring-cyan-300 items-center justify-center">
              <HubAvatar
                isLoggedIn={isLoggedIn}
                avatarUrl={user?.avatar_url}
                nickname={(user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '회원')}
                size="sm"
                className="w-full h-full rounded-full"
              />
            </div>
            {/* 닉네임 - 모바일과 PC 모두 노출 (모바일에서는 이미지 없이 텍스트만 노출) */}
            <span className="text-[14px] font-bold text-gray-700 group-hover:text-cyan-600 transition-colors max-w-[120px] truncate">
              {isLoggedIn 
                ? ((user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || ''))
                : '게스트'}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
