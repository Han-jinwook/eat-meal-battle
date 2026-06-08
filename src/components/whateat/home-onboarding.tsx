"use client"

import { User, Users, MessageSquare, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { useEffect, useState } from "react"
 
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
 
export function HomeOnboarding({ onStart }: { onStart: () => void }) {
  const { isLoggedIn, isLoading } = useHub()
  const [scrolled, setScrolled] = useState(false)
 
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled)
      }
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [scrolled])
 
  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gradient-to-br from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] pt-8 pb-12 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-80 h-80 bg-cyan-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-pink-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
 
      <div className="w-full max-w-2xl px-6 relative z-10 flex flex-col items-center">
        
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center mt-6 mb-10">
          
          <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight leading-[1.2] mb-4 drop-shadow-sm">
            배고픈 순간, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
              가장 먼저 꺼내는
            </span>
          </h1>
          
          <p className="text-[15px] sm:text-base text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
            당신의 맛집 서랍장 <strong className="text-slate-700">"뭐먹지?"</strong> 하나면 충분합니다.
          </p>
        </div>
 
        {/* Features Section */}
        <div className="grid grid-cols-2 gap-6 w-full max-w-2xl mx-auto mb-10">
          {features.map((feature, idx) => (
            <div 
              key={feature.id} 
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white shadow-md relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner", feature.bg)}>
                  <feature.icon className={cn("size-5", feature.iconColor)} strokeWidth={2.5} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">{feature.title}</h3>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-400 font-medium leading-relaxed">
                {feature.desc}
              </p>
              
              {/* Card Decoration */}
              <div className={cn(
                "absolute -right-10 -bottom-10 size-28 rounded-full opacity-10 bg-gradient-to-br blur-xl group-hover:opacity-20 transition-opacity duration-500",
                feature.color
              )} />
            </div>
          ))}
        </div>
 
        {/* Bottom CTA */}
        <div className="w-full text-center pb-8 flex flex-col items-center">
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
            className="group relative inline-flex items-center justify-center gap-2 px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-base overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_30px_6px_rgba(249,115,22,0.25)] active:scale-95 w-full max-w-sm"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-orange-500 via-pink-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_auto] animate-gradient" />
            <span className="relative z-10 flex items-center gap-2">
              {isLoading ? "로딩중..." : (isLoggedIn ? "내 맛집 서랍 열기" : "3초만에 시작하기 ⚡")}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
