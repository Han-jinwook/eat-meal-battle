"use client"

import { Plus } from "lucide-react"

interface FloatingActionButtonProps {
  onClick: () => void
}

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <div className="sticky bottom-0 z-50 pointer-events-none">
      <div className="relative h-0">
        <button
          onClick={onClick}
          className="pointer-events-auto absolute bottom-8 right-5 size-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
