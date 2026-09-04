import { useState, useEffect, useCallback } from "react"
import { 
  X, 
  MapPin, 
  Youtube, 
  ExternalLink, 
  ChefHat, 
  Bike, 
  UtensilsCrossed, 
  Heart, 
  MessageCircle, 
  Send, 
  Pencil, 
  Trash2, 
  CornerDownRight 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { createClient } from "@/lib/supabase"
import { secureWrite } from "@/lib/supabase-safe"

export interface DetailPlanData {
  id: number | string
  date: string
  time: string
  mealType: string
  menu: string
  place: string
  memo: string
  thumbnail?: string
  url?: string
  userId?: string
  nickname?: string
  author?: string
  sharedBy?: string
  createdAt?: string
  isSample?: boolean
}

interface ReservationDetailModalProps {
  isOpen: boolean
  onClose: () => void
  plan: DetailPlanData | null
}

interface CommentReply {
  id: string | number
  userId: string
  author: string
  content: string
  createdAt: string
  likes: number
  isLiked?: boolean
}

interface MealComment {
  id: string | number
  userId: string
  author: string
  content: string
  createdAt: string
  likes: number
  isLiked?: boolean
  replies: CommentReply[]
}

export function parseSourceUrls(urlStr?: string | null) {
  if (!urlStr) return { placeUrl: "", videoUrl: "" }
  if (urlStr.startsWith("{")) {
    try {
      const parsed = JSON.parse(urlStr)
      return {
        placeUrl: parsed.placeUrl || "",
        videoUrl: parsed.videoUrl || ""
      }
    } catch (e) {}
  }
  if (urlStr.includes("youtube.com") || urlStr.includes("youtu.be") || urlStr.includes("instagram.com") || urlStr.includes("tiktok.com")) {
    return { placeUrl: "", videoUrl: urlStr }
  } else {
    return { placeUrl: urlStr, videoUrl: "" }
  }
}

export function stringifySourceUrls(placeUrl?: string, videoUrl?: string): string | undefined {
  const p = placeUrl?.trim() || ""
  const v = videoUrl?.trim() || ""
  if (p && v) {
    return JSON.stringify({ placeUrl: p, videoUrl: v })
  }
  return p || v || undefined
}

function parseRegionFromAddress(address: string) {
  const parts = address.split(" ").filter(Boolean)
  return {
    city: parts[0] || "",
    gu: parts[1] || "",
    dong: parts[2] || ""
  }
}

function formatRegionStr(city?: string, gu?: string, dong?: string) {
  if (!city && !gu && !dong) return ""
  return [city, gu, dong].filter(Boolean).join("/")
}

export function ReservationDetailModal({ isOpen, onClose, plan }: ReservationDetailModalProps) {
  const { isLoggedIn, user } = useHub()
  const [likedUsers, setLikedUsers] = useState<string[]>([])
  const [comments, setComments] = useState<MealComment[]>([])
  const [commentInput, setCommentInput] = useState("")
  const [replyInput, setReplyInput] = useState("")
  const [activeReplyTarget, setActiveReplyTarget] = useState<string | number | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | number | null>(null)
  const [editCommentText, setEditCommentText] = useState("")

  const planId = plan?.id
  const isSample = plan?.isSample || (typeof planId === "string" && planId.startsWith("sample-")) || planId === 1 || planId === 2 || planId === 3

  // 1. Fetch Likes & Comments for this reservation
  const fetchCardData = useCallback(async () => {
    if (!planId || isSample) return
    try {
      const supabase = createClient()

      // 1-1. Fetch Likes
      const { data: likesData } = await supabase
        .from("meal_likes")
        .select("user_id")
        .eq("meal_id", planId)

      if (likesData) {
        setLikedUsers(likesData.map((l: any) => l.user_id))
      }

      // 1-2. Fetch Comments
      const { data: commentsData } = await supabase
        .from("comments")
        .select("*")
        .eq("meal_id", planId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })

      if (commentsData) {
        const commentIds = commentsData.map((c: any) => c.id)
        let repliesData: any[] = []
        if (commentIds.length > 0) {
          const { data: repData } = await supabase
            .from("comment_replies")
            .select("*")
            .in("comment_id", commentIds)
            .eq("is_deleted", false)
            .order("created_at", { ascending: true })
          if (repData) repliesData = repData
        }

        const userIds = Array.from(new Set([
          ...commentsData.map((c: any) => c.user_id),
          ...repliesData.map((r: any) => r.user_id)
        ]))

        const userMap: Record<string, string> = {}
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, nickname")
            .in("id", userIds)
          if (usersData) {
            usersData.forEach((u: any) => {
              userMap[u.id] = u.nickname
            })
          }
        }

        const mappedComments: MealComment[] = commentsData.map((c: any) => {
          const cReplies: CommentReply[] = repliesData
            .filter((r: any) => r.comment_id === c.id)
            .map((r: any) => ({
              id: r.id,
              userId: r.user_id,
              author: r.user_id === user?.id ? "나" : (userMap[r.user_id] || "가족"),
              content: r.content,
              createdAt: new Date(r.created_at).toLocaleDateString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
              likes: r.likes_count || 0
            }))

          return {
            id: c.id,
            userId: c.user_id,
            author: c.user_id === user?.id ? "나" : (userMap[c.user_id] || "가족"),
            content: c.content,
            createdAt: new Date(c.created_at).toLocaleDateString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
            likes: c.likes_count || 0,
            replies: cReplies
          }
        })

        setComments(mappedComments)
      }
    } catch (err) {
      console.error("Failed to fetch card details:", err)
    }
  }, [planId, isSample, user?.id])

  useEffect(() => {
    if (isOpen && planId) {
      fetchCardData()
    }
  }, [isOpen, planId, fetchCardData])

  // Realtime subscription for likes & comments
  useEffect(() => {
    if (!isOpen || !planId || isSample) return

    const supabase = createClient()
    const ts = Date.now()
    const channel = supabase
      .channel(`realtime:reservation_detail:${planId}:${ts}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `meal_id=eq.${planId}` }, () => {
        fetchCardData()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_likes", filter: `meal_id=eq.${planId}` }, () => {
        fetchCardData()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_replies" }, () => {
        fetchCardData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, planId, isSample, fetchCardData])

  if (!isOpen || !plan) return null

  const hasLiked = user?.id ? likedUsers.includes(user.id) : false

  // Handle Like Toggle
  const handleToggleLike = async () => {
    if (isSample) {
      toast("샘플이라 좋아요 저장이 안 되며, 새 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent("openLoginModal"))
      return
    }

    if (hasLiked) {
      setLikedUsers(prev => prev.filter(id => id !== user.id))
      try {
        await secureWrite({
          table: "meal_likes",
          action: "delete",
          filters: { meal_id: plan.id }
        })
      } catch (err) {
        setLikedUsers(prev => [...prev, user.id])
        toast.error("좋아요 취소에 실패했습니다.")
      }
    } else {
      setLikedUsers(prev => [...prev, user.id])
      try {
        await secureWrite({
          table: "meal_likes",
          action: "insert",
          data: {
            meal_id: plan.id,
            user_id: user.id
          }
        })
      } catch (err) {
        setLikedUsers(prev => prev.filter(id => id !== user.id))
        toast.error("좋아요 저장에 실패했습니다.")
      }
    }
  }

  // Handle Add Comment
  const handleAddComment = async () => {
    const text = commentInput.trim()
    if (!text) return
    if (isSample) {
      toast("샘플이라 댓글 작성이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent("openLoginModal"))
      return
    }

    const tempId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`
    const newCommentObj: MealComment = {
      id: tempId,
      userId: user.id,
      author: "나",
      content: text,
      createdAt: new Date().toLocaleDateString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      likes: 0,
      replies: []
    }

    setComments(prev => [...prev, newCommentObj])
    setCommentInput("")

    try {
      await secureWrite({
        table: "comments",
        action: "insert",
        data: {
          id: tempId,
          meal_id: plan.id,
          user_id: user.id,
          content: text,
          is_deleted: false
        }
      })
      fetchCardData()
    } catch (err) {
      setComments(prev => prev.filter(c => c.id !== tempId))
      toast.error("댓글 저장에 실패했습니다.")
    }
  }

  // Handle Add Reply
  const handleAddReply = async (commentId: string | number) => {
    const text = replyInput.trim()
    if (!text) return
    if (isSample) {
      toast("샘플이라 답글 작성이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent("openLoginModal"))
      return
    }

    const replyId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `reply-${Date.now()}`
    try {
      await secureWrite({
        table: "comment_replies",
        action: "insert",
        data: {
          id: replyId,
          comment_id: commentId,
          user_id: user.id,
          content: text,
          is_deleted: false
        }
      })
      setReplyInput("")
      setActiveReplyTarget(null)
      fetchCardData()
    } catch (err) {
      toast.error("답글 저장에 실패했습니다.")
    }
  }

  // Format Card Date
  const formatHeaderDate = (dateStr: string, timeStr?: string) => {
    if (!dateStr) return ""
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      const month = d.getMonth() + 1
      const day = d.getDate()
      let formatted = `${month}월 ${day}일`
      if (timeStr) {
        formatted += ` · ${timeStr}`
      }
      return formatted
    } catch (e) {
      return dateStr
    }
  }

  const authorName = plan.userId === user?.id 
    ? "나" 
    : (plan.nickname || plan.author || plan.sharedBy || "가족")

  const typeMap: Record<string, "집밥" | "배달" | "외식"> = {
    homemade: "집밥",
    home: "집밥",
    delivery: "배달",
    dining: "외식",
    dineout: "외식",
    집밥: "집밥",
    배달: "배달",
    외식: "외식"
  }
  const displayMealType = typeMap[plan.mealType] || plan.mealType || "외식"

  const TypeIcon = displayMealType === "집밥" 
    ? ChefHat 
    : displayMealType === "배달" 
      ? Bike 
      : UtensilsCrossed

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] p-3.5 sm:p-4 rounded-[28px] sm:rounded-[32px] shadow-2xl border border-white/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 팝업 헤더 */}
        <div className="flex items-center justify-between px-2 pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
            <TypeIcon className="size-4 text-orange-500" strokeWidth={2.2} />
            <span>식사 예약 상세</span>
          </div>
          <button 
            onClick={onClose}
            className="size-7.5 flex items-center justify-center rounded-full bg-white/90 shadow-xs border border-gray-200/80 text-gray-600 hover:text-foreground hover:bg-white transition-colors cursor-pointer shrink-0"
            title="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 카드 컨테이너 (배경 위에 떠 있는 카드) */}
        <div className={cn(
          "flex-1 overflow-y-auto rounded-2xl sm:rounded-3xl shadow-sm bg-white border border-gray-200/80 border-l-4 flex flex-col",
          displayMealType === "집밥" && "border-l-emerald-500",
          displayMealType === "배달" && "border-l-sky-500",
          displayMealType === "외식" && "border-l-orange-500",
          !displayMealType && "border-l-orange-500"
        )}>
          {/* 1. 상단 카드 헤더 */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-gray-100/80 bg-white">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {/* 식사유형 뱃지 */}
              <div className={cn(
                "px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 border text-xs font-bold shrink-0 shadow-2xs",
                displayMealType === "집밥" && "bg-emerald-50 text-emerald-700 border-emerald-200/80",
                displayMealType === "배달" && "bg-sky-50 text-sky-700 border-sky-200/80",
                displayMealType === "외식" && "bg-orange-50 text-orange-700 border-orange-200/80",
                !displayMealType && "bg-gray-50 text-gray-700 border-gray-200"
              )}>
                <TypeIcon className="size-3.5 shrink-0" strokeWidth={2.2} />
                <span>{displayMealType || "식사"}</span>
              </div>

              {/* 헤더 텍스트: 작성자 · 📅 날짜 */}
              <div className="flex items-center gap-1 text-xs font-bold text-gray-800 min-w-0">
                <span className="text-foreground font-black shrink-0">{authorName}</span>
                <span className="text-gray-300">·</span>
                {plan.date && (
                  <span className="truncate text-muted-foreground">
                    📅 {formatHeaderDate(plan.date, plan.time)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. 스크롤 가능한 본문 영역 */}
          <div className="flex-1 overflow-y-auto">
          {/* 2-1. 카드 본문 2단 구조 (좌: 메뉴명/장소/메모, 우: 썸네일) */}
          <div className="p-4 flex items-start justify-between gap-3 bg-white">
            {/* 좌측 텍스트 & 정보 구역 */}
            <div className="flex-1 min-w-0">
              {/* 메뉴 제목 */}
              <h4 className="font-bold text-foreground text-base sm:text-lg leading-snug">
                {plan.menu}
              </h4>

              {/* 식당 주소 또는 숏폼 뱃지 */}
              {plan.place ? (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 text-orange-500 shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {(() => {
                      if (plan.place.includes("/")) return plan.place
                      if (plan.place.includes(" ")) {
                        const reg = parseRegionFromAddress(plan.place)
                        const formatted = formatRegionStr(reg.city, reg.gu, reg.dong)
                        if (formatted) return formatted
                      }
                      return plan.place
                    })()}
                  </span>
                </div>
              ) : (
                plan.url && (plan.url.includes("youtube.com") || plan.url.includes("youtu.be") || plan.url.includes("tiktok.com") || plan.url.includes("instagram.com")) && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/70 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                      <Youtube className="size-3 text-red-500 shrink-0" />
                      <span>숏폼 영상</span>
                    </span>
                  </div>
                )
              )}

              {/* 메모 말풍선 */}
              {plan.memo && (
                <div className="mt-2.5 p-2.5 bg-orange-50/60 rounded-xl border border-orange-100/70 text-xs text-foreground/90 leading-relaxed">
                  <p className="font-medium">{plan.memo}</p>
                </div>
              )}
            </div>

            {/* 우측 썸네일 이미지 */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {plan.thumbnail ? (
                <div 
                  className={cn(
                    "size-24 sm:size-28 rounded-2xl overflow-hidden shrink-0 relative bg-muted border border-muted/40 shadow-sm",
                    plan.url && "cursor-pointer group"
                  )}
                  onClick={() => {
                    if (plan.url) window.open(plan.url, '_blank')
                  }}
                  title={plan.url ? "클릭 시 해당 링크로 이동합니다" : undefined}
                >
                  <img 
                    src={plan.thumbnail} 
                    alt={plan.menu} 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
                    }}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                  />
                  {plan.url && (
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-end justify-end p-1.5">
                      <div className="size-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white">
                        <ExternalLink className="size-3" />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* 2-2. 좋아요 / 댓글 수 요약 바 */}
          <div className="flex items-center justify-between border-y border-muted/30 px-4 py-2.5 bg-gray-50/50">
            <div className="flex items-center gap-4">
              <button
                onClick={handleToggleLike}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${hasLiked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}
              >
                <Heart className={`size-4 ${hasLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                <span>좋아요 {likedUsers.length > 0 ? likedUsers.length : ""}</span>
              </button>
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <MessageCircle className="size-4" />
                <span>댓글 {comments.length > 0 ? comments.length : ""}</span>
              </div>
            </div>
          </div>

          {/* 2-3. 댓글 목록 섹션 */}
          <div className="p-4 bg-white space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-foreground">
              <MessageCircle className="size-3.5 text-orange-500" />
              <span>댓글 {comments.length}개</span>
            </div>

            {comments.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                아직 등록된 댓글이 없습니다.<br />가족과 함께 먹고 싶은 의견을 남겨보세요! 💬
              </div>
            ) : (
              <div className="space-y-2.5">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-1.5">
                    {/* 댓글 말풍선 */}
                    <div className="bg-orange-50/40 border border-orange-100/60 rounded-2xl p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-foreground">{comment.author}</span>
                          <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
                        </div>
                        {comment.userId === user?.id && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <button
                              onClick={() => {
                                setEditingCommentId(comment.id)
                                setEditCommentText(comment.content)
                              }}
                              className="p-1 hover:text-foreground transition-colors cursor-pointer"
                              title="수정"
                            >
                              <Pencil className="size-2.5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm("댓글을 삭제하시겠습니까?")) {
                                  try {
                                    await secureWrite({
                                      table: "comments",
                                      action: "update",
                                      data: { id: comment.id, is_deleted: true }
                                    })
                                    fetchCardData()
                                  } catch (err) {
                                    toast.error("댓글 삭제에 실패했습니다.")
                                  }
                                }
                              }}
                              className="p-1 hover:text-red-500 transition-colors cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="size-2.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {editingCommentId === comment.id ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <input
                            type="text"
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            className="flex-1 bg-white border border-orange-200 rounded-lg px-2.5 py-1 text-xs outline-none"
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              try {
                                await secureWrite({
                                  table: "comments",
                                  action: "update",
                                  data: { id: comment.id, content: editCommentText.trim() }
                                })
                                setEditingCommentId(null)
                                fetchCardData()
                              } catch (err) {
                                toast.error("수정에 실패했습니다.")
                              }
                            }}
                            className="px-2 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingCommentId(null)}
                            className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <p className="text-foreground/90 font-medium whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </p>
                      )}

                      {/* 답글 달기 버튼 */}
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t border-orange-100/50">
                        <button
                          onClick={() => {
                            setActiveReplyTarget(activeReplyTarget === comment.id ? null : comment.id)
                            setReplyInput("")
                          }}
                          className="text-[11px] font-bold text-muted-foreground hover:text-orange-600 transition-colors cursor-pointer"
                        >
                          답글 달기
                        </button>
                      </div>
                    </div>

                    {/* 대댓글(답글) 목록 */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="pl-4 space-y-1.5 border-l-2 border-orange-200/70 ml-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="bg-gray-50/80 border border-gray-200/60 rounded-xl p-2.5 text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                <CornerDownRight className="size-2.5 text-muted-foreground" />
                                <span className="font-extrabold text-foreground">{reply.author}</span>
                                <span className="text-[10px] text-muted-foreground">{reply.createdAt}</span>
                              </div>
                              {reply.userId === user?.id && (
                                <button
                                  onClick={async () => {
                                    if (confirm("답글을 삭제하시겠습니까?")) {
                                      try {
                                        await secureWrite({
                                          table: "comment_replies",
                                          action: "update",
                                          data: { id: reply.id, is_deleted: true }
                                        })
                                        fetchCardData()
                                      } catch (err) {
                                        toast.error("답글 삭제에 실패했습니다.")
                                      }
                                    }
                                  }}
                                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                                  title="삭제"
                                >
                                  <Trash2 className="size-2.5" />
                                </button>
                              )}
                            </div>
                            <p className="text-foreground/90 font-medium whitespace-pre-wrap leading-relaxed pl-3.5">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 답글 입력창 (활성화 시) */}
                    {activeReplyTarget === comment.id && (
                      <div className="pl-4 flex items-center gap-1.5 border-l-2 border-orange-300 ml-2 mt-1.5">
                        <input
                          type="text"
                          value={replyInput}
                          onChange={(e) => setReplyInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleAddReply(comment.id)
                            }
                          }}
                          placeholder="답글을 남겨보세요..."
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-orange-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddReply(comment.id)}
                          className="size-7 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95"
                        >
                          <Send className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. 하단 고정 댓글 입력 바 */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/80 flex items-center gap-2">
          <input
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleAddComment()
              }
            }}
            placeholder="가족에게 코멘트를 남겨보세요"
            className="flex-1 bg-white border border-gray-200/90 rounded-2xl px-3.5 py-2 text-xs outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 shadow-2xs"
          />
          <button
            onClick={handleAddComment}
            disabled={!commentInput.trim()}
            className="size-8 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-sm shadow-orange-500/20 shrink-0"
            title="댓글 등록"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
