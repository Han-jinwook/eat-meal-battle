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
import { useHub, HubAvatar, useHubReferral } from "@/services/merlin-hub-sdk/react"
import { createClient } from "@/lib/supabase"
import { toast } from "react-hot-toast"

export interface FamilyMember {
  id: number
  name: string
  avatar: string
  role: "chef" | "member"
  isOnline: boolean
  isStudent: boolean
  userId?: string
}

interface SharedMeal {
  id: string | number
  image: string
  title: string
  sharedBy: string
  sharedAt: string
  sharedAtIso: string
  mealType: "homemade" | "delivery" | "dining" | "other"
  mealMenuId?: string
  doNotPromote?: boolean
  rawExplanation?: string
}

interface MealReply {
  id: string | number
  author: string
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
}

interface MealComment {
  id: string | number
  author: string
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
  replies: MealReply[]
}

interface VoteOption {
  id: string | number
  title: string
  image: string
  votes: number
  votedBy: string[]
}

interface ActiveVote {
  id: string | number
  title: string
  createdBy: string
  endsAt: string
  options: VoteOption[]
  isActive: boolean
}

interface TodayMenu {
  id: string | number
  title: string
  image: string
  decidedBy: string
  decidedAt: string
  mealTime: "breakfast" | "lunch" | "dinner"
}

export const familyMembers: FamilyMember[] = [
  { id: 1, name: "나", avatar: "", role: "chef", isOnline: true, isStudent: false },
  { id: 2, name: "엄마", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face", role: "member", isOnline: false, isStudent: false },
  { id: 3, name: "아빠", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face", role: "member", isOnline: false, isStudent: false },
  { id: 4, name: "동생", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face", role: "member", isOnline: false, isStudent: true },
]

const defaultSharedMeals: SharedMeal[] = [
  {
    id: "sample-1",
    image: "https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=500&fit=crop",
    title: "아빠표 수제 라구 파스타 🍝",
    sharedBy: "아빠",
    sharedAt: "오늘 12:30",
    sharedAtIso: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    mealType: "homemade",
  },
  {
    id: "sample-2",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&fit=crop",
    title: "첫 알바 첫 월급 턱! 동생이 쏜 맛있는 모둠 스시 🍣",
    sharedBy: "동생",
    sharedAt: "어제",
    sharedAtIso: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    mealType: "dining",
  },
  {
    id: "sample-3",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=500&fit=crop",
    title: "엄마가 불금 야식으로 배달 주문해준 바삭한 반반 치킨 🍗",
    sharedBy: "엄마",
    sharedAt: "3일 전",
    sharedAtIso: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    mealType: "delivery",
  }
]

const defaultMealComments: Record<string | number, MealComment[]> = {
  "sample-1": [
    {
      id: "comment-s1-1",
      author: "엄마",
      content: "오늘 아침 파스타 진짜 맛있었어! 소스가 레스토랑 급이네 🍝",
      createdAt: "오전 11:20",
      likes: 2,
      isLiked: false,
      replies: [
        {
          id: "reply-s1-1-1",
          author: "나",
          content: "맞아 아빠 요리 실력이 점점 늘어나는 것 같아 ㅎㅎ",
          createdAt: "오전 11:22",
          likes: 1,
          isLiked: false
        }
      ]
    },
    {
      id: "comment-s1-2",
      author: "동생",
      content: "아빠 내일 아침에도 파스타 해주면 안 돼요? 😋",
      createdAt: "오전 11:30",
      likes: 1,
      isLiked: false,
      replies: []
    }
  ],
  "sample-2": [
    {
      id: "comment-s2-1",
      author: "엄마",
      content: "동생이 첫 월급 탔다고 스시를 사왔네~ 입에서 살살 녹아 🍣",
      createdAt: "어제 17:40",
      likes: 1,
      isLiked: false,
      replies: []
    },
    {
      id: "comment-s2-2",
      author: "아빠",
      content: "회가 엄청 신선하더구나. 고생했다 우리 아들!",
      createdAt: "어제 18:00",
      likes: 1,
      isLiked: false,
      replies: []
    }
  ],
  "sample-3": [
    {
      id: "comment-s3-1",
      author: "나",
      content: "역시 치킨은 브랜드 반반 치킨이 진리..! 양념이 짱이야 🍗",
      createdAt: "3일 전",
      likes: 2,
      isLiked: false,
      replies: []
    },
    {
      id: "comment-s3-2",
      author: "동생",
      content: "바삭바삭해서 맥주 안주로 최고였음! 닭다리 양보해줘서 고마워요 엄마 👍",
      createdAt: "3일 전",
      likes: 1,
      isLiked: false,
      replies: []
    }
  ]
}

const defaultMealRatings: Record<string | number, Record<number, number>> = {
  "sample-1": { 1: 5, 2: 5, 3: 5, 4: 5 },
  "sample-2": { 1: 5, 2: 5, 3: 5, 4: 5 },
  "sample-3": { 1: 5, 2: 5, 3: 5, 4: 5 }
}

const defaultActiveVote: ActiveVote = {
  id: "sample-vote",
  title: "오늘 저녁 뭐 먹을까요?",
  createdBy: "엄마",
  endsAt: "오후 5시까지",
  isActive: true,
  options: [
    { id: 1, title: "삼겹살", image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=200&h=200&fit=crop", votes: 2, votedBy: ["아빠", "동생"] },
    { id: 2, title: "치킨", image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200&h=200&fit=crop", votes: 1, votedBy: ["나"] },
    { id: 3, title: "파스타", image: "https://images.unsplash.com/photo-1563379926898-37aacf113fd9?w=200&h=200&fit=crop", votes: 0, votedBy: [] },
  ]
}

const defaultTodayMenus: TodayMenu[] = [
  {
    id: "sample-menu-1",
    title: "토스트와 스크램블 에그",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=200&h=200&fit=crop",
    decidedBy: "엄마",
    decidedAt: "07:00",
    mealTime: "breakfast"
  },
  {
    id: "sample-menu-2",
    title: "김치찌개",
    image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=200&h=200&fit=crop",
    decidedBy: "엄마",
    decidedAt: "11:30",
    mealTime: "lunch"
  }
]

const sharedMeals: SharedMeal[] = []
const activeVote: ActiveVote | null = null
const todayMenus: TodayMenu[] = []

type TabType = "shared" | "vote" | "menu"
type SharedMealFilterType = "all" | "homemade" | "delivery" | "dining"

function generateUUID() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function FamilyPage() {
  const { isLoggedIn, user } = useHub()
  const { getReferralHistory, getMyReferralInfo } = useHubReferral()
  const [members, setMembers] = useState<FamilyMember[]>(familyMembers)
  const [showChefModal, setShowChefModal] = useState(false)

  useEffect(() => {
    async function loadRealFamily() {
      if (isLoggedIn) {
        const history = await getReferralHistory()
        const acceptedHistory = (history || []).filter((item: any) => item.status === 'REWARDED')

        if (acceptedHistory.length > 0) {
          const avatarPresets = [
            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
            "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop&crop=face",
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face"
          ]

          setMembers(prev => {
            const currentChef = prev.find(m => m.role === 'chef')
            const meMember: FamilyMember = {
              id: 1,
              name: "나",
              avatar: user?.avatar_url || "",
              role: (currentChef && currentChef.name === "나") ? "chef" : "member",
              isOnline: true,
              isStudent: false,
              userId: user?.id
            }

            const realMembers: FamilyMember[] = acceptedHistory.map((item: any, index: number) => ({
              id: index + 2,
              name: item.inviteeNickname || "가족",
              avatar: avatarPresets[index % avatarPresets.length],
              role: "member" as const,
              isOnline: false,
              isStudent: false,
              userId: item.inviteeId || item.id
            }))

            const updatedMembers = [meMember, ...realMembers]

            if (currentChef && currentChef.name !== "나") {
              const foundRealChef = updatedMembers.find(m => m.name === currentChef.name)
              if (foundRealChef) {
                foundRealChef.role = 'chef'
                meMember.role = 'member'
              }
            }

            return updatedMembers
          })
        } else {
          setMembers(prev => {
            const hasVirtual = prev.some(m => m.name === "엄마" || m.name === "아빠" || m.name === "동생")
            const baseList = hasVirtual ? prev : familyMembers
            return baseList.map(m => {
              if (m.name === "나") {
                return {
                  ...m,
                  avatar: user?.avatar_url || ""
                }
              }
              return m
            })
          })
        }
      } else {
        setMembers(familyMembers)
      }
    }
    loadRealFamily()
  }, [isLoggedIn, user, getReferralHistory])

  // Resolve database user UUIDs for family members
  useEffect(() => {
    async function resolveMemberUserIds() {
      if (!isLoggedIn || !user?.id) return

      // Filter members who are not '나' and don't have a userId yet
      const needsResolution = members.filter(m => m.name !== "나" && !m.userId)
      if (needsResolution.length === 0) return

      try {
        const supabase = createClient()
        const history = await getReferralHistory()
        const acceptedHistory = (history || []).filter((item: any) => item.status === 'REWARDED')
        const emails = acceptedHistory.map((h: any) => h.inviteeEmail).filter(Boolean)
        const nicknames = acceptedHistory.map((h: any) => h.inviteeNickname).filter(Boolean)

        let dbUsers: any[] = []
        if (emails.length > 0) {
          const { data } = await supabase.from('users').select('id, email, nickname').in('email', emails)
          if (data) dbUsers = [...dbUsers, ...data]
        }
        if (nicknames.length > 0) {
          const { data } = await supabase.from('users').select('id, email, nickname').in('nickname', nicknames)
          if (data) dbUsers = [...dbUsers, ...data]
        }

        setMembers(prev => prev.map(m => {
          if (m.name === "나") return { ...m, userId: user.id }
          
          const matched = dbUsers.find(u => {
            const ref = acceptedHistory.find((h: any) => h.inviteeNickname === m.name)
            return u.email === ref?.inviteeEmail || u.nickname === m.name
          })

          if (matched) {
            return { ...m, userId: matched.id }
          }
          return m
        }))
      } catch (err) {
        console.error("Failed to resolve member user IDs:", err)
      }
    }
    resolveMemberUserIds()
  }, [isLoggedIn, user, getReferralHistory])

  const [selectedChefId, setSelectedChefId] = useState<number | null>(null)

  useEffect(() => {
    if (showChefModal) {
      const currentChef = members.find((m) => m.role === "chef")
      if (currentChef) {
        setSelectedChefId(currentChef.id)
      }
    }
  }, [showChefModal, members])

  const [activeTab, setActiveTab] = useState<TabType>("shared")
  const [meals, setMeals] = useState<SharedMeal[]>(sharedMeals)
  const [vote, setVote] = useState<ActiveVote | null>(activeVote)
  const [selectedMealId, setSelectedMealId] = useState<string | number | null>(null)
  const [mealCommentInput, setMealCommentInput] = useState("")
  const [mealReplyInput, setMealReplyInput] = useState("")
  const [sharedMealFilter, setSharedMealFilter] = useState<SharedMealFilterType>("all")
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ mealId: string | number; commentId: string | number } | null>(null)
  const [expandedMealCommentsId, setExpandedMealCommentsId] = useState<string | number | null>(null)
  const [mealComments, setMealComments] = useState<Record<string | number, MealComment[]>>({})
  const [mealRatings, setMealRatings] = useState<Record<string | number, Record<number, number>>>({})
  
  // 샘플 데이터일 때 초기 댓글과 평점을 로컬 상태에 주입
  useEffect(() => {
    if (meals.length === 0) {
      setMealComments(defaultMealComments)
      setMealRatings(defaultMealRatings)
    }
  }, [meals])

  const displayComments = meals.length === 0 ? defaultMealComments : mealComments
  const displayRatings = meals.length === 0 ? defaultMealRatings : mealRatings

  const [promotedMealIds, setPromotedMealIds] = useState<any[]>([])
  const [promotionReasonByMealId, setPromotionReasonByMealId] = useState<Record<string | number, "all-rated" | "deadline">>({})
  const [isPromotingMealId, setIsPromotingMealId] = useState<string | number | null>(null)
  const [dismissedMealHighlightIds, setDismissedMealHighlightIds] = useState<any[]>([])

  // 거주 지역 등록 모달 관련 상태 변수
  const [regionModalOpen, setRegionModalOpen] = useState(false)
  const [inputCity, setInputCity] = useState("")
  const [inputGu, setInputGu] = useState("")
  const [inputDong, setInputDong] = useState("")
  const [isRegionSaving, setIsRegionSaving] = useState(false)

  const handleSaveRegionAndUpload = async () => {
    if (!inputCity.trim() || !inputGu.trim() || !inputDong.trim()) {
      toast.error("거주 지역(시도, 시군구, 읍면동)을 모두 입력해 주세요.")
      return
    }

    if (!user?.id) return

    try {
      setIsRegionSaving(true)
      const supabase = createClient()

      const regionData = {
        city: inputCity.trim(),
        gu: inputGu.trim(),
        dong: inputDong.trim()
      }

      // users 테이블에 region 저장
      const { error: userError } = await supabase
        .from('users')
        .update({ region: JSON.stringify(regionData) })
        .eq('id', user.id)

      if (userError) throw userError

      setRegionModalOpen(false)
      toast.success("거주 지역이 등록되었습니다!")

      // 대기 중인 패밀리 식사 업로드 속행
      if (pendingFamilyRating) {
        const { mealId, memberId, score } = pendingFamilyRating
        await saveFamilyRating(mealId, memberId, score)
        const currentRatingMap = { ...(mealRatings[mealId] ?? {}), [memberId]: score }
        await tryPromoteMealToTalk(mealId, currentRatingMap)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("navigateToTalk"))
        }, 100)
      }
      setPendingFamilyRating(null)

    } catch (err) {
      console.error("Failed to save user region on family 5star promotion:", err)
      toast.error("지역 저장에 실패했습니다. 다시 시도해 주세요.")
    } finally {
      setIsRegionSaving(false)
    }
  }

  // Decided Menu States
  const [decidedMealTime, setDecidedMealTime] = useState<"breakfast" | "lunch" | "dinner">("breakfast")
  const [decidedMenuName, setDecidedMenuName] = useState("")
  const [todayDecidedMenus, setTodayDecidedMenus] = useState<TodayMenu[]>([])

  // Vote Creation States
  const [voteTitle, setVoteTitle] = useState("")
  const [voteOption1, setVoteOption1] = useState("")
  const [voteOption2, setVoteOption2] = useState("")
  const [voteOption3, setVoteOption3] = useState("")
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isInviteLinkCopied, setIsInviteLinkCopied] = useState(false)
  const [showCreateVoteModal, setShowCreateVoteModal] = useState(false)
  const [showDecideMenuModal, setShowDecideMenuModal] = useState(false)
  const [familyPhoto, setFamilyPhoto] = useState<string | null>(null)
  const familyPhotoInputRef = useRef<HTMLInputElement | null>(null)

  const [inviteLink, setInviteLink] = useState("")

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    async function buildInviteLink() {
      let base = window.location.origin + window.location.pathname;
      try {
        const urlObj = new URL(base);
        const privatePaths = ['/profile', '/payment', '/login'];
        if (privatePaths.some(p => urlObj.pathname.startsWith(p))) {
          urlObj.pathname = '/';
          urlObj.search = '';
        }
        base = urlObj.toString();
      } catch (e) {}

      if (isLoggedIn) {
        const info = await getMyReferralInfo();
        if (info?.code) {
          try {
            const urlObj = new URL(base);
            urlObj.searchParams.set('ref', info.code);
            setInviteLink(urlObj.toString());
            return;
          } catch (e) {
            setInviteLink(`${base}${base.includes('?') ? '&' : '?'}ref=${info.code}`);
            return;
          }
        }
      }
      setInviteLink(base);
    }
    buildInviteLink();
  }, [isLoggedIn, user, getMyReferralInfo])

  const fetchFamilyData = async (familyUserIds: string[]) => {
    try {
      const supabase = createClient()
      
      // 1. Fetch shared meals (meal_images)
      const { data: imgData, error: imgError } = await supabase
        .from('meal_images')
        .select('*')
        .in('uploaded_by', familyUserIds)
        .in('source', ['family-shared', 'solo-5star'])
        .order('created_at', { ascending: false })

      if (imgError) throw imgError

      if (!imgData || imgData.length === 0) {
        setMeals([])
        return
      }

      // Extract mealMenuIds and mealImageIds (both can be targets for comments)
      const mealMenuIds = imgData.map(img => img.meal_id).filter(Boolean)
      const mealImageIds = imgData.map(img => img.id).filter(Boolean)
      const allTargetIds = Array.from(new Set([...mealMenuIds, ...mealImageIds]))

      // 2. Fetch comments for these target IDs
      let allComments: any[] = []
      if (allTargetIds.length > 0) {
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*')
          .in('meal_id', allTargetIds)
          .eq('is_deleted', false)
        allComments = commentsData || []
      }

      // Extract comment IDs to fetch replies
      const commentIds = allComments.map(c => c.id)
      let allReplies: any[] = []
      if (commentIds.length > 0) {
        const { data: repliesData } = await supabase
          .from('comment_replies')
          .select('*')
          .in('comment_id', commentIds)
          .eq('is_deleted', false)
        allReplies = repliesData || []
      }

      // 3. Fetch ratings for these mealMenuIds
      let allRatings: any[] = []
      if (mealMenuIds.length > 0) {
        const { data: ratingsData } = await supabase
          .from('meal_ratings')
          .select('*')
          .in('meal_id', mealMenuIds)
        allRatings = ratingsData || []
      }

      // 4. Load users list to map user_id to nicknames/avatars
      const allUserIds = Array.from(new Set([
        ...imgData.map(img => img.uploaded_by),
        ...allComments.map(c => c.user_id),
        ...allReplies.map(r => r.user_id),
        ...allRatings.map(rt => rt.user_id)
      ]))
      let dbUsers: any[] = []
      if (allUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, nickname, email, profile_image')
          .in('id', allUserIds)
        dbUsers = usersData || []
      }
      const userMap = new Map(dbUsers.map(u => [u.id, u]))

      // 5. Map to UI State structures
      const formattedMeals: SharedMeal[] = imgData.map(img => {
        let meta: any = {}
        try {
          meta = img.explanation ? JSON.parse(img.explanation) : {}
        } catch (e) {
          meta = { title: img.explanation || "식사" }
        }

        const u = userMap.get(img.uploaded_by)
        const uploaderName = u?.nickname || "가족"
        const formattedDate = new Date(img.created_at).toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        return {
          id: img.id,
          image: img.image_url,
          title: meta.title || "맛있는 식사",
          sharedBy: img.uploaded_by === user?.id ? "나" : uploaderName,
          sharedAt: formattedDate,
          sharedAtIso: img.created_at,
          mealType: meta.mealType || "homemade",
          mealMenuId: img.meal_id,
          doNotPromote: meta.doNotPromote || false,
          rawExplanation: img.explanation || ''
        }
      })

      // Map comments & replies
      const commentsByMealId: Record<string, MealComment[]> = {}
      imgData.forEach(img => {
        const mealMenuId = img.meal_id
        const imgId = img.id

        const mealCommentsList = allComments
          .filter(c => c.meal_id === mealMenuId || c.meal_id === imgId)
          .map(c => {
            const u = userMap.get(c.user_id)
            const cAuthor = c.user_id === user?.id ? "나" : (u?.nickname || "가족")
            const cReplies = allReplies
              .filter(r => r.comment_id === c.id)
              .map(r => {
                const ru = userMap.get(r.user_id)
                return {
                  id: r.id,
                  author: r.user_id === user?.id ? "나" : (ru?.nickname || "가족"),
                  content: r.content,
                  createdAt: new Date(r.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                  likes: 0,
                  isLiked: false
                }
              })

            return {
              id: c.id,
              author: cAuthor,
              content: c.content,
              createdAt: new Date(c.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              likes: 0,
              isLiked: false,
              replies: cReplies
            }
          })

        commentsByMealId[imgId] = mealCommentsList
      })

      // Map ratings
      const ratingsByMealId: Record<string, Record<number, number>> = {}
      imgData.forEach(img => {
        const mealMenuId = img.meal_id
        const imgId = img.id
        const mealRatingsMap: Record<number, number> = {}

        allRatings
          .filter(rt => rt.meal_id === mealMenuId)
          .forEach(rt => {
            const foundMember = members.find(m => m.userId === rt.user_id)
            if (foundMember) {
              mealRatingsMap[foundMember.id] = rt.rating
            }
          })

        ratingsByMealId[imgId] = mealRatingsMap
      })

      setMeals(formattedMeals)
      setMealComments(commentsByMealId)
      setMealRatings(ratingsByMealId)

    } catch (e) {
      console.error("Failed to fetch family shared data:", e)
    }
  }

  const fetchDecidedMenus = async () => {
    try {
      const supabase = createClient()
      const todayStr = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('meal_menus')
        .select('*')
        .eq('school_code', 'family')
        .eq('meal_date', todayStr)
        .eq('is_temporary', false)

      if (error) throw error

      if (data) {
        const formatted: TodayMenu[] = data.map(m => ({
          id: m.id,
          title: m.menu_items?.[0] || "결정된 메뉴",
          image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop",
          decidedBy: m.kcal || "셰프",
          decidedAt: new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          mealTime: m.meal_type as "breakfast" | "lunch" | "dinner"
        }))
        setTodayDecidedMenus(formatted)
      }
    } catch (err) {
      console.error("Failed to fetch decided menus", err)
    }
  }

  // Trigger sync of family data and decided menus
  useEffect(() => {
    if (isLoggedIn && user?.id) {
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      if (familyUserIds.length > 0) {
        fetchFamilyData(familyUserIds)
      }
      fetchDecidedMenus()
    }
  }, [members, isLoggedIn, user])

  const currentFamilyMember = members.find((member) => member.name === "나") ?? members[0]
  const currentFamilyMemberId = currentFamilyMember.id
  const currentFamilyMemberName = currentFamilyMember.name

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

  const baseMeals = meals.length === 0 ? defaultSharedMeals : meals
  const filteredMeals = baseMeals.filter((meal) => {
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
    const ratingMap = displayRatings[mealId] ?? {}
    const ratedScores = Object.values(ratingMap).filter((score): score is number => typeof score === "number")

    if (ratedScores.length === 0) {
      return 0
    }

    const total = ratedScores.reduce((sum, score) => sum + score, 0)
    return total / ratedScores.length
  }

  const tryPromoteMealToTalk = async (
    mealId: string | number,
    ratingMap: Record<number, number>,
    passedMeals?: SharedMeal[]
  ) => {
    if (promotedMealIds.includes(mealId) || isPromotingMealId === mealId) {
      return
    }

    const currentMeals = passedMeals || meals
    const targetMeal = currentMeals.find((meal) => meal.id === mealId)
    if (!targetMeal || targetMeal.doNotPromote) {
      return
    }

    const scores = Object.values(ratingMap).filter((score): score is number => typeof score === "number")
    const has5Star = scores.some((score) => score === 5)

    if (!has5Star) {
      return
    }

    try {
      setIsPromotingMealId(mealId)

      const supabase = createClient()
      let meta: any = {}
      try {
        meta = targetMeal.rawExplanation ? JSON.parse(targetMeal.rawExplanation) : {}
      } catch (e) {
        meta = { title: targetMeal.title }
      }
      
      // 맛톡 승격 일시 기록
      meta.promotedAt = new Date().toISOString()
      meta.mealType = meta.mealType || targetMeal.mealType

      const { error } = await supabase
        .from('meal_images')
        .update({
          status: 'approved',
          explanation: JSON.stringify(meta)
        })
        .eq('id', targetMeal.id)

      if (error) throw error

      setPromotedMealIds((prev) => prev.includes(mealId) ? prev : [...prev, mealId])
    } catch (error) {
      console.error("[FamilyPage] 맛톡 게시 실패:", error)
    } finally {
      setIsPromotingMealId(null)
    }
  }



  const [shareConsentModalOpen, setShareConsentModalOpen] = useState(false)
  const [pendingFamilyRating, setPendingFamilyRating] = useState<{
    mealId: string | number
    memberId: number
    score: number
  } | null>(null)
  const [rememberSharePref, setRememberSharePref] = useState(false)

  const updateMealDoNotPromote = async (mealId: string | number, rawExplanation: string) => {
    try {
      const supabase = createClient()
      let meta: any = {}
      try {
        meta = rawExplanation ? JSON.parse(rawExplanation) : {}
      } catch (e) {
        meta = { title: rawExplanation || "식사" }
      }
      meta.doNotPromote = true
      
      await supabase
        .from('meal_images')
        .update({ explanation: JSON.stringify(meta) })
        .eq('id', mealId)
    } catch (err) {
      console.error("Failed to update doNotPromote flag", err)
    }
  }

  const checkFamilyConsentAndRate = async (mealId: string | number, memberId: number, score: number) => {
    const targetMeal = meals.find((meal) => meal.id === mealId)
    if (!targetMeal) return
    
    if (score === 5) {
      const supabase = createClient()
      const { data: userData } = await supabase
        .from('users')
        .select('region')
        .eq('id', user?.id)
        .single()

      const hasRegion = userData?.region ? (() => {
        try {
          const parsed = JSON.parse(userData.region)
          return Boolean(parsed.city && parsed.gu && parsed.dong)
        } catch (e) {
          return false
        }
      })() : false

      // 지역 설정이 없다면 모달 오픈
      if (!hasRegion) {
        setPendingFamilyRating({ mealId, memberId, score })
        setRegionModalOpen(true)
        return
      }

      const pref = localStorage.getItem("whateat_auto_share_5star")
      if (pref === "approved") {
        await saveFamilyRating(mealId, memberId, score)
        const currentRatingMap = { ...(mealRatings[mealId] ?? {}), [memberId]: score }
        await tryPromoteMealToTalk(mealId, currentRatingMap)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("navigateToTalk"))
        }, 100)
      } else if (pref === "rejected") {
        await saveFamilyRating(mealId, memberId, score)
        await updateMealDoNotPromote(targetMeal.id, targetMeal.rawExplanation || '')
        const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
        await fetchFamilyData(familyUserIds)
      } else {
        setPendingFamilyRating({ mealId, memberId, score })
        setShareConsentModalOpen(true)
      }
    } else {
      await saveFamilyRating(mealId, memberId, score)
    }
  }

  const saveFamilyRating = async (mealId: string | number, memberId: number, score: number) => {
    if (typeof mealId === "string" && mealId.startsWith("sample-")) {
      setMealRatings((prev) => {
        const next = { ...prev }
        next[mealId] = { ...(next[mealId] ?? {}), [memberId]: score }
        return next
      })
      return
    }

    const targetMeal = baseMeals.find((meal) => meal.id === mealId)
    if (!targetMeal || memberId !== currentFamilyMemberId || !isMealRatingOpen(targetMeal)) {
      return
    }

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const supabase = createClient()
      const mealMenuId = targetMeal.mealMenuId

      if (!mealMenuId) {
        console.error("Cannot rate meal without a valid mealMenuId")
        return
      }

      // Check if user already rated this meal
      const { data: existing } = await supabase
        .from('meal_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('meal_id', mealMenuId)
        .limit(1)

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('meal_ratings')
          .update({ rating: score })
          .eq('id', existing[0].id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('meal_ratings')
          .insert({
            id: generateUUID(),
            user_id: user.id,
            meal_id: mealMenuId,
            rating: score
          })
        if (error) throw error
      }

      // Sync state by reloading family data
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
    } catch (err) {
      console.error("Failed to save rating to Supabase", err)
    }
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

  const handleAddMealComment = async (mealId: string | number) => {
    const content = mealCommentInput.trim()
    if (!content) return

    if (typeof mealId === "string" && mealId.startsWith("sample-")) {
      setMealComments((prev) => {
        const next = { ...prev }
        const newComment: MealComment = {
          id: `comment-virtual-${Date.now()}`,
          author: "나",
          content: content,
          createdAt: "방금 전",
          likes: 0,
          isLiked: false,
          replies: []
        }
        next[mealId] = [...(next[mealId] ?? []), newComment]
        return next
      })
      setMealCommentInput("")
      return
    }

    const targetMeal = baseMeals.find(m => m.id === mealId)
    if (!targetMeal || !targetMeal.mealMenuId) return

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const supabase = createClient()
      const commentUuid = generateUUID()
      const { error } = await supabase.from('comments').insert({
        id: commentUuid,
        meal_id: targetMeal.mealMenuId,
        user_id: user.id,
        content: content,
        is_deleted: false
      })

      if (error) throw error

      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
      setMealCommentInput("")
    } catch (err) {
      console.error("Failed to add comment to Supabase", err)
    }
  }

  const handleAddMealReply = async (mealId: string | number, commentId: string | number) => {
    const content = mealReplyInput.trim()
    if (!content) return

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const supabase = createClient()
      const replyUuid = generateUUID()
      const { error } = await supabase.from('comment_replies').insert({
        id: replyUuid,
        comment_id: commentId,
        user_id: user.id,
        content: content,
        is_deleted: false
      })

      if (error) throw error

      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
      setMealReplyInput("")
      setActiveReplyTarget(null)
    } catch (err) {
      console.error("Failed to add reply to Supabase", err)
    }
  }

  const handleDecideMenu = async () => {
    if (!decidedMenuName.trim()) return

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const supabase = createClient()
      const todayStr = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('meal_menus').insert({
        id: generateUUID(),
        school_code: 'family',
        meal_date: todayStr,
        meal_type: decidedMealTime === "breakfast" ? "아침" : decidedMealTime === "lunch" ? "점심" : "저녁",
        menu_items: [decidedMenuName.trim()],
        kcal: currentFamilyMemberName, // storing decidedBy in kcal
        is_temporary: false,
        is_empty_result: false,
        office_code: 'E10'
      })

      if (error) throw error

      await fetchDecidedMenus()
      setShowDecideMenuModal(false)
      setDecidedMenuName("")
    } catch (err) {
      console.error("Failed to decide menu in Supabase", err)
    }
  }

  const handleCreateVote = () => {
    if (!voteTitle.trim() || !voteOption1.trim() || !voteOption2.trim()) return

    const options: VoteOption[] = [
      { id: 1, title: voteOption1.trim(), image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop", votes: 0, votedBy: [] },
      { id: 2, title: voteOption2.trim(), image: "https://images.unsplash.com/photo-1563379926898-37aacf113fd9?w=200&h=200&fit=crop", votes: 0, votedBy: [] }
    ]

    if (voteOption3.trim()) {
      options.push({ id: 3, title: voteOption3.trim(), image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200&h=200&fit=crop", votes: 0, votedBy: [] })
    }

    const newVote: ActiveVote = {
      id: Date.now().toString(),
      title: voteTitle.trim(),
      createdBy: currentFamilyMemberName,
      endsAt: "오늘 오후 6시까지",
      isActive: true,
      options
    }

    setVote(newVote)
    setShowCreateVoteModal(false)
    setVoteTitle("")
    setVoteOption1("")
    setVoteOption2("")
    setVoteOption3("")
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
        <span className="text-xs text-muted-foreground">{(displayComments[mealId] ?? []).length}개</span>
      </div>

      <div className={cn("space-y-2 pr-1", variant === "modal" ? "max-h-64 overflow-y-auto" : "max-h-48 overflow-y-auto")}>
        {(displayComments[mealId] ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
        ) : (
          (displayComments[mealId] ?? []).map((comment) => (
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

  const handleInteraction = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('openLoginModal'))
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Family Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl pt-3 pb-2 px-5 border border-white shadow-lg">
        <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar">
          <>
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  window.dispatchEvent(new CustomEvent('openLoginModal'))
                } else {
                  familyPhotoInputRef.current?.click()
                }
              }}
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
            <div className="flex flex-col gap-1 mt-1">
              <p className="text-[10px] text-muted-foreground font-semibold">{members.length}명의 구성원</p>
              <button
                onClick={() => {
                  setShowChefModal(true)
                }}
                className="text-[9px] bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 px-1.5 py-0.5 rounded-full font-black transition-all flex items-center gap-0.5"
              >
                <ChefHat className="size-2.5" />
                우리가족 셰프는?
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center gap-3 ml-2 overflow-x-auto hide-scrollbar">
            {members.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative">
                  {member.name === "나" ? (
                    <HubAvatar
                      isLoggedIn={isLoggedIn}
                      avatarUrl={user?.avatar_url}
                      nickname={(user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '나')}
                      size="sm"
                      className="!w-14 !h-14 rounded-2xl border-2 border-white shadow-md"
                    />
                  ) : (
                    <img
                      src={member.avatar || "/placeholder.svg"}
                      alt={member.name}
                      className="size-14 rounded-2xl object-cover border-2 border-white shadow-md"
                    />
                  )}
                  {member.role === "chef" && (
                    <div className="absolute -top-1 -right-1 size-5 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-white">
                      <ChefHat className="size-3 text-white" />
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
              onClick={() => {
                setShowInviteModal(true)
              }}
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
              const displayMeals = meals.length === 0 ? defaultSharedMeals : meals
              const count =
                filterTab.id === "all"
                  ? displayMeals.length
                  : displayMeals.filter((meal) => getSharedMealCategory(meal) === filterTab.id).length

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
                    {/* 샘플 리본 */}
                    {meals.length === 0 && (
                      <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 z-10 pointer-events-none">
                        <div className="absolute top-3 -right-6 w-24 bg-yellow-400 text-yellow-900 text-[9px] font-black py-0.5 text-center rotate-45 shadow-md">
                          💡 SAMPLE
                        </div>
                      </div>
                    )}
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
                        댓글 {(displayComments[meal.id] ?? []).length}개
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
                  {members.map((member) => {
                    const score = displayRatings[selectedMeal.id]?.[member.id] ?? 0
                    const isSelf = member.id === currentFamilyMemberId
                    const canRate = isSelf && isMealRatingOpen(selectedMeal)

                    return (
                      <div key={member.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground min-w-16">{member.name}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              onClick={() => canRate && checkFamilyConsentAndRate(selectedMeal.id, member.id, value)}
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
              onClick={() => {
                if (!isLoggedIn) {
                  window.dispatchEvent(new CustomEvent('openLoginModal'))
                } else {
                  setShowCreateVoteModal(true)
                }
              }}
              className="flex items-center gap-1 text-xs text-orange-500 font-bold"
            >
              <Plus className="size-3.5" />
              투표 만들기
            </button>
          </div>

          {(() => {
            const displayVote = vote || defaultActiveVote
            return displayVote?.isActive ? (
              <div className="bg-white/80 rounded-3xl p-5 border border-white shadow-lg relative overflow-hidden">
                {/* 샘플 리본 */}
                {!vote && (
                  <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 z-10 pointer-events-none">
                    <div className="absolute top-3 -right-6 w-24 bg-yellow-400 text-yellow-900 text-[9px] font-black py-0.5 text-center rotate-45 shadow-md">
                      💡 SAMPLE
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-foreground">{displayVote.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{displayVote.createdBy}님이 생성</span>
                      <span className="text-xs text-orange-500 font-bold flex items-center gap-1">
                        <Clock className="size-3" />
                        {displayVote.endsAt}
                      </span>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-green-100 rounded-full">
                    <span className="text-[10px] font-bold text-green-600">진행중</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {displayVote.options.map((option) => {
                    const totalVotes = displayVote.options.reduce((sum, o) => sum + o.votes, 0)
                    const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
                    const hasVoted = option.votedBy.includes("나")

                    return (
                      <button
                        key={option.id}
                        onClick={() => !hasVoted && vote && castVote(option.id as number)}
                        disabled={hasVoted || !vote}
                        className={cn(
                          "relative flex items-center gap-3 p-3 rounded-2xl border-2 transition-all overflow-hidden cursor-pointer",
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
            )
          })()}
        </div>
      )}

      {activeTab === "menu" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">{"Chef's Choice"}</h3>
            <button 
              onClick={() => {
                if (!isLoggedIn) {
                  window.dispatchEvent(new CustomEvent('openLoginModal'))
                } else {
                  setShowDecideMenuModal(true)
                }
              }}
              className="flex items-center gap-1 text-xs text-orange-500 font-bold"
            >
              <ChefHat className="size-3.5" />
              메뉴 결정하기
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {["breakfast", "lunch", "dinner"].map((mealTime) => {
              const displayTodayMenus = todayDecidedMenus.length === 0 ? defaultTodayMenus : todayDecidedMenus
              const menu = displayTodayMenus.find(m => m.mealTime === mealTime)
              const label = mealTime === "breakfast" ? "아침" : mealTime === "lunch" ? "점심" : "저녁"
              const timeRange = mealTime === "breakfast" ? "06:00 - 09:00" : mealTime === "lunch" ? "11:00 - 14:00" : "17:00 - 20:00"

              return (
                <div 
                  key={mealTime}
                  className={cn(
                    "bg-white/80 rounded-2xl p-4 border border-white shadow-md relative overflow-hidden",
                    !menu && "opacity-60"
                  )}
                >
                  {/* 샘플 리본 */}
                  {todayDecidedMenus.length === 0 && menu && (
                    <div className="absolute top-0 right-0 overflow-hidden w-16 h-16 z-10 pointer-events-none">
                      <div className="absolute top-2 -right-6 w-20 bg-yellow-400 text-yellow-900 text-[8px] font-black py-0.5 text-center rotate-45 shadow-md">
                        💡 SAMPLE
                      </div>
                    </div>
                  )}
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
              onClick={() => {
                if (!isLoggedIn) {
                  window.dispatchEvent(new CustomEvent('openLoginModal'))
                } else {
                  handleCopyInviteLink()
                }
              }}
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

      {/* Chef Selection Bottom Sheet (Pull-up Modal) */}
      {showChefModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-[430px] md:max-w-[640px] lg:max-w-[800px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">우리가족 셰프 지정 🍳</h3>
              <button 
                onClick={() => setShowChefModal(false)} 
                className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-normal">
              가족들의 식사를 결정할 주방 책임자(셰프)를 지정하세요. 셰프는 메뉴 결정 권한을 가집니다.
            </p>
            
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
              {members.map((member) => {
                const isSelected = selectedChefId === member.id
                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedChefId(member.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all",
                      isSelected 
                        ? "border-orange-500 bg-orange-50/50" 
                        : "border-gray-100 hover:bg-gray-50"
                    )}
                  >
                    {member.name === "나" ? (
                      <HubAvatar
                        isLoggedIn={isLoggedIn}
                        avatarUrl={user?.avatar_url}
                        nickname={(user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '나')}
                        size="sm"
                        className="!w-10 !h-10 rounded-xl"
                      />
                    ) : (
                      <img 
                        src={member.avatar || "/placeholder.svg"} 
                        alt={member.name} 
                        className="size-10 rounded-xl object-cover"
                      />
                    )}
                    <div className="flex-1 text-left">
                      <span className="font-bold text-sm text-foreground">{member.name}</span>
                      {member.role === 'chef' && (
                        <span className="ml-2 text-[10px] font-bold text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-md">현재 셰프</span>
                      )}
                    </div>
                    <div className={cn(
                      "size-5 rounded-full border flex items-center justify-center",
                      isSelected ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300"
                    )}>
                      {isSelected && <Check className="size-3 stroke-[3]" />}
                    </div>
                  </button>
                )
              })}
            </div>
            
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  window.dispatchEvent(new CustomEvent('openLoginModal'))
                } else {
                  if (selectedChefId) {
                    setMembers(prev => prev.map(m => ({
                      ...m,
                      role: m.id === selectedChefId ? 'chef' : 'member'
                    })))
                    setShowChefModal(false)
                  }
                }
              }}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-orange-500/20"
            >
              셰프 변경 완료
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
                  value={voteTitle}
                  onChange={(e) => setVoteTitle(e.target.value)}
                  placeholder="오늘 저녁 뭐 먹을까요?" 
                  className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">후보 메뉴 (2-3개)</label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    value={voteOption1}
                    onChange={(e) => setVoteOption1(e.target.value)}
                    placeholder="메뉴 1" 
                    className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300" 
                  />
                  <input 
                    type="text" 
                    value={voteOption2}
                    onChange={(e) => setVoteOption2(e.target.value)}
                    placeholder="메뉴 2" 
                    className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300" 
                  />
                  <input 
                    type="text" 
                    value={voteOption3}
                    onChange={(e) => setVoteOption3(e.target.value)}
                    placeholder="메뉴 3 (선택)" 
                    className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300" 
                  />
                </div>
              </div>
              <button 
                onClick={handleCreateVote}
                className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl mt-2 cursor-pointer hover:bg-orange-600 transition-colors"
              >
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
                  {["아침", "점심", "저녁"].map((time) => {
                    const timeType = time === "아침" ? "breakfast" : time === "점심" ? "lunch" : "dinner"
                    return (
                      <button 
                        key={time} 
                        onClick={() => setDecidedMealTime(timeType)}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-xl border-2 text-sm font-medium transition-colors cursor-pointer",
                          decidedMealTime === timeType 
                            ? "border-orange-500 text-orange-500 bg-orange-50/50 font-bold" 
                            : "border-muted text-muted-foreground hover:border-orange-400"
                        )}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">메뉴 이름</label>
                <input 
                  type="text" 
                  value={decidedMenuName}
                  onChange={(e) => setDecidedMenuName(e.target.value)}
                  placeholder="오늘의 메뉴를 입력하세요" 
                  className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <button 
                onClick={handleDecideMenu}
                className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl mt-2 flex items-center justify-center gap-2 cursor-pointer hover:bg-orange-600 transition-colors"
              >
                <Bell className="size-4" />
                결정 및 알림 보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-Star Share Consent Modal */}
      {shareConsentModalOpen && pendingFamilyRating && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-foreground mb-2">맛톡 공개 동의</h3>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              5점 평점을 받은 식사는 '맛톡'(동네 피드)에 공개됩니다. 공개하시겠습니까?
            </p>
            
            <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberSharePref}
                onChange={(e) => setRememberSharePref(e.target.checked)}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 size-4 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">이후 항상 이 선택 적용 (자동 처리)</span>
            </label>
            
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (rememberSharePref) {
                    localStorage.setItem("whateat_auto_share_5star", "approved")
                  }
                  setShareConsentModalOpen(false)
                  if (pendingFamilyRating) {
                    const { mealId, memberId, score } = pendingFamilyRating
                    
                    const supabase = createClient()
                    const { data: userData } = await supabase
                      .from('users')
                      .select('region')
                      .eq('id', user?.id)
                      .single()

                    const hasRegion = userData?.region ? (() => {
                      try {
                        const parsed = JSON.parse(userData.region)
                        return Boolean(parsed.city && parsed.gu && parsed.dong)
                      } catch (e) {
                        return false
                      }
                    })() : false

                    if (!hasRegion) {
                      setRegionModalOpen(true)
                    } else {
                      await saveFamilyRating(mealId, memberId, score)
                      const currentRatingMap = { ...(mealRatings[mealId] ?? {}), [memberId]: score }
                      await tryPromoteMealToTalk(mealId, currentRatingMap)
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent("navigateToTalk"))
                      }, 100)
                      setPendingFamilyRating(null)
                    }
                  }
                }}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                승낙 (공개)
              </button>
              <button
                onClick={async () => {
                  if (rememberSharePref) {
                    localStorage.setItem("whateat_auto_share_5star", "rejected")
                  }
                  setShareConsentModalOpen(false)
                  if (pendingFamilyRating) {
                    await saveFamilyRating(pendingFamilyRating.mealId, pendingFamilyRating.memberId, pendingFamilyRating.score)
                    const targetMeal = meals.find(m => m.id === pendingFamilyRating.mealId)
                    if (targetMeal) {
                      await updateMealDoNotPromote(targetMeal.id, targetMeal.rawExplanation || '')
                    }
                  }
                  setPendingFamilyRating(null)
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-muted-foreground font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                거절 (비공개)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 거주 지역 등록 모달 (최초 맛톡 공유 시 강제 수집) */}
      {regionModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-in fade-in zoom-in duration-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <span className="text-orange-500">📍</span> 거주 지역 등록
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                맛톡(동네 맛집 피드)에 식사 기록을 연동하기 위해 회원님의 거주 지역(동) 정보를 등록해 주세요.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground mb-1 block">시/도</label>
                  <input
                    type="text"
                    placeholder="예: 인천"
                    value={inputCity}
                    onChange={(e) => setInputCity(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground mb-1 block">시/군/구</label>
                  <input
                    type="text"
                    placeholder="예: 서구"
                    value={inputGu}
                    onChange={(e) => setInputGu(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground mb-1 block">읍/면/동</label>
                  <input
                    type="text"
                    placeholder="예: 청라동"
                    value={inputDong}
                    onChange={(e) => setInputDong(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveRegionAndUpload}
                disabled={isRegionSaving}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:bg-orange-300 flex items-center justify-center"
              >
                {isRegionSaving ? "저장 중..." : "거주 지역 등록 및 맛톡 공유"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
