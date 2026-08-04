"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { 
  Crown, 
  Share2, 
  Vote as VoteIcon, 
  ChefHat, 
  Bike,
  UtensilsCrossed,
  Pencil,
  Trash2,
  Bell, 
  Check, 
  X, 
  ArrowUpDown,
  ChevronDown,
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
  MapPin,
  Search,
  ExternalLink,
  BookOpen,
  Calendar,
  UserMinus,
  Users,
} from "lucide-react"
import { cn, formatPlaceNameWithRegion } from "@/lib/utils"
import { useHub, HubAvatar, useHubReferral } from "@/services/merlin-hub-sdk/react"
import { createClient } from "@/lib/supabase"
import { getSessionToken } from "@/services/merlin-hub-sdk/CoreLogic/client"
import { secureWrite } from "@/lib/supabase-safe"
import { toast } from "react-hot-toast"
import { MealCalendarTab } from "@/components/whateat/meal-calendar-tab"
import { TabNavigation } from "@/components/whateat/tab-navigation"
import { AddReservationModal } from "@/components/whateat/add-reservation-modal"
import { AddLogModal, type MealLogData } from "@/components/whateat/add-log-modal"

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
  linkUrl?: string
  linkThumbnail?: string
  placeName?: string
  status?: string
}

interface MealReply {
  id: string | number
  userId?: string
  author: string
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
}

interface MealComment {
  id: string | number
  userId?: string
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

const defaultWishlistItems = [
  {
    id: "sample-wish-1",
    date: "",
    time: "19:00",
    mealType: "배달",
    menu: "가족 야식 치킨 파티 🍗",
    place: "교촌치킨 청라점",
    memo: "이번 주말 야식으로 다같이 치맥 어때요?",
    thumbnail: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&fit=crop",
    url: "https://m.place.naver.com/restaurant/1234567",
    userId: "sample-user-1",
    isSample: true
  },
  {
    id: "sample-wish-2",
    date: "",
    time: "12:30",
    mealType: "집밥",
    menu: "아빠표 해물 토마토 파스타 🍝",
    place: "우리집 주방",
    memo: "주말 점심에 스페셜 해물 파스타 해드릴게요!",
    thumbnail: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=500&fit=crop",
    url: "https://www.youtube.com/results?search_query=해물+파스타+레시피",
    userId: "sample-user-2",
    isSample: true
  },
  {
    id: "sample-wish-3",
    date: "",
    time: "18:30",
    mealType: "외식",
    menu: "청담동 숙성 삼겹살 외식 🥓",
    place: "우미학 청담점",
    memo: "이번 주말 외식 장소로 어때요? 다같이 고기 먹어요!",
    thumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&fit=crop",
    url: "https://m.place.naver.com/restaurant/37166160",
    userId: "sample-user-3",
    isSample: true
  }
]

const defaultFamilyReservations = [
  {
    id: "sample-res-1",
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: "19:00",
    mealType: "배달",
    menu: "불금 가족 치킨 배달 🍗",
    place: "교촌치킨 청라점",
    memo: "금요일 저녁 다같이 모여서 치맥!",
    thumbnail: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&fit=crop",
    url: "https://m.place.naver.com/restaurant/1234567",
    userId: "sample-user-1",
    isSample: true
  },
  {
    id: "sample-res-2",
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: "12:30",
    mealType: "집밥",
    menu: "주말 아빠표 봉골레 파스타 🍝",
    place: "우리집",
    memo: "주말 점심 특식 파스타!",
    thumbnail: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=500&fit=crop",
    url: "https://www.youtube.com/results?search_query=봉골레+파스타",
    userId: "sample-user-2",
    isSample: true
  },
  {
    id: "sample-res-3",
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    time: "18:30",
    mealType: "외식",
    menu: "가족 외식 삼겹살 데이 🥓",
    place: "우미학 청담점",
    memo: "일요일 저녁 가족 외식",
    thumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&fit=crop",
    url: "https://m.place.naver.com/restaurant/37166160",
    userId: "sample-user-3",
    isSample: true
  }
]

const mergeWishlistWithSamples = (realWishlist: any[]) => {
  if (!realWishlist || realWishlist.length === 0) {
    return defaultWishlistItems
  }
  const hasDelivery = realWishlist.some(item => item.mealType === "배달")
  const hasHomemade = realWishlist.some(item => item.mealType === "집밥")
  const hasDineout = realWishlist.some(item => item.mealType === "외식")
  const result = [...realWishlist]
  if (!hasDelivery) {
    const sample = defaultWishlistItems.find(s => s.mealType === "배달")
    if (sample) result.push(sample)
  }
  if (!hasHomemade) {
    const sample = defaultWishlistItems.find(s => s.mealType === "집밥")
    if (sample) result.push(sample)
  }
  if (!hasDineout) {
    const sample = defaultWishlistItems.find(s => s.mealType === "외식")
    if (sample) result.push(sample)
  }
  return result
}

const mergeReservationsWithSamples = (realReservations: any[]) => {
  if (!realReservations || realReservations.length === 0) {
    return defaultFamilyReservations
  }
  const hasDelivery = realReservations.some(item => item.mealType === "배달")
  const hasHomemade = realReservations.some(item => item.mealType === "집밥")
  const hasDineout = realReservations.some(item => item.mealType === "외식")
  const result = [...realReservations]
  if (!hasDelivery) {
    const sample = defaultFamilyReservations.find(s => s.mealType === "배달")
    if (sample) result.push(sample)
  }
  if (!hasHomemade) {
    const sample = defaultFamilyReservations.find(s => s.mealType === "집밥")
    if (sample) result.push(sample)
  }
  if (!hasDineout) {
    const sample = defaultFamilyReservations.find(s => s.mealType === "외식")
    if (sample) result.push(sample)
  }
  return result
}

const sharedMeals: SharedMeal[] = []
const activeVote: ActiveVote | null = null
const todayMenus: TodayMenu[] = []

type TabType = "shared" | "vote" | "menu"
type SharedMealFilterType = "all" | "homemade" | "delivery" | "dining"

function formatTimeAgo(isoString?: string) {
  if (!isoString) return "방금 전"
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return "방금 전"
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return "방금 전"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

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

const getFamilyName = async (supabase: any, uploadedBy: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const currentUserId = session?.user?.id || uploadedBy

    const { data: referralData } = await supabase
      .from("referrals")
      .select("referrer_id")
      .eq("referee_id", currentUserId)
      .maybeSingle()

    const hostId = referralData?.referrer_id || currentUserId

    const { data: hostUser } = await supabase
      .from("users")
      .select("nickname")
      .eq("id", hostId)
      .single()

    if (hostUser?.nickname) {
      return `${hostUser.nickname} 가족`
    }
  } catch (e) {
    console.error("getFamilyName error:", e)
  }
  return "우리 가족"
}

export function FamilyPage({ 
  activeMainTab = "log",
  onTabChange
}: { 
  activeMainTab?: "log" | "reservation" | "calendar"
  onTabChange?: (tab: "log" | "reservation" | "calendar") => void
}) {
  const { isLoggedIn, user } = useHub()
  const { getReferralHistory, getMyReferralInfo } = useHubReferral()
  const [members, setMembers] = useState<FamilyMember[]>(familyMembers)
  const [showChefModal, setShowChefModal] = useState(false)
  const [showMemberManageModal, setShowMemberManageModal] = useState(false)
  const [isFamilyOwner, setIsFamilyOwner] = useState(true)

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!targetUserId || targetUserId === user?.id) {
      toast.error('방장 자신은 제거할 수 없습니다.');
      return;
    }
    if (!confirm(`'${memberName}' 님을 가족 그룹에서 제거하시겠습니까?`)) return;

    try {
      let hubToken = '';
      try {
        const { getSessionToken } = await import('@/services/merlin-hub-sdk/CoreLogic/client');
        hubToken = getSessionToken() || '';
      } catch (e) {}

      const res = await fetch('/api/family/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(hubToken ? { 'x-hub-token': hubToken } : {}),
        },
        body: JSON.stringify({ targetUserId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`'${memberName}' 님이 가족에서 제거되었습니다.`);
        // Reload family members
        window.dispatchEvent(new Event('focus'));
      } else {
        toast.error(data.error || '멤버 제거에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
      toast.error('오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    async function loadRealFamily() {
      if (!isLoggedIn || !user) {
        setMembers(familyMembers)
        setIsFamilyOwner(true)
        setFamilyPhoto(null)
        return
      }

      try {
        let hubToken = ''
        try {
          const { getSessionToken } = await import('@/services/merlin-hub-sdk/CoreLogic/client')
          hubToken = getSessionToken() || ''
        } catch (e) {}

        // 왓잇 전용 가족 정보 조회 (whateat_family_groups + whateat_family_members 테이블)
        const res = await fetch('/api/family/members', {
          headers: hubToken ? { 'x-hub-token': hubToken } : undefined
        })
        if (!res.ok) throw new Error(`family/members API error: ${res.status}`)
        const result = await res.json()

        // 가족 연결 전 (family_members에 데이터 없음) → 나 혼자 상태
        if (result._noFamily) {
          setIsFamilyOwner(true)
          setFamilyHostId(user.id)
          setFamilyGroupId(null)
          setFamilyPhoto(null)
          setChefUserId(user.id)
          setFamilyHostName(user.nickname || '나')
          const mySelf: FamilyMember = {
            id: 1,
            name: "나",
            avatar: user.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
            role: "member",
            isOnline: true,
            isStudent: false,
            userId: user.id
          }
          setMembers([mySelf])
          return
        }

        const { isOwner, hostId, chefId, hostUser, refereeIds, membersData, familyGroup } = result
        const effectiveChefId = chefId || hostId || user.id;

        setIsFamilyOwner(isOwner)
        setFamilyHostId(hostId)
        setFamilyGroupId(familyGroup?.id || null)
        setFamilyPhoto(familyGroup?.family_photo || null)
        setChefUserId(effectiveChefId)
        setSelectedChefId(effectiveChefId)

        const myDefaultAvatar = user.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face"
        const fallbackAvatar = "https://images.unsplash.com/photo-1544717305-2782549b5136?w=100&h=100&fit=crop&crop=face"

        const hostNickname = hostUser?.nickname || (user.nickname || "나")
        const hostAvatar = hostUser?.profile_image || myDefaultAvatar
        setFamilyHostName(hostNickname)

        let newMemberList: FamilyMember[] = []

        const meMember: FamilyMember = {
          id: 1,
          name: "나",
          avatar: myDefaultAvatar,
          role: user.id === effectiveChefId ? "chef" : "member",
          isOnline: true,
          isStudent: false,
          userId: user.id
        }

        if (isOwner) {
          // 방장인 경우: 나 + 초대한 멤버들
          const otherMembers: FamilyMember[] = (membersData || []).map((m: any, idx: number) => ({
            id: idx + 2,
            name: m.nickname || "멤버",
            avatar: m.profile_image || fallbackAvatar,
            role: m.id === effectiveChefId ? ("chef" as const) : ("member" as const),
            isOnline: true,
            isStudent: false,
            userId: m.id
          }))
          newMemberList = [meMember, ...otherMembers]
        } else {
          // 초대받은 멤버인 경우: 나 + 방장 + 다른 멤버들
          const hostMember: FamilyMember = {
            id: 2,
            name: hostNickname,
            avatar: hostAvatar,
            role: hostId === effectiveChefId ? ("chef" as const) : ("member" as const),
            isOnline: true,
            isStudent: false,
            userId: hostId
          }
          const otherMembers: FamilyMember[] = (membersData || [])
            .filter((m: any) => m.id !== user.id)
            .map((m: any, idx: number) => ({
              id: idx + 3,
              name: m.nickname || "멤버",
              avatar: m.profile_image || fallbackAvatar,
              role: m.id === effectiveChefId ? ("chef" as const) : ("member" as const),
              isOnline: false,
              isStudent: false,
              userId: m.id
            }))
          newMemberList = [meMember, hostMember, ...otherMembers]
        }

        setMembers(newMemberList)

      } catch (err) {
        console.error("loadRealFamily error:", err)
      }
    }
    loadRealFamily()

    const handleFocus = () => {
      loadRealFamily()
    }
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [isLoggedIn, user, activeMainTab])

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
          const { data } = await supabase.from('users').select('id, email, nickname, profile_image').in('email', emails)
          if (data) dbUsers = [...dbUsers, ...data]
        }
        if (nicknames.length > 0) {
          const { data } = await supabase.from('users').select('id, email, nickname, profile_image').in('nickname', nicknames)
          if (data) dbUsers = [...dbUsers, ...data]
        }

        setMembers(prev => prev.map(m => {
          if (m.name === "나") return { ...m, userId: user.id }
          
          const matched = dbUsers.find(u => {
            const ref = acceptedHistory.find((h: any) => h.inviteeNickname === m.name)
            return u.email === ref?.inviteeEmail || u.nickname === m.name
          })

          if (matched) {
            return { 
              ...m, 
              userId: matched.id,
              avatar: matched.profile_image || m.avatar
            }
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

  const [meals, setMeals] = useState<SharedMeal[]>(sharedMeals)

  // 기등록된 배달 식당 목록 추출
  const registeredDeliveryStores = useMemo(() => {
    const storesMap = new Map<string, any>()
    meals.forEach(log => {
      // family page에서는 mealType이 "delivery" 이거나 type이 "배달"
      if ((log.mealType === "delivery" || log.type === "배달") && log.placeName) {
        const address = log.placeAddress || ""
        const dongMatch = address.match(/([가-힣\d]+동)/)
        const dong = dongMatch ? dongMatch[1] : "역삼동"
        storesMap.set(log.placeName, {
          name: log.placeName,
          address: address,
          category: "배달음식",
          dong: dong,
          lastOrderedAt: log.date || "최근"
        })
      }
    })
    return Array.from(storesMap.values())
  }, [meals])

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [vote, setVote] = useState<ActiveVote | null>(activeVote)
  const [selectedMealId, setSelectedMealId] = useState<string | number | null>(null)
  const [mealCommentInput, setMealCommentInput] = useState("")
  const [mealReplyInput, setMealReplyInput] = useState("")
  const [sharedMealFilter, setSharedMealFilter] = useState<SharedMealFilterType>("all")
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ mealId: string | number; commentId: string | number } | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | number | null>(null)
  const [editCommentText, setEditCommentText] = useState("")
  const [editingReplyId, setEditingReplyId] = useState<string | number | null>(null)
  const [editReplyText, setEditReplyText] = useState("")
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

  const [sortOption, setSortOption] = useState<"날짜순" | "별점순" | "기간">("날짜순")
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc")
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
      await secureWrite({
        table: 'users',
        action: 'update',
        data: { region: JSON.stringify(regionData) },
        filters: { id: user.id }
      })

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

  // Base64 데이터를 Blob으로 변환하는 헬퍼 함수
  const base64ToBlob = (base64Data: string, contentType = "image/webp") => {
    const byteString = atob(base64Data.split(",")[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    return new Blob([ab], { type: contentType })
  }

  // Supabase Storage에 파일 업로드하는 함수
  const uploadImageToStorage = async (base64Image: string): Promise<string> => {
    if (!user?.id) throw new Error("User not logged in")
    const token = getSessionToken();
    const fileName = `family_${user.id}_${Date.now()}.webp`

    const res = await fetch('/api/db/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ image: base64Image, fileName })
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Image upload failed');
    }
    return result.publicUrl;
  }

  const handleAddMealSave = async (data: MealLogData) => {
    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    const mealUuid = generateUUID()
    let status = "pending"
    let source = "family-shared"

    const mealTypeMap = {
      "집밥": "homemade" as const,
      "배달": "delivery" as const,
      "외식": "dining" as const
    }
    const mappedMealType = mealTypeMap[data.mealType] || "homemade"
    const effectiveImage = data.image || data.linkThumbnail || "/images/placeholder-food.jpg"
    const effectiveTitle = data.menuName?.trim() || data.place?.name || "맛있는 식사"

    // 1. 낙관적 업데이트 생성
    const optimisticMeal: SharedMeal = {
      id: mealUuid,
      userName: user.user_metadata?.full_name || user.email?.split("@")[0] || "나",
      userAvatar: user.user_metadata?.avatar_url || "/images/avatars/default.png",
      userRole: members.find(m => m.userId === user.id)?.role || "member",
      mealType: mappedMealType,
      menuName: effectiveTitle,
      rating: 0,
      tips: data.recipe?.split("\n").filter((t) => t.trim()) || [],
      placeName: data.place?.name || data.deliveryStoreName || "",
      placeAddress: data.place?.address || "",
      description: data.description || "",
      image: effectiveImage,
      date: data.date ? toDisplayDate(data.date) : toDisplayDate(toIsoDate(new Date())),
      comments: [],
      likes: 0,
      likedByMe: false,
      ratingsCount: 0,
      ratingsSum: 0,
      linkUrl: data.linkUrl || "",
      linkThumbnail: data.linkThumbnail || ""
    }

    // 로컬 상태 즉시 추가 (렉 없이 피드에 바로 렌더링!)
    setMeals(prev => [optimisticMeal, ...prev])

    // 모달 즉각 닫기
    setAddModalOpen(false)
    toast.success("식사 기록이 등록되었습니다! 🍽️")

    try {
      let finalImageUrl = effectiveImage

      if (data.image && data.image.startsWith("data:image")) {
        try {
          finalImageUrl = await uploadImageToStorage(data.image)
          setMeals(prev => prev.map(meal => meal.id === mealUuid ? { ...meal, image: finalImageUrl } : meal))
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr)
          finalImageUrl = data.linkThumbnail || "/images/placeholder-food.jpg"
          setMeals(prev => prev.map(meal => meal.id === mealUuid ? { ...meal, image: finalImageUrl } : meal))
        }
      }

      const metadata = {
        title: effectiveTitle,
        mealType: mappedMealType,
        rating: 0,
        tips: data.recipe?.split("\n").filter((t) => t.trim()) || [],
        placeName: data.place?.name || data.deliveryStoreName || "",
        placeAddress: data.place?.address || "",
        description: data.description || "",
        linkUrl: data.linkUrl || "",
        linkThumbnail: data.linkThumbnail || ""
      }

      await secureWrite({
        table: "meal_images",
        action: "insert",
        data: {
          id: mealUuid,
          meal_id: mealUuid,
          image_url: finalImageUrl,
          uploaded_by: user.id,
          explanation: JSON.stringify(metadata),
          source: source,
          status: status,
          title: effectiveTitle,
          rating: 0,
          meal_type: data.mealType,
          link_url: data.linkUrl || "",
          place_name: data.place?.name || data.deliveryStoreName || "",
          place_address: data.place?.address || "",
          description: data.description || ""
        }
      })

      if (data.description) {
        await secureWrite({
          table: "comments",
          action: "insert",
          data: {
            id: generateUUID(),
            meal_id: mealUuid,
            user_id: user.id,
            content: data.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false
          }
        })
      }

      // 최종 정합성을 위해 백그라운드 fetch 수행 (작성자 ID 본인 포함 보장)
      const familyUserIds = Array.from(new Set([user.id, ...members.map(m => m.userId).filter(Boolean) as string[]]))
      if (familyUserIds.length > 0) {
        await fetchFamilyData(familyUserIds)
      }
      
    } catch (err) {
      console.error("Failed to save meal shared to Supabase:", err)
      toast.error("백그라운드 식사 공유 저장에 실패했습니다.")
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
  const [reservationSubTab, setReservationSubTab] = useState<"wishlist" | "list">("wishlist")
  const [familyGroupId, setFamilyGroupId] = useState<string | null>(null)
  const [familyHostId, setFamilyHostId] = useState<string | null>(null)
  const [familyHostName, setFamilyHostName] = useState<string>("스타크")
  const [chefUserId, setChefUserId] = useState<string | null>(null)
  const [familyReservations, setFamilyReservations] = useState<any[]>(defaultFamilyReservations)
  const [wishlistItems, setWishlistItems] = useState<any[]>(defaultWishlistItems)
  const [isReservationsLoaded, setIsReservationsLoaded] = useState(false)
  const [isAddReservationOpen, setIsAddReservationOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any | null>(null)
  const [wishlistLikes, setWishlistLikes] = useState<Record<string | number, string[]>>({})
  const [reservationFilter, setReservationFilter] = useState<"전체" | "집밥" | "배달" | "외식">("전체")
  const familyPhotoInputRef = useRef<HTMLInputElement | null>(null)

  const [inviteLink, setInviteLink] = useState("")

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 초대 링크 = ref(초대하는 멤버의 허브 개인코드) + family(왓잇 방장 UUID) 두 코드 포함
    async function buildInviteLink() {
      const base = window.location.origin + '/';
      if (!isLoggedIn || !user?.id) {
        setInviteLink(base);
        return;
      }

      // 왓잇 가족방 코드: 방장의 user.id (UUID) - 방장이든 멤버든 속해있는 가족의 방장 ID 사용
      const hostIdToUse = familyHostId || user.id;
      const familyParam = `family=${hostIdToUse}`;

      // 허브 개인 추천 코드 (초대하는 내 코드 - 허브 보상 수령용)
      try {
        const info = await getMyReferralInfo();
        if (info?.code) {
          setInviteLink(`${base}?ref=${info.code}&${familyParam}`);
          return;
        }
      } catch (e) {}

      // 허브 코드 없으면 family 코드만
      setInviteLink(`${base}?${familyParam}`);
    }
    buildInviteLink();
  }, [isLoggedIn, user, familyHostId, getMyReferralInfo])

  const fetchFamilyData = async (familyUserIds: string[]) => {
    try {
      const supabase = createClient()
      
      // 1. Fetch shared meals (meal_images)
      const { data: imgData, error: imgError } = await supabase
        .from('meal_images')
        .select('*')
        .in('uploaded_by', familyUserIds)
        .eq('source', 'family-shared')
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
          rawExplanation: img.explanation || '',
          linkUrl: meta.linkUrl,
          linkThumbnail: meta.linkThumbnail,
          placeName: meta.placeName,
          placeAddress: meta.placeAddress || "",
          status: img.status
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
                  userId: r.user_id,
                  author: r.user_id === user?.id ? "나" : (ru?.nickname || "가족"),
                  content: r.content,
                  createdAt: new Date(r.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                  likes: 0,
                  isLiked: false
                }
              })

            return {
              id: c.id,
              userId: c.user_id,
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

  const fetchFamilyReservations = async (familyUserIds: string[]) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("meal_reservations")
        .select("*")
        .in("user_id", familyUserIds)
        .order("created_at", { ascending: false })

      if (error) throw error

      if (data) {
        const rawWishlist = data.filter(r => r.source === "family_wishlist" || !r.date).map(row => ({
          id: row.id,
          date: row.date || "",
          time: row.time || "",
          mealType: row.meal_type as "집밥" | "배달" | "외식",
          menu: row.menu,
          place: row.place || "",
          memo: row.memo || "",
          thumbnail: row.thumbnail || "",
          url: row.source_url || "",
          userId: row.user_id,
          createdAt: row.created_at
        }))

        const rawReservations = data.filter(r => r.source === "family" && r.date).map(row => ({
          id: row.id,
          date: row.date,
          time: row.time || "",
          mealType: row.meal_type as "집밥" | "배달" | "외식",
          menu: row.menu,
          place: row.place || "",
          memo: row.memo || "",
          thumbnail: row.thumbnail || "",
          url: row.source_url || "",
          userId: row.user_id,
          createdAt: row.created_at
        }))

        const wishlist = mergeWishlistWithSamples(rawWishlist)
        const reservations = mergeReservationsWithSamples(rawReservations)

        setWishlistItems(wishlist)
        setFamilyReservations(reservations)

        // Fetch comments and replies for wishlist and reservations
        const wishlistIds = wishlist.map(w => w.id)
        const reservationIds = reservations.map(r => r.id)
        const allResIds = [...wishlistIds, ...reservationIds]
        if (allResIds.length > 0) {
          const { data: commentsData } = await supabase
            .from("comments")
            .select("*")
            .in("meal_id", allResIds)
            .eq("is_deleted", false)
          
          const allComments = commentsData || []
          const commentIds = allComments.map(c => c.id)
          
          let allReplies: any[] = []
          if (commentIds.length > 0) {
            const { data: repliesData } = await supabase
              .from("comment_replies")
              .select("*")
              .in("comment_id", commentIds)
              .eq("is_deleted", false)
            allReplies = repliesData || []
          }

          const userIds = Array.from(new Set([
            ...allComments.map(c => c.user_id),
            ...allReplies.map(r => r.user_id)
          ]))
          
          let dbUsers: any[] = []
          if (userIds.length > 0) {
            const { data: usersData } = await supabase
              .from("users")
              .select("id, nickname, profile_image")
              .in("id", userIds)
            dbUsers = usersData || []
          }
          const userMap = new Map(dbUsers.map(u => [u.id, u]))

          const commentsMap: Record<string | number, MealComment[]> = {}
          allResIds.forEach(resId => {
            commentsMap[resId] = allComments
              .filter(c => c.meal_id === resId)
              .map(c => {
                const u = userMap.get(c.user_id)
                const cAuthor = c.user_id === user?.id ? "나" : (u?.nickname || "가족")
                const cReplies = allReplies
                  .filter(r => r.comment_id === c.id)
                  .map(r => {
                    const ru = userMap.get(r.user_id)
                    return {
                      id: r.id,
                      userId: r.user_id,
                      author: r.user_id === user?.id ? "나" : (ru?.nickname || "가족"),
                      content: r.content,
                      createdAt: new Date(r.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                      likes: 0,
                      isLiked: false
                    }
                  })
                
                return {
                  id: c.id,
                  userId: c.user_id,
                  author: cAuthor,
                  content: c.content,
                  createdAt: new Date(c.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                  likes: 0,
                  isLiked: false,
                  replies: cReplies
                }
              })
          })
          setMealComments(prev => ({ ...prev, ...commentsMap }))
        }

        // Fetch likes for wishlist items
        if (wishlistIds.length > 0) {
          const { data: likesData } = await supabase
            .from("meal_likes")
            .select("meal_id, user_id")
            .in("meal_id", wishlistIds)
          
          if (likesData) {
            const likesMap: Record<string | number, string[]> = {}
            wishlistIds.forEach(wid => {
              likesMap[wid] = likesData.filter(l => l.meal_id === wid).map(l => l.user_id)
            })
            setWishlistLikes(likesMap)
          }
        }
      } else {
        setWishlistItems(defaultWishlistItems)
        setFamilyReservations(defaultFamilyReservations)
      }
    } catch (err) {
      console.error("Failed to fetch family reservations:", err)
      setWishlistItems(defaultWishlistItems)
      setFamilyReservations(defaultFamilyReservations)
    } finally {
      setIsReservationsLoaded(true)
    }
  }

  const handleSaveWishlistItem = async (data: any) => {
    if (!isLoggedIn || !user) return
    const uploadToast = toast.loading("위시리스트를 저장하고 있습니다...")
    try {
      await secureWrite({
        table: "meal_reservations",
        action: "upsert",
        data: {
          id: data.id && !String(data.id).startsWith("sample-") ? data.id : undefined,
          user_id: user.id,
          date: null,
          time: data.time || "",
          meal_type: data.mealType,
          menu: data.menu,
          place: data.place || null,
          memo: data.memo || "",
          thumbnail: data.thumbnail || null,
          source_url: data.url || null,
          source: "family_wishlist"
        }
      })
      toast.success("위시리스트에 추가되었습니다! 📋", { id: uploadToast })
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      fetchFamilyReservations(familyUserIds)
    } catch (err) {
      console.error("Failed to save wishlist item:", err)
      toast.error("위시리스트 저장에 실패했습니다.", { id: uploadToast })
    }
  }

  const handleDeleteWishlistItem = async (id: string | number) => {
    if (String(id).startsWith("sample-")) {
      toast("실제 식사를 등록하면 샘플은 자동으로 사라집니다! 💡")
      setWishlistItems(prev => prev.filter(item => item.id !== id))
      return
    }
    const deleteToast = toast.loading("위시리스트를 삭제하고 있습니다...")
    try {
      await secureWrite({
        table: "meal_reservations",
        action: "delete",
        filters: { id }
      })
      toast.success("삭제되었습니다.", { id: deleteToast })
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      fetchFamilyReservations(familyUserIds)
    } catch (err) {
      console.error("Failed to delete wishlist item:", err)
      toast.error("삭제에 실패했습니다.", { id: deleteToast })
    }
  }

  const handleSaveFamilyReservation = async (data: any) => {
    if (!isLoggedIn || !user) return
    const uploadToast = toast.loading("가족 예약을 저장하고 있습니다...")
    try {
      await secureWrite({
        table: "meal_reservations",
        action: "upsert",
        data: {
          id: data.id && !String(data.id).startsWith("sample-") ? data.id : undefined,
          user_id: user.id,
          date: data.date,
          time: data.time || "",
          meal_type: data.mealType,
          menu: data.menu,
          place: data.place || null,
          memo: data.memo || "",
          thumbnail: data.thumbnail || null,
          source_url: data.url || null,
          source: "family"
        }
      })
      toast.success("가족 먹예약이 저장되었습니다! 📅", { id: uploadToast })
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      fetchFamilyReservations(familyUserIds)
    } catch (err) {
      console.error("Failed to save family reservation:", err)
      toast.error("예약 저장에 실패했습니다.", { id: uploadToast })
    }
  }

  const handleDeleteFamilyReservation = async (id: string | number) => {
    if (String(id).startsWith("sample-")) {
      toast("실제 식사 예약을 등록하면 샘플은 자동으로 사라집니다! 💡")
      setFamilyReservations(prev => prev.filter(item => item.id !== id))
      return
    }
    const deleteToast = toast.loading("예약을 삭제하고 있습니다...")
    try {
      await secureWrite({
        table: "meal_reservations",
        action: "delete",
        filters: { id }
      })
      toast.success("삭제되었습니다.", { id: deleteToast })
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      fetchFamilyReservations(familyUserIds)
    } catch (err) {
      console.error("Failed to delete reservation:", err)
      toast.error("삭제에 실패했습니다.", { id: deleteToast })
    }
  }

  const handleToggleWishlistLike = async (itemId: string | number) => {
    if (!isLoggedIn || !user) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }
    
    const likedUsers = wishlistLikes[itemId] || []
    const hasLiked = likedUsers.includes(user.id)
    
    try {
      if (hasLiked) {
        await secureWrite({
          table: "meal_likes",
          action: "delete",
          filters: { meal_id: itemId }
        })
        setWishlistLikes(prev => ({
          ...prev,
          [itemId]: likedUsers.filter(uid => uid !== user.id)
        }))
      } else {
        await secureWrite({
          table: "meal_likes",
          action: "insert",
          data: {
            meal_id: itemId,
            user_id: user.id
          }
        })
        setWishlistLikes(prev => ({
          ...prev,
          [itemId]: [...likedUsers, user.id]
        }))
      }
    } catch (err) {
      console.error("Failed to toggle wishlist like:", err)
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
        fetchFamilyReservations(familyUserIds)
      }
      fetchDecidedMenus()
    }
  }, [members, isLoggedIn, user])

  const currentFamilyMember = members.find((member) => member.name === "나") ?? members[0]
  const currentFamilyMemberId = currentFamilyMember.id
  const currentFamilyMemberName = currentFamilyMember.name

  const handleFamilyPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isFamilyOwner) {
      toast.error("가족 대표 사진은 방장만 변경할 수 있습니다.")
      return
    }
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64Image = e.target?.result as string
      if (!base64Image) return

      const uploadToast = toast.loading("가족 사진을 업로드하고 있습니다...")
      try {
        const publicUrl = await uploadImageToStorage(base64Image)

        const payload: any = {
          owner_id: user?.id,
          name: `${user?.nickname && user.nickname !== '회원' ? user.nickname : '스타크'} 가족`,
          family_photo: publicUrl
        }
        if (familyGroupId) {
          payload.id = familyGroupId
        }

        const res = await secureWrite({
          table: "whateat_family_groups",
          action: "upsert",
          data: payload
        })

        if (res?.data?.[0]?.id) {
          setFamilyGroupId(res.data[0].id)
        }

        setFamilyPhoto(publicUrl)
        toast.success("가족 사진이 업로드되었습니다! 🎉", { id: uploadToast })
      } catch (err) {
        console.error("Failed to upload family photo:", err)
        toast.error("가족 사진 업로드에 실패했습니다.", { id: uploadToast })
      }
    }
    reader.readAsDataURL(file)
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

  const hasHomemade = meals.some(m => m.mealType === "homemade")
  const hasDelivery = meals.some(m => m.mealType === "delivery")
  const hasDining = meals.some(m => m.mealType === "dining")
  
  const activeDefaultMeals = defaultSharedMeals.filter(m => {
    if (m.mealType === "homemade" && hasHomemade) return false
    if (m.mealType === "delivery" && hasDelivery) return false
    if (m.mealType === "dining" && hasDining) return false
    return true
  })
  
  const baseMeals = [...activeDefaultMeals, ...meals]
  
  const filteredMeals = baseMeals.filter((meal) => {
    if (sharedMealFilter !== "all" && getSharedMealCategory(meal) !== sharedMealFilter) {
      return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesSearch = 
        meal.title.toLowerCase().includes(q) ||
        meal.placeName?.toLowerCase().includes(q) ||
        meal.placeAddress?.toLowerCase().includes(q) ||
        meal.sharedBy.toLowerCase().includes(q) ||
        meal.rawExplanation?.toLowerCase().includes(q)
      
      if (!matchesSearch) return false
    }
    return true
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
    if (!targetMeal || targetMeal.doNotPromote || targetMeal.status === 'approved') {
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

      // 패밀리 공유 식사인 경우 가족 이름 연동 처리
      if (!meta.familyName) {
        const { data: imgData } = await supabase
          .from("meal_images")
          .select("uploaded_by")
          .eq("id", targetMeal.id)
          .single()
        
        if (imgData?.uploaded_by) {
          meta.familyName = await getFamilyName(supabase, imgData.uploaded_by)
        }
      }

      await secureWrite({
        table: 'meal_images',
        action: 'update',
        data: {
          status: 'approved',
          explanation: JSON.stringify(meta)
        },
        filters: { id: targetMeal.id }
      })

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
      
      await secureWrite({
        table: 'meal_images',
        action: 'update',
        data: { explanation: JSON.stringify(meta) },
        filters: { id: mealId }
      })
    } catch (err) {
      console.error("Failed to update doNotPromote flag", err)
    }
  }

  const checkFamilyConsentAndRate = async (mealId: string | number, memberId: number, score: number) => {
    if (typeof mealId === "string" && mealId.startsWith("sample-")) {
      toast("샘플이라 별점 수정 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }

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
        await secureWrite({
          table: 'meal_ratings',
          action: 'update',
          data: { rating: score },
          filters: { id: existing[0].id }
        })
      } else {
        await secureWrite({
          table: 'meal_ratings',
          action: 'insert',
          data: {
            id: generateUUID(),
            user_id: user.id,
            meal_id: mealMenuId,
            rating: score
          }
        })
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
      toast("샘플이라 메모 작성 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }

    const targetMeal = baseMeals.find(m => m.id === mealId)
    if (!targetMeal || !targetMeal.mealMenuId) return

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const commentUuid = generateUUID()
      await secureWrite({
        table: 'comments',
        action: 'insert',
        data: {
          id: commentUuid,
          meal_id: targetMeal.mealMenuId,
          user_id: user.id,
          content: content,
          is_deleted: false
        }
      })

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

    if (typeof mealId === "string" && mealId.startsWith("sample-")) {
      toast("샘플이라 메모 작성 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const replyUuid = generateUUID()
      await secureWrite({
        table: 'comment_replies',
        action: 'insert',
        data: {
          id: replyUuid,
          comment_id: commentId,
          user_id: user.id,
          content: content,
          is_deleted: false
        }
      })

      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
      setMealReplyInput("")
      setActiveReplyTarget(null)
    } catch (err) {
      console.error("Failed to add reply to Supabase", err)
    }
  }

  const handleEditMealComment = (commentId: string | number, currentContent: string) => {
    setEditingCommentId(commentId)
    setEditCommentText(currentContent)
  }

  const handleUpdateMealComment = async (commentId: string | number) => {
    const trimmed = editCommentText.trim()
    if (!trimmed) return

    try {
      if (typeof commentId !== "number" && !String(commentId).startsWith("comment-")) {
        await secureWrite({
          table: "comments",
          action: "update",
          data: {
            content: trimmed,
            updated_at: new Date().toISOString()
          },
          filters: { id: commentId }
        })
      }

      setEditingCommentId(null)
      setEditCommentText("")
      
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
    } catch (err) {
      console.error("Failed to update comment:", err)
      toast.error("댓글 수정에 실패했습니다.")
    }
  }

  const handleDeleteMealComment = async (commentId: string | number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return

    try {
      if (typeof commentId !== "number" && !String(commentId).startsWith("comment-")) {
        await secureWrite({
          table: "comments",
          action: "update",
          data: {
            is_deleted: true,
            updated_at: new Date().toISOString()
          },
          filters: { id: commentId }
        })
      }

      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
      toast.success("댓글이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete comment:", err)
      toast.error("댓글 삭제에 실패했습니다.")
    }
  }

  const handleEditMealReply = (replyId: string | number, currentContent: string) => {
    setEditingReplyId(replyId)
    setEditReplyText(currentContent)
  }

  const handleUpdateMealReply = async (replyId: string | number) => {
    const trimmed = editReplyText.trim()
    if (!trimmed) return

    try {
      if (typeof replyId !== "number") {
        await secureWrite({
          table: "comment_replies",
          action: "update",
          data: {
            content: trimmed,
            updated_at: new Date().toISOString()
          },
          filters: { id: replyId }
        })
      }

      setEditingReplyId(null)
      setEditReplyText("")

      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
    } catch (err) {
      console.error("Failed to update reply:", err)
      toast.error("답글 수정에 실패했습니다.")
    }
  }

  const handleDeleteMealReply = async (replyId: string | number) => {
    if (!confirm("답글을 삭제하시겠습니까?")) return

    try {
      if (typeof replyId !== "number") {
        await secureWrite({
          table: "comment_replies",
          action: "update",
          data: {
            is_deleted: true,
            updated_at: new Date().toISOString()
          },
          filters: { id: replyId }
        })
      }

      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      await fetchFamilyData(familyUserIds)
      toast.success("답글이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete reply:", err)
      toast.error("답글 삭제에 실패했습니다.")
    }
  }

  const handleDecideMenu = async () => {
    if (!decidedMenuName.trim()) return

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0]
      await secureWrite({
        table: 'meal_menus',
        action: 'insert',
        data: {
          id: generateUUID(),
          school_code: 'family',
          meal_date: todayStr,
          meal_type: decidedMealTime === "breakfast" ? "아침" : decidedMealTime === "lunch" ? "점심" : "저녁",
          menu_items: [decidedMenuName.trim()],
          kcal: currentFamilyMemberName, // storing decidedBy in kcal
          is_temporary: false,
          is_empty_result: false,
          office_code: 'E10'
        }
      })

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

  const renderMealCommentsSection = (mealId: string | number, variant: "modal" | "card" = "modal") => {
    const commentsList = displayComments[mealId] ?? []
    const totalCommentsCount = commentsList.reduce((acc, c) => acc + 1 + (c.replies ?? []).length, 0)

    return (
      <>
        <div className={cn("flex items-center gap-2 mb-3", variant === "card" && "mb-2")}>
          <MessageCircle className="size-4 text-orange-500" />
          <h4 className="font-bold text-sm text-foreground">댓글</h4>
          <span className="text-xs text-muted-foreground">{totalCommentsCount}개</span>
        </div>

        <div className={cn("space-y-2 pr-1", variant === "modal" ? "max-h-64 overflow-y-auto" : "max-h-48 overflow-y-auto")}>
          {commentsList.length === 0 ? (
            <p className="text-xs text-muted-foreground">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
          ) : (
            commentsList.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-orange-50/50 border border-orange-100 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground">{comment.author}</span>
                    <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
                  </div>
                  {comment.userId === user?.id && (
                    <div className="flex items-center gap-1.5">
                      {editingCommentId === comment.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateMealComment(comment.id)}
                            className="text-[9px] font-bold text-orange-600 hover:underline"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingCommentId(null)}
                            className="text-[9px] font-bold text-muted-foreground hover:underline"
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditMealComment(comment.id, comment.content)}
                            className="text-muted-foreground hover:text-orange-500 transition-colors"
                            title="수정"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteMealComment(comment.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {editingCommentId === comment.id ? (
                  <div className="mt-2 flex gap-1.5">
                    <input
                      type="text"
                      value={editCommentText}
                      onChange={(e) => setEditCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          handleUpdateMealComment(comment.id)
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-foreground mt-1 leading-relaxed">{comment.content}</p>
                )}

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
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    답글
                  </button>
                </div>

                {(comment.replies ?? []).length > 0 && (
                  <div className="mt-2.5 pl-2 border-l border-orange-200 space-y-1.5">
                    {(comment.replies ?? []).map((reply) => (
                      <div key={reply.id} className="bg-white/70 rounded-lg px-2 py-1.5 border border-orange-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-foreground">{reply.author}</span>
                            <span className="text-[10px] text-muted-foreground">{reply.createdAt}</span>
                          </div>
                          {reply.userId === user?.id && (
                            <div className="flex items-center gap-1.5">
                              {editingReplyId === reply.id ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateMealReply(reply.id)}
                                    className="text-[9px] font-bold text-orange-600 hover:underline"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={() => setEditingReplyId(null)}
                                    className="text-[9px] font-bold text-muted-foreground hover:underline"
                                  >
                                    취소
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditMealReply(reply.id, reply.content)}
                                    className="text-muted-foreground hover:text-orange-500 transition-colors"
                                    title="수정"
                                  >
                                    <Pencil className="size-2.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMealReply(reply.id)}
                                    className="text-muted-foreground hover:text-red-500 transition-colors"
                                    title="삭제"
                                  >
                                    <Trash2 className="size-2.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {editingReplyId === reply.id ? (
                          <div className="mt-1 flex gap-1.5">
                            <input
                              type="text"
                              value={editReplyText}
                              onChange={(e) => setEditReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                  e.preventDefault()
                                  handleUpdateMealReply(reply.id)
                                }
                              }}
                              className="flex-1 px-2 py-1 rounded bg-white border border-gray-200 text-[10px] outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                            />
                          </div>
                        ) : (
                          <p className="text-[11px] text-foreground mt-0.5 leading-relaxed">{reply.content}</p>
                        )}
                        <button
                          onClick={() => toggleMealReplyLike(mealId, comment.id, reply.id)}
                          className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1 hover:text-orange-500"
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
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault()
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
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault()
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
  }



  const handleInteraction = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('openLoginModal'))
    }
  }

  return (
    <div className="flex flex-col pb-4">
      {/* Sticky Header Container */}
      <div className="sticky top-[52px] sm:top-[62px] z-30 bg-[#fffaf5] -mx-5 px-5 pt-3 pb-1 flex flex-col gap-2 border-b border-muted/10">
        {/* Family Header */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl pt-2 pb-1.5 px-4 border border-white shadow-sm">
          <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar">
            <>
              {isFamilyOwner ? (
                <button
                  onClick={() => {
                    if (!isLoggedIn) {
                      window.dispatchEvent(new CustomEvent('openLoginModal'))
                    } else {
                      familyPhotoInputRef.current?.click()
                    }
                  }}
                  className="size-11 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 hover:bg-orange-100 transition-colors overflow-hidden shrink-0"
                >
                  {familyPhoto ? (
                    <img src={familyPhoto} alt="가족 사진" className="w-full h-full object-cover" />
                  ) : (
                    <Pencil className="size-4" />
                  )}
                </button>
              ) : (
                <div className="size-11 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 overflow-hidden shrink-0">
                  {familyPhoto ? (
                    <img src={familyPhoto} alt="가족 사진" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">🏡</span>
                  )}
                </div>
              )}
              <input
                ref={familyPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleFamilyPhotoChange}
                className="hidden"
              />
            </>

            <div className="shrink-0 min-w-fit pr-1">
              <h2 className="font-bold text-foreground text-base leading-tight">
                {!isLoggedIn || !user
                  ? "게스트 가족"
                  : isFamilyOwner
                    ? `${user?.nickname && user.nickname !== '회원' ? user.nickname : '우리'} 가족`
                    : `${familyHostName || '가족'} 가족`}
              </h2>
              <div className="flex flex-col gap-1 mt-0.5">
                <p className="text-[9px] text-muted-foreground font-semibold">
                  {members.length}명의 구성원
                </p>
                {isLoggedIn && isFamilyOwner && (
                  <button
                    onClick={() => {
                      setShowChefModal(true)
                    }}
                    className="text-[8px] bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 px-2 py-0.5 rounded-full font-black transition-all flex items-center gap-0.5 cursor-pointer mt-0.5"
                  >
                    <Settings className="size-2" />
                    셰프 / 가족 관리
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex items-center justify-start gap-2.5 overflow-x-auto hide-scrollbar">
              {members.map((member) => (
                <div key={member.id} className="flex flex-col items-center gap-1 shrink-0 pt-1">
                  <div className="relative">
                    <HubAvatar
                      isLoggedIn={isLoggedIn}
                      avatarUrl={member.name === "나" ? user?.avatar_url : member.avatar}
                      nickname={member.name === "나" ? ((user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '나')) : member.name}
                      size="sm"
                      className="!w-11 !h-11 rounded-xl border-2 border-white shadow-sm"
                    />
                    {member.role === "chef" && (
                      <div className="absolute -top-1 -right-1 size-4.5 rounded-full bg-orange-500 text-white font-extrabold text-[10px] leading-none flex items-center justify-center border-1.5 border-white shadow-xs z-10 select-none" title="가족 셰프 👨‍🍳">
                        셰
                      </div>
                    )}
                    {member.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-green-400 border-2 border-white" />
                    )}
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                    {member.name}
                  </span>
                </div>
              ))}
              <button 
                onClick={() => {
                  setShowInviteModal(true)
                }}
                className="flex flex-col items-center gap-1 shrink-0 ml-1 cursor-pointer"
              >
                <div className="size-11 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <Plus className="size-4 text-muted-foreground/50" />
                </div>
                <span className="text-[9px] font-medium text-muted-foreground">초대</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          <TabNavigation
            activeTab={activeMainTab as "log" | "reservation" | "calendar"}
            onTabChange={onTabChange || (() => {})}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-3 flex flex-col gap-3">
      {activeMainTab === "log" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="식당, 메뉴, 장소 검색"
                className="w-full pl-9 pr-4 h-[38px] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm placeholder:text-muted-foreground/50"
              />
            </div>
            
            <div className="relative shrink-0" ref={sortRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-1.5 px-3.5 bg-white/60 text-muted-foreground border border-white/80 hover:border-primary/30 rounded-xl text-sm font-medium transition-all h-[38px]"
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
                  }}
                  className="inline-flex cursor-pointer"
                >
                  <ArrowUpDown className="size-3" />
                </span>
                <span>{sortOption}</span>
                <span className="text-[10px] font-bold">{sortDirection === "desc" ? "↓" : "↑"}</span>
                <ChevronDown className="size-2.5" />
              </button>

              {showSortDropdown && (
                <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-xl border border-muted/20 py-2 z-50">
                  {(["날짜순", "별점순", "기간"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortOption(option)
                        setShowSortDropdown(false)
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-sm transition-all",
                        sortOption === option
                          ? "bg-orange-50 text-primary font-bold"
                          : "text-foreground hover:bg-muted/50"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-end gap-2 overflow-x-auto hide-scrollbar pb-1">
              {sharedFilterTabs.map((filterTab) => {
                const Icon = filterTab.icon
                const displayMeals = [...activeDefaultMeals, ...meals]
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
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  window.dispatchEvent(new CustomEvent('openLoginModal'))
                } else {
                  setAddModalOpen(true)
                }
              }}
              className="size-11 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 transition-all hover:scale-105 active:scale-95 z-20 shrink-0"
            >
              <Plus className="size-5" />
            </button>
          </div>


          
          {filteredMeals.length === 0 ? (
            <div className="bg-white/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <Share2 className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">아직 공유된 식사가 없어요</p>
              <p className="text-xs text-muted-foreground/70 mt-1">먹로그에서 가족에게 공유해보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMeals.map((meal) => {
                const isOpen = isMealRatingOpen(meal)
                const isExpanded = expandedMealCommentsId === meal.id
                const averageRating = getMealAverageRating(meal.id)
                const shouldHighlight = isOpen && !dismissedMealHighlightIds.includes(meal.id)

                return (
                  <div
                    key={meal.id}
                    className={cn(
                      "relative bg-white/80 rounded-[2rem] overflow-hidden border border-white shadow-md",
                      shouldHighlight && "ring-2 ring-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.18),0_0_22px_rgba(34,211,238,0.38)]",
                    )}
                  >
                    {/* 샘플 리본 - 솔로 스타일과 동일 */}
                    {meals.length === 0 && (
                      <div className="absolute top-4 -right-10 w-52 bg-yellow-400 text-yellow-900 text-[10px] font-black py-1 text-center rotate-45 shadow-md z-10 pointer-events-none">
                        💡 SAMPLE
                      </div>
                    )}

                    {/* 좌우 분할 카드 - 솔로 스타일 동일 적용 */}
                    <button
                      onClick={() => isOpen && handleOpenMealCardDetail(meal.id)}
                      className={cn(
                        "w-full text-left block",
                        isOpen ? "hover:opacity-95 transition-opacity cursor-pointer" : "cursor-default",
                      )}
                    >
                      <div className="flex h-[190px]">
                        {/* 왼쪽: 이미지 */}
                        <div className="w-1/2 relative overflow-hidden">
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-300 hover:scale-105"
                            style={{ backgroundImage: `url("${meal.image || '/placeholder.svg'}")` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          <div className="absolute top-3 left-3">
                            <span className="w-fit px-2 py-0.5 bg-white/20 backdrop-blur-md text-white text-[8px] font-bold rounded-md border border-white/30">
                              {meal.mealType === "homemade" ? "집밥" : meal.mealType === "delivery" ? "배달" : meal.mealType === "dining" ? "외식" : "기타"}
                            </span>
                          </div>
                        </div>

                        {/* 오른쪽: 식사 정보 또는 식당 링크 */}
                        <div className="w-1/2 bg-gray-50/80 border-l border-muted flex flex-col overflow-hidden relative">
                          {meal.linkUrl ? (
                            (() => {
                              const isKakao = meal.linkUrl.includes("kko.to") || meal.linkUrl.includes("kakao.com")
                              const isGoogle = meal.linkUrl.includes("google.com") || meal.linkUrl.includes("google.co.kr") || meal.linkUrl.includes("goo.gl")
                              const isYoutube = meal.linkUrl.includes("youtube.com") || meal.linkUrl.includes("youtu.be")
                              const isInstagram = meal.linkUrl.includes("instagram.com")
                              const isTiktok = meal.linkUrl.includes("tiktok.com")
                              const isNaver = meal.linkUrl.includes("naver.me") || meal.linkUrl.includes("naver.com") || meal.linkUrl.includes("naver.co.kr")
                              const isGeneric = !isKakao && !isGoogle && !isYoutube && !isInstagram && !isTiktok && !isNaver
                              
                              const isRecipe = isGeneric && (meal.mealType === "homemade" || meal.mealType === "집밥")
                              const isStoreLink = isGeneric && !isRecipe

                              return (
                                <a
                                  href={meal.linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full h-full relative group overflow-hidden block cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {meal.linkThumbnail ? (
                                    <div
                                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                                      style={{ backgroundImage: `url("${meal.linkThumbnail.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(meal.linkThumbnail)}` : meal.linkThumbnail}")` }}
                                    />
                                  ) : (
                                    <div className={cn(
                                      "absolute inset-0 flex flex-col items-center justify-center p-3 text-center",
                                      isKakao && "bg-gradient-to-br from-amber-50 to-amber-100/70",
                                      isGoogle && "bg-gradient-to-br from-blue-50 to-indigo-50/80",
                                      isYoutube && "bg-gradient-to-br from-red-50 to-red-100/70",
                                      isInstagram && "bg-gradient-to-br from-pink-50 to-purple-50",
                                      isTiktok && "bg-gradient-to-br from-slate-50 to-slate-100",
                                      isNaver && "bg-gradient-to-br from-green-50 to-emerald-100",
                                      isRecipe && "bg-gradient-to-br from-orange-50 to-orange-100/60",
                                      isStoreLink && "bg-gradient-to-br from-slate-50 to-slate-100"
                                    )}>
                                      <div className={cn(
                                        "size-8 rounded-full flex items-center justify-center mb-1.5 shadow-sm text-sm font-black",
                                        isKakao && "bg-[#FEE500] border border-amber-200 text-[#3C1E1E]",
                                        isGoogle && "bg-[#4285F4] text-white",
                                        isYoutube && "bg-[#FF0000] text-white",
                                        isInstagram && "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white",
                                        isTiktok && "bg-[#010101] text-white border border-slate-700",
                                        isNaver && "bg-[#03C75A] text-white",
                                        isRecipe && "bg-orange-500 text-white",
                                        isStoreLink && "bg-slate-600 text-white"
                                      )}>
                                        <span className="text-sm font-black">
                                          {isKakao ? "K" : isGoogle ? "G" : isYoutube ? "Y" : isInstagram ? "I" : isTiktok ? "T" : isNaver ? "N" : isRecipe ? "R" : "P"}
                                        </span>
                                      </div>
                                      <span className={cn(
                                        "text-[10px] font-bold",
                                        isKakao && "text-amber-800",
                                        isGoogle && "text-blue-800",
                                        isYoutube && "text-red-800",
                                        isInstagram && "text-pink-800",
                                        isTiktok && "text-slate-800",
                                        isNaver && "text-emerald-800",
                                        isRecipe && "text-orange-800",
                                        isStoreLink && "text-slate-800"
                                      )}>
                                        {isKakao ? "카카오맵" : isGoogle ? "구글 지도" : isYoutube ? "유튜브" : isInstagram ? "인스타그램" : isTiktok ? "틱톡" : isNaver ? "네이버 플레이스" : isRecipe ? "레시피" : "식당 링크"}
                                      </span>
                                      <span className={cn(
                                        "text-[9px] truncate max-w-full px-2 mt-0.5",
                                        isKakao && "text-amber-700/80",
                                        isGoogle && "text-blue-700/80",
                                        isYoutube && "text-red-700/80",
                                        isInstagram && "text-pink-700/80",
                                        isTiktok && "text-slate-700/80",
                                        isNaver && "text-emerald-700/80",
                                        isRecipe && "text-orange-700/80",
                                        isStoreLink && "text-slate-700/80"
                                      )}>{meal.placeName || "상세 보기"}</span>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                                    {(meal.mealType === "dining" || meal.mealType === "delivery") ? (
                                      <>
                                        <div className={cn(
                                          "size-4 rounded-full flex items-center justify-center",
                                          isKakao && "bg-[#FEE500] text-[#3C1E1E]",
                                          isGoogle && "bg-[#4285F4] text-white",
                                          !isKakao && !isGoogle && "bg-[#03C75A] text-white"
                                        )}>
                                          <span className="text-[7px] font-black">
                                            {isKakao ? "K" : isGoogle ? "G" : "N"}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-foreground">
                                          {isKakao ? "Map" : isGoogle ? "Map" : "Place"}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <div className={cn(
                                          "size-4 rounded-full flex items-center justify-center text-[7px] font-black shadow-sm",
                                          isYoutube && "bg-[#FF0000] text-white",
                                          isInstagram && "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white",
                                          isTiktok && "bg-[#010101] text-white",
                                          !isYoutube && !isInstagram && !isTiktok && "bg-orange-500 text-white"
                                        )}>
                                          <span>
                                            {isYoutube ? "Y" : isInstagram ? "I" : isTiktok ? "T" : "R"}
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-foreground">
                                          {isYoutube ? "YouTube" : isInstagram ? "Reels" : isTiktok ? "TikTok" : "Recipe"}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </a>
                              )
                            })()
                          ) : (meal.mealType === "dining" || meal.mealType === "delivery") && meal.linkUrl && meal.placeName ? (
                            <a
                              href={meal.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-full flex flex-col items-center justify-center bg-[#F9F9F9] hover:bg-gray-100 transition-colors p-3 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="size-10 rounded-full bg-[#03C75A]/10 flex items-center justify-center mb-2">
                                <MapPin className="size-5 text-[#03C75A]" />
                              </div>
                              <span className="text-[11px] font-bold text-foreground text-center line-clamp-2 leading-tight">
                                {meal.placeName}
                              </span>
                            </a>
                          ) : (meal.mealType === "dining" || meal.mealType === "delivery") ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F9F9F9] p-3 text-center">
                              <div className="size-10 rounded-full bg-orange-100 flex items-center justify-center mb-2 text-orange-400">
                                <ExternalLink className="size-5" />
                              </div>
                              <span className="text-[11px] font-bold text-muted-foreground/70 leading-tight">
                                등록된 식당/배달 정보가<br/>없습니다.
                              </span>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F9F9F9] p-3 text-center">
                              <div className="size-10 rounded-full bg-orange-100 flex items-center justify-center mb-2 text-orange-400">
                                <BookOpen className="size-5" />
                              </div>
                              <span className="text-[11px] font-bold text-muted-foreground/70 leading-tight">
                                등록된 레시피/조리 팁이<br/>없습니다.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Title, Date, Average Rating */}
                      <div className="px-5 pt-4 pb-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase flex items-center gap-1.5">
                            {meal.sharedAt}
                            {meal.mealType === "homemade" && (
                              <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[8px] font-bold">홈쉐퍼</span>
                            )}
                          </p>
                          <div className="flex items-center gap-0.5 text-orange-500">
                            <Star className="size-4 fill-orange-400 text-orange-400" />
                            <span className="text-xs font-bold ml-0.5">
                              {isOpen ? "평가중" : `${averageRating.toFixed(1)} (${Object.keys(mealRatings[meal.id] || {}).length}명)`}
                            </span>
                          </div>
                        </div>
                        <h3 className="font-bold text-foreground text-[16px] leading-snug mb-1 truncate">{meal.title}</h3>
                        <p className="text-[10px] text-muted-foreground/80 mb-2">by {meal.sharedBy}</p>
                      </div>
                    </button>

                    <div className="px-4 pb-3 pt-2">
                      <button
                        onClick={() => {
                          setExpandedMealCommentsId(isExpanded ? null : meal.id)
                          if (isExpanded) {
                            setActiveReplyTarget(null)
                            setMealReplyInput("")
                          }
                        }}
                        className="w-full rounded-lg bg-orange-50 border border-orange-100 px-2.5 py-2 text-[11px] font-bold text-orange-600 flex items-center justify-center gap-1 hover:bg-orange-100/70 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="size-3.5" />
                        댓글 {(displayComments[meal.id] ?? []).length}개
                      </button>

                      {isExpanded && (
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

      {activeMainTab === "reservation" && (() => {
        const isChef = chefUserId ? user?.id === chefUserId : isFamilyOwner
        const chef = members.find(m => m.userId === chefUserId) ?? members.find(m => m.role === "chef")

        const filteredWishlist = wishlistItems.filter(item => {
          if (reservationFilter === "전체") return true
          return item.mealType === reservationFilter
        })

        const filteredReservations = familyReservations.filter(item => {
          if (reservationFilter === "전체") return true
          return item.mealType === reservationFilter
        })

        const renderCard = (item: any, isWishlistCard: boolean) => {
          const likedUsers = wishlistLikes[item.id] || []
          const hasLiked = user?.id ? likedUsers.includes(user.id) : false
          const commentList = mealComments[item.id] || []
          const mealTypeColor: Record<string, string> = {
            "집밥": "bg-green-100 text-green-700",
            "배달": "bg-blue-100 text-blue-700",
            "외식": "bg-orange-100 text-orange-700",
          }
          const isSampleItem = item.isSample || String(item.id).startsWith("sample-")

          // 작성자 메타데이터 (헤더 노출)
          const cardUser = members.find(m => m.userId === item.userId)
          const avatarUrl = item.userId === user?.id ? user?.avatar_url : cardUser?.avatar
          const nickname = item.userId === user?.id
            ? ((user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '나'))
            : (cardUser?.name || "가족")
          const formattedTime = item.createdAt ? formatTimeAgo(item.createdAt) : "방금 전"

          return (
            <div 
              key={item.id} 
              className={cn(
                "bg-white rounded-3xl border border-white shadow-md overflow-hidden relative transition-all hover:shadow-lg",
                isSampleItem && "opacity-90"
              )}
            >
              {/* 샘플 리본 */}
              {isSampleItem && (
                <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 z-10 pointer-events-none">
                  <div className="absolute top-3 -right-6 w-24 bg-yellow-400 text-yellow-900 text-[8px] font-black py-0.5 text-center rotate-45 shadow-sm">
                    💡 SAMPLE
                  </div>
                </div>
              )}

              {/* 1. 상단 프로필 헤더 (누가 올렸는지 + 언제 올렸는지) */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2.5">
                  <HubAvatar
                    isLoggedIn={isLoggedIn}
                    avatarUrl={avatarUrl}
                    nickname={nickname}
                    size="sm"
                    className="!w-9 !h-9 rounded-full border border-white shadow-sm shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">{nickname}</span>
                    <span className="text-[10px] text-muted-foreground">{formattedTime}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold", mealTypeColor[item.mealType] ?? "bg-muted text-muted-foreground")}>
                    {item.mealType}
                  </span>
                  {/* 수정 버튼 (수정 모달에서 수정 및 삭제 가능) */}
                  {(item.userId === user?.id || isChef) && (
                    <button
                      onClick={() => {
                        setEditingPlan({ ...item, isWishlist: isWishlistCard })
                        setIsAddReservationOpen(true)
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
                      title="수정/삭제"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. 카드 본문 - 공간 최적화 2열 구조 (좌: 메뉴명/위시날짜/메모, 우: url 썸네일 사진) */}
              <div className="px-4 pb-3 flex items-start gap-3">
                {/* 좌측 텍스트 & 정보 구역 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <h4 className="font-bold text-foreground text-sm sm:text-base leading-snug truncate">{item.menu}</h4>
                    {item.time && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 text-orange-600 rounded-md shrink-0">
                        {item.time}
                      </span>
                    )}
                  </div>

                  {/* 장소(MapPin) 및 날짜 */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    {item.place && (
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-orange-500 shrink-0" />
                        <span className="font-medium text-foreground truncate">{item.place}</span>
                      </div>
                    )}
                    {!isWishlistCard && item.date && (
                      <div className="flex items-center gap-1 text-orange-500 font-bold">
                        <Calendar className="size-3 shrink-0" />
                        <span>{item.date}</span>
                      </div>
                    )}
                  </div>

                  {/* 메모 말풍선 (좌측 영역 내 배치) */}
                  {item.memo && (
                    <div className="mt-2 p-2.5 bg-orange-50/60 rounded-xl border border-orange-100/70 text-xs text-foreground/90 leading-relaxed">
                      <p className="line-clamp-2 font-medium">{item.memo}</p>
                    </div>
                  )}
                </div>

                {/* 우측 URL 썸네일 이미지 (사진 클릭 시 원본 URL 링크 이동!) */}
                {item.thumbnail ? (
                  <div 
                    className={cn(
                      "size-24 sm:size-28 rounded-2xl overflow-hidden shrink-0 relative bg-muted border border-muted/40 shadow-sm",
                      item.url && "cursor-pointer group"
                    )}
                    onClick={() => {
                      if (item.url) window.open(item.url, '_blank')
                    }}
                    title={item.url ? "클릭 시 해당 링크로 이동합니다" : undefined}
                  >
                    <img 
                      src={item.thumbnail} 
                      alt={item.menu} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                    />
                    {item.url && (
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-end justify-end p-1.5">
                        <div className="size-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white">
                          <ExternalLink className="size-3" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* 5. 맛톡 느낌의 하단 액션 바 (좋아요, 댓글, 셰프 날짜 잡기) */}
              <div className="flex items-center justify-between border-t border-muted/30 px-4 py-2.5 bg-gray-50/30">
                <div className="flex items-center gap-4">
                  {isWishlistCard && (
                    <button
                      onClick={() => handleToggleWishlistLike(item.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${hasLiked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}
                    >
                      <Heart className={`size-4 ${hasLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                      <span>좋아요 {likedUsers.length > 0 ? likedUsers.length : ""}</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveMealId(item.id)
                      setShowCommentModal(true)
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageCircle className="size-4" />
                    <span>댓글 {commentList.length > 0 ? commentList.length : ""}</span>
                  </button>
                </div>

                {/* 셰프 전용 날짜 잡기 버튼 (셰프에게만 표시!) */}
                {isWishlistCard && isChef && (
                  <button
                    onClick={() => {
                      setEditingPlan({ ...item, isWishlistToSchedule: true })
                      setIsAddReservationOpen(true)
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-95"
                  >
                    <Calendar className="size-3.5" />
                    <span>날짜 잡기</span>
                  </button>
                )}
              </div>
            </div>
          )
        }

        return (
          <div className="flex flex-col gap-4">
            {/* 셰프 정보 바 */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-3 flex items-center gap-3">
              <div className="size-8 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
                <ChefHat className="size-4.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-orange-700 truncate">
                  👨‍🍳 {chef ? `${chef.name === "나" ? "나" : chef.name}가 오늘의 셰프` : "방장이 임시 셰프"}
                </p>
                <p className="text-[10px] text-orange-600 truncate">
                  {isChef ? "위시리스트를 보고 날짜를 잡아 예약을 확정해보세요" : "셰프가 위시리스트를 보고 날짜를 잡아줄 거예요"}
                </p>
              </div>
            </div>

            {/* 검색어 입력 및 정렬 (솔로와 동일) */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="식당, 메뉴, 장소 검색"
                  className="w-full pl-9 pr-4 h-[38px] bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-1.5 px-3.5 bg-white/60 text-muted-foreground border border-white/80 hover:border-primary/30 rounded-xl text-sm font-medium transition-all h-[38px]"
                >
                  <ArrowUpDown className="size-3" />
                  <span>{sortOption}</span>
                  <ChevronDown className="size-2.5" />
                </button>

                {showSortDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-xl border border-muted/20 py-2 z-50">
                    {(["날짜순", "별점순", "기간"] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setSortOption(option)
                          setShowSortDropdown(false)
                        }}
                        className={cn(
                          "w-full px-4 py-2.5 text-left text-sm transition-all",
                          sortOption === option
                            ? "bg-orange-50 text-primary font-bold"
                            : "text-foreground hover:bg-muted/50"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 카테고리 필터 칩 + 수량 배지 + (+) 추가 버튼 */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(["전체", "집밥", "배달", "외식"] as const).map(f => {
                  const count = f === "전체" 
                    ? wishlistItems.length + familyReservations.length 
                    : wishlistItems.filter(i => i.mealType === f).length + familyReservations.filter(i => i.mealType === f).length
                  return (
                    <button
                      key={f}
                      onClick={() => setReservationFilter(f)}
                      className={cn(
                        "shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5",
                        reservationFilter === f
                          ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                          : "bg-white text-muted-foreground border-muted hover:border-orange-300"
                      )}
                    >
                      <span>{f}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                        reservationFilter === f ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    window.dispatchEvent(new CustomEvent('openLoginModal'))
                  } else {
                    setEditingPlan({ isWishlist: true })
                    setIsAddReservationOpen(true)
                  }
                }}
                className="size-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-md transition-all shrink-0"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* 모바일 서브 탭 스위처 (md 이상에서는 숨김) */}
            <div className="md:hidden flex bg-muted/40 rounded-xl p-1 gap-1">
              <button
                onClick={() => setReservationSubTab("wishlist")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                  reservationSubTab === "wishlist"
                    ? "bg-white text-orange-500 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                📋 위시리스트 ({filteredWishlist.length})
              </button>
              <button
                onClick={() => setReservationSubTab("list")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                  reservationSubTab === "list"
                    ? "bg-white text-orange-500 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                📅 예약 목록 ({filteredReservations.length})
              </button>
            </div>

            {/* 모바일 뷰 (선택된 탭 렌더링) */}
            <div className="md:hidden flex flex-col gap-3">
              {reservationSubTab === "wishlist" && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-bold text-foreground text-sm">📋 가족 위시리스트 ({filteredWishlist.length})</h3>
                  {filteredWishlist.map(item => renderCard(item, true))}
                </div>
              )}
              {reservationSubTab === "list" && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-bold text-foreground text-sm">📅 가족 먹예약 목록 ({filteredReservations.length})</h3>
                  {filteredReservations.map(item => renderCard(item, false))}
                </div>
              )}
            </div>

            {/* 데스크톱/태블릿 2열 Split-View (md 이상에서 활성화) */}
            <div className="hidden md:grid md:grid-cols-2 gap-4 items-start">
              {/* 좌측: 위시리스트 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-1 border-b border-muted/40">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <span>📋 가족 위시리스트</span>
                    <span className="text-xs text-orange-500 font-bold">({filteredWishlist.length})</span>
                  </h3>
                  <button
                    onClick={() => {
                      if (!isLoggedIn) {
                        window.dispatchEvent(new CustomEvent('openLoginModal'))
                      } else {
                        setEditingPlan({ isWishlist: true })
                        setIsAddReservationOpen(true)
                      }
                    }}
                    className="text-xs text-orange-500 font-bold flex items-center gap-0.5 hover:underline"
                  >
                    <Plus className="size-3" /> 추가
                  </button>
                </div>
                {filteredWishlist.map(item => renderCard(item, true))}
              </div>

              {/* 우측: 확정 예약 목록 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-1 border-b border-muted/40">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <span>📅 확정 예약 목록</span>
                    <span className="text-xs text-orange-500 font-bold">({filteredReservations.length})</span>
                  </h3>
                  {isChef && (
                    <button
                      onClick={() => {
                        setEditingPlan(null)
                        setIsAddReservationOpen(true)
                      }}
                      className="text-xs text-orange-500 font-bold flex items-center gap-0.5 hover:underline"
                    >
                      <Plus className="size-3" /> 예약 추가
                    </button>
                  )}
                </div>
                {filteredReservations.map(item => renderCard(item, false))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 패밀리 먹캘린더 탭 */}
      {activeMainTab === "calendar" && (
        <div className="flex flex-col gap-4">
          <MealCalendarTab />
        </div>
      )}
      </div>

      {/* AddReservationModal - 위시리스트 및 예약 추가/수정 */}
      {isAddReservationOpen && (
        <AddReservationModal
          isOpen={isAddReservationOpen}
          onClose={() => {
            setIsAddReservationOpen(false)
            setEditingPlan(null)
          }}
          onSave={(data: any) => {
            const isSchedulingFromWishlist = editingPlan?.isWishlistToSchedule
            const isWishlistAdd = editingPlan?.isWishlist && !isSchedulingFromWishlist

            if (isSchedulingFromWishlist) {
              // 위시리스트 → 예약 전환: 동일 ID로 source=family, date 확정
              handleSaveFamilyReservation({ ...data, id: editingPlan.id })
            } else if (isWishlistAdd || !data.date) {
              handleSaveWishlistItem(data)
            } else {
              handleSaveFamilyReservation(data)
            }
            setIsAddReservationOpen(false)
            setEditingPlan(null)
          }}
          onDelete={(id) => {
            if (editingPlan?.isWishlist || !editingPlan?.date) {
              handleDeleteWishlistItem(id)
            } else {
              handleDeleteFamilyReservation(id)
            }
            setIsAddReservationOpen(false)
            setEditingPlan(null)
          }}
          editData={editingPlan && !editingPlan.isWishlistToSchedule ? editingPlan : null}
          isWishlist={!editingPlan?.isWishlistToSchedule && (editingPlan?.isWishlist === true || !editingPlan?.date)}
        />
      )}

      {/* Invite Modal */}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => { setShowInviteModal(false); setIsInviteLinkCopied(false); }}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">가족 초대하기</h3>
              <button 
                onClick={() => {
                  setShowInviteModal(false)
                  setIsInviteLinkCopied(false)
                }} 
                className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
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
                } else if (isInviteLinkCopied) {
                  setShowInviteModal(false)
                  setIsInviteLinkCopied(false)
                } else {
                  handleCopyInviteLink()
                }
              }}
              className={cn(
                "w-full py-3 text-white font-bold rounded-xl transition-colors cursor-pointer",
                isInviteLinkCopied ? "bg-emerald-500 hover:bg-emerald-600" : "bg-orange-500 hover:bg-orange-600",
              )}
            >
              {isInviteLinkCopied ? "복사 완료!" : "링크 복사하기"}
            </button>
          </div>
        </div>
      )}

      {/* Integrated 2-Column Family & Chef Management Modal */}
      {showChefModal && isFamilyOwner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setShowChefModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-[440px] md:max-w-[760px] p-5 md:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Settings className="size-5 text-orange-500" />
                가족 및 셰프 관리 ⚙️
              </h3>
              <button 
                onClick={() => setShowChefModal(false)} 
                className="size-8 rounded-full hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              {/* Left Column (1단): 셰프 지정 */}
              <div className="flex flex-col bg-gray-50/70 p-4 rounded-2xl border border-gray-100/80">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ChefHat className="size-4 text-orange-500" />
                  <h4 className="font-bold text-sm text-foreground">1. 우리가족 셰프 지정</h4>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 leading-tight">
                  가족들의 메뉴 결정 권한을 가질 셰프를 지정하세요.
                </p>
                
                <div className="space-y-2 flex-1 max-h-56 overflow-y-auto pr-1 mb-4">
                  {members.map((member) => {
                    const memberUserId = member.userId || (member.name === "나" ? user?.id : null)
                    const isSelected = selectedChefId 
                      ? (selectedChefId === memberUserId || selectedChefId === member.id) 
                      : (chefUserId ? chefUserId === memberUserId : member.role === 'chef')
                    return (
                      <button
                        key={member.id}
                        onClick={() => setSelectedChefId(memberUserId || member.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer text-left",
                          isSelected 
                            ? "border-orange-500 bg-orange-50/90 shadow-xs" 
                            : "border-gray-200/80 bg-white hover:bg-gray-50"
                        )}
                      >
                        <HubAvatar
                          isLoggedIn={isLoggedIn}
                          avatarUrl={member.name === "나" ? user?.avatar_url : member.avatar}
                          nickname={member.name === "나" ? ((user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '나')) : member.name}
                          size="sm"
                          className="!w-9 !h-9 rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-xs text-foreground block truncate">{member.name}</span>
                          {(member.role === 'chef' || (chefUserId && memberUserId === chefUserId)) && (
                            <span className="text-[9px] font-bold text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-md">현재 셰프</span>
                          )}
                        </div>
                        <div className={cn(
                          "size-4 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300"
                        )}>
                          {isSelected && <Check className="size-2.5 stroke-[3]" />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={async () => {
                    if (!isLoggedIn) {
                      window.dispatchEvent(new CustomEvent('openLoginModal'))
                    } else {
                      if (selectedChefId) {
                        const newChefMember = members.find(m => m.userId === selectedChefId || m.id === selectedChefId || (m.name === "나" && user?.id === selectedChefId))
                        const newChefUserId = newChefMember?.userId || (newChefMember?.name === "나" ? user?.id : (typeof selectedChefId === 'string' ? selectedChefId : null))
                        
                        if (newChefUserId) {
                          if (!isFamilyOwner) {
                            toast.error("셰프 지정 권한은 방장에게만 있습니다.")
                            return
                          }
                          setMembers(prev => prev.map(m => {
                            const isThisMemberChef = m.userId === newChefUserId || (m.name === "나" && user?.id === newChefUserId)
                            return {
                              ...m,
                              role: isThisMemberChef ? 'chef' : 'member'
                            }
                          }))
                          setChefUserId(newChefUserId)

                          try {
                            let hubToken = ''
                            try {
                              const { getSessionToken } = await import('@/services/merlin-hub-sdk/CoreLogic/client')
                              hubToken = getSessionToken() || ''
                            } catch (e) {}

                            const res = await fetch('/api/family/members', {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(hubToken ? { 'x-hub-token': hubToken } : {})
                              },
                              body: JSON.stringify({ chefUserId: newChefUserId })
                            })

                            if (!res.ok) {
                              const errData = await res.json().catch(() => ({}))
                              throw new Error(errData.error || `HTTP ${res.status}`)
                            }

                            toast.success("셰프가 변경되었습니다! 👨‍🍳")
                          } catch (err) {
                            console.error("Failed to update chef_id:", err)
                            toast.error("셰프 변경 저장에 실패했습니다.")
                          }
                        }
                        setShowChefModal(false)
                      }
                    }
                  }}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer mt-auto"
                >
                  셰프 변경 완료
                </button>
              </div>

              {/* Right Column (2단): 가족 멤버 관리 */}
              <div className="flex flex-col bg-gray-50/70 p-4 rounded-2xl border border-gray-100/80">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users className="size-4 text-red-500" />
                  <h4 className="font-bold text-sm text-foreground">2. 가족 멤버 관리</h4>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 leading-tight">
                  필요 시 가족 그룹에서 구성원을 제외할 수 있습니다.
                </p>
                
                <div className="space-y-2 flex-1 max-h-56 overflow-y-auto pr-1 mb-4">
                  {members.map((member) => {
                    const isMe = member.userId === user?.id || member.name === "나"
                    return (
                      <div
                        key={member.id}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-gray-200/80 bg-white"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <HubAvatar
                            isLoggedIn={isLoggedIn}
                            avatarUrl={member.name === "나" ? user?.avatar_url : member.avatar}
                            nickname={member.name === "나" ? (user?.nickname || '나') : member.name}
                            size="sm"
                            className="!w-9 !h-9 rounded-lg"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-foreground block truncate">{member.name}</span>
                            {isMe ? (
                              <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">방장(나)</span>
                            ) : (
                              <span className="text-[9px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">가족 멤버</span>
                            )}
                          </div>
                        </div>

                        {!isMe && member.userId && (
                          <button
                            onClick={() => handleRemoveMember(member.userId!, member.name)}
                            className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-0.5 border border-red-100 shrink-0 cursor-pointer"
                          >
                            <UserMinus className="size-3" />
                            제외
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowChefModal(false)}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer"
            >
              닫기
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
              5점 별점을 준 식사는 '맛톡'(동네 피드)에 공개됩니다. 공개하시겠습니까?
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
      {/* Add Meal Log Modal */}
      <AddLogModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddMealSave}
        mode="family"
        registeredDeliveryStores={registeredDeliveryStores}
      />
    </div>
  )
}
