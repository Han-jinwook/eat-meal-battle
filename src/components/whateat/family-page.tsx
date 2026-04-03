"use client"

import { useEffect, useRef, useState } from "react"
import { 
  Crown, 
  Share2, 
  Vote as VoteIcon, 
  ChefHat, 
  Bike,
  UtensilsCrossed,
  Pencil,
  Bell, 
  Check, 
  X, 
  Plus,
  Clock,
  Utensils,
  MoreVertical,
  Settings,
  Star,
  MessageCircle,
  Heart,
  Send,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FamilyMember {
  id: number
  name: string
  avatar: string
  role: "chef" | "member"
  isOnline: boolean
}

interface SharedMeal {
  id: number
  image: string
  title: string
  sharedBy: string
  sharedAt: string
  sharedAtIso: string
  mealType: "homemade" | "delivery" | "dining" | "other"
}

interface MealReply {
  id: number
  author: string
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
}

interface MealComment {
  id: number
  author: string
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
  replies: MealReply[]
}

interface VoteOption {
  id: number
  title: string
  image: string
  votes: number
  votedBy: string[]
}

interface ActiveVote {
  id: number
  title: string
  createdBy: string
  endsAt: string
  options: VoteOption[]
  isActive: boolean
}

interface TodayMenu {
  id: number
  title: string
  image: string
  decidedBy: string
  decidedAt: string
  mealTime: "breakfast" | "lunch" | "dinner"
}

const familyMembers: FamilyMember[] = [
  { id: 1, name: "엄마 (나)", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face", role: "chef", isOnline: true },
  { id: 2, name: "아빠", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face", role: "member", isOnline: true },
  { id: 3, name: "딸", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face", role: "member", isOnline: false },
  { id: 4, name: "아들", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face", role: "member", isOnline: true },
]

const sharedMeals: SharedMeal[] = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=400&fit=crop",
    title: "주말 브런치 팬케이크",
    sharedBy: "엄마",
    sharedAt: "오늘 10:30",
    sharedAtIso: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    mealType: "homemade",
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop",
    title: "건강 샐러드",
    sharedBy: "딸",
    sharedAt: "어제",
    sharedAtIso: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    mealType: "homemade",
  }
]

const activeVote: ActiveVote = {
  id: 1,
  title: "오늘 저녁 뭐 먹을까요?",
  createdBy: "엄마",
  endsAt: "오후 5시까지",
  isActive: true,
  options: [
    { id: 1, title: "삼겹살", image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=200&h=200&fit=crop", votes: 2, votedBy: ["아빠", "아들"] },
    { id: 2, title: "치킨", image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200&h=200&fit=crop", votes: 1, votedBy: ["딸"] },
    { id: 3, title: "파스타", image: "https://images.unsplash.com/photo-1563379926898-37aacf113fd9?w=200&h=200&fit=crop", votes: 0, votedBy: [] },
  ]
}

const todayMenus: TodayMenu[] = [
  {
    id: 1,
    title: "토스트와 스크램블 에그",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=200&h=200&fit=crop",
    decidedBy: "엄마",
    decidedAt: "07:00",
    mealTime: "breakfast"
  },
  {
    id: 2,
    title: "김치찌개",
    image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=200&h=200&fit=crop",
    decidedBy: "엄마",
    decidedAt: "11:30",
    mealTime: "lunch"
  }
]

type TabType = "shared" | "vote" | "menu"
type SharedMealFilterType = "all" | "homemade" | "delivery" | "dining"

export function FamilyPage() {
  const [activeTab, setActiveTab] = useState<TabType>("shared")
  const [meals, setMeals] = useState(sharedMeals)
  const [vote, setVote] = useState(activeVote)
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null)
  const [mealCommentInput, setMealCommentInput] = useState("")
  const [mealReplyInput, setMealReplyInput] = useState("")
  const [sharedMealFilter, setSharedMealFilter] = useState<SharedMealFilterType>("all")
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ mealId: number; commentId: number } | null>(null)
  const [expandedMealCommentsId, setExpandedMealCommentsId] = useState<number | null>(null)
  const [mealComments, setMealComments] = useState<Record<number, MealComment[]>>({
    1: [
      {
        id: 101,
        author: "아빠",
        content: "비주얼 최고! 다음에 또 해줘요 😋",
        createdAt: "30분 전",
        likes: 2,
        isLiked: false,
        replies: [
          {
            id: 1001,
            author: "엄마",
            content: "좋아~ 다음엔 블루베리도 넣어볼게",
            createdAt: "25분 전",
            likes: 1,
            isLiked: false,
          },
        ],
      },
    ],
    2: [
      {
        id: 201,
        author: "엄마",
        content: "소스 조합이 정말 깔끔했어요",
        createdAt: "어제",
        likes: 1,
        isLiked: false,
        replies: [],
      },
    ],
  })
  const [mealRatings, setMealRatings] = useState<Record<number, Record<number, number>>>({})
  const [promotedMealIds, setPromotedMealIds] = useState<number[]>([])
  const [promotionReasonByMealId, setPromotionReasonByMealId] = useState<Record<number, "all-rated" | "deadline">>({})
  const [isPromotingMealId, setIsPromotingMealId] = useState<number | null>(null)
  const [dismissedMealHighlightIds, setDismissedMealHighlightIds] = useState<number[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isInviteLinkCopied, setIsInviteLinkCopied] = useState(false)
  const [showCreateVoteModal, setShowCreateVoteModal] = useState(false)
  const [showDecideMenuModal, setShowDecideMenuModal] = useState(false)
  const [familyPhoto, setFamilyPhoto] = useState<string | null>(null)
  const familyPhotoInputRef = useRef<HTMLInputElement | null>(null)

  const inviteLink = "https://whateat.app/invite/abc123xyz"
  const currentFamilyMember = familyMembers.find((member) => member.name.includes("(나)")) ?? familyMembers[0]
  const currentFamilyMemberId = currentFamilyMember.id
  const currentFamilyMemberName = currentFamilyMember.name.replace(" (나)", "")

  const handleFamilyPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setFamilyPhoto(objectUrl)
  }

  const selectedMeal = meals.find((meal) => meal.id === selectedMealId) ?? null

  const getSharedMealCategory = (meal: SharedMeal): Exclude<SharedMealFilterType, "all"> => {
    if (meal.mealType === "homemade") return "homemade"
    if (meal.mealType === "delivery") return "delivery"
    if (meal.mealType === "dining") return "dining"
    return "dining"
  }

  const sharedFilterTabs = [
    { id: "all" as SharedMealFilterType, label: "전체", icon: null },
    { id: "homemade" as SharedMealFilterType, label: "집밥", icon: ChefHat },
    { id: "delivery" as SharedMealFilterType, label: "배달", icon: Bike },
    { id: "dining" as SharedMealFilterType, label: "외식", icon: UtensilsCrossed },
  ]

  const filteredMeals = meals.filter((meal) => {
    if (sharedMealFilter === "all") {
      return true
    }
    return getSharedMealCategory(meal) === sharedMealFilter
  })

  const formatRemainingTime = (remainingMs: number) => {
    const totalMinutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`
    }

    return `${minutes}분`
  }

  const getMealDeadline = (meal: SharedMeal) => {
    const deadlineMs = Date.parse(meal.sharedAtIso) + 3 * 60 * 60 * 1000
    return new Date(deadlineMs)
  }

  const isMealRatingOpen = (meal: SharedMeal) => Date.now() <= getMealDeadline(meal).getTime()

  const getMealDeadlineLabel = (meal: SharedMeal) => {
    const deadline = getMealDeadline(meal)
    const remaining = deadline.getTime() - Date.now()
    const deadlineText = deadline.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })

    if (remaining <= 0) {
      return `별점 마감 ${deadlineText}`
    }

    return `별점 마감 ${deadlineText} · 남은 ${formatRemainingTime(remaining)}`
  }

  const getMealAverageRating = (mealId: number) => {
    const ratingMap = mealRatings[mealId] ?? {}
    const ratedScores = Object.values(ratingMap).filter((score): score is number => typeof score === "number")

    if (ratedScores.length === 0) {
      return 0
    }

    const total = ratedScores.reduce((sum, score) => sum + score, 0)
    return total / ratedScores.length
  }

  const tryPromoteMealToTalk = async (mealId: number, ratingMap: Record<number, number>) => {
    if (promotedMealIds.includes(mealId) || isPromotingMealId === mealId) {
      return
    }

    const targetMeal = meals.find((meal) => meal.id === mealId)
    if (!targetMeal) {
      return
    }

    const scores = Object.values(ratingMap).filter((score): score is number => typeof score === "number")
    const ratedCount = scores.length
    const isRatingOpen = isMealRatingOpen(targetMeal)
    const allFamilyRated = ratedCount >= familyMembers.length
    const canPromoteNow = (!isRatingOpen && ratedCount >= 1) || allFamilyRated

    if (!canPromoteNow) {
      return
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length

    if (average < 5) {
      return
    }

    try {
      setIsPromotingMealId(mealId)

      const comments = (mealComments[mealId] ?? []).map((comment) => ({
        id: comment.id,
        author: comment.author,
        content: comment.content,
        createdAt: comment.createdAt,
        likes: comment.likes,
        isLiked: comment.isLiked,
        replies: (comment.replies ?? []).map((reply) => ({
          id: reply.id,
          author: reply.author,
          content: reply.content,
          createdAt: reply.createdAt,
          likes: reply.likes,
          isLiked: reply.isLiked,
        })),
      }))

      const response = await fetch("/api/whateat/talk-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "family-shared",
          mealId: targetMeal.id,
          title: targetMeal.title,
          image: targetMeal.image,
          sharedBy: targetMeal.sharedBy,
          comments,
          ratingAverage: Number(average.toFixed(1)),
          ratingCount: scores.length,
        }),
      })

      if (!response.ok) {
        throw new Error(`status ${response.status}`)
      }

      setPromotedMealIds((prev) => [...prev, mealId])
      setPromotionReasonByMealId((prev) => ({
        ...prev,
        [mealId]: allFamilyRated && isRatingOpen ? "all-rated" : "deadline",
      }))
    } catch (error) {
      console.error("[FamilyPage] 맛통 게시 실패:", error)
    } finally {
      setIsPromotingMealId(null)
    }
  }

  useEffect(() => {
    const promoteClosedMeals = () => {
      meals.forEach((meal) => {
        if (promotedMealIds.includes(meal.id) || isPromotingMealId === meal.id) {
          return
        }

        if (isMealRatingOpen(meal)) {
          return
        }

        const ratingMap = mealRatings[meal.id] ?? {}
        const ratedCount = Object.values(ratingMap).filter((score) => typeof score === "number").length
        if (ratedCount < 1) {
          return
        }

        void tryPromoteMealToTalk(meal.id, ratingMap)
      })
    }

    promoteClosedMeals()
    const intervalId = window.setInterval(promoteClosedMeals, 30 * 1000)
    return () => window.clearInterval(intervalId)
  }, [meals, mealRatings, promotedMealIds, isPromotingMealId])

  const handleMealRating = (mealId: number, memberId: number, score: number) => {
    const targetMeal = meals.find((meal) => meal.id === mealId)
    if (!targetMeal || memberId !== currentFamilyMemberId || !isMealRatingOpen(targetMeal)) {
      return
    }

    const nextMealRatings = {
      ...(mealRatings[mealId] ?? {}),
      [memberId]: score,
    }

    setMealRatings((prev) => {
      const nextState = {
        ...prev,
        [mealId]: nextMealRatings,
      }

      return nextState
    })

    void tryPromoteMealToTalk(mealId, nextMealRatings)
  }

  const handleOpenMealCardDetail = (mealId: number) => {
    setSelectedMealId(mealId)
    setDismissedMealHighlightIds((prev) => (prev.includes(mealId) ? prev : [...prev, mealId]))
  }

  const toggleMealCommentLike = (mealId: number, commentId: number) => {
    setMealComments((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] ?? []).map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: !comment.isLiked,
              likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
            }
          : comment,
      ),
    }))
  }

  const toggleMealReplyLike = (mealId: number, commentId: number, replyId: number) => {
    setMealComments((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] ?? []).map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              replies: (comment.replies ?? []).map((reply) =>
                reply.id === replyId
                  ? {
                      ...reply,
                      isLiked: !reply.isLiked,
                      likes: reply.isLiked ? reply.likes - 1 : reply.likes + 1,
                    }
                  : reply,
              ),
            }
          : comment,
      ),
    }))
  }

  const handleAddMealComment = (mealId: number) => {
    const content = mealCommentInput.trim()
    if (!content) return

    const newComment: MealComment = {
      id: Date.now(),
      author: currentFamilyMemberName,
      content,
      createdAt: "방금 전",
      likes: 0,
      isLiked: false,
      replies: [],
    }

    setMealComments((prev) => ({
      ...prev,
      [mealId]: [...(prev[mealId] ?? []), newComment],
    }))
    setMealCommentInput("")
  }

  const handleAddMealReply = (mealId: number, commentId: number) => {
    const content = mealReplyInput.trim()
    if (!content) return

    const newReply: MealReply = {
      id: Date.now(),
      author: currentFamilyMemberName,
      content,
      createdAt: "방금 전",
      likes: 0,
      isLiked: false,
    }

    setMealComments((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] ?? []).map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              replies: [...(comment.replies ?? []), newReply],
            }
          : comment,
      ),
    }))

    setMealReplyInput("")
    setActiveReplyTarget(null)
  }

  const castVote = (optionId: number) => {
    setVote({
      ...vote,
      options: vote.options.map(opt => 
        opt.id === optionId 
          ? { ...opt, votes: opt.votes + 1, votedBy: [...opt.votedBy, "나"] }
          : opt
      )
    })
  }

  const handleCopyInviteLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = inviteLink
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      setIsInviteLinkCopied(true)
    } catch (error) {
      console.error("[FamilyPage] 초대 링크 복사 실패:", error)
    }
  }

  const renderMealCommentsSection = (mealId: number, variant: "modal" | "card" = "modal") => (
    <>
      <div className={cn("flex items-center gap-2 mb-3", variant === "card" && "mb-2")}>
        <MessageCircle className="size-4 text-orange-500" />
        <h4 className="font-bold text-sm text-foreground">댓글</h4>
        <span className="text-xs text-muted-foreground">{(mealComments[mealId] ?? []).length}개</span>
      </div>

      <div className={cn("space-y-2 pr-1", variant === "modal" ? "max-h-64 overflow-y-auto" : "max-h-48 overflow-y-auto")}>
        {(mealComments[mealId] ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
        ) : (
          (mealComments[mealId] ?? []).map((comment) => (
            <div key={comment.id} className="rounded-xl bg-orange-50/50 border border-orange-100 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground">{comment.author}</span>
                <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
              </div>
              <p className="text-xs text-foreground mt-1">{comment.content}</p>

              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => toggleMealCommentLike(mealId, comment.id)}
                  className="text-[11px] text-muted-foreground flex items-center gap-1"
                >
                  <Heart className={cn("size-3.5", comment.isLiked && "fill-orange-500 text-orange-500")} />
                  {comment.likes}
                </button>
                <button
                  onClick={() => {
                    const isSameTarget =
                      activeReplyTarget?.mealId === mealId &&
                      activeReplyTarget.commentId === comment.id

                    if (isSameTarget) {
                      setActiveReplyTarget(null)
                      setMealReplyInput("")
                      return
                    }

                    setActiveReplyTarget({ mealId, commentId: comment.id })
                    setMealReplyInput("")
                  }}
                  className="text-[11px] text-muted-foreground"
                >
                  답글
                </button>
              </div>

              {(comment.replies ?? []).length > 0 && (
                <div className="mt-2.5 pl-2 border-l border-orange-200 space-y-1.5">
                  {(comment.replies ?? []).map((reply) => (
                    <div key={reply.id} className="bg-white/70 rounded-lg px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-foreground">{reply.author}</span>
                        <span className="text-[10px] text-muted-foreground">{reply.createdAt}</span>
                      </div>
                      <p className="text-[11px] text-foreground mt-0.5">{reply.content}</p>
                      <button
                        onClick={() => toggleMealReplyLike(mealId, comment.id, reply.id)}
                        className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1"
                      >
                        <Heart className={cn("size-3", reply.isLiked && "fill-orange-500 text-orange-500")} />
                        {reply.likes}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeReplyTarget?.mealId === mealId && activeReplyTarget.commentId === comment.id && (
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={mealReplyInput}
                    onChange={(e) => setMealReplyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddMealReply(mealId, comment.id)
                      }
                    }}
                    placeholder="답글을 입력하세요"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] outline-none focus:ring-2 focus:ring-orange-300"
                  />
                  <button
                    onClick={() => handleAddMealReply(mealId, comment.id)}
                    className="size-7 rounded-lg bg-orange-500 text-white flex items-center justify-center"
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={mealCommentInput}
          onChange={(e) => setMealCommentInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAddMealComment(mealId)
            }
          }}
          placeholder="가족에게 코멘트를 남겨보세요"
          className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-orange-300"
        />
        <button
          onClick={() => handleAddMealComment(mealId)}
          className="size-9 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
        >
          <Send className="size-4" />
        </button>
      </div>
    </>
  )

  const tabs = [
    { id: "shared" as TabType, label: "공유된 식사", icon: Share2 },
    { id: "menu" as TabType, label: "오늘의 메뉴", icon: ChefHat },
    { id: "vote" as TabType, label: "투표", icon: VoteIcon },
  ]

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Family Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-white shadow-lg">
        <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1">
          <>
            <button
              onClick={() => familyPhotoInputRef.current?.click()}
              className="size-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 hover:bg-orange-100 transition-colors overflow-hidden shrink-0"
            >
              {familyPhoto ? (
                <img src={familyPhoto} alt="가족 사진" className="w-full h-full object-cover" />
              ) : (
                <Pencil className="size-5" />
              )}
            </button>
            <input
              ref={familyPhotoInputRef}
              type="file"
              accept="image/*"
              onChange={handleFamilyPhotoChange}
              className="hidden"
            />
          </>

          <div className="shrink-0 min-w-fit">
            <h2 className="font-bold text-foreground text-lg leading-tight">우리 가족</h2>
            <p className="text-xs text-muted-foreground">4명의 구성원</p>
          </div>

          <div className="flex-1 flex items-center justify-center gap-3 ml-2 overflow-x-auto hide-scrollbar pb-1">
            {familyMembers.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative">
                  <img
                    src={member.avatar || "/placeholder.svg"}
                    alt={member.name}
                    className="size-14 rounded-2xl object-cover border-2 border-white shadow-md"
                  />
                  {member.role === "chef" && (
                    <div className="absolute -top-1 -right-1 size-5 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-white">
                      <Crown className="size-3 text-white" />
                    </div>
                  )}
                  {member.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-green-400 border-2 border-white" />
                  )}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {member.name}
                </span>
              </div>
            ))}
            <button 
              onClick={() => setShowInviteModal(true)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="size-14 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Plus className="size-5 text-muted-foreground/50" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">초대</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2">
        <div className="ml-auto flex items-center gap-2">
          {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-orange-500 text-white shadow-md shadow-orange-200/70"
                    : "bg-white/70 text-muted-foreground hover:bg-white"
                )}
              >
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "shared" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-2 overflow-x-auto hide-scrollbar pb-1">
            {sharedFilterTabs.map((filterTab) => {
              const Icon = filterTab.icon
              const count =
                filterTab.id === "all"
                  ? meals.length
                  : meals.filter((meal) => getSharedMealCategory(meal) === filterTab.id).length

              return (
                <div key={filterTab.id} className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-[11px] font-black leading-none text-sky-500">{count}</span>
                  <button
                    onClick={() => setSharedMealFilter(filterTab.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[13px] font-bold transition-all flex items-center gap-1 whitespace-nowrap",
                      sharedMealFilter === filterTab.id
                        ? "bg-orange-500 text-white shadow-md shadow-orange-200/70"
                        : "bg-white/70 text-muted-foreground hover:bg-white",
                    )}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {filterTab.label}
                  </button>
                </div>
              )
            })}
          </div>
          
          {filteredMeals.length === 0 ? (
            <div className="bg-white/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <Share2 className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">아직 공유된 식사가 없어요</p>
              <p className="text-xs text-muted-foreground/70 mt-1">먹로그에서 가족에게 공유해보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredMeals.map((meal) => {
                const isOpen = isMealRatingOpen(meal)
                const isExpanded = expandedMealCommentsId === meal.id
                const averageRating = getMealAverageRating(meal.id)
                const shouldHighlight = isOpen && !dismissedMealHighlightIds.includes(meal.id)

                return (
                  <div
                    key={meal.id}
                    className={cn(
                      "relative bg-white/80 rounded-2xl overflow-hidden border border-white shadow-md",
                      shouldHighlight && "ring-2 ring-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.18),0_0_22px_rgba(34,211,238,0.38)]",
                    )}
                  >
                    <button
                      onClick={() => isOpen && handleOpenMealCardDetail(meal.id)}
                      className={cn(
                        "w-full text-left",
                        isOpen ? "hover:shadow-lg transition-shadow" : "cursor-default",
                      )}
                    >
                      <div className="aspect-square">
                        <img src={meal.image || "/placeholder.svg"} alt={meal.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <h4 className="font-bold text-sm text-foreground truncate">{meal.title}</h4>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <span>{meal.sharedBy}</span>
                            {meal.mealType === "homemade" && (
                              <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-bold">홈쉐퍼</span>
                            )}
                            <span>{meal.sharedAt}</span>
                          </span>
                          <span className="text-[10px] text-orange-500 font-bold flex items-center gap-1">
                            <Star className="size-3 fill-orange-400 text-orange-400" />
                            {isOpen ? "별점 평가중" : averageRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="px-3 pb-3">
                      <button
                        onClick={() => {
                          if (isOpen) {
                            handleOpenMealCardDetail(meal.id)
                            return
                          }

                            setExpandedMealCommentsId(isExpanded ? null : meal.id)
                            if (isExpanded) {
                              setActiveReplyTarget(null)
                              setMealReplyInput("")
                            }
                        }}
                        className="w-full rounded-lg bg-orange-50 border border-orange-100 px-2.5 py-2 text-[11px] font-bold text-orange-600 flex items-center justify-center gap-1"
                      >
                        <MessageCircle className="size-3.5" />
                        댓글 {(mealComments[meal.id] ?? []).length}개
                      </button>

                      {!isOpen && isExpanded && (
                        <div className="mt-2 rounded-xl border border-orange-100 bg-white p-3">
                          {renderMealCommentsSection(meal.id, "card")}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {selectedMeal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl border border-white">
            <div className="p-5 border-b border-orange-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-foreground text-lg">{selectedMeal.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span>{selectedMeal.sharedBy}</span>
                  {selectedMeal.mealType === "homemade" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-bold">홈쉐퍼</span>
                  )}
                  <span>{selectedMeal.sharedAt}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedMealId(null)
                  setMealCommentInput("")
                }}
                className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-82px)] p-5 space-y-5">
              <img src={selectedMeal.image || "/placeholder.svg"} alt={selectedMeal.title} className="w-full rounded-2xl aspect-[4/3] object-cover" />

              <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-foreground">가족 별점</h4>
                  <span className="text-sm font-extrabold text-orange-500 flex items-center gap-1">
                    <Sparkles className="size-4" />
                    평균 {getMealAverageRating(selectedMeal.id) > 0 ? getMealAverageRating(selectedMeal.id).toFixed(1) : "-"}
                  </span>
                </div>

                <div className={cn(
                  "mb-3 text-[11px] font-semibold rounded-lg px-2.5 py-2",
                  isMealRatingOpen(selectedMeal)
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-500",
                )}>
                  {getMealDeadlineLabel(selectedMeal)}
                </div>

                <div className="space-y-2.5">
                  {familyMembers.map((member) => {
                    const score = mealRatings[selectedMeal.id]?.[member.id] ?? 0
                    const isSelf = member.id === currentFamilyMemberId
                    const canRate = isSelf && isMealRatingOpen(selectedMeal)

                    return (
                      <div key={member.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground min-w-16">{member.name}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              onClick={() => canRate && handleMealRating(selectedMeal.id, member.id, value)}
                              disabled={!canRate}
                              className="p-0.5"
                            >
                              <Star
                                className={cn(
                                  "size-4 transition-colors",
                                  value <= score ? "fill-orange-400 text-orange-400" : "text-gray-300",
                                  !canRate && "opacity-60",
                                )}
                              />
                            </button>
                          ))}
                        </div>
                        <span className="text-[11px] font-bold text-orange-500 w-8 text-right">{score > 0 ? `${score}점` : "-"}</span>
                      </div>
                    )
                  })}
                </div>

                <p className="text-[11px] text-muted-foreground mt-3">별점은 본인(나) 계정으로만 입력할 수 있어요.</p>

                {promotedMealIds.includes(selectedMeal.id) && (
                  <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-700 font-bold">
                    {promotionReasonByMealId[selectedMeal.id] === "all-rated"
                      ? "가족 전원 평가 완료! 평균 5.0 이상으로 맛통 즉시 게시 완료"
                      : "마감 후 평균 5.0 이상 달성! 맛통 게시 완료"}
                  </div>
                )}
                {isPromotingMealId === selectedMeal.id && (
                  <div className="mt-3 rounded-xl bg-orange-100 border border-orange-200 px-3 py-2 text-[11px] text-orange-600 font-bold">
                    맛통 게시 중...
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                {renderMealCommentsSection(selectedMeal.id, "modal")}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "vote" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">진행 중인 투표</h3>
            <button 
              onClick={() => setShowCreateVoteModal(true)}
              className="flex items-center gap-1 text-xs text-orange-500 font-bold"
            >
              <Plus className="size-3.5" />
              투표 만들기
            </button>
          </div>

          {vote.isActive ? (
            <div className="bg-white/80 rounded-3xl p-5 border border-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-foreground">{vote.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{vote.createdBy}님이 생성</span>
                    <span className="text-xs text-orange-500 font-bold flex items-center gap-1">
                      <Clock className="size-3" />
                      {vote.endsAt}
                    </span>
                  </div>
                </div>
                <div className="px-2.5 py-1 bg-green-100 rounded-full">
                  <span className="text-[10px] font-bold text-green-600">진행중</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {vote.options.map((option) => {
                  const totalVotes = vote.options.reduce((sum, o) => sum + o.votes, 0)
                  const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
                  const hasVoted = option.votedBy.includes("나")

                  return (
                    <button
                      key={option.id}
                      onClick={() => !hasVoted && castVote(option.id)}
                      disabled={hasVoted}
                      className={cn(
                        "relative flex items-center gap-3 p-3 rounded-2xl border-2 transition-all overflow-hidden",
                        hasVoted 
                          ? "border-orange-400 bg-orange-50" 
                          : "border-muted hover:border-orange-300 bg-white"
                      )}
                    >
                      {/* Progress bar background */}
                      <div 
                        className="absolute inset-0 bg-orange-100/50 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                      
                      <img 
                        src={option.image || "/placeholder.svg"} 
                        alt={option.title} 
                        className="relative size-12 rounded-xl object-cover shrink-0"
                      />
                      <div className="relative flex-1 text-left">
                        <span className="font-bold text-sm">{option.title}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {option.votedBy.length > 0 ? option.votedBy.join(", ") : "아직 투표 없음"}
                          </span>
                        </div>
                      </div>
                      <div className="relative flex items-center gap-2">
                        <span className="font-bold text-orange-500">{option.votes}</span>
                        {hasVoted && <Check className="size-4 text-orange-500" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <VoteIcon className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">진행 중인 투표가 없어요</p>
              <p className="text-xs text-muted-foreground/70 mt-1">가족들과 메뉴를 정해보세요!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "menu" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">{"Chef's Choice"}</h3>
            <button 
              onClick={() => setShowDecideMenuModal(true)}
              className="flex items-center gap-1 text-xs text-orange-500 font-bold"
            >
              <ChefHat className="size-3.5" />
              메뉴 결정하기
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {["breakfast", "lunch", "dinner"].map((mealTime) => {
              const menu = todayMenus.find(m => m.mealTime === mealTime)
              const label = mealTime === "breakfast" ? "아침" : mealTime === "lunch" ? "점심" : "저녁"
              const timeRange = mealTime === "breakfast" ? "06:00 - 09:00" : mealTime === "lunch" ? "11:00 - 14:00" : "17:00 - 20:00"

              return (
                <div 
                  key={mealTime}
                  className={cn(
                    "bg-white/80 rounded-2xl p-4 border border-white shadow-md",
                    !menu && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "size-12 rounded-xl flex items-center justify-center shrink-0",
                      menu ? "bg-gradient-to-br from-orange-400 to-orange-500" : "bg-muted"
                    )}>
                      <Utensils className={cn("size-5", menu ? "text-white" : "text-muted-foreground")} />
                    </div>
                    
                    {menu ? (
                      <div className="flex-1 flex items-center gap-3">
                        <img src={menu.image || "/placeholder.svg"} alt={menu.title} className="size-14 rounded-xl object-cover" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-500">{label}</span>
                            <span className="text-[10px] text-muted-foreground">{timeRange}</span>
                          </div>
                          <h4 className="font-bold text-foreground mt-0.5">{menu.title}</h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {menu.decidedBy}님이 {menu.decidedAt}에 결정
                          </p>
                        </div>
                        <button className="size-8 rounded-lg hover:bg-muted/50 flex items-center justify-center">
                          <MoreVertical className="size-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">{label}</span>
                          <span className="text-[10px] text-muted-foreground">{timeRange}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">아직 결정되지 않았어요</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Notification Preview */}
          <div className="bg-gradient-to-r from-orange-100/70 to-orange-50 rounded-2xl p-4 border border-orange-200">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Bell className="size-5 text-orange-500" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-sm">알림 설정</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {"메뉴가 결정되면 가족 모두에게 알림이 전송돼요"}
                </p>
                <button className="text-xs text-orange-500 font-bold mt-2">설정 변경</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">가족 초대하기</h3>
              <button onClick={() => setShowInviteModal(false)} className="size-8 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">초대 링크를 공유하여 가족을 초대하세요</p>
            <div className="bg-muted rounded-xl p-3 mb-4">
              <p className="text-xs text-muted-foreground break-all">{inviteLink}</p>
            </div>
            <button
              onClick={handleCopyInviteLink}
              className={cn(
                "w-full py-3 text-white font-bold rounded-xl transition-colors",
                isInviteLinkCopied ? "bg-emerald-500" : "bg-orange-500 hover:bg-orange-600",
              )}
            >
              {isInviteLinkCopied ? "복사 완료!" : "링크 복사하기"}
            </button>
          </div>
        </div>
      )}

      {/* Create Vote Modal */}
      {showCreateVoteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">투표 만들기</h3>
              <button onClick={() => setShowCreateVoteModal(false)} className="size-8 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">투표 제목</label>
                <input 
                  type="text" 
                  placeholder="오늘 저녁 뭐 먹을까요?" 
                  className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">후보 메뉴 (2-3개)</label>
                <div className="flex flex-col gap-2">
                  <input type="text" placeholder="메뉴 1" className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300" />
                  <input type="text" placeholder="메뉴 2" className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300" />
                  <input type="text" placeholder="메뉴 3 (선택)" className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
              </div>
              <button className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl mt-2">
                투표 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decide Menu Modal */}
      {showDecideMenuModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">메뉴 결정하기</h3>
              <button onClick={() => setShowDecideMenuModal(false)} className="size-8 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">식사 시간</label>
                <div className="flex gap-2">
                  {["아침", "점심", "저녁"].map((time) => (
                    <button key={time} className="flex-1 py-2 px-3 rounded-xl border-2 border-muted text-sm font-medium hover:border-orange-400 hover:text-orange-500 transition-colors">
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">메뉴 이름</label>
                <input 
                  type="text" 
                  placeholder="오늘의 메뉴를 입력하세요" 
                  className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <button className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl mt-2 flex items-center justify-center gap-2">
                <Bell className="size-4" />
                결정 및 알림 보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
