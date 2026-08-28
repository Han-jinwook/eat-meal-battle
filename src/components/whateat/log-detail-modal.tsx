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
  CornerDownRight,
  Star,
  BookOpen,
  Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { createClient } from "@/lib/supabase"
import { secureWrite } from "@/lib/supabase-safe"

export interface DetailLogData {
  id: number | string
  date?: string
  mealType?: string
  title?: string
  label?: string
  menu?: string
  placeName?: string
  placeAddress?: string
  memo?: string
  image?: string
  thumbnail?: string
  linkUrl?: string
  linkThumbnail?: string
  rating?: number
  userId?: string
  nickname?: string
  author?: string
  sharedBy?: string
  createdAt?: string
  isSample?: boolean
}

interface LogDetailModalProps {
  isOpen: boolean
  onClose: () => void
  log: DetailLogData | null
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

export function LogDetailModal({ isOpen, onClose, log }: LogDetailModalProps) {
  const { isLoggedIn, user } = useHub()
  const [likedUsers, setLikedUsers] = useState<string[]>([])
  const [comments, setComments] = useState<MealComment[]>([])
  const [commentInput, setCommentInput] = useState("")
  const [replyInput, setReplyInput] = useState("")
  const [activeReplyTarget, setActiveReplyTarget] = useState<string | number | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | number | null>(null)
  const [editCommentText, setEditCommentText] = useState("")
  const [currentRating, setCurrentRating] = useState<number>(log?.rating || 5)

  const logId = log?.id
  const isSample = log?.isSample || (typeof logId === "string" && logId.startsWith("sample-")) || logId === 1 || logId === 2 || logId === 3

  useEffect(() => {
    if (log?.rating) {
      setCurrentRating(log.rating)
    }
  }, [log?.rating])

  // 1. Fetch Likes & Comments for this log
  const fetchCardData = useCallback(async () => {
    if (!logId || isSample) return
    try {
      const supabase = createClient()

      // 1-1. Fetch Likes
      const { data: likesData } = await supabase
        .from("meal_likes")
        .select("user_id")
        .eq("meal_id", logId)

      if (likesData) {
        setLikedUsers(likesData.map((l: any) => l.user_id))
      }

      // 1-2. Fetch Comments
      const { data: commentsData } = await supabase
        .from("comments")
        .select("*")
        .eq("meal_id", logId)
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
              createdAt: r.created_at,
              likes: r.likes || 0
            }))

          return {
            id: c.id,
            userId: c.user_id,
            author: c.user_id === user?.id ? "나" : (userMap[c.user_id] || "가족"),
            content: c.content,
            createdAt: c.created_at,
            likes: c.likes || 0,
            replies: cReplies
          }
        })

        setComments(mappedComments)
      }
    } catch (e) {
      console.error("Failed to load comments/likes for log:", e)
    }
  }, [logId, isSample, user?.id])

  useEffect(() => {
    if (isOpen && logId) {
      if (isSample) {
        setLikedUsers([])
        setComments([])
      } else {
        fetchCardData()
      }
    }
  }, [isOpen, logId, isSample, fetchCardData])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !log) return null

  // 2. Toggle Like Handler
  const handleToggleLike = async () => {
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }
    if (isSample) {
      toast("샘플 카드에는 좋아요를 누를 수 없습니다.", { icon: "💡" })
      return
    }

    const hasLiked = likedUsers.includes(user.id)
    const newLikedUsers = hasLiked 
      ? likedUsers.filter(id => id !== user.id) 
      : [...likedUsers, user.id]
    
    setLikedUsers(newLikedUsers)

    try {
      if (hasLiked) {
        await secureWrite({
          table: "meal_likes",
          action: "delete",
          filters: { meal_id: logId, user_id: user.id }
        })
      } else {
        await secureWrite({
          table: "meal_likes",
          action: "insert",
          data: { meal_id: logId, user_id: user.id }
        })
      }
    } catch (e) {
      console.error("Like toggle failed", e)
      fetchCardData()
    }
  }

  // 3. Add Comment Handler
  const handleAddComment = async () => {
    if (!commentInput.trim()) return
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }
    if (isSample) {
      toast("샘플 카드에는 댓글을 작성할 수 없습니다.", { icon: "💡" })
      return
    }

    const content = commentInput.trim()
    setCommentInput("")

    const tempComment: MealComment = {
      id: "temp-" + Date.now(),
      userId: user.id,
      author: "나",
      content,
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: []
    }
    setComments(prev => [...prev, tempComment])

    try {
      await secureWrite({
        table: "comments",
        action: "insert",
        data: {
          meal_id: logId,
          user_id: user.id,
          content,
          is_deleted: false,
          created_at: new Date().toISOString()
        }
      })
      fetchCardData()
    } catch (e) {
      console.error("Failed to add comment", e)
      fetchCardData()
    }
  }

  // 4. Add Reply Handler
  const handleAddReply = async (commentId: string | number) => {
    if (!replyInput.trim()) return
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }
    if (isSample) return

    const content = replyInput.trim()
    setReplyInput("")
    setActiveReplyTarget(null)

    const tempReply: CommentReply = {
      id: "temp-reply-" + Date.now(),
      userId: user.id,
      author: "나",
      content,
      createdAt: new Date().toISOString(),
      likes: 0
    }

    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return { ...c, replies: [...c.replies, tempReply] }
      }
      return c
    }))

    try {
      await secureWrite({
        table: "comment_replies",
        action: "insert",
        data: {
          comment_id: commentId,
          user_id: user.id,
          content,
          is_deleted: false,
          created_at: new Date().toISOString()
        }
      })
      fetchCardData()
    } catch (e) {
      console.error("Failed to add reply", e)
      fetchCardData()
    }
  }

  // 5. Delete Comment
  const handleDeleteComment = async (commentId: string | number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return
    setComments(prev => prev.filter(c => c.id !== commentId))
    try {
      await secureWrite({
        table: "comments",
        action: "update",
        filters: { id: commentId },
        data: { is_deleted: true }
      })
      fetchCardData()
    } catch (e) {
      console.error("Failed to delete comment", e)
      fetchCardData()
    }
  }

  // 6. Delete Reply
  const handleDeleteReply = async (replyId: string | number) => {
    if (!confirm("답글을 삭제하시겠습니까?")) return
    setComments(prev => prev.map(c => ({
      ...c,
      replies: c.replies.filter(r => r.id !== replyId)
    })))
    try {
      await secureWrite({
        table: "comment_replies",
        action: "update",
        filters: { id: replyId },
        data: { is_deleted: true }
      })
      fetchCardData()
    } catch (e) {
      console.error("Failed to delete reply", e)
      fetchCardData()
    }
  }

  // 7. Update Comment
  const handleUpdateComment = async (commentId: string | number) => {
    if (!editCommentText.trim()) return
    const content = editCommentText.trim()
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, content } : c))
    setEditingCommentId(null)
    setEditCommentText("")

    try {
      await secureWrite({
        table: "comments",
        action: "update",
        filters: { id: commentId },
        data: { content }
      })
      fetchCardData()
    } catch (e) {
      console.error("Failed to update comment", e)
      fetchCardData()
    }
  }

  // Formatting helpers
  const formatHeaderDate = (dateStr?: string) => {
    if (!dateStr) return ""
    try {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        const m = d.getMonth() + 1
        const day = d.getDate()
        return `${m}월 ${day}일`
      }
    } catch (e) {}
    return dateStr
  }

  const formatCommentDate = (dateStr?: string) => {
    if (!dateStr) return ""
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ""
      const m = d.getMonth() + 1
      const day = d.getDate()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return `${m}/${day} ${hh}:${mm}`
    } catch (e) {
      return ""
    }
  }

  const authorName = log.userId === user?.id 
    ? "나" 
    : (log.nickname || log.author || log.sharedBy || "가족")

  const mealTypeStr = log.mealType || (log.type === "delivery" ? "배달" : log.type === "out" ? "외식" : "집밥")
  const TypeIcon = mealTypeStr === "집밥" 
    ? ChefHat 
    : mealTypeStr === "배달" 
      ? Bike 
      : UtensilsCrossed

  const mealTitle = log.title || log.menu || log.label || "식사 기록"
  const mealImage = log.image || log.thumbnail || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=450&fit=crop"

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] p-3.5 sm:p-4 rounded-[28px] sm:rounded-[32px] shadow-2xl border border-white/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 팝업 헤더 */}
        <div className="flex items-center justify-between px-2 pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
            <TypeIcon className="size-4 text-orange-500" strokeWidth={2.2} />
            <span>먹로그 상세</span>
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
          mealTypeStr === "집밥" && "border-l-emerald-500",
          mealTypeStr === "배달" && "border-l-sky-500",
          mealTypeStr === "외식" && "border-l-orange-500",
          !mealTypeStr && "border-l-orange-500"
        )}>
          {/* 1. 상단 카드 헤더 */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-gray-100/80 bg-white">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {/* 식사유형 뱃지 */}
              <div className={cn(
                "px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 border text-xs font-bold shrink-0 shadow-2xs",
                mealTypeStr === "집밥" && "bg-emerald-50 text-emerald-700 border-emerald-200/80",
                mealTypeStr === "배달" && "bg-sky-50 text-sky-700 border-sky-200/80",
                mealTypeStr === "외식" && "bg-orange-50 text-orange-700 border-orange-200/80",
                !mealTypeStr && "bg-gray-50 text-gray-700 border-gray-200"
              )}>
                <TypeIcon className="size-3.5 shrink-0" strokeWidth={2.2} />
                <span>{mealTypeStr}</span>
              </div>

              {/* 헤더 텍스트: 작성자 · 📅 날짜 */}
              <div className="flex items-center gap-1 text-xs font-bold text-gray-800 min-w-0">
                <span className="text-foreground font-black shrink-0">{authorName}</span>
                <span className="text-gray-300">·</span>
                {log.date && (
                  <span className="truncate text-muted-foreground">
                    📅 {formatHeaderDate(log.date)}
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
                  {mealTitle}
                </h4>

                {/* 식당 주소 */}
                {log.placeName || log.placeAddress ? (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 text-orange-500 shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {log.placeName || (log.placeAddress ? (() => {
                        const reg = parseRegionFromAddress(log.placeAddress)
                        const formatted = formatRegionStr(reg.city, reg.gu, reg.dong)
                        return formatted || log.placeAddress
                      })() : "")}
                    </span>
                  </div>
                ) : null}

                {/* 별점 평가 표시 */}
                <div className="flex items-center gap-1 mt-2.5">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star 
                        key={s} 
                        className={cn(
                          "size-4",
                          s <= currentRating ? "fill-orange-500 text-orange-500" : "text-gray-200 fill-gray-100"
                        )} 
                      />
                    ))}
                  </div>
                  <span className="text-xs font-black text-orange-600 ml-1">
                    {currentRating}점
                  </span>
                </div>

                {/* 메모 말풍선 */}
                {log.memo && (
                  <div className="mt-3 p-3 bg-orange-50/70 rounded-2xl border border-orange-100 text-xs text-foreground leading-relaxed">
                    <p className="font-medium">{log.memo}</p>
                  </div>
                )}
              </div>

              {/* 우측 썸네일 */}
              {mealImage && (
                <div 
                  className={cn(
                    "size-24 sm:size-28 rounded-2xl overflow-hidden shrink-0 relative bg-muted border border-muted/40 shadow-sm",
                    log.linkUrl && "cursor-pointer group"
                  )}
                  onClick={() => {
                    if (log.linkUrl) window.open(log.linkUrl, '_blank')
                  }}
                  title={log.linkUrl ? "클릭 시 해당 링크로 이동합니다" : undefined}
                >
                  <img 
                    src={mealImage} 
                    alt={mealTitle} 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
                    }}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                  />
                  {log.linkUrl && (
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-end justify-end p-1.5">
                      <div className="size-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white">
                        <ExternalLink className="size-3" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. 하단 액션 바 (좋아요 & 댓글 카운트) */}
            <div className="flex items-center justify-between border-t border-muted/30 px-4 py-2.5 bg-gray-50/40">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleToggleLike}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    user?.id && likedUsers.includes(user.id) 
                      ? "text-rose-500" 
                      : "text-muted-foreground hover:text-rose-500"
                  }`}
                >
                  <Heart className={`size-4 ${user?.id && likedUsers.includes(user.id) ? "fill-rose-500 text-rose-500" : ""}`} />
                  <span>좋아요 {likedUsers.length > 0 ? likedUsers.length : ""}</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <MessageCircle className="size-4" />
                  <span>댓글 {comments.length > 0 ? comments.length : ""}</span>
                </div>
              </div>
            </div>

            {/* 4. 댓글 목록 영역 */}
            <div className="border-t border-muted/20 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <MessageCircle className="size-3.5 text-orange-500" />
                  댓글 {comments.length}개
                </span>
              </div>

              {comments.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground/80 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
                  <p>아직 등록된 댓글이 없습니다.</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">식사에 대한 첫 의견을 남겨보세요! 💬</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((comment) => {
                    const isMyComment = comment.userId === user?.id
                    return (
                      <div key={comment.id} className="bg-gray-50/70 rounded-2xl p-3 border border-gray-100 text-xs">
                        {/* 댓글 헤더 */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-foreground">{comment.author}</span>
                            <span className="text-[10px] text-muted-foreground">{formatCommentDate(comment.createdAt)}</span>
                          </div>
                          {isMyComment && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => {
                                  setEditingCommentId(comment.id)
                                  setEditCommentText(comment.content)
                                }}
                                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="수정"
                              >
                                <Pencil className="size-3" />
                              </button>
                              <button 
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 text-muted-foreground hover:text-rose-500 cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 댓글 본문 */}
                        {editingCommentId === comment.id ? (
                          <div className="mt-1 flex gap-1.5">
                            <input
                              type="text"
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-xs outline-none focus:border-orange-500"
                            />
                            <button
                              onClick={() => handleUpdateComment(comment.id)}
                              className="px-2.5 py-1 bg-orange-500 text-white rounded-xl text-[11px] font-bold"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded-xl text-[11px]"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <p className="text-foreground leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                        )}

                        {/* 답글 버튼 */}
                        <div className="mt-1.5 flex items-center gap-3">
                          <button
                            onClick={() => {
                              setActiveReplyTarget(activeReplyTarget === comment.id ? null : comment.id)
                              setReplyInput("")
                            }}
                            className="text-[11px] font-bold text-muted-foreground hover:text-orange-600 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <CornerDownRight className="size-3" />
                            <span>답글 달기</span>
                          </button>
                        </div>

                        {/* 대댓글 입력 폼 */}
                        {activeReplyTarget === comment.id && (
                          <div className="mt-2.5 pl-3 border-l-2 border-orange-200 flex gap-1.5">
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
                              placeholder="답글을 입력하세요..."
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-orange-500"
                            />
                            <button
                              onClick={() => handleAddReply(comment.id)}
                              className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                            >
                              등록
                            </button>
                          </div>
                        )}

                        {/* 대댓글 목록 */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="mt-2 pl-3 space-y-1.5 border-l-2 border-orange-100">
                            {comment.replies.map((reply) => {
                              const isMyReply = reply.userId === user?.id
                              return (
                                <div key={reply.id} className="bg-white/80 rounded-xl p-2 border border-gray-100">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-foreground text-[11px]">{reply.author}</span>
                                      <span className="text-[9px] text-muted-foreground">{formatCommentDate(reply.createdAt)}</span>
                                    </div>
                                    {isMyReply && (
                                      <button
                                        onClick={() => handleDeleteReply(reply.id)}
                                        className="p-0.5 text-muted-foreground hover:text-rose-500 cursor-pointer"
                                        title="삭제"
                                      >
                                        <Trash2 className="size-2.5" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-foreground text-[11px] leading-relaxed">{reply.content}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 5. 하단 댓글 작성 인풋 바 */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/70 flex items-center gap-2">
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
              placeholder="식사에 코멘트를 남겨보세요"
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
