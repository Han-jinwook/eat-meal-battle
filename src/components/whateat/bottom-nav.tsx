"use client"

import { User, Users, MessageSquare, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"

export type BottomNavTab = "solo" | "family" | "talk" | "meal"

interface BottomNavProps {
  activeTab?: BottomNavTab
  onTabChange?: (tab: BottomNavTab) => void
}

const navItems = [
  { id: "solo" as BottomNavTab, label: "솔로", icon: User },
  { id: "family" as BottomNavTab, label: "패밀리", icon: Users },
  { id: "talk" as BottomNavTab, label: "맛톡", icon: MessageSquare },
  { id: "meal" as BottomNavTab, label: "급식", icon: UtensilsCrossed },
]

export function BottomNav({ activeTab = "solo", onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white backdrop-blur-2xl border-t border-cyan-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] h-20 flex items-center px-6 z-[100]">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onTabChange?.(item.id)}
          className={cn(
            "flex flex-col items-center justify-center gap-1.5 flex-1 py-2 rounded-xl transition-all",
            activeTab === item.id 
              ? "text-cyan-600 bg-cyan-50" 
              : "text-gray-400 hover:text-cyan-500"
          )}
        >
          <item.icon className={cn("size-6", activeTab === item.id && "fill-cyan-100 stroke-cyan-600")} />
          <span className="text-[10px] font-bold">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
