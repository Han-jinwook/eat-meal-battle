"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { HubAuthModal, HubBenefitModal } from "@/services/merlin-hub-sdk/react"

/**
 * 전역 단일 로그인 모달 (허브 표준)
 * - 최상위 레이아웃에 단 1회만 배치한다.
 * - 로그인/본인인증이 필요한 지점에서는 아래 이벤트만 디스패치한다:
 *     window.dispatchEvent(new CustomEvent('openLoginModal'))
 * - 개별 페이지/컴포넌트에서 HubAuthModal 을 중복 선언하지 말 것.
 */
export function GlobalLoginModal() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname() || ""

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("openLoginModal", handler)
    window.addEventListener("merlinSessionExpired", handler)
    return () => {
      window.removeEventListener("openLoginModal", handler)
      window.removeEventListener("merlinSessionExpired", handler)
    }
  }, [])

  const handleClose = () => {
    setOpen(false)
    // /login 페이지에서 모달을 닫고 나갈 경우, 홈으로 리다이렉트하여 로딩 루프 탈출
    if (pathname === "/login" || pathname.startsWith("/login")) {
      router.replace("/")
    }
  }

  return (
    <>
      <HubBenefitModal
        customBenefitTitle="우리 학교 급식 알림"
        customBenefitDesc="우리 학교 급식·퀴즈 정보를 가족과 함께 확인하세요"
        customBenefitIcon="🍱"
      />
      <HubAuthModal
        isOpen={open}
        onClose={handleClose}
        onSuccess={async (email?: string) => {
          if (email) localStorage.setItem("userEmail", email)
          setOpen(false)
          window.location.reload() // 세션 동기화를 위해 리로딩 권장
        }}
        appName="뭐먹지?"
        appLogoUrl="/icons/icon-192x192.png"
        subtitleActionText="급식 퀴즈에"
      />
    </>
  )
}
