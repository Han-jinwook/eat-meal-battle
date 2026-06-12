"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

interface ImageViewerProps {
  src: string
  alt?: string
  isOpen: boolean
  onClose: () => void
}

export function ImageViewer({ src, alt = "이미지", isOpen, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  const reset = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    positionRef.current = { x: 0, y: 0 }
  }, [])

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) reset()
  }, [isOpen, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  // wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale(prev => Math.min(5, Math.max(0.5, prev - e.deltaY * 0.001)))
  }, [])

  // mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - positionRef.current.x, y: e.clientY - positionRef.current.y }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const next = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }
    positionRef.current = next
    setPosition(next)
  }
  const handleMouseUp = () => setIsDragging(false)

  // touch pinch & drag
  const lastTouchDist = useRef<number | null>(null)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (lastTouchDist.current !== null) {
        const delta = dist - lastTouchDist.current
        setScale(prev => Math.min(5, Math.max(0.5, prev + delta * 0.005)))
      }
      lastTouchDist.current = dist
    } else if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0]
      const next = { x: touch.clientX - dragStart.current.x, y: touch.clientY - dragStart.current.y }
      positionRef.current = next
      setPosition(next)
    }
  }
  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchDist.current = null
    if (e.touches.length === 1) {
      dragStart.current = {
        x: e.touches[0].clientX - positionRef.current.x,
        y: e.touches[0].clientY - positionRef.current.y,
      }
    }
  }
  const handleTouchEnd = () => { lastTouchDist.current = null }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={() => setScale(prev => Math.min(5, prev + 0.5))}
          className="size-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white flex items-center justify-center transition-all shadow-md"
          title="확대"
        >
          <ZoomIn className="size-5" />
        </button>
        <button
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.5))}
          className="size-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white flex items-center justify-center transition-all shadow-md"
          title="축소"
        >
          <ZoomOut className="size-5" />
        </button>
        <button
          onClick={reset}
          className="size-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white flex items-center justify-center transition-all shadow-md"
          title="초기화"
        >
          <RotateCcw className="size-5" />
        </button>
        <button
          onClick={onClose}
          className="size-11 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all shadow-lg border-2 border-orange-100/50"
          title="닫기"
        >
          <X className="size-6" strokeWidth={2.5} />
        </button>
      </div>

      {/* Zoom indicator */}
      {scale !== 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 border border-white/10 backdrop-blur-sm rounded-full text-white text-xs font-bold shadow-md">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Image */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg select-none transition-transform duration-100 shadow-2xl"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          }}
        />
      </div>
    </div>,
    document.body
  )
}
