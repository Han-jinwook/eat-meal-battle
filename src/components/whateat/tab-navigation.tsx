"use client"

import { cn } from "@/lib/utils"

interface TabNavigationProps {
  activeTab: "log" | "reservation" | "calendar"
  onTabChange: (tab: "log" | "reservation" | "calendar") => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

const tabs = [
  { id: "log" as const, label: "먹로그" },
  { id: "reservation" as const, label: "먹예약" },
  { id: "calendar" as const, label: "먹캘린더" },
]

export function TabNavigation({ 
  activeTab, 
  onTabChange, 
  searchQuery,
  onSearchChange
}: TabNavigationProps) {

  return (
    <div className="flex flex-col">
      {/* Tab Row + Notification/Profile */}
      <div className="flex items-center gap-1 border-b border-cyan-100/80">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-6 py-3.5 text-base font-bold transition-all duration-300 relative whitespace-nowrap rounded-t-xl cursor-pointer",
              activeTab === tab.id
                ? "text-cyan-600 bg-cyan-50/50 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[3px] after:bg-cyan-500 after:rounded-full"
                : "text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50/30"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
