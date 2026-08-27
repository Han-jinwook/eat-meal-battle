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
  { id: "solo" as HeaderNavTab, label: "솔로", shortLabel: "솔로", icon: User },
  { id: "family" as HeaderNavTab, label: "가족/모임", shortLabel: "가족", icon: Users },
  { id: "talk" as HeaderNavTab, label: "맛톡", shortLabel: "맛톡", icon: MessageSquare },
  { id: "meal" as HeaderNavTab, label: "급식", shortLabel: "급식", icon: UtensilsCrossed },
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
      style={{ '--app-header-height': '54px' } as React.CSSProperties}
    >
      <div className="w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] flex min-h-[54px] items-center px-4 sm:px-5 py-1.5 justify-between gap-1">
        {/* Logo */}
        <Image 
          src={whatEatLogo}
          alt="뭐먹지?" 
          width={80}
          height={38}
          className="h-7 sm:h-8.5 w-auto shrink-0 object-contain cursor-pointer"
          onClick={() => onNavTabChange?.("home")}
          priority
        />
        {/* Main Nav - 4개 메뉴 컴팩트 정렬 */}
        <nav className="flex items-center justify-center gap-0.5 sm:gap-2">
          {navItems.map((item) => {
            const isHovered = hoveredTab === item.id;
            const isActive = activeNavTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavTabChange?.(item.id)}
                className={cn(
                  "inline-flex items-center justify-center gap-1 rounded-full py-1.5 sm:py-2 px-2 sm:px-3.5 text-[13px] sm:text-[14px] font-bold leading-none transition-all whitespace-nowrap cursor-pointer text-center",
                  isActive
                    ? "text-cyan-600 bg-cyan-50 shadow-2xs ring-1 ring-cyan-200/70"
                    : isHovered
                      ? "text-cyan-500 bg-cyan-50/70 ring-2 ring-cyan-400/30 scale-105"
                      : "text-gray-600 hover:text-cyan-500 hover:scale-105"
                )}
              >
                <item.icon className="hidden md:inline-block size-3.5" />
                {/* 모바일(sm 미만)에서는 2글자 컴팩트 라벨('가족'), sm 이상에서는 전체 라벨('가족/모임') */}
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
        {/* 우측 프로필 & 패밀리앱 스위처(F) [🥳F] 마이크로 캡슐 표준 규격 */}
        <div className="flex items-center bg-slate-50/90 sm:bg-slate-50/60 rounded-full sm:rounded-2xl p-0.5 sm:p-1 border border-slate-200/80 sm:border-slate-100/50 shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={handleProfileClick}
            className="flex items-center gap-1 sm:gap-2 cursor-pointer group"
            aria-label="프로필 설정 열기"
          >
            {/* 28px(w-7 h-7) 원형 아바타 (모바일 28px 초밀착 원형 규격) */}
            <div className="size-7 sm:size-8 shrink-0 rounded-full overflow-hidden border border-cyan-100 ring-1.5 sm:ring-2 ring-cyan-200 transition-all group-hover:ring-cyan-400 flex items-center justify-center bg-orange-50">
              <HubAvatar
                isLoggedIn={isLoggedIn}
                avatarUrl={user?.avatar_url}
                nickname={(user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '회원')}
                size="sm"
                className="!w-7 !h-7 sm:!w-8 sm:!h-8 !rounded-full"
              />
            </div>
            {/* 텍스트 닉네임 - 모바일에서는 숨기고 PC(sm 이상)에서만 노출 */}
            <span className="hidden sm:inline-block text-[13px] sm:text-[14px] font-bold text-gray-700 group-hover:text-cyan-600 transition-colors max-w-[100px] truncate">
              {isLoggedIn 
                ? ((user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || ''))
                : '게스트'}
            </span>
          </button>
          
          {/* F 스위처 버튼 (여백 없이 초밀착 28px) */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center overflow-hidden rounded-full [&>div]:inline-flex [&_button]:!w-7 [&_button]:!h-7 sm:[&_button]:!w-8 sm:[&_button]:!h-8 [&_img]:!w-5 [&_img]:!h-5 sm:[&_img]:!w-6 sm:[&_img]:!h-6">
            <HubAppSwitcher currentAppId="whateat" joinedAppIds={[]} />
          </div>
        </div>
      </div>
    </header>
  )
}
