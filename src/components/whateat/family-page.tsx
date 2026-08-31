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
  ArrowDown,
  ChevronDown,
  Plus,
  Clock,
  Utensils,
  MoreVertical,
  Settings,
  Star,
  StarHalf,
  MessageCircle,
  MessageSquare,
  Heart,
  Send,
  Sparkles,
  MapPin,
  Search,
  ExternalLink,
  BookOpen,
  Calendar,
  CalendarDays,
  UserMinus,
  Users,
  FolderClosed,
  UserPlus,
  Youtube,
} from "lucide-react"
import { createPortal } from "react-dom"
import { cn, formatPlaceNameWithRegion, formatRegionStr, parseRegionFromAddress } from "@/lib/utils"
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
  userId?: string
  sharedAt: string
  sharedAtIso: string
  mealType: "homemade" | "delivery" | "dining" | "other"
  mealMenuId?: string
  doNotPromote?: boolean
  rawExplanation?: string
  linkUrl?: string
  linkThumbnail?: string
  placeName?: string
  placeAddress?: string
  type?: string
  date?: string
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

const mergeWishlistWithSamples = (realWishlist: any[], isGroupMode: boolean = false) => {
  if (isGroupMode) {
    const realDineout = realWishlist.filter(item => item.mealType === "외식")
    if (realDineout.length === 0) {
      const sample = defaultWishlistItems.find(s => s.mealType === "외식")
      return sample ? [sample] : []
    }
    return realDineout
  }
  if (!realWishlist || realWishlist.length === 0) {
    return defaultWishlistItems
  }
  return realWishlist
}

const mergeReservationsWithSamples = (realReservations: any[], isGroupMode: boolean = false) => {
  if (isGroupMode) {
    const realDineout = realReservations.filter(item => item.mealType === "외식")
    if (realDineout.length === 0) {
      const sample = defaultFamilyReservations.find(s => s.mealType === "외식")
      return sample ? [sample] : []
    }
    return realDineout
  }
  if (!realReservations || realReservations.length === 0) {
    return defaultFamilyReservations
  }
  return realReservations
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

// DB 아바타 URL 및 렌더링 최적화를 위한 O(1) 상수 매핑
export const AVATAR_MAP: Record<string, string> = {
  'stark': '/images/avatars/stark-profile.png',
  'merlin': '/images/avatars/merlin-profile.png',
  'default': 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100&h=100&fit=crop&crop=face'
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
  const cachedFamilyStateRef = useRef<{
    members: FamilyMember[]
    isOwner: boolean
    hostId: string | null
    hostName: string
    groupId: string | null
    photo: string | null
    chefUserId: string | null
  } | null>(null)
  const [showChefModal, setShowChefModal] = useState(false)
  const [activeMode, setActiveMode] = useState<'family' | 'group'>('family')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [showGroupMembersDropdown, setShowGroupMembersDropdown] = useState<string | null>(null)
  const [showCreateGroupDropdown, setShowCreateGroupDropdown] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const [userRegion, setUserRegion] = useState<string>("")

  useEffect(() => {
    async function loadUserRegion() {
      if (!isLoggedIn || !user?.id) return
      try {
        const supabase = createClient()
        const { data } = await supabase.from('users').select('region').eq('id', user.id).maybeSingle()
        if (data?.region) {
          setUserRegion(data.region)
        }
      } catch (e) {}
    }
    loadUserRegion()
  }, [isLoggedIn, user])
  const [showMemberManageModal, setShowMemberManageModal] = useState(false)
  const [isFamilyOwner, setIsFamilyOwner] = useState(true)
  const [editingMemoId, setEditingMemoId] = useState<string | number | null>(null)
  const [editingMemoText, setEditingMemoText] = useState("")

  const handleSilentSaveFamilyMemo = async (id: string | number, newMemo: string) => {
    setEditingMemoId(null)
    const trimmed = newMemo.trim()

    setFamilyReservations(prev => prev.map(p => p.id === id ? { ...p, memo: trimmed } : p))
    setWishlistItems(prev => prev.map(p => p.id === id ? { ...p, memo: trimmed } : p))

    if (isLoggedIn && user?.id) {
      try {
        await secureWrite({
          table: "meal_reservations",
          action: "update",
          data: { memo: trimmed },
          filters: { id }
        })
      } catch (err) {
        console.error("Failed to save family inline memo silently", err)
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("whateat:reservation-updated"))
    }
  }

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!targetUserId || targetUserId === user?.id) {
      toast.error('방장 자신은 제거할 수 없습니다.');
      return;
    }
    if (!confirm(`'${memberName}' 님을 가족 그룹에서 제거하시겠습니까?`)) return;

    try {
      let hubToken = '';
      hubToken = getSessionToken() || '';

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

  // Click outside / scroll / resize to close group members / create group dropdowns
  useEffect(() => {
    if (!showGroupMembersDropdown && !showCreateGroupDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.group-dropdown-container') && !target.closest('.group-dropdown-trigger')) {
        setShowGroupMembersDropdown(null);
        setShowCreateGroupDropdown(false);
      }
    };
    const handleScrollOrResize = () => {
      setShowGroupMembersDropdown(null);
      setShowCreateGroupDropdown(false);
    };
    document.addEventListener('click', handleOutsideClick);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [showGroupMembersDropdown, showCreateGroupDropdown]);

  // Set category filters to 'dining' / '외식' automatically in Group mode
  useEffect(() => {
    if (activeMode === 'group') {
      setSharedMealFilter('dining')
      setReservationFilter('외식')
    } else {
      setSharedMealFilter('all')
      setReservationFilter('전체')
    }
  }, [activeMode])

  useEffect(() => {
    async function loadRealFamily() {
      if (activeMode === 'group') return
      if (!isLoggedIn || !user) {
        setMembers(familyMembers)
        setIsFamilyOwner(true)
        setFamilyPhoto(null)
        return
      }

      try {
        let hubToken = ''
        hubToken = getSessionToken() || ''

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
        cachedFamilyStateRef.current = {
          members: newMemberList,
          isOwner,
          hostId,
          hostName: hostNickname,
          groupId: familyGroup?.id || null,
          photo: familyGroup?.family_photo || null,
          chefUserId: effectiveChefId
        }

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
  }, [isLoggedIn, user, activeMainTab, activeMode])

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
        const [emailRes, nicknameRes] = await Promise.all([
          emails.length > 0 ? supabase.from('users').select('id, email, nickname, profile_image').in('email', emails) : Promise.resolve({ data: [] }),
          nicknames.length > 0 ? supabase.from('users').select('id, email, nickname, profile_image').in('nickname', nicknames) : Promise.resolve({ data: [] })
        ])
        
        if (emailRes.data) dbUsers = [...dbUsers, ...emailRes.data]
        if (nicknameRes.data) dbUsers = [...dbUsers, ...nicknameRes.data]

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

  // Load groups from backend api
  const loadGroups = async () => {
    if (!isLoggedIn || !user?.id) return
    try {
      const hubToken = getSessionToken() || '';
      const res = await fetch('/api/group/members', {
        headers: {
          ...(hubToken ? { 'x-hub-token': hubToken } : {})
        }
      })
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups || [])
      }
    } catch (e) {
      console.error("Failed to load groups:", e)
    }
  }

  useEffect(() => {
    loadGroups()
    window.addEventListener("focus", loadGroups)
    return () => window.removeEventListener("focus", loadGroups)
  }, [isLoggedIn, user])

  // When switching between family and group modes, family state is never corrupted
  useEffect(() => {
    if (activeMode === 'family' && cachedFamilyStateRef.current) {
      const c = cachedFamilyStateRef.current
      setMembers(c.members)
      setIsFamilyOwner(c.isOwner)
      setFamilyHostId(c.hostId)
      setFamilyHostName(c.hostName)
      setFamilyGroupId(c.groupId)
      setFamilyPhoto(c.photo)
      setChefUserId(c.chefUserId)
      setSelectedChefId(c.chefUserId)
    }
  }, [activeMode])

  // Listen to joinedGroup event from WhatEatApp.tsx
  useEffect(() => {
    const handleJoinedGroup = (e: CustomEvent) => {
      const { groupId } = e.detail
      if (groupId) {
        loadGroups().then(() => {
          setActiveMode('group')
          setSelectedGroupId(groupId)
        })
      }
    }
    window.addEventListener('joinedGroup', handleJoinedGroup as any)
    return () => window.removeEventListener('joinedGroup', handleJoinedGroup as any)
  }, [])

  // Group Handlers
  const handleCreateGroupSubmit = async () => {
    if (!newGroupName || !newGroupName.trim()) return
    const name = newGroupName.trim()
    setShowCreateGroupDropdown(false)
    setNewGroupName('')
    const createToast = toast.loading("모임을 생성하고 있습니다...")
    try {
      const hubToken = getSessionToken() || '';
      const res = await fetch('/api/group/members', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(hubToken ? { 'x-hub-token': hubToken } : {})
        },
        body: JSON.stringify({ action: 'create', name })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("모임이 생성되었습니다! 👥", { id: createToast })
        await loadGroups()
        setActiveMode('group')
        setSelectedGroupId(data.groupId)
      } else {
        toast.error(data.error || "모임 생성에 실패했습니다.", { id: createToast })
      }
    } catch (err) {
      console.error(err)
      toast.error("오류가 발생했습니다.", { id: createToast })
    }
  }

  const handleCreateGroupPrompt = async () => {
    const name = prompt("새로운 모임의 이름을 입력해주세요:")
    if (!name || !name.trim()) return
    const createToast = toast.loading("모임을 생성하고 있습니다...")
    try {
      const hubToken = getSessionToken() || '';
      const res = await fetch('/api/group/members', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(hubToken ? { 'x-hub-token': hubToken } : {})
        },
        body: JSON.stringify({ action: 'create', name: name.trim() })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("모임이 생성되었습니다! 👥", { id: createToast })
        await loadGroups()
        setActiveMode('group')
        setSelectedGroupId(data.groupId)
      } else {
        toast.error(data.error || "모임 생성에 실패했습니다.", { id: createToast })
      }
    } catch (err) {
      console.error(err)
      toast.error("오류가 발생했습니다.", { id: createToast })
    }
  }

  const handleKickGroupMember = async (groupId: string, targetUserId: string, targetName: string) => {
    if (!confirm(`'${targetName}'님을 모임에서 추방하시겠습니까?`)) return
    const kickToast = toast.loading("추방 처리를 진행 중입니다...")
    try {
      const hubToken = getSessionToken() || '';
      const res = await fetch('/api/group/members', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...(hubToken ? { 'x-hub-token': hubToken } : {})
        },
        body: JSON.stringify({ action: 'kick', groupId, targetUserId })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("모임원 추방이 완료되었습니다.", { id: kickToast })
        await loadGroups()
      } else {
        toast.error(data.error || "추방 실패", { id: kickToast })
      }
    } catch (err) {
      console.error(err)
      toast.error("오류가 발생했습니다.", { id: kickToast })
    }
  }

  const handleCopyGroupInviteLink = async (groupId: string, groupName: string) => {
    let refParam = ""
    try {
      const info = await getMyReferralInfo()
      if (info?.code) {
        refParam = `ref=${info.code}&`
      }
    } catch (e) {
      console.error("Failed to get referral info for group invite:", e)
    }

    const inviteLink = `${window.location.origin}/whateat?${refParam}group=${groupId}`
    
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
      toast.success(`'${groupName}' 모임 초대 링크가 복사되었습니다! 👥`)
    } catch (err) {
      console.error(err)
      toast.error("초대 링크 복사에 실패했습니다.")
    }
  }

  const handleLeaveGroup = async (groupId: string, groupName: string, isOwner: boolean) => {
    const actionText = isOwner ? "삭제(해체)" : "탈퇴"
    if (!confirm(`정말로 '${groupName}' 모임에서 ${actionText}하시겠습니까?`)) return
    const leaveToast = toast.loading(`${actionText} 진행 중...`)
    try {
      const hubToken = getSessionToken() || '';
      const res = await fetch('/api/group/members', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...(hubToken ? { 'x-hub-token': hubToken } : {})
        },
        body: JSON.stringify({ action: isOwner ? 'delete' : 'leave', groupId })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`${actionText}되었습니다.`, { id: leaveToast })
        await loadGroups()
        setActiveMode('family')
        setSelectedGroupId(null)
      } else {
        toast.error(data.error || `${actionText} 실패`, { id: leaveToast })
      }
    } catch (err) {
      console.error(err)
      toast.error("오류가 발생했습니다.", { id: leaveToast })
    }
  }

  const [selectedChefId, setSelectedChefId] = useState<string | number | null>(null)

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
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealLogData | null>(null)

  const isSampleMeal = (mealId: string | number) => {
    if (mealId === 1 || mealId === 2 || mealId === 3) return true
    if (typeof mealId === "string" && (mealId.startsWith("sample-") || mealId === "1" || mealId === "2" || mealId === "3")) return true
    return false
  }
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
  const displayComments = { ...defaultMealComments, ...mealComments }
  const displayRatings = { ...defaultMealRatings, ...mealRatings }

  const [sortOption, setSortOption] = useState<"날짜순" | "별점순" | "기간">("날짜순")
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc")
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
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

  // 댓글 창 외부 클릭 시 댓글 창 닫기
  useEffect(() => {
    if (!expandedMealCommentsId) return

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest(`[data-meal-card-id="${expandedMealCommentsId}"]`)) {
        return
      }
      setExpandedMealCommentsId(null)
      setActiveReplyTarget(null)
      setMealReplyInput("")
    }

    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("touchstart", handleOutsideClick)

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("touchstart", handleOutsideClick)
    }
  }, [expandedMealCommentsId])

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
    let source = activeMode === 'group' ? "group-shared" : "family-shared"

    const mealTypeMap = {
      "집밥": "homemade" as const,
      "배달": "delivery" as const,
      "외식": "dining" as const
    }
    const mappedMealType = mealTypeMap[data.mealType] || "homemade"
    const effectiveImage = data.image || data.linkThumbnail || "/images/placeholder-food.jpg"
    const effectiveTitle = data.menuName?.trim() || data.place?.name || "맛있는 식사"

    const nowIso = new Date().toISOString()
    const formattedDate = new Date().toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // 1. 낙관적 업데이트 생성
    const optimisticMeal: SharedMeal = {
      id: mealUuid,
      image: effectiveImage,
      title: effectiveTitle,
      sharedBy: user.nickname || user.email?.split("@")[0] || "나",
      userId: user.id,
      sharedAt: formattedDate,
      sharedAtIso: nowIso,
      mealType: mappedMealType,
      mealMenuId: mealUuid,
      rawExplanation: JSON.stringify({
        title: effectiveTitle,
        mealType: mappedMealType,
        rating: 0,
        tips: data.recipe?.split("\n").filter((t) => t.trim()) || [],
        placeName: data.place?.name || data.deliveryStoreName || "",
        placeAddress: data.place?.address || "",
        description: data.description || "",
        linkUrl: data.linkUrl || "",
        linkThumbnail: data.linkThumbnail || ""
      }),
      linkUrl: data.linkUrl || "",
      linkThumbnail: data.linkThumbnail || "",
      placeName: data.place?.name || data.deliveryStoreName || "",
      status: status
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
          meal_id: null,
          image_url: finalImageUrl,
          uploaded_by: user.id,
          explanation: JSON.stringify(metadata),
          source: source,
          status: status,
          title: effectiveTitle,
          rating: 0,
          meal_type: activeMode === 'group' ? "외식" : data.mealType,
          link_url: data.linkUrl || "",
          link_thumbnail: data.linkThumbnail || "",
          place_name: data.place?.name || data.deliveryStoreName || "",
          place_address: data.place?.address || "",
          description: data.description || "",
          ...(activeMode === 'group' ? { group_id: selectedGroupId } : {})
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

  const handleEditMealClick = (meal: SharedMeal) => {
    if (isSampleMeal(meal.id)) {
      toast("샘플이라 수정이 되지 않습니다.", { icon: "💡", duration: 3000 })
      return
    }

    let meta: any = {}
    if (meal.rawExplanation) {
      try {
        meta = JSON.parse(meal.rawExplanation)
      } catch (e) {
        meta = {}
      }
    }

    const mealTypeMap: Record<string, "집밥" | "배달" | "외식"> = {
      homemade: "집밥",
      delivery: "배달",
      dining: "외식",
      집밥: "집밥",
      배달: "배달",
      외식: "외식"
    }

    const editData: MealLogData = {
      id: meal.id,
      mealType: mealTypeMap[meal.mealType] || "집밥",
      menuName: meal.title,
      image: meal.image,
      description: meta.description || "",
      recipe: (meta.tips || []).join("\n"),
      linkUrl: meal.linkUrl || meta.linkUrl || "",
      linkThumbnail: meal.linkThumbnail || meta.linkThumbnail || "",
      deliveryStoreName: meal.mealType === "delivery" ? (meal.placeName || meta.placeName) : undefined,
      place: (meal.placeName || meta.placeName) ? { name: meal.placeName || meta.placeName, address: meal.placeAddress || meta.placeAddress || "", category: "" } : undefined
    }

    setEditingMeal(editData)
    setEditModalOpen(true)
  }

  const handleDeleteMealClick = async (mealId: string | number) => {
    if (isSampleMeal(mealId)) {
      toast("샘플이라 삭제가 되지 않습니다.", { icon: "💡", duration: 3000 })
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    try {
      await secureWrite({
        table: "comments",
        action: "delete",
        filters: { meal_id: mealId }
      })
    } catch (e) {
      console.warn("Failed to delete comments for meal:", e)
    }

    try {
      await secureWrite({
        table: "meal_images",
        action: "delete",
        filters: { id: mealId }
      })

      setMeals(prev => prev.filter(m => m.id !== mealId))
      setEditModalOpen(false)
      setEditingMeal(null)
      toast.success("식사 기록이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete family meal:", err)
      toast.error("식사 기록 삭제에 실패했습니다.")
    }
  }

  const handleEditMealSave = async (data: MealLogData) => {
    if (!data.id || isSampleMeal(data.id)) return

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    const mealUuid = data.id
    const mealTypeMap = {
      "집밥": "homemade" as const,
      "배달": "delivery" as const,
      "외식": "dining" as const
    }
    const mappedMealType = mealTypeMap[data.mealType] || "homemade"
    const effectiveImage = data.image || data.linkThumbnail || "/images/placeholder-food.jpg"
    const effectiveTitle = data.menuName?.trim() || data.place?.name || "맛있는 식사"

    // 1. Optimistic update
    setMeals(prev => prev.map(m => {
      if (m.id === mealUuid) {
        return {
          ...m,
          image: effectiveImage,
          title: effectiveTitle,
          mealType: mappedMealType,
          linkUrl: data.linkUrl || "",
          linkThumbnail: data.linkThumbnail || "",
          placeName: data.place?.name || data.deliveryStoreName || "",
          rawExplanation: JSON.stringify({
            title: effectiveTitle,
            mealType: mappedMealType,
            rating: 0,
            tips: data.recipe?.split("\n").filter((t) => t.trim()) || [],
            placeName: data.place?.name || data.deliveryStoreName || "",
            placeAddress: data.place?.address || "",
            description: data.description || "",
            linkUrl: data.linkUrl || "",
            linkThumbnail: data.linkThumbnail || ""
          })
        }
      }
      return m
    }))

    setEditModalOpen(false)
    setEditingMeal(null)
    toast.success("식사 기록이 수정되었습니다.")

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
        action: "update",
        data: {
          image_url: finalImageUrl,
          explanation: JSON.stringify(metadata),
          title: effectiveTitle,
          meal_type: data.mealType,
          link_url: data.linkUrl || "",
          link_thumbnail: data.linkThumbnail || "",
          place_name: data.place?.name || data.deliveryStoreName || "",
          place_address: data.place?.address || "",
          description: data.description || ""
        },
        filters: { id: mealUuid }
      })

      if (data.description !== undefined) {
        const supabase = createClient()
        const cleanDesc = data.description.trim()
        const { data: existingComments } = await supabase
          .from("comments")
          .select("id")
          .eq("meal_id", mealUuid)
          .eq("user_id", user.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true })

        if (cleanDesc !== "") {
          if (existingComments && existingComments.length > 0) {
            await secureWrite({
              table: "comments",
              action: "update",
              data: {
                content: cleanDesc,
                updated_at: new Date().toISOString()
              },
              filters: { id: existingComments[0].id }
            })
          } else {
            await secureWrite({
              table: "comments",
              action: "insert",
              data: {
                id: generateUUID(),
                meal_id: mealUuid,
                user_id: user.id,
                content: cleanDesc,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_deleted: false
              }
            })
          }
        } else if (existingComments && existingComments.length > 0) {
          await secureWrite({
            table: "comments",
            action: "update",
            data: {
              is_deleted: true,
              updated_at: new Date().toISOString()
            },
            filters: { id: existingComments[0].id }
          })
        }
      }
    } catch (err) {
      console.error("Failed to edit family meal in Supabase:", err)
      toast.error("식사 기록 수정 중 오류가 발생했습니다.")
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
  const [selectedReservationForPopup, setSelectedReservationForPopup] = useState<any | null>(null)
  const [selectedLogMealForPopup, setSelectedLogMealForPopup] = useState<any | null>(null)
  const [wishlistLikes, setWishlistLikes] = useState<Record<string | number, string[]>>({})
  const [reservationFilter, setReservationFilter] = useState<"전체" | "집밥" | "배달" | "외식">("전체")
  const familyPhotoInputRef = useRef<HTMLInputElement | null>(null)

  const activeGroup = activeMode === 'group' ? groups.find(g => g.id === selectedGroupId) : null
  const displayMembers = (activeMode === 'group' && activeGroup)
    ? activeGroup.members.map((m: any, idx: number) => ({
        id: idx + 1,
        name: m.userId === user?.id ? "나" : (m.nickname || m.name),
        avatar: m.userId === user?.id ? (user?.avatar_url || m.avatar) : m.avatar,
        role: m.role === 'owner' ? ('chef' as const) : ('member' as const),
        isOnline: m.userId === user?.id ? true : false,
        isStudent: false,
        userId: m.userId
      }))
    : members

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

  const fetchFamilyData = async (familyUserIds: string[], targetGroupId: string | null = null) => {
    try {
      const supabase = createClient()
      
      let query = supabase.from('meal_images').select('*')
      if (targetGroupId) {
        query = query.eq('group_id', targetGroupId)
      } else {
        query = query.in('uploaded_by', familyUserIds).eq('source', 'family-shared')
      }
      
      // 1. Fetch shared meals (meal_images)
      const { data: imgData, error: imgError } = await query
        .order('created_at', { ascending: false })
        .limit(30)

      if (imgError) throw imgError

      if (!imgData || imgData.length === 0) {
        setMeals([])
        return
      }

      // 1.5 Early map and render meals to avoid blocking UI on comments/users fetch
      const initialFormattedMeals: SharedMeal[] = imgData.map(img => {
        let meta: any = {}
        try {
          meta = img.explanation ? JSON.parse(img.explanation) : {}
        } catch (e) {
          meta = { title: img.explanation || "식사" }
        }

        const foundMember = displayMembers.find(m => m.userId === img.uploaded_by)
        const uploaderName = foundMember ? foundMember.name : "가족"
        const formattedDate = new Date(img.created_at).toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        return {
          id: img.id,
          image: img.image_url,
          title: img.title || meta.title || "맛있는 식사",
          sharedBy: img.uploaded_by === user?.id ? "나" : uploaderName,
          userId: img.uploaded_by,
          sharedAt: formattedDate,
          sharedAtIso: img.created_at,
          mealType: meta.mealType || "homemade",
          mealMenuId: img.meal_id,
          doNotPromote: meta.doNotPromote || false,
          rawExplanation: img.explanation || '',
          linkUrl: img.link_url || meta.linkUrl || "",
          linkThumbnail: img.link_thumbnail || meta.linkThumbnail || "",
          placeName: img.place_name || meta.placeName || "",
          placeAddress: img.place_address || meta.placeAddress || "",
          status: img.status
        }
      })
      setMeals(initialFormattedMeals)

      // Extract mealMenuIds and mealImageIds (both can be targets for comments)
      const mealMenuIds = imgData.map(img => img.meal_id).filter(Boolean)
      const mealImageIds = imgData.map(img => img.id).filter(Boolean)
      const allTargetIds = Array.from(new Set([...mealMenuIds, ...mealImageIds]))

      // 2. Fetch comments, ratings, and likes for these target IDs in parallel
      let allComments: any[] = []
      let allRatings: any[] = []
      let allLikes: any[] = []

      if (allTargetIds.length > 0) {
        const [commentsRes, ratingsRes, likesRes] = await Promise.all([
          supabase.from('comments').select('*').in('meal_id', allTargetIds).eq('is_deleted', false),
          supabase.from('meal_ratings').select('*').in('meal_id', allTargetIds),
          supabase.from('meal_likes').select('meal_id, user_id').in('meal_id', allTargetIds)
        ])
        allComments = commentsRes.data || []
        allRatings = ratingsRes.data || []
        allLikes = likesRes.data || []
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

      // 4. Load users list to map user_id to nicknames/avatars
      const allUserIds = Array.from(new Set([
        ...allComments.map(c => c.user_id),
        ...allReplies.map(r => r.user_id),
        ...allRatings.map(rt => rt.user_id),
        ...allLikes.map(l => l.user_id)
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
                const isReplyLiked = typeof window !== 'undefined' ? localStorage.getItem(`liked_reply_${user?.id}_${r.id}`) === 'true' : false
                const savedReplyCount = typeof window !== 'undefined' ? localStorage.getItem(`reply_likes_count_${r.id}`) : null
                const replyLikes = savedReplyCount !== null ? parseInt(savedReplyCount, 10) : (r.likes_count || (isReplyLiked ? 1 : 0))

                return {
                  id: r.id,
                  userId: r.user_id,
                  author: r.user_id === user?.id ? "나" : (ru?.nickname || "가족"),
                  content: r.content,
                  createdAt: new Date(r.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                  likes: replyLikes,
                  isLiked: isReplyLiked
                }
              })

            const isCommentLiked = typeof window !== 'undefined' ? localStorage.getItem(`liked_comment_${user?.id}_${c.id}`) === 'true' : false
            const savedCommentCount = typeof window !== 'undefined' ? localStorage.getItem(`comment_likes_count_${c.id}`) : null
            const commentLikes = savedCommentCount !== null ? parseInt(savedCommentCount, 10) : (c.likes_count || (isCommentLiked ? 1 : 0))

            return {
              id: c.id,
              userId: c.user_id,
              author: cAuthor,
              content: c.content,
              createdAt: new Date(c.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              likes: commentLikes,
              isLiked: isCommentLiked,
              replies: cReplies
            }
          })

        commentsByMealId[imgId] = mealCommentsList
      })

      // Map ratings and likes
      const ratingsByMealId: Record<string, Record<number, number>> = {}
      const likesByMealId: Record<string, string[]> = {}
      
      imgData.forEach(img => {
        const targetId = img.meal_id || img.id
        const imgId = img.id
        const mealRatingsMap: Record<number, number> = {}

        allRatings
          .filter(rt => rt.meal_id === targetId)
          .forEach(rt => {
            const foundMember = displayMembers.find(m => m.userId === rt.user_id)
            if (foundMember) {
              mealRatingsMap[foundMember.id] = rt.rating
            }
          })

        ratingsByMealId[imgId] = mealRatingsMap
        
        likesByMealId[imgId] = allLikes
          .filter(l => l.meal_id === targetId)
          .map(l => l.user_id)
      })

      setMealComments(prev => ({ ...prev, ...commentsByMealId }))
      setMealRatings(prev => ({ ...prev, ...ratingsByMealId }))
      setWishlistLikes(prev => ({ ...prev, ...likesByMealId }))

    } catch (e) {
      console.error("Failed to fetch family shared data:", e)
    }
  }

  const fetchFamilyReservations = async (familyUserIds: string[], targetGroupId: string | null = null) => {
    try {
      const supabase = createClient()
      let query = supabase.from("meal_reservations").select("*")
      if (targetGroupId) {
        query = query.eq('group_id', targetGroupId)
      } else {
        query = query.in("user_id", familyUserIds).is("group_id", null)
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error

      if (data) {
        const rawWishlist = data.filter(r => !r.date || (r.source && r.source.includes("wishlist"))).map(row => ({
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

        const rawReservations = data.filter(r => !!r.date && (!r.source || !r.source.includes("wishlist"))).map(row => ({
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

        const wishlist = mergeWishlistWithSamples(rawWishlist, targetGroupId !== null)
        const reservations = mergeReservationsWithSamples(rawReservations, targetGroupId !== null)

        setWishlistItems(wishlist)
        setFamilyReservations(reservations)

        // Fetch comments and replies for wishlist and reservations
        const wishlistIds = wishlist.map(w => w.id)
        const reservationIds = reservations.map(r => r.id)
        const allResIds = [...wishlistIds, ...reservationIds]
        const dbResIds = allResIds.filter(id => typeof id === 'string' && !id.startsWith('sample-'))
        
        if (dbResIds.length > 0) {
          const { data: commentsData } = await supabase
            .from("comments")
            .select("*")
            .in("meal_id", dbResIds)
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
          dbResIds.forEach(resId => {
            commentsMap[resId] = allComments
              .filter(c => c.meal_id === resId)
              .map(c => {
                const u = userMap.get(c.user_id)
                const cAuthor = c.user_id === user?.id ? "나" : (u?.nickname || "가족")
                const cReplies = allReplies
                  .filter(r => r.comment_id === c.id)
                  .map(r => {
                    const ru = userMap.get(r.user_id)
                    const isReplyLiked = typeof window !== 'undefined' ? localStorage.getItem(`liked_reply_${user?.id}_${r.id}`) === 'true' : false
                    const savedReplyCount = typeof window !== 'undefined' ? localStorage.getItem(`reply_likes_count_${r.id}`) : null
                    const replyLikes = savedReplyCount !== null ? parseInt(savedReplyCount, 10) : (r.likes_count || (isReplyLiked ? 1 : 0))

                    return {
                      id: r.id,
                      userId: r.user_id,
                      author: r.user_id === user?.id ? "나" : (ru?.nickname || "가족"),
                      content: r.content,
                      createdAt: new Date(r.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                      likes: replyLikes,
                      isLiked: isReplyLiked
                    }
                  })
                
                const isCommentLiked = typeof window !== 'undefined' ? localStorage.getItem(`liked_comment_${user?.id}_${c.id}`) === 'true' : false
                const savedCommentCount = typeof window !== 'undefined' ? localStorage.getItem(`comment_likes_count_${c.id}`) : null
                const commentLikes = savedCommentCount !== null ? parseInt(savedCommentCount, 10) : (c.likes_count || (isCommentLiked ? 1 : 0))

                return {
                  id: c.id,
                  userId: c.user_id,
                  author: cAuthor,
                  content: c.content,
                  createdAt: new Date(c.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                  likes: commentLikes,
                  isLiked: isCommentLiked,
                  replies: cReplies
                }
              })
          })
          setMealComments(prev => {
            const next = { ...prev }
            dbResIds.forEach(resId => {
              next[resId] = commentsMap[resId] || []
            })
            return next
          })
        }

        // Fetch likes for wishlist and reservation items
        if (dbResIds.length > 0) {
          const { data: likesData } = await supabase
            .from("meal_likes")
            .select("meal_id, user_id")
            .in("meal_id", dbResIds)
          
          if (likesData) {
            const likesMap: Record<string | number, string[]> = {}
            dbResIds.forEach(resId => {
              likesMap[resId] = likesData.filter(l => l.meal_id === resId).map(l => l.user_id)
            })
            setWishlistLikes(prev => ({ ...prev, ...likesMap }))
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
          meal_type: activeMode === 'group' ? "외식" : data.mealType,
          menu: data.menu,
          place: data.place || null,
          memo: data.memo || "",
          thumbnail: data.thumbnail || null,
          source_url: data.url || null,
          source: activeMode === 'group' ? "group_wishlist" : "family_wishlist",
          ...(activeMode === 'group' ? { group_id: selectedGroupId } : {})
        }
      })
      toast.success("위시리스트에 추가되었습니다! 📋", { id: uploadToast })
      if (activeMode === 'group') {
        fetchFamilyReservations([], selectedGroupId)
      } else {
        const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
        fetchFamilyReservations(familyUserIds)
      }
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
      if (activeMode === 'group') {
        fetchFamilyReservations([], selectedGroupId)
      } else {
        const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
        fetchFamilyReservations(familyUserIds)
      }
    } catch (err) {
      console.error("Failed to delete wishlist item:", err)
      toast.error("삭제에 실패했습니다.", { id: deleteToast })
    }
  }

  const handleSaveFamilyReservation = async (data: any) => {
    if (!isLoggedIn || !user) return
    if (data?.isSample || String(data?.id).startsWith("sample-") || data?.id === 1 || data?.id === 2 || data?.id === 3) {
      toast("샘플이라 저장이 안 되며, 새 식사를 등록하면 샘플은 사라집니다.", {
        icon: "💡",
        duration: 3000
      })
      return
    }
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
          meal_type: activeMode === 'group' ? "외식" : data.mealType,
          menu: data.menu,
          place: data.place || null,
          memo: data.memo || "",
          thumbnail: data.thumbnail || null,
          source_url: data.url || null,
          source: activeMode === 'group' ? "group" : "family",
          ...(activeMode === 'group' ? { group_id: selectedGroupId } : {})
        }
      })
      toast.success("먹예약이 저장되었습니다! 📅", { id: uploadToast })
      if (activeMode === 'group') {
        fetchFamilyReservations([], selectedGroupId)
      } else {
        const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
        fetchFamilyReservations(familyUserIds)
      }
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
      if (activeMode === 'group') {
        fetchFamilyReservations([], selectedGroupId)
      } else {
        const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
        fetchFamilyReservations(familyUserIds)
      }
    } catch (err) {
      console.error("Failed to delete reservation:", err)
      toast.error("삭제에 실패했습니다.", { id: deleteToast })
    }
  }

  const handleToggleWishlistLike = async (itemId: string | number) => {
    if (typeof itemId === "string" && (itemId.startsWith("sample-") || itemId === "1" || itemId === "2" || itemId === "3")) {
      toast("샘플이라 좋아요 저장이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }
    if (typeof itemId === "number" && (itemId === 1 || itemId === 2 || itemId === 3)) {
      toast("샘플이라 좋아요 저장이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }

    if (!isLoggedIn || !user) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }
    
    const likedUsers = wishlistLikes[itemId] || []
    const hasLiked = likedUsers.includes(user.id)
    
    // 낙관적 업데이트로 더블클릭 등 방지
    if (hasLiked) {
      setWishlistLikes(prev => ({
        ...prev,
        [itemId]: likedUsers.filter(uid => uid !== user.id)
      }))
    } else {
      setWishlistLikes(prev => ({
        ...prev,
        [itemId]: [...likedUsers, user.id]
      }))
    }

    try {
      if (hasLiked) {
        await secureWrite({
          table: "meal_likes",
          action: "delete",
          filters: { meal_id: itemId }
        })
      } else {
        await secureWrite({
          table: "meal_likes",
          action: "insert",
          data: {
            meal_id: itemId,
            user_id: user.id
          }
        })
      }
    } catch (err: any) {
      // 중복 키 에러는 이미 처리된 것이므로 무시
      if (err.message && err.message.includes("duplicate key")) {
        return
      }
      // 실패 시 롤백
      if (hasLiked) {
        setWishlistLikes(prev => ({
          ...prev,
          [itemId]: [...likedUsers, user.id]
        }))
      } else {
        setWishlistLikes(prev => ({
          ...prev,
          [itemId]: likedUsers.filter(uid => uid !== user.id)
        }))
      }
      console.error("Failed to toggle wishlist like:", err)
      toast.error(`좋아요 처리에 실패했습니다: ${err.message || err}`)
    }
  }

  const fetchDecidedMenus = async () => {
    // 급식(meal_menus) 칼럼 재활용 잔재 제거 - local state 및 패밀리 전용 데이터 사용
  }

  // Trigger sync of family data and decided menus
  useEffect(() => {
    if (isLoggedIn && user?.id) {
      const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
      if (activeMode === 'group' && selectedGroupId) {
        fetchFamilyData([], selectedGroupId)
        fetchFamilyReservations([], selectedGroupId)
      } else if (familyUserIds.length > 0) {
        fetchFamilyData(familyUserIds)
        fetchFamilyReservations(familyUserIds)
      }
      fetchDecidedMenus()
    }
  }, [members, isLoggedIn, user, activeMode, selectedGroupId])

  // Realtime subscription for family updates (meals, ratings, comments, replies, reservations, likes)
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return

    const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
    if (familyUserIds.length === 0) return

    const supabase = createClient()
    const ts = Date.now()

    const channel = supabase
      .channel(`realtime:family_sync:${ts}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_ratings' }, () => {
        if (activeMode === 'group' && selectedGroupId) {
          fetchFamilyData([], selectedGroupId)
        } else {
          fetchFamilyData(familyUserIds)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const newComment = payload.new as any;
        setMealComments(prev => {
          const mealId = newComment.meal_id;
          const existingComments = prev[mealId] || [];
          if (existingComments.some(c => c.id === newComment.id)) return prev;
          
          const u = members.find(m => m.userId === newComment.user_id);
          const author = newComment.user_id === user?.id ? "나" : (u?.name || "가족");
          
          const mappedComment = {
            id: newComment.id,
            userId: newComment.user_id,
            author,
            content: newComment.content,
            createdAt: new Date(newComment.created_at).toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            likes: 0,
            isLiked: false,
            replies: []
          };
          return { ...prev, [mealId]: [...existingComments, mappedComment] };
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, (payload) => {
        const updatedComment = payload.new as any;
        setMealComments(prev => {
          const mealId = updatedComment.meal_id;
          if (!prev[mealId]) return prev;
          if (updatedComment.is_deleted) {
            return { ...prev, [mealId]: prev[mealId].filter(c => c.id !== updatedComment.id) };
          } else {
            return {
              ...prev,
              [mealId]: prev[mealId].map(c => c.id === updatedComment.id ? { 
                ...c, 
                content: updatedComment.content,
                likes: updatedComment.likes_count ?? c.likes
              } : c)
            };
          }
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_replies' }, () => {
        fetchFamilyData(familyUserIds)
        fetchFamilyReservations(familyUserIds)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_images' }, () => {
        fetchFamilyData(familyUserIds)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_reservations' }, () => {
        if (activeMode === 'group' && selectedGroupId) {
          fetchFamilyReservations([], selectedGroupId)
        } else {
          fetchFamilyReservations(familyUserIds)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meal_likes' }, (payload) => {
        const { meal_id, user_id } = payload.new as any;
        setWishlistLikes(prev => {
          const existingLikes = prev[meal_id] || [];
          if (existingLikes.includes(user_id)) return prev;
          return { ...prev, [meal_id]: [...existingLikes, user_id] };
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'meal_likes' }, (payload) => {
        const { meal_id, user_id } = payload.old as any;
        setWishlistLikes(prev => {
          const existingLikes = prev[meal_id] || [];
          return { ...prev, [meal_id]: existingLikes.filter(id => id !== user_id) };
        });
      })
      .subscribe((status, err) => {
        if (err) console.error('[Realtime:family_sync] Error:', err)
      })

    return () => {
      supabase.removeChannel(channel)
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
  
  const activeDefaultMeals = activeMode === 'group'
    ? (meals.some(m => m.mealType === "dining") ? [] : defaultSharedMeals.filter(m => m.mealType === "dining"))
    : defaultSharedMeals.filter(m => {
        if (m.mealType === "homemade" && hasHomemade) return false
        if (m.mealType === "delivery" && hasDelivery) return false
        if (m.mealType === "dining" && hasDining) return false
        return true
      })
  
  const baseMeals = [...activeDefaultMeals, ...meals]
  
  const filteredMeals = baseMeals.filter((meal) => {
    if (activeMode === 'group' && meal.mealType !== "dining") return false
    if (sharedMealFilter !== "all" && getSharedMealCategory(meal) !== sharedMealFilter) {
      return false
    }
    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch = 
        (meal.title && meal.title.toLowerCase().includes(q)) ||
        (meal.placeName && meal.placeName.toLowerCase().includes(q)) ||
        (meal.placeAddress && meal.placeAddress.toLowerCase().includes(q)) ||
        (meal.sharedBy && meal.sharedBy.toLowerCase().includes(q)) ||
        (meal.rawExplanation && meal.rawExplanation.toLowerCase().includes(q))
      
      if (!matchesSearch) return false
    }
    return true
  }).sort((a, b) => {
    // 1. 별점순
    if (sortOption === "별점순") {
      const getAvg = (mealId: number | string) => {
        const ratingMap = displayRatings[mealId] ?? {}
        const ratedScores = Object.values(ratingMap).filter((s): s is number => typeof s === "number")
        if (ratedScores.length === 0) return 0
        return ratedScores.reduce((sum, s) => sum + s, 0) / ratedScores.length
      }
      const scoreA = getAvg(a.id)
      const scoreB = getAvg(b.id)
      if (scoreA !== scoreB) {
        return sortDirection === "desc" ? scoreB - scoreA : scoreA - scoreB
      }
    }
    
    // 2. 날짜순 (기본)
    const dateA = a.sharedAtIso ? new Date(a.sharedAtIso).getTime() : 0
    const dateB = b.sharedAtIso ? new Date(b.sharedAtIso).getTime() : 0
    
    return sortDirection === "desc" ? dateB - dateA : dateA - dateB
  })

  const getMealAverageRating = (mealId: string | number) => {
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
      
      // 맛톡 승격 일시 및 5점 부여 승격자 정보 기록
      meta.promotedAt = new Date().toISOString()
      meta.mealType = meta.mealType || targetMeal.mealType
      if (user?.id) {
        meta.promotedBy = user.id
        meta.promotedByNickname = user.nickname || (user as any).name || ""
      }

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
    const isSample = typeof mealId === "string" && mealId.startsWith("sample-")
    
    // 대상 식사 로그 조회
    const targetMeal = meals.find((meal) => meal.id === mealId)
    if (!targetMeal) return

    const currentRatingMap = { ...(mealRatings[mealId] ?? {}), [memberId]: score }
    const has5Star = Object.values(currentRatingMap).some((s) => s === 5)
    
    const oldScore = mealRatings[mealId]?.[memberId] ?? 0

    // 5점 -> 4점 이하로 다운그레이드 시 맛톡 수거 검증
    // (이 때, 나 혹은 다른 가족 구성원 통틀어 5점이 더이상 남지 않게 되는 경우에만 맛톡 수거 검증)
    const was5StarAtAll = Object.values(mealRatings[mealId] ?? {}).some((s) => s === 5)
    if (was5StarAtAll && !has5Star && targetMeal.status === 'approved' && !isSample) {
      try {
        const supabase = createClient()
        const ratingTargetId = targetMeal.mealMenuId || targetMeal.id
        
        // 다른 이웃의 댓글이 달렸는지 확인
        const { data: commentsData, error: commentError } = await supabase
          .from("comments")
          .select("id, user_id")
          .eq("meal_id", ratingTargetId)
          .eq("is_deleted", false)

        if (commentError) throw commentError

        const familyUserIds = members.map(m => m.userId).filter(Boolean) as string[]
        const hasOtherComments = commentsData && commentsData.some(c => !familyUserIds.includes(c.user_id))

        if (hasOtherComments) {
          toast("'맛톡'에 올라간 후, 다른 이웃의 댓글/좋아요 활동이 발생하여 평점을 낮출 수 없습니다.", { icon: "🔒", duration: 4000 })
          return
        }

        // 수거 성공: status -> 'pending'으로 강제 강등 및 데이터베이스 수정
        let meta: any = {}
        try {
          meta = targetMeal.rawExplanation ? JSON.parse(targetMeal.rawExplanation) : {}
        } catch (e) {
          meta = { title: targetMeal.title }
        }
        meta.promotedAt = undefined // 승격 시간 삭제

        await secureWrite({
          table: 'meal_images',
          action: 'update',
          data: {
            status: 'pending',
            explanation: JSON.stringify(meta)
          },
          filters: { id: targetMeal.id }
        })

        // 로컬 상태에서 맛톡 수거 반영
        setPromotedMealIds((prev) => prev.filter((id) => id !== mealId))
        
        toast("다른 유저의 활동이 없어 맛톡 피드에서 식사 기록을 수거했습니다.", { icon: "🧹", duration: 3000 })
      } catch (err) {
        console.error("Family downgrade check failed:", err)
        toast.error("평점 변경 검증에 실패했습니다.")
        return
      }
    }

    // --- 5점 승격 동의 모달 연동 ---
    if (score === 5 && targetMeal.status !== 'approved' && !isSample) {
      const pref = localStorage.getItem("whateat_auto_share_5star")
      if (pref === "approved") {
        // 이미 자동 동의한 경우 바로 저장 및 맛톡 승격
        await saveFamilyRating(mealId, memberId, score)
        await tryPromoteMealToTalk(mealId, currentRatingMap)
        toast("가족 5점 평가 달성! '맛톡' 피드로 등록되었습니다. 🌟", { icon: "🎉" })
        setSelectedMealId(null) // 팝업 닫기
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("navigateToTalk"))
        }, 1500) // 1.5초 후 이동
      } else if (pref === "rejected") {
        // 거절한 적이 있는 경우 저장만 하고 승격하지 않음
        await saveFamilyRating(mealId, memberId, score)
        await updateMealDoNotPromote(targetMeal.id, targetMeal.rawExplanation || '')
      } else {
        // 동의 이력이 없는 경우 동의 팝업 모달 띄우기
        setPendingFamilyRating({ mealId, memberId, score })
        setShareConsentModalOpen(true)
        return
      }
    } else {
      // 5점 신규 승격이 아닌 경우 일반 저장만 처리
      await saveFamilyRating(mealId, memberId, score)
    }
  }

  const saveFamilyRating = async (mealId: string | number, memberId: number, score: number) => {
    // 샘플 카드: 로컬 상태에만 즉시 반영
    if (typeof mealId === "string" && mealId.startsWith("sample-")) {
      setMealRatings((prev) => {
        const next = { ...prev }
        next[mealId] = { ...(next[mealId] ?? {}), [memberId]: score }
        return next
      })
      return
    }

    const targetMeal = baseMeals.find((meal) => meal.id === mealId)
    if (!targetMeal) return
    if (memberId !== currentFamilyMemberId) return
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    // 낙관적(optimistic) UI 업데이트: 클릭 즉시 별에 색 반영
    const prevRatings = mealRatings
    setMealRatings((prev) => {
      const next = { ...prev }
      next[mealId] = { ...(next[mealId] ?? {}), [memberId]: score }
      return next
    })

    try {
      const supabase = createClient()
      const ratingTargetId = targetMeal.mealMenuId || targetMeal.id
      if (!ratingTargetId) return

      const { data: existing, error: fetchErr } = await supabase
        .from('meal_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('meal_id', ratingTargetId)
        .limit(1)

      if (fetchErr) throw fetchErr

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
            user_id: user.id,
            meal_id: ratingTargetId,
            rating: score
          }
        })
      }

      // 로컬 낙관적 업데이트(setMealRatings) 및 DB(secureWrite) 저장이 완료되었으므로
      // 전체 페이지를 재조회(fetchFamilyData)하여 화면이 번쩍거리는 현상을 방지
    } catch (err: any) {
      // 실패 시 낙관적 업데이트 롤백
      setMealRatings(prevRatings)
      console.error("Failed to save rating to Supabase", err)
    }
  }

  const handleOpenMealCardDetail = (mealId: string | number) => {
    setSelectedMealId(mealId)
    setDismissedMealHighlightIds((prev) => (prev.includes(mealId) ? prev : [...prev, mealId]))
  }

  const toggleMealCommentLike = async (mealId: string | number, commentId: string | number) => {
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    const storageKey = `liked_comment_${user.id}_${commentId}`
    const countKey = `comment_likes_count_${commentId}`
    const alreadyLiked = localStorage.getItem(storageKey) === 'true'

    const comments = displayComments[mealId] || mealComments[mealId] || []
    const targetComment = comments.find(c => c.id === commentId)
    if (!targetComment) return

    const newLikesCount = alreadyLiked ? Math.max(0, targetComment.likes - 1) : targetComment.likes + 1

    setMealComments((prev) => {
      const currentList = prev[mealId] || displayComments[mealId] || []
      return {
        ...prev,
        [mealId]: currentList.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                isLiked: !alreadyLiked,
                likes: newLikesCount,
              }
            : comment,
        ),
      }
    })

    if (alreadyLiked) {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, 'true')
    }
    localStorage.setItem(countKey, String(newLikesCount))
  }

  const toggleMealReplyLike = async (mealId: string | number, commentId: string | number, replyId: string | number) => {
    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    const storageKey = `liked_reply_${user.id}_${replyId}`
    const countKey = `reply_likes_count_${replyId}`
    const alreadyLiked = localStorage.getItem(storageKey) === 'true'

    const comments = displayComments[mealId] || mealComments[mealId] || []
    const targetComment = comments.find(c => c.id === commentId)
    if (!targetComment) return
    const targetReply = (targetComment.replies || []).find(r => r.id === replyId)
    if (!targetReply) return

    const newLikesCount = alreadyLiked ? Math.max(0, targetReply.likes - 1) : targetReply.likes + 1

    setMealComments((prev) => {
      const currentList = prev[mealId] || displayComments[mealId] || []
      return {
        ...prev,
        [mealId]: currentList.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                replies: (comment.replies || []).map((reply) =>
                  reply.id === replyId
                    ? { ...reply, isLiked: !alreadyLiked, likes: newLikesCount }
                    : reply
                ),
              }
            : comment,
        ),
      }
    })

    if (alreadyLiked) {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, 'true')
    }
    localStorage.setItem(countKey, String(newLikesCount))
  }

  const handleAddMealComment = async (mealId: string | number) => {
    const content = mealCommentInput.trim()
    if (!content) return

    if (typeof mealId === "string" && (mealId.startsWith("sample-") || mealId === "1" || mealId === "2" || mealId === "3")) {
      toast("샘플이라 댓글 작성이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }
    if (typeof mealId === "number" && (mealId === 1 || mealId === 2 || mealId === 3)) {
      toast("샘플이라 댓글 작성이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }

    const targetMeal = baseMeals.find(m => m.id === mealId)
      || wishlistItems.find(m => m.id === mealId)
      || familyReservations.find(m => m.id === mealId);
    if (!targetMeal) return
    const commentTargetId = targetMeal.id

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    const commentUuid = generateUUID()
    
    // 낙관적 업데이트
    setMealComments(prev => {
      const existing = prev[commentTargetId] || [];
      const tempComment = {
        id: commentUuid,
        userId: user.id,
        author: "나",
        content: content,
        createdAt: new Date().toLocaleDateString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        likes: 0,
        isLiked: false,
        replies: []
      };
      return { ...prev, [commentTargetId]: [...existing, tempComment] };
    });
    
    setMealCommentInput("")

    try {
      await secureWrite({
        table: 'comments',
        action: 'insert',
        data: {
          id: commentUuid,
          meal_id: commentTargetId,
          user_id: user.id,
          content: content,
          is_deleted: false
        }
      })
    } catch (err: any) {
      console.error("Failed to add comment to Supabase", err)
      // 에러 발생 시 낙관적 업데이트 롤백
      setMealComments(prev => {
        const existing = prev[commentTargetId] || [];
        return { ...prev, [commentTargetId]: existing.filter(c => c.id !== commentUuid) };
      });
      toast.error(`댓글 저장에 실패했습니다: ${err.message || err}`)
    }
  }

  const handleAddMealReply = async (mealId: string | number, commentId: string | number) => {
    const content = mealReplyInput.trim()
    if (!content) return

    if (typeof mealId === "string" && (mealId.startsWith("sample-") || mealId === "1" || mealId === "2" || mealId === "3")) {
      toast("샘플이라 댓글 작성이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }
    if (typeof mealId === "number" && (mealId === 1 || mealId === 2 || mealId === 3)) {
      toast("샘플이라 댓글 작성이 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
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
      
      setEditingCommentId(null)
      setEditCommentText("")
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
      const newDecidedMenu: TodayMenu = {
        id: generateUUID(),
        title: decidedMenuName.trim(),
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop",
        decidedBy: currentFamilyMemberName,
        decidedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        mealTime: decidedMealTime
      }
      setTodayDecidedMenus(prev => [newDecidedMenu, ...prev])
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

  const renderCard = (item: any, isWishlistCard: boolean, isPopupCard = false, onClosePopup?: () => void) => {
    const isChef = activeMode === 'group'
      ? (groups.find(g => g.id === selectedGroupId)?.ownerId === user?.id)
      : (chefUserId ? user?.id === chefUserId : isFamilyOwner)
    const likedUsers = wishlistLikes[item.id] || []
    const hasLiked = user?.id ? likedUsers.includes(user.id) : false
    const commentList = mealComments[item.id] || []
    const isSampleItem = item.isSample || String(item.id).startsWith("sample-")

    // 작성자 메타데이터 (헤더 노출)
    const isSampleUser = String(item.userId).startsWith("sample-")
    const sampleNameMap: Record<string, string> = {
      "sample-user-1": "엄마",
      "sample-user-2": "아빠",
      "sample-user-3": "동생"
    }

    const cardUser = displayMembers.find(m => m.userId === item.userId)
    const nickname = isSampleUser
      ? sampleNameMap[item.userId] || "가족"
      : (item.userId === user?.id
        ? ((user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') ? user.nickname : (user?.email?.split('@')[0] || '나'))
        : (cardUser?.name || "가족"))

    const getMealTypeIcon = (type: string) => {
      if (type === "집밥") return ChefHat
      if (type === "배달") return Bike
      return UtensilsCrossed
    }
    const TypeIcon = getMealTypeIcon(item.mealType)

    const formatCardDate = (dateStr: string, timeStr?: string) => {
      let formatted = dateStr
      try {
        const d = new Date(dateStr)
        const m = d.getMonth() + 1
        const day = d.getDate()
        formatted = `${m}월 ${day}일`
      } catch (e) {
        if (dateStr.includes("-")) {
          const parts = dateStr.split("-")
          if (parts.length === 3) {
            formatted = `${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일`
          }
        }
      }
      if (timeStr) {
        let mealTimeLabel = ""
        try {
          const hour = parseInt(timeStr.split(":")[0], 10)
          if (!isNaN(hour)) {
            if (hour < 11) {
              mealTimeLabel = "아침"
            } else if (hour < 16) {
              mealTimeLabel = "점심"
            } else {
              mealTimeLabel = "저녁"
            }
          }
        } catch (e) {}
        if (mealTimeLabel) {
          formatted += ` · ${mealTimeLabel}`
        }
      }
      return formatted
    }

    // 카드 외관 스타일 (위시리스트: 흑백/선만 남김 vs 확정 예약: 컬러풀)
    const borderClass = isWishlistCard
      ? "border border-gray-200 border-l-4 border-l-slate-300 shadow-2xs hover:shadow-xs"
      : cn(
          "border border-y-gray-200/80 border-r-gray-200/80 border-l-4 shadow-sm hover:shadow-md hover:-translate-y-0.5",
          item.mealType === "집밥" && "border-l-emerald-500",
          item.mealType === "배달" && "border-l-sky-500",
          item.mealType === "외식" && "border-l-orange-500"
        )
    const bgClass = "bg-white"

    return (
      <div 
        key={item.id} 
        className={cn(
          "rounded-3xl overflow-hidden relative transition-all duration-200",
          borderClass,
          bgClass,
          isSampleItem && "opacity-95"
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

        {/* 1. 상단 헤더: 좌측 [식사유형 뱃지] + [작성자/날짜], 우측 [✏️ 수정 / 닫기] */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* 식사유형 뱃지: 위시는 흑백/모노톤, 확정은 컬러풀 */}
            <div className={cn(
              "px-2 py-0.5 rounded-lg flex items-center gap-1.5 border text-xs font-bold shrink-0 shadow-2xs",
              isWishlistCard 
                ? "bg-slate-100/90 text-slate-600 border-slate-200/80"
                : cn(
                    item.mealType === "집밥" && "bg-emerald-50 text-emerald-700 border-emerald-200/80",
                    item.mealType === "배달" && "bg-sky-50 text-sky-700 border-sky-200/80",
                    item.mealType === "외식" && "bg-orange-50 text-orange-700 border-orange-200/80",
                    !item.mealType && "bg-gray-50 text-gray-700 border-gray-200"
                  )
            )}>
              <TypeIcon className={cn("size-3.5 shrink-0", isWishlistCard ? "text-slate-500" : undefined)} strokeWidth={2.2} />
              <span>{item.mealType || "식사"}</span>
            </div>

            {/* 헤더 텍스트: 위시는 "작성자 wish" (날짜 없음), 확정은 "작성자 · 📅 날짜" */}
            {isWishlistCard ? (
              <span className="text-xs font-bold text-slate-500 truncate">
                <span className="text-foreground font-black">{nickname}</span> wish
              </span>
            ) : (
              <div className="flex items-center gap-1 text-xs font-bold text-gray-800 min-w-0">
                <span className="text-foreground font-black shrink-0">{nickname}</span>
                <span className="text-gray-300">·</span>
                {item.date && (
                  <span className="flex items-center gap-1 truncate">
                    <CalendarDays className="size-3.5 text-gray-400 shrink-0" />
                    <span>{formatCardDate(item.date, item.time)}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={cn("flex items-center gap-1.5 shrink-0", isSampleItem && "mr-10")}>
            {/* 수정 버튼:
                - 위시리스트 카드: 최초 등록자(item.userId === user?.id)에게만 노출
                - 확정 예약 카드: 날짜잡기 권한이 있는 셰프/방장(isChef)에게만 노출 */}
            {isLoggedIn && (isWishlistCard ? (item.userId === user?.id) : isChef) && (
              <button
                onClick={() => {
                  if (isSampleItem) {
                    toast("샘플이라 수정/삭제가 안 되며, 식사를 등록하면 샘플은 사라집니다.", {
                      icon: "💡",
                      duration: 3000
                    })
                    return
                  }
                  if (isPopupCard && onClosePopup) {
                    onClosePopup()
                  }
                  setEditingPlan({ ...item, isWishlist: isWishlistCard })
                  setIsAddReservationOpen(true)
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                title="수정/삭제"
              >
                <Pencil className="size-3" />
              </button>
            )}

            {/* 팝업 모달일 때 닫기(X) 버튼 */}
            {isPopupCard && onClosePopup && (
              <button
                onClick={onClosePopup}
                className="size-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-foreground transition-colors cursor-pointer shrink-0"
                title="닫기"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* 2. 카드 본문 - 공간 최적화 2열 구조 (좌: 메뉴명/장소/메모, 우: 썸네일) */}
        <div className="px-4 pb-3 pt-1 flex items-start justify-between gap-3">
          {/* 좌측 텍스트 & 정보 구역 */}
          <div className="flex-1 min-w-0">
            <div>
              {/* 둘째줄: 메뉴 제목 */}
              <h4 className="font-bold text-foreground text-sm sm:text-base leading-snug line-clamp-2">
                {item.menu}
              </h4>

              {/* 셋째줄: 식당 주소 또는 숏폼 뱃지 */}
              {item.place ? (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 text-orange-500 shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {(() => {
                      if (item.place.includes("/")) return item.place
                      if (item.place.includes(" ")) {
                        const reg = parseRegionFromAddress(item.place)
                        const formatted = formatRegionStr(reg.city, reg.gu, reg.dong)
                        if (formatted) return formatted
                      }
                      return item.place
                    })()}
                  </span>
                </div>
              ) : (
                item.url && (item.url.includes("youtube.com") || item.url.includes("youtu.be") || item.url.includes("tiktok.com") || item.url.includes("instagram.com")) && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/70 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                      <Youtube className="size-3 text-red-500 shrink-0" />
                      <span>숏폼 영상</span>
                    </span>
                  </div>
                )
              )}
            </div>

            {/* 넷째줄: 메모 말풍선 (클릭 시 원터치 조용한 자동저장 인라인 입력) */}
            {editingMemoId === item.id ? (
              <div 
                className="mt-2.5 p-1 bg-white rounded-xl border-2 border-orange-400/90 shadow-2xs flex items-center animate-in fade-in duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  autoFocus
                  value={editingMemoText}
                  onChange={(e) => setEditingMemoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur()
                    }
                  }}
                  onBlur={() => handleSilentSaveFamilyMemo(item.id, editingMemoText)}
                  placeholder="한줄 메모 입력..."
                  className="w-full bg-transparent text-xs font-medium outline-none text-foreground px-1.5 py-0.5"
                />
              </div>
            ) : (
              (item.memo || !String(item.id).startsWith("sample-")) && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation()
                    if (String(item.id).startsWith("sample-")) return
                    setEditingMemoId(item.id)
                    setEditingMemoText(item.memo || "")
                  }}
                  className="mt-2.5 p-2 bg-orange-50/60 hover:bg-orange-100/80 rounded-xl border border-orange-100/80 text-xs text-foreground/90 leading-relaxed cursor-text transition-all"
                  title="클릭하여 메모 바로 수정"
                >
                  <p className="line-clamp-2 font-medium">
                    {item.memo || <span className="text-muted-foreground/60 italic">+ 메모 입력</span>}
                  </p>
                </div>
              )
            )}
          </div>

          {/* 우측 영역 */}
          <div className="flex flex-col items-end gap-2 shrink-0">
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
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
                  }}
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
        </div>

        {/* 5. 맛톡 느낌의 하단 액션 바 (좋아요, 댓글, 셰프 날짜 잡기) */}
        <div className="flex items-center justify-between border-t border-muted/30 px-4 py-2.5 bg-gray-50/30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleToggleWishlistLike(item.id)}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${hasLiked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"}`}
            >
              <Heart className={`size-4 ${hasLiked ? "fill-rose-500 text-rose-500" : ""}`} />
              <span>좋아요 {likedUsers.length > 0 ? likedUsers.length : ""}</span>
            </button>
            <button
              onClick={() => {
                setExpandedMealCommentsId(expandedMealCommentsId === item.id ? null : item.id)
                if (expandedMealCommentsId === item.id) {
                  setActiveReplyTarget(null)
                  setMealReplyInput("")
                }
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="size-4" />
              <span>댓글 {commentList.length > 0 ? commentList.length : ""}</span>
            </button>
          </div>

          {/* 셰프 전용 날짜 잡기 버튼 */}
          {isWishlistCard && isChef && (
            <button
              onClick={() => {
                if (isSampleItem) {
                  toast("샘플이라 날짜잡기가 안 되며, 새 식사를 등록하면 샘플은 사라집니다.", {
                    icon: "💡",
                    duration: 3000
                  })
                  return
                }
                if (isPopupCard && onClosePopup) {
                  onClosePopup()
                }
                setEditingPlan({ ...item, authorNickname: nickname, isWishlistToSchedule: true })
                setIsAddReservationOpen(true)
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3.5 py-1.5 rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-95"
            >
              <Calendar className="size-3.5" />
              <span>날짜 잡기</span>
            </button>
          )}
        </div>

        {/* 댓글 섹션 추가 (인라인 전개) */}
        {expandedMealCommentsId === item.id && (
          <div className="border-t border-muted/20 bg-white p-4">
            {renderMealCommentsSection(item.id, "card")}
          </div>
        )}
      </div>
    )
  }

  const renderMealCard = (meal: any, isPopupCard = false, onClosePopup?: () => void) => {
    const isExpanded = expandedMealCommentsId === meal.id || isPopupCard
    const averageRating = getMealAverageRating(meal.id)
    const shouldHighlight = !dismissedMealHighlightIds.includes(meal.id)

    const placeAddress = (() => {
      if (meal.rawExplanation) {
        try {
          const meta = JSON.parse(meal.rawExplanation)
          return meta.placeAddress || ""
        } catch (e) {}
      }
      return ""
    })()

    const getCleanDate = (m: any) => {
      if (m.sharedAtIso) {
        const d = new Date(m.sharedAtIso)
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear()
          const mStr = String(d.getMonth() + 1).padStart(2, "0")
          const dateVal = String(d.getDate()).padStart(2, "0")
          return `${y}.${mStr}.${dateVal}`
        }
      }
      return m.sharedAt || ""
    }
    const cleanDate = getCleanDate(meal)

    return (
      <div
        key={meal.id}
        data-meal-card-id={meal.id}
        className={cn(
          "relative bg-white rounded-3xl overflow-hidden border border-gray-200/80 shadow-md",
          shouldHighlight && "ring-2 ring-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.18),0_0_22px_rgba(34,211,238,0.38)]",
        )}
      >
        {/* 샘플 리본 - 샘플 카드에 100% 지속 노출 */}
        {isSampleMeal(meal.id) && (
          <div className="absolute top-4 -right-10 w-52 bg-yellow-400 text-yellow-900 text-[10px] font-black py-1 text-center rotate-45 shadow-md z-10 pointer-events-none">
            💡 SAMPLE
          </div>
        )}

        {/* 좌우 분할 카드 */}
        <div
          onClick={() => handleOpenMealCardDetail(meal.id)}
          className="w-full text-left block hover:opacity-95 transition-opacity cursor-pointer"
        >
          <div className="flex h-[190px]">
            {/* 왼쪽: 이미지 */}
            <div 
              className="w-1/2 relative overflow-hidden group/img cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenMealCardDetail(meal.id)
              }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover/img:scale-105"
                style={{ backgroundImage: `url("${meal.image || '/placeholder.svg'}")` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 z-10">
                <div className={cn(
                  "px-2 py-0.5 rounded-lg flex items-center gap-1 border text-[10px] font-bold shadow-xs",
                  (meal.mealType === "homemade" || meal.mealType === "집밥") && "bg-emerald-50/95 text-emerald-700 border-emerald-200/80 backdrop-blur-sm",
                  (meal.mealType === "delivery" || meal.mealType === "배달") && "bg-sky-50/95 text-sky-700 border-sky-200/80 backdrop-blur-sm",
                  (meal.mealType === "dining" || meal.mealType === "외식") && "bg-orange-50/95 text-orange-700 border-orange-200/80 backdrop-blur-sm",
                  !meal.mealType && "bg-white/90 text-gray-700 border-gray-200"
                )}>
                  {(meal.mealType === "homemade" || meal.mealType === "집밥") ? <ChefHat className="size-3 shrink-0" strokeWidth={2.2} /> :
                   (meal.mealType === "delivery" || meal.mealType === "배달") ? <Bike className="size-3 shrink-0" strokeWidth={2.2} /> :
                   <UtensilsCrossed className="size-3 shrink-0" strokeWidth={2.2} />}
                  <span>{meal.mealType === "homemade" ? "집밥" : meal.mealType === "delivery" ? "배달" : meal.mealType === "dining" ? "외식" : (meal.mealType || "식사")}</span>
                </div>
              </div>
            </div>

            {/* 오른쪽: 식사 정보 또는 식당 링크 */}
            <div className="w-1/2 bg-gray-50/80 border-l border-muted flex flex-col overflow-hidden relative">
              {/* 연필 수정 아이콘 - 글 작성자에게만 노출 */}
              {meal.userId === user?.id && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isSampleMeal(meal.id)) {
                      toast("샘플이라 수정이 되지 않습니다.", { icon: "💡", duration: 3000 })
                      return
                    }
                    if (isPopupCard && onClosePopup) {
                      onClosePopup()
                    }
                    handleEditMealClick(meal)
                  }}
                  className="absolute top-1.5 right-1.5 size-7.5 flex items-center justify-center text-foreground bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-full shadow-sm hover:bg-white active:scale-95 transition-all z-20 cursor-pointer"
                  title="수정"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
              {meal.linkUrl ? (
                (() => {
                  const isKakao = meal.linkUrl.includes("kko.to") || meal.linkUrl.includes("kakao.com")
                  const isGoogle = meal.linkUrl.includes("google.com") || meal.linkUrl.includes("google.co.kr") || meal.linkUrl.includes("goo.gl")
                  const isYoutube = meal.linkUrl.includes("youtube.com") || meal.linkUrl.includes("youtu.be")
                  const isInstagram = meal.linkUrl.includes("instagram.com")
                  const isTiktok = meal.linkUrl.includes("tiktok.com")
                  const isNaver = meal.linkUrl.includes("naver.me") || meal.linkUrl.includes("naver.com") || meal.linkUrl.includes("naver.co.kr")
                  const isGeneric = !isKakao && !isGoogle && !isYoutube && !isInstagram && !isTiktok && !isNaver
                  
                  const isRecipe = isGeneric && (meal.mealType === "homemade")
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
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover/scale-105"
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

          {/* Place info bar - 외식/배달 혹은 집밥 높이 일치용 빈 줄 (우측 오프셋 및 상하 여백 슬림화) */}
          {(meal.mealType === "dining" || meal.mealType === "delivery") && meal.placeName ? (
            <div
              className={`flex items-center gap-2 pl-24 pr-5 py-0.5 bg-gray-50/50 border-t border-muted/20 transition-all min-h-[25px] ${meal.linkUrl ? 'hover:bg-gray-100/60 group cursor-pointer' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (meal.linkUrl) window.open(meal.linkUrl, '_blank', 'noopener,noreferrer')
              }}
            >
              {meal.linkUrl && (meal.linkUrl.includes("naver.me") || meal.linkUrl.includes("naver.com")) ? (
                <div className="size-4 rounded-md bg-[#03C75A] flex items-center justify-center shrink-0">
                  <span className="text-white text-[7.5px] font-black">N</span>
                </div>
              ) : (
                <div className="size-4 rounded-md bg-orange-100 flex items-center justify-center shrink-0">
                  <MapPin className="size-2.5 text-orange-500" />
                </div>
              )}
              <span className="text-[11px] font-bold text-foreground truncate flex items-center leading-tight">
                <span className="truncate">{meal.placeName}</span>
                {placeAddress && (
                  <span className="text-[10px] font-normal text-muted-foreground ml-1.5 shrink-0">
                    {(() => {
                      let defaultCity = ""
                      let defaultGu = ""
                      let defaultDong = ""
                      if (userRegion) {
                        try {
                          const parsedReg = JSON.parse(userRegion)
                          defaultCity = parsedReg.city || ""
                          defaultGu = parsedReg.gu || ""
                          defaultDong = parsedReg.dong || ""
                        } catch (ex) {}
                      }
                      const parsed = parseRegionFromAddress(placeAddress, defaultCity, defaultGu, defaultDong)
                      return formatRegionStr(parsed.city, parsed.gu, parsed.dong)
                    })()}
                  </span>
                )}
              </span>
            </div>
          ) : (
            <div className="h-[25px] pl-24 pr-5 py-0.5 bg-gray-50/50 border-t border-muted/20" />
          )}

          {/* Card Footer: Title, Date, Average Rating */}
          <div className="px-5 pt-1 pb-3 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                {cleanDate}
              </p>
              {(() => {
                const myRating = displayRatings[meal.id]?.[currentFamilyMemberId] ?? 0
                const ratingsObj = displayRatings[meal.id] || {}
                const ratedCount = Object.keys(ratingsObj).filter(k => (ratingsObj as any)[k] > 0).length
                const totalMembersCount = members?.length || 2
                const hasMyRating = myRating > 0

                return (
                  <div 
                    className="flex items-center gap-1 select-none shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                    title="가족 별점 자세히 보기 및 평가하기"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenMealCardDetail(meal.id)
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <Star 
                        className={cn(
                          "size-4 transition-colors",
                          (hasMyRating || averageRating > 0) 
                            ? "fill-orange-500 text-orange-500" 
                            : "text-gray-300 fill-none stroke-[1.5]"
                        )} 
                      />
                      <span className="text-xs font-black text-foreground">
                        {averageRating > 0 ? averageRating.toFixed(1) : "0.0"}
                      </span>
                      <span className="text-[11px] font-bold text-muted-foreground">
                        ({ratedCount}/{totalMembersCount})
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex items-center justify-between gap-2 mt-0.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {meal.sharedBy && (
                  <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                    by {meal.sharedBy}
                  </span>
                )}
                <h3 className="font-extrabold text-foreground text-sm tracking-tight truncate">
                  {meal.title}
                </h3>
              </div>

              {/* 댓글 버튼 (식사명 줄 우측 끝으로 이동) */}
              <div 
                className="flex items-center gap-1.5 cursor-pointer group hover:bg-muted/10 p-1 -mr-1 rounded-md transition-colors shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedMealCommentsId(expandedMealCommentsId === meal.id ? null : meal.id)
                  if (expandedMealCommentsId === meal.id) {
                    setActiveReplyTarget(null)
                    setMealReplyInput("")
                  }
                }}
              >
                <MessageSquare className="size-3.5 text-orange-500" />
                <span className="text-xs font-bold text-foreground select-none">댓글</span>
                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                  {(displayComments[meal.id] ?? []).length}
                </span>
              </div>
            </div>

            {promotedMealIds.includes(meal.id) && (
              <div className="mt-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[10px] text-emerald-700 font-bold flex items-center gap-1.5">
                <Sparkles className="size-3 shrink-0" />
                <span>가족 5점 만점 달성으로 맛톡에 게시된 식사입니다!</span>
              </div>
            )}
          </div>
        </div>

        {/* 댓글 섹션 추가 (인라인 전개) */}
        {isExpanded && (
          <div className="border-t border-muted/20 bg-white p-4">
            {renderMealCommentsSection(meal.id, "card")}
          </div>
        )}
      </div>
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
      <div className="sticky top-[52px] sm:top-[62px] z-50 bg-[#fffaf5] -mx-5 px-5 pt-3 pb-1 flex flex-col gap-2 border-b border-muted/10">
        {/* Family/Group Hybrid Header */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl pt-2 pb-1.5 px-4 border border-white shadow-sm flex flex-col md:flex-row gap-3 items-center select-none relative z-50">
          {/* Left: Family Sector */}
          <div 
            onClick={() => {
              if (activeMode !== 'family') {
                setActiveMode('family')
                setSelectedGroupId(null)
              }
            }}
            className={cn(
              "transition-all duration-300 flex items-center gap-3 cursor-pointer flex-1 md:max-w-[60%]",
              activeMode === 'group' && "md:opacity-40 md:scale-95"
            )}
          >
            {/* Full Family Content: always visible on desktop, collapsed on mobile if activeMode === 'group' */}
            <div className={cn(
              "flex-1 flex items-center justify-start gap-2.5 overflow-x-auto hide-scrollbar animate-fade-in",
              activeMode === 'group' ? 'hidden md:flex' : 'flex'
            )}>
              {isFamilyOwner ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isLoggedIn) {
                      window.dispatchEvent(new CustomEvent('openLoginModal'))
                    } else {
                      familyPhotoInputRef.current?.click()
                    }
                  }}
                  className="size-11 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 hover:bg-orange-100 transition-colors overflow-hidden shrink-0 cursor-pointer"
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

              <div className="shrink-0 min-w-fit pr-1">
                <h2 className="font-bold text-foreground text-base leading-tight">
                  {!isLoggedIn || !user
                    ? "게스트 가족"
                    : isFamilyOwner
                      ? `${user?.nickname && user.nickname !== '회원' ? user.nickname : '우리'} 가족`
                      : `${familyHostName || '가족'} 가족`}
                </h2>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {isLoggedIn && isFamilyOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
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
                        <div className="absolute -top-1 -right-1 size-4.5 rounded-full bg-orange-500 text-white font-extrabold text-[10px] leading-none flex items-center justify-center border-1.5 border-white shadow-xs z-10 select-none" title="가족셰프-메뉴결정권자">
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
                  onClick={(e) => {
                    e.stopPropagation()
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

            {/* Collapsed Family Tab: only visible on mobile when activeMode === 'group' */}
            {activeMode === 'group' && (
              <div className="flex md:hidden items-center gap-2 shrink-0 animate-fade-in">
                {familyPhoto ? (
                  <img src={familyPhoto} alt="가족" className="size-7 rounded-lg object-cover" />
                ) : (
                  <span className="text-base">🏡</span>
                )}
                <span className="font-extrabold text-xs text-foreground whitespace-nowrap">
                  {!isLoggedIn || !user
                    ? "게스트 가족"
                    : isFamilyOwner
                      ? `${user?.nickname && user.nickname !== '회원' ? user.nickname : '우리'} 가족`
                      : `${familyHostName || '가족'} 가족`}
                </span>
              </div>
            )}
          </div>

          {/* Desktop divider */}
          <div className="hidden md:block w-[1px] h-8 bg-slate-100 shrink-0 mx-1" />

          {/* Right: Group Sector */}
          <div 
            className={cn(
              "transition-all duration-300 flex items-center gap-3 flex-1 md:max-w-[40%]",
              activeMode === 'family' && "md:scale-95"
            )}
          >
            {/* Group Chips List: on mobile, only show if group mode is active; on desktop, always show */}
            <div className={cn(
              "flex-1 flex flex-row-reverse items-center justify-start gap-1.5 pt-0.5 overflow-x-auto hide-scrollbar flex-nowrap",
              activeMode === 'family' ? 'hidden md:flex' : 'flex'
            )}>
              {/* 1. Moim + Button (Always far right, vertical stacked layout, fixed position, dropdown below) */}
              {isLoggedIn && (
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      setDropdownCoords({
                        top: rect.bottom + window.scrollY,
                        left: rect.left + window.scrollX,
                        width: rect.width
                      })
                      setShowCreateGroupDropdown(prev => !prev)
                    }}
                    className="group-dropdown-trigger px-2 py-1 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-100 flex flex-col items-center justify-center text-[10px] font-black leading-tight cursor-pointer transition-colors shrink-0"
                    title="새 모임 만들기"
                  >
                    <span>모임</span>
                    <Plus className="size-5 mt-0.5" />
                  </button>

                  {showCreateGroupDropdown && dropdownCoords && typeof document !== 'undefined' && createPortal(
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: `${dropdownCoords.top}px`,
                        left: `${Math.max(8, dropdownCoords.left - 240 + dropdownCoords.width)}px`,
                      }}
                      className="group-dropdown-container w-60 bg-white rounded-xl shadow-lg border border-cyan-100 p-3 z-[9999] animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <div className="text-[10px] font-black text-cyan-600 mb-2">새 모임 만들기</div>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="모임 이름을 입력해주세요"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 mb-2 font-bold text-gray-700"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateGroupSubmit()
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setShowCreateGroupDropdown(false)
                            setNewGroupName('')
                          }}
                          className="px-2 py-1 text-[9px] font-bold text-gray-500 hover:bg-gray-100 rounded cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleCreateGroupSubmit}
                          className="px-2.5 py-1 text-[9px] font-black text-white bg-cyan-600 hover:bg-cyan-700 rounded cursor-pointer"
                        >
                          만들기
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              )}

              {/* 2. Mapped Group Chips (rendered to the left of the Moim+ button) */}
              {groups.map((group) => {
                const isSelected = activeMode === 'group' && selectedGroupId === group.id
                return (
                  <div 
                    key={group.id} 
                    className={cn(
                      "relative transition-opacity duration-300",
                      activeMode === 'family' && "opacity-40"
                    )}
                  >
                    {/* Split Interactive Chip in 2-line layout */}
                    <div 
                      className={cn(
                        "rounded-lg text-xs font-bold transition-all flex flex-col items-center whitespace-nowrap overflow-hidden border border-transparent shadow-xs select-none shrink-0",
                        isSelected
                          ? "bg-cyan-600 text-white"
                          : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
                      )}
                    >
                      {/* Top: Group Name Button (Switches mode and tab, supports toggling off) */}
                      <button
                        onClick={() => {
                          if (activeMode === 'group' && selectedGroupId === group.id) {
                            setActiveMode('family')
                            setSelectedGroupId(null)
                          } else {
                            setActiveMode('group')
                            setSelectedGroupId(group.id)
                          }
                          // Close dropdown if toggling/switching groups
                          setShowGroupMembersDropdown(null)
                        }}
                        className={cn(
                          "w-full px-2.5 py-1.5 text-center transition-all cursor-pointer font-black text-[11px] leading-tight border-b",
                          isSelected 
                            ? "border-white/10 hover:bg-cyan-700/20" 
                            : "border-gray-200/50 hover:bg-gray-300/20"
                        )}
                      >
                        {group.name}
                      </button>

                      {/* Bottom: Member Count Toggle Button (Toggles members dropdown only, has trigger class) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const rect = e.currentTarget.getBoundingClientRect()
                          setDropdownCoords({
                            top: rect.bottom + window.scrollY,
                            left: rect.left + window.scrollX,
                            width: rect.width
                          })
                          setShowGroupMembersDropdown(prev => prev === group.id ? null : group.id)
                        }}
                        className={cn(
                          "group-dropdown-trigger w-full py-1 text-[9px] font-bold text-center flex items-center justify-center cursor-pointer transition-colors leading-none",
                          isSelected ? "hover:bg-cyan-700/20 text-cyan-100" : "hover:bg-gray-300/20 text-muted-foreground/80"
                        )}
                        title="모임 구성원 보기"
                      >
                        <span>({group.members.length})</span>
                      </button>
                    </div>

                    {showGroupMembersDropdown === group.id && dropdownCoords && typeof document !== 'undefined' && createPortal(
                      <div 
                        style={{
                          position: 'absolute',
                          top: `${dropdownCoords.top}px`,
                          left: `${Math.max(8, dropdownCoords.left - 208 + dropdownCoords.width)}px`,
                        }}
                        className="group-dropdown-container w-52 bg-white rounded-xl shadow-lg border border-cyan-100 py-1 z-[9999] animate-in fade-in slide-in-from-top-1 duration-200"
                      >
                        {/* Header and Buttons combined in a single line */}
                        <div className="px-2.5 py-1.5 border-b border-cyan-50 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-cyan-600">모임 구성원</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyGroupInviteLink(group.id, group.name)
                              }}
                              className="px-1.5 py-0.5 text-[9px] font-black text-cyan-600 bg-cyan-50 hover:bg-cyan-100 rounded-sm cursor-pointer transition-colors"
                            >
                              초대 +
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLeaveGroup(group.id, group.name, group.isOwner)
                              }}
                              className="px-1.5 py-0.5 text-[9px] font-black text-red-500 hover:bg-red-50 rounded-sm cursor-pointer transition-colors"
                            >
                              {group.isOwner ? "삭제" : "탈퇴"}
                            </button>
                          </div>
                        </div>

                        {/* Members List */}
                        <div className="max-h-40 overflow-y-auto px-2 py-1 flex flex-col gap-1">
                          {group.members.map((m: any) => {
                            const isMe = m.userId === user?.id
                            const displayName = isMe ? "나" : (m.name || '멤버')
                            const displayAvatar = isMe ? (user?.avatar_url || m.avatar) : m.avatar
                            return (
                              <div key={m.userId} className="flex items-center justify-between p-1 hover:bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <img src={displayAvatar} alt={displayName} className="size-5 rounded-full object-cover" />
                                  <span className="text-xs font-bold text-gray-700">{displayName}</span>
                                  {m.role === 'owner' && <span className="text-[8px] bg-cyan-50 text-cyan-600 px-1 rounded-sm">방장</span>}
                                </div>
                                {group.isOwner && !isMe && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleKickGroupMember(group.id, m.userId, m.name)
                                    }}
                                    className="text-[9px] text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded cursor-pointer font-bold"
                                  >
                                    추방
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                )
              })}
              {groups.length === 0 && (
                <span className="text-xs text-muted-foreground/60 italic ml-1">아직 생성된 모임이 없습니다.</span>
              )}
            </div>
          </div>
        </div>

        <div className="sticky top-[62px] z-40 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] pt-2 pb-1 -mx-5 px-5">
          <TabNavigation
            activeTab={activeMainTab as "log" | "reservation" | "calendar"}
            onTabChange={onTabChange || (() => {})}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* Tab Content */}
{/* Tab Content */}
      <div className="flex flex-col gap-3">
      {activeMainTab === "log" && (
        <div className="flex flex-col gap-3">
          {/* Sticky Search + Filter */}
          <div className="sticky top-[116px] z-30 -mx-4 px-4 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex items-center justify-between gap-2">
            
            {/* Left Side: Filters */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar flex-shrink-0 max-w-[50%] sm:max-w-[60%] pt-1.5 pb-1">
              {sharedFilterTabs.map((filterTab) => {
                const isHidden = activeMode === 'group' && filterTab.id !== 'dining'
                const Icon = filterTab.icon
                const displayMeals = [...activeDefaultMeals, ...meals]
                const count =
                  filterTab.id === "all"
                    ? displayMeals.length
                    : displayMeals.filter((meal) => getSharedMealCategory(meal) === filterTab.id).length

                return (
                  <button
                    key={filterTab.id}
                    onClick={() => !isHidden && setSharedMealFilter(filterTab.id)}
                    className={cn(
                      "relative px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                      sharedMealFilter === filterTab.id
                        ? "bg-orange-500 text-white shadow-md shadow-orange-200/70"
                        : "bg-white/70 text-muted-foreground hover:bg-white flex-shrink-0",
                      isHidden && "invisible pointer-events-none"
                    )}
                  >
                    <span className="absolute -top-1.5 right-1 z-10 text-xs leading-none font-black text-sky-500">
                      {count}
                    </span>
                    {Icon && <Icon className="size-4" />}
                    {filterTab.label}
                  </button>
                )
              })}
            </div>

            {/* Right Side: Actions (Search, Sort, FAB) */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-1 min-w-0 pb-1">
              
              {/* Search Bar */}
              <div className={cn("relative transition-all duration-300 ease-in-out", isSearchExpanded || searchQuery ? "flex-1 min-w-[120px] sm:min-w-[150px]" : "w-[38px] flex-shrink-0")}>
                {isSearchExpanded || searchQuery ? (
                  <>
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => { if (!searchQuery) setIsSearchExpanded(false) }}
                      placeholder="식당, 메뉴 검색"
                      className="w-full pl-8 pr-7 h-[38px] bg-white border border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 outline-none text-sm shadow-xs transition-all duration-300"
                    />
                    <button
                      onClick={() => { setSearchQuery(''); setIsSearchExpanded(false) }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground p-1.5 transition-colors cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsSearchExpanded(true)}
                    className="w-[38px] h-[38px] flex items-center justify-center bg-white/60 text-muted-foreground border border-white/80 rounded-xl shadow-sm hover:bg-white hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Search className="size-4" />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className={cn("relative flex-shrink-0", (isSearchExpanded || searchQuery) ? "hidden lg:block" : "block")} ref={sortRef}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-1.5 px-3.5 bg-white/60 text-muted-foreground border border-white/80 hover:border-primary/30 rounded-xl text-sm font-medium transition-all h-[38px]"
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
                    }}
                    className="inline-flex cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <ArrowDown className={cn("size-3 transition-transform duration-300", sortDirection === "asc" && "rotate-180")} />
                  </span>
                  <span className="hidden sm:inline">{sortOption}</span>
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

              {/* FAB */}
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    window.dispatchEvent(new CustomEvent('openLoginModal'))
                  } else {
                    setAddModalOpen(true)
                  }
                }}
                className="size-10 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 transition-all hover:scale-105 active:scale-95 z-20 shrink-0"
              >
                <Plus className="size-5" />
              </button>
            </div>
          </div>


          
          {filteredMeals.length === 0 ? (
            <div className="bg-white/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <Share2 className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">아직 공유된 식사가 없어요</p>
              <p className="text-xs text-muted-foreground/70 mt-1">먹로그에서 가족에게 공유해보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {filteredMeals.map((meal) => renderMealCard(meal))}
            </div>
          )}
        </div>
      )}

      {selectedMeal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setSelectedMealId(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl border border-white cursor-default animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-orange-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-foreground text-lg">{selectedMeal.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span>{selectedMeal.sharedBy}</span>
                  <span>{selectedMeal.sharedAt}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedMealId(null)}
                className="size-7.5 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-146px)] p-5 space-y-5">
              <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-foreground">가족 별점</h4>
                  <span className="text-sm font-extrabold text-orange-500 flex items-center gap-1">
                    <Sparkles className="size-4" />
                    평균 {getMealAverageRating(selectedMeal.id) > 0 ? getMealAverageRating(selectedMeal.id).toFixed(1) : "-"}
                  </span>
                </div>

                <div className="space-y-2.5 mt-4">
                  {members.map((member) => {
                    const score = displayRatings[selectedMeal.id]?.[member.id] ?? 0
                    const isSelf = member.id === currentFamilyMemberId
                    const canRate = isSelf

                    return (
                      <div 
                        key={member.id} 
                        className={cn(
                          "flex items-center justify-between gap-2 px-3 py-2 -mx-3 rounded-xl transition-colors",
                          isSelf ? "bg-white border border-orange-100 shadow-sm" : "opacity-75"
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-16">
                          <span className={cn("text-xs font-bold", isSelf ? "text-orange-700" : "text-foreground")}>
                            {member.name}
                          </span>
                          {isSelf && (
                            <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-sm font-semibold tracking-tight">
                              수정 가능
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              onClick={() => canRate && checkFamilyConsentAndRate(selectedMeal.id, member.id, value)}
                              disabled={!canRate}
                              className={cn(
                                "p-0.5",
                                canRate ? "hover:scale-110 active:scale-95 transition-transform cursor-pointer" : "cursor-default"
                              )}
                            >
                              <Star
                                className={cn(
                                  "size-5 transition-all",
                                  value <= score ? "fill-orange-500 text-orange-500" : "text-gray-200 fill-gray-50",
                                  !canRate && value <= score && "fill-orange-400 text-orange-400",
                                )}
                              />
                            </button>
                          ))}
                        </div>
                        <span className={cn(
                          "text-[11px] font-bold w-8 text-right",
                          isSelf ? "text-orange-600" : "text-orange-400"
                        )}>
                          {score > 0 ? `${score}점` : "-"}
                        </span>
                      </div>
                    )
                  })}
                </div>


                {promotedMealIds.includes(selectedMeal.id) && (
                  <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-700 font-bold">
                    가족 중 5점을 부여하여 맛통 게시 완료
                  </div>
                )}
                {isPromotingMealId === selectedMeal.id && (
                  <div className="mt-3 rounded-xl bg-orange-100 border border-orange-200 px-3 py-2 text-[11px] text-orange-600 font-bold">
                    맛통 게시 중...
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-orange-100/50 flex justify-end">
              <button
                onClick={() => {
                  setSelectedMealId(null)
                  setMealCommentInput("")
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-sm transition-all shadow-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === "reservation" && (() => {
        const isChef = activeMode === 'group'
          ? (groups.find(g => g.id === selectedGroupId)?.ownerId === user?.id)
          : (chefUserId ? user?.id === chefUserId : isFamilyOwner)
        const chef = members.find(m => m.userId === chefUserId) ?? members.find(m => m.role === "chef")

        const filteredWishlist = wishlistItems.filter(item => {
          const query = searchQuery ? searchQuery.trim().toLowerCase() : ""
          const matchesSearch = !query ||
            (item.menu && item.menu.toLowerCase().includes(query)) ||
            (item.place && item.place.toLowerCase().includes(query)) ||
            (item.memo && item.memo.toLowerCase().includes(query))
          const matchesFilter = reservationFilter === "전체" || item.mealType === reservationFilter
          return matchesSearch && matchesFilter
        }).sort((a, b) => {
          // 1. 날짜순 (기본) - 생성일 기준
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return sortDirection === "desc" ? dateB - dateA : dateA - dateB
        })

        const filteredReservations = familyReservations.filter(item => {
          const query = searchQuery ? searchQuery.trim().toLowerCase() : ""
          const matchesSearch = !query ||
            (item.menu && item.menu.toLowerCase().includes(query)) ||
            (item.place && item.place.toLowerCase().includes(query)) ||
            (item.memo && item.memo.toLowerCase().includes(query))
          const matchesFilter = reservationFilter === "전체" || item.mealType === reservationFilter
          return matchesSearch && matchesFilter
        }).sort((a, b) => {
          // 1. 날짜순 (기본) - 예약일 기준
          const dateA = a.date ? new Date(a.date).getTime() : 0
          const dateB = b.date ? new Date(b.date).getTime() : 0
          return sortDirection === "desc" ? dateB - dateA : dateA - dateB
        })

        return (
          <div className="flex flex-col gap-1">
            {/* Sticky Search + Filter */}
            <div className="sticky top-[116px] z-30 -mx-4 px-4 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex items-center justify-between gap-2">
              
              {/* Left Side: Filters */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-shrink-0 max-w-[50%] sm:max-w-[60%] pt-1.5">
                {(["전체", "집밥", "배달", "외식"] as const).map(f => {
                  const isHidden = activeMode === 'group' && f !== "외식"
                  const count = f === "전체" 
                    ? wishlistItems.length + familyReservations.length 
                    : wishlistItems.filter(i => i.mealType === f).length + familyReservations.filter(i => i.mealType === f).length
                  return (
                    <button
                      key={f}
                      onClick={() => !isHidden && setReservationFilter(f)}
                      className={cn(
                        "relative shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5",
                        reservationFilter === f
                          ? "bg-orange-500 text-white shadow-md shadow-orange-200/70"
                          : "bg-white/70 text-muted-foreground hover:bg-white flex-shrink-0",
                        isHidden && "invisible pointer-events-none"
                      )}
                    >
                      <span className="absolute -top-1.5 right-1 z-10 text-xs leading-none font-black text-sky-500">
                        {count}
                      </span>
                      <span>{f}</span>
                    </button>
                  )
                })}
              </div>

              {/* Right Side: Actions (Search, Sort, FAB) */}
              <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-1 min-w-0 pb-1">
                
                {/* Search Bar */}
                <div className={cn("relative transition-all duration-300 ease-in-out", isSearchExpanded || searchQuery ? "flex-1 min-w-[120px] sm:min-w-[150px]" : "w-[38px] flex-shrink-0")}>
                  {isSearchExpanded || searchQuery ? (
                    <>
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground size-3.5" />
                      <input
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onBlur={() => { if (!searchQuery) setIsSearchExpanded(false) }}
                        placeholder="식당, 메뉴 검색"
                        className="w-full pl-8 pr-7 h-[38px] bg-white border border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 outline-none text-sm shadow-xs transition-all duration-300"
                      />
                      <button
                        onClick={() => { setSearchQuery(''); setIsSearchExpanded(false) }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground p-1.5 transition-colors cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsSearchExpanded(true)}
                      className="w-[38px] h-[38px] flex items-center justify-center bg-white/60 text-muted-foreground border border-white/80 rounded-xl shadow-sm hover:bg-white hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Search className="size-4" />
                    </button>
                  )}
                </div>

                {/* Sort Dropdown */}
                <div className={cn("relative flex-shrink-0", (isSearchExpanded || searchQuery) ? "hidden lg:block" : "block")}>
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="flex items-center gap-1.5 px-3.5 bg-white/60 text-muted-foreground border border-white/80 hover:border-primary/30 rounded-xl text-sm font-medium transition-all h-[38px]"
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
                      }}
                      className="inline-flex cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <ArrowDown className={cn("size-3 transition-transform duration-300", sortDirection === "asc" && "rotate-180")} />
                    </span>
                    <span className="hidden sm:inline">{sortOption}</span>
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

                {/* FAB */}
                <button
                  onClick={() => {
                    if (!isLoggedIn) {
                      window.dispatchEvent(new CustomEvent('openLoginModal'))
                    } else {
                      setEditingPlan({ isWishlist: true })
                      setIsAddReservationOpen(true)
                    }
                  }}
                  className="size-10 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-md shadow-orange-500/30 transition-all hover:scale-105 active:scale-95 z-20 shrink-0"
                >
                  <Plus className="size-5" strokeWidth={2.8} />
                </button>
              </div>
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
                  <h3 className="font-bold text-foreground text-sm">
                    {activeMode === 'group' ? '👥 모임 위시리스트' : '📋 가족 위시리스트'} ({filteredWishlist.length})
                  </h3>
                  {filteredWishlist.map(item => renderCard(item, true))}
                </div>
              )}
              {reservationSubTab === "list" && (
                <div className="flex flex-col gap-3">
                  <h3 className="font-bold text-foreground text-sm">
                    {activeMode === 'group' ? '📅 모임 먹예약 목록' : '📅 가족 먹예약 목록'} ({filteredReservations.length})
                  </h3>
                  {filteredReservations.map(item => renderCard(item, false))}
                </div>
              )}
            </div>

            {/* 데스크톱/태블릿 2열 Split-View (md 이상에서 활성화) */}
            <div className="hidden md:grid md:grid-cols-2 gap-4 items-start mt-2">
              {/* 좌측: 위시리스트 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/80">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <span>{activeMode === 'group' ? '👥 모임 위시리스트' : '📋 가족 위시리스트'}</span>
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
                    className="text-xs text-orange-500 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    <Plus className="size-3" /> 추가
                  </button>
                </div>
                {filteredWishlist.map(item => renderCard(item, true))}
              </div>

              {/* 우측: 확정 예약 목록 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/80">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <span>{activeMode === 'group' ? '📅 모임 확정 예약' : '📅 확정 예약 목록'}</span>
                    <span className="text-xs text-orange-500 font-bold">({filteredReservations.length})</span>
                  </h3>
                </div>
                {filteredReservations.map(item => renderCard(item, false))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 패밀리/모임 먹캘린더 탭 */}
      {activeMainTab === "calendar" && (
        <div className="flex flex-col gap-4">
          <MealCalendarTab 
            modeType={activeMode === "group" ? "group" : "family"}
            familyUserIds={members.map(m => m.userId).filter(Boolean) as string[]}
            groupId={selectedGroupId}
            initialReservations={familyReservations}
            initialLogs={meals}
            onSelectReservation={(item) => {
              const fullItem = familyReservations.find(r => r.id === item.id) 
                || wishlistItems.find(w => w.id === item.id) 
                || item
              setSelectedReservationForPopup(fullItem)
              setExpandedMealCommentsId(fullItem.id)
            }}
            onSelectLog={(item) => {
              const fullMeal = [...activeDefaultMeals, ...meals].find(m => m.id === item.id) || item
              setSelectedLogMealForPopup(fullMeal)
              setExpandedMealCommentsId(fullMeal.id)
            }}
          />
        </div>
      )}
      </div>

      {/* 달력에서 예약 클릭 시: 따뜻한 배경 위에 떠 있는 단일 카드 팝업 모달 */}
      {selectedReservationForPopup && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedReservationForPopup(null)}
        >
          <div 
            className="w-full max-w-lg bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] p-3.5 sm:p-4 rounded-[28px] sm:rounded-[32px] shadow-2xl border border-white/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 팝업 헤더 */}
            <div className="flex items-center justify-between px-2 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
                <Calendar className="size-4 text-orange-500" />
                <span>식사 예약 상세</span>
              </div>
              <button
                onClick={() => setSelectedReservationForPopup(null)}
                className="size-7.5 flex items-center justify-center rounded-full bg-white/90 shadow-xs border border-gray-200/80 text-gray-600 hover:text-foreground hover:bg-white transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 카드 컨테이너 (배경 위에 깔끔하게 떠 있는 카드) */}
            <div className="flex-1 overflow-y-auto rounded-2xl sm:rounded-3xl shadow-sm">
              {(() => {
                const liveItem = familyReservations.find(r => r.id === selectedReservationForPopup.id) 
                  || wishlistItems.find(w => w.id === selectedReservationForPopup.id) 
                  || selectedReservationForPopup
                return renderCard(liveItem, !liveItem.date, true, () => setSelectedReservationForPopup(null))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 달력에서 먹로그 클릭 시: 따뜻한 배경 위에 떠 있는 먹로그 카드 팝업 모달 */}
      {selectedLogMealForPopup && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedLogMealForPopup(null)}
        >
          <div 
            className="w-full max-w-lg bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] p-3.5 sm:p-4 rounded-[28px] sm:rounded-[32px] shadow-2xl border border-white/80 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 팝업 헤더 */}
            <div className="flex items-center justify-between px-2 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
                <Utensils className="size-4 text-orange-500" />
                <span>공유 먹로그 상세</span>
              </div>
              <button
                onClick={() => setSelectedLogMealForPopup(null)}
                className="size-7.5 flex items-center justify-center rounded-full bg-white/90 shadow-xs border border-gray-200/80 text-gray-600 hover:text-foreground hover:bg-white transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 카드 컨테이너 */}
            <div className="flex-1 overflow-y-auto rounded-2xl sm:rounded-3xl shadow-sm">
              {(() => {
                const liveMeal = [...activeDefaultMeals, ...meals].find(m => m.id === selectedLogMealForPopup.id) || selectedLogMealForPopup
                return renderMealCard(liveMeal, true, () => setSelectedLogMealForPopup(null))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* AddReservationModal - 위시리스트 및 예약 추가/수정 */}
      {isAddReservationOpen && (
        <AddReservationModal
          isOpen={isAddReservationOpen}
          isGroupMode={activeMode === "group"}
          contextName={
            activeMode === "group" 
              ? (groups.find(g => g.id === selectedGroupId)?.name || "모임") 
              : (!isLoggedIn || !user 
                  ? "게스트 가족" 
                  : isFamilyOwner 
                    ? `${user?.nickname && user.nickname !== '회원' ? user.nickname : '우리'} 가족` 
                    : `${familyHostName || '가족'} 가족`)
          }
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
          editData={editingPlan && editingPlan.id ? editingPlan : null}
          isWishlist={!editingPlan?.isWishlistToSchedule && (editingPlan?.isWishlist === true || !editingPlan?.date)}
          isScheduling={!!editingPlan?.isWishlistToSchedule}
          isGroupMode={activeMode === "group"}
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
                            hubToken = getSessionToken() || ''

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
                      toast("가족 5점 평가 달성! '맛톡' 피드로 등록되었습니다. 🌟", { icon: "🎉" })
                      setSelectedMealId(null) // 팝업 닫기
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent("navigateToTalk"))
                      }, 1500) // 1.5초 후 이동
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
      {/* Add / Edit Meal Log Modal */}
      <AddLogModal
        isOpen={addModalOpen || editModalOpen}
        isGroupMode={activeMode === "group"}
        onClose={() => {
          setAddModalOpen(false)
          setEditModalOpen(false)
          setEditingMeal(null)
        }}
        editData={editingMeal}
        onSave={editingMeal ? handleEditMealSave : handleAddMealSave}
        onDelete={editingMeal && editingMeal.id ? () => handleDeleteMealClick(editingMeal.id!) : undefined}
        mode="family"
        registeredDeliveryStores={registeredDeliveryStores}
      />
    </div>
  )
}
