"use client"

import { User, Users, MessageSquare, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { useEffect, useState } from "react"
import Image from "next/image"
import whatEatLogo from "../../../public/images/logo.png"
 
const features = [
  {
    id: "solo",
    title: "나만의 맛집 서랍장",
    desc: "기억하고 싶은 맛, 다시 가고 싶은 곳. 흩어져 있던 나만의 입맛을 차곡차곡 기록하세요.",
    icon: User,
    color: "from-blue-400 to-cyan-400",
    shadow: "shadow-cyan-200",
    bg: "bg-cyan-50",
    iconColor: "text-cyan-500",
  },
  {
    id: "family",
    title: "가족 식탁의 즐거움",
    desc: "오늘 저녁 뭐 먹지? 함께 메뉴를 투표하고, 우리가족이 공유한 맛있는 식탁을 즐겨보세요.",
    icon: Users,
    color: "from-orange-400 to-pink-400",
    shadow: "shadow-orange-200",
    bg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    id: "talk",
    title: "동네 찐 맛집 발견",
    desc: "광고 없는 진짜 리뷰. 우리 이웃들이 직접 인정한 5점 만점 맛집들을 확인하세요.",
    icon: MessageSquare,
    color: "from-green-400 to-emerald-400",
    shadow: "shadow-emerald-200",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-500",
  },
  {
    id: "meal",
    title: "우리 아이 학교 급식",
    desc: "오늘 메뉴는 뭘까? 아이의 급식 평가를 확인하고, 식단과 연계된 재미있는 AI 퀴즈도 즐겨보세요.",
    icon: UtensilsCrossed,
    color: "from-purple-400 to-indigo-400",
    shadow: "shadow-indigo-200",
    bg: "bg-indigo-50",
    iconColor: "text-indigo-500",
  },
]
 
export function HomeOnboarding({ 
  onStart,
  onHoverTab
}: { 
  onStart: (targetTab?: HeaderNavTab) => void 
  onHoverTab?: (tab: HeaderNavTab | null) => void
}) {
  const { isLoggedIn, isLoading } = useHub()
 
  return (
    <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] pt-4 pb-4 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-80 h-80 bg-cyan-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-pink-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
 
      <div className="w-full max-w-3xl px-8 relative z-10 flex flex-col items-center">
        
        {/* Hero Section (Reverted to compact size) */}
        <div className="flex flex-col items-center text-center mt-2 mb-8">
          
          <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-[1.2] mb-3 drop-shadow-sm">
            배고픈 순간, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
              가장 먼저 꺼내는
            </span>
          </h1>
          
          <p className="text-[13px] sm:text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto flex items-center justify-center gap-1 flex-wrap">
            <span>당신의 맛집 서랍장</span>
            <Image 
              src={whatEatLogo} 
              alt="뭐먹지?" 
              width={90} 
              height={40} 
              className="h-6.5 w-auto object-contain inline-block transform translate-y-[-2px] mx-0.5"
            />
            <span>하나면 충분합니다.</span>
          </p>
        </div>
 
        {/* Features Section (마우스오버 입체감 & 헤더 하이라이트 동기화) */}
        <div className="grid grid-cols-2 gap-8 w-full max-w-3xl mx-auto mb-6">
          {features.map((feature, idx) => (
            <div 
              key={feature.id} 
              onMouseEnter={() => onHoverTab?.(feature.id as HeaderNavTab)}
              onMouseLeave={() => onHoverTab?.(null)}
              onClick={() => {
                onHoverTab?.(null);
                if (!isLoading) {
                  // 비로그인 상태여도 인증 모달을 띄우지 않고, 클릭한 탭 레이아웃을 구경할 수 있도록 다이렉트 점핑
                  onStart(feature.id as HeaderNavTab);
                }
              }}
              className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 border border-white/80 shadow-md relative overflow-hidden group hover:-translate-y-2 hover:shadow-xl hover:border-orange-200/50 active:scale-[0.98] transition-all duration-300 flex flex-col gap-4 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={cn("size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300", feature.bg)}>
                  <feature.icon className={cn("size-6", feature.iconColor)} strokeWidth={2.5} />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors">{feature.title}</h3>
              </div>
              <p className="text-sm sm:text-[15px] text-slate-400 font-semibold leading-relaxed group-hover:text-slate-500 transition-colors">
                {feature.desc}
              </p>
              
              {/* Card Decoration */}
              <div className={cn(
                "absolute -right-8 -bottom-8 size-36 rounded-full opacity-10 bg-gradient-to-br blur-xl group-hover:opacity-25 transition-opacity duration-500",
                feature.color
              )} />
            </div>
          ))}
        </div>
 
        {/* Bottom CTA (Kept scaled up from ef73c2f) */}
        <div className="w-full text-center pb-0 flex flex-col items-center">
          <button
            onClick={() => {
              if (!isLoading) {
                if (isLoggedIn) {
                  onStart()
                } else {
                  window.dispatchEvent(new CustomEvent('openLoginModal'))
                }
              }
            }}
            className={cn(
              "group relative inline-flex items-center justify-center gap-2 px-12 py-5 rounded-2xl font-bold text-lg overflow-hidden transition-all active:scale-95 w-full max-w-md cursor-pointer",
              isLoggedIn 
                ? "bg-slate-900 text-white hover:scale-105 hover:shadow-[0_0_30px_6px_rgba(249,115,22,0.25)]"
                : "bg-cyan-500 hover:bg-cyan-600 text-white hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20"
            )}
          >
            {isLoggedIn && (
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_auto] animate-gradient" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {isLoading ? "로딩중..." : (isLoggedIn ? "내 맛집 서랍 열기" : "이메일로 3초 로그인하기 ⚡")}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
