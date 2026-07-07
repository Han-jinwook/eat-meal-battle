"use client"

import { useEffect, useState, useRef } from "react"
import { 
  MapPin, 
  Star,
  Heart,
  MessageCircle,
  ChevronDown,
  UserPlus,
  UserCheck,
  Search,
  ArrowUpDown,
  X,
  Send,
  ExternalLink,
  Pin,
  Pencil,
  Trash2
} from "lucide-react"
import { cn, formatPlaceNameWithRegion } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { secureWrite } from "@/lib/supabase-safe"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { toast } from "react-hot-toast"
import { ImageViewer } from "@/components/whateat/image-viewer"

// 타입 정의
interface TalkPost {
  id: number | string
  type: "homemade" | "delivery" | "dineout"
  // 등록 출처: 솔로 / 가족 / 모임
  source: "solo" | "family" | "group"
  title: string
  image: string
  description: string
  region: {
    dong: string
    gu: string
    city: string
  }
  // 외식/배달인 경우 상점 정보
  restaurant?: {
    name: string
    address: string
  }
  author: {
    id: number | string
    nickname: string
    avatar: string
    region: string
  }
  createdAt: string
  // 별점 시스템 (평균 + 참여자 수)
  rating: {
    average: number
    count: number
  }
  likes: number
  isLiked: boolean
  commentCount: number
  // 집밥만 구독 가능
  isSubscribed?: boolean
  isSample?: boolean
  isExplicit?: boolean
  linkUrl?: string
  linkThumbnail?: string
}

interface Comment {
  id: number
  author: {
    nickname: string
    avatar: string
    region: string
  }
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
}

// 더미 데이터
const dummyPosts: TalkPost[] = [
  {
    id: 1,
    type: "dineout",
    source: "group",
    title: "청라 찐 맛집 [인생 소갈비살] 육즙 폭발 숯불구이 🥩",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&fit=crop",
    description: "웨이팅이 전혀 아깝지 않은 인생 갈비살 맛집이에요! 참숯 향이 고기에 그대로 배어 있어서 소금만 콕 찍어 먹어도 감칠맛이 폭발합니다. 육즙이 뚝뚝 떨어지는 극강의 부드러움.. 가족 모임 장소로 강력 추천해요! 💯",
    region: { dong: "청라동", gu: "서구", city: "인천광역시" },
    restaurant: { name: "인생 갈비살 청라점", address: "인천 서구 청라라임로 85" },
    author: { id: 101, nickname: "청라동 멀린님", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face", region: "청라동" },
    createdAt: "방금 전",
    rating: { average: 4.9, count: 18 },
    likes: 12,
    isLiked: false,
    commentCount: 2,
    isSubscribed: false,
    linkUrl: "https://map.naver.com",
    linkThumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&fit=crop"
  },
  {
    id: 2,
    type: "homemade",
    source: "solo",
    title: "에어프라이어로 뚝딱! 마늘 통삼겹 겉바속촉 오븐구이 🥓",
    image: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&fit=crop",
    description: "에어프라이어 180도에서 20분 뒤집어서 15분 구웠더니 겉은 과자처럼 바삭하고 속은 육즙 가득 촉촉하게 구워졌어요. 통마늘이랑 아스파라거스도 같이 구워 쌈장에 찍어 먹으면 밥 한 공기 뚝딱입니다! 초간단 영양 만점 메뉴 😋",
    region: { dong: "논현동", gu: "강남구", city: "서울특별시" },
    author: { id: 102, nickname: "집밥 백선생", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face", region: "논현동" },
    createdAt: "30분 전",
    rating: { average: 5.0, count: 22 },
    likes: 24,
    isLiked: false,
    commentCount: 2,
    isSubscribed: false,
    linkUrl: "https://www.10000recipe.com",
    linkThumbnail: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=100&fit=crop"
  },
  {
    id: 3,
    type: "delivery",
    source: "family",
    title: "꾸덕함의 끝판왕! 매콤 투움바 떡볶이 & 바삭 크리스피 치킨 세트 🍗",
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&fit=crop",
    description: "오늘 야식은 투움바 로제 떡볶이에 크리스피 순살 치킨입니다! 꾸덕하고 매콤한 소스에 바삭한 치킨을 푹 찍어 먹으면 스트레스가 다 날아가요. 넙적당면이랑 치즈 핫도그 토핑 추가는 선택이 아닌 필수입니다.. 강력 추천! 👍",
    region: { dong: "송도동", gu: "연수구", city: "인천광역시" },
    restaurant: { name: "삼첩분식 송도점", address: "인천 연수구 송도동 23-4" },
    author: { id: 103, nickname: "송도 배달요정", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop&crop=face", region: "송도동" },
    createdAt: "2시간 전",
    rating: { average: 4.8, count: 14 },
    likes: 15,
    isLiked: false,
    commentCount: 2,
    isSubscribed: false,
    linkUrl: "https://map.naver.com",
    linkThumbnail: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=100&fit=crop"
  }
]

const dummyComments: Record<string | number, Comment[]> = {
  1: [
    {
      id: 11,
      author: { nickname: "고기러버", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=50&h=50&fit=crop&crop=face", region: "청라동" },
      content: "와.. 고기 윤기 흐르는 거 대박이네요. 오늘 저녁 여기로 결정합니다!",
      createdAt: "방금 전",
      likes: 3,
      isLiked: false
    },
    {
      id: 12,
      author: { nickname: "동네주민", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop&crop=face", region: "청라동" },
      content: "여기 된장찌개도 예술이에요! 꼭 밥 말아서 된장술밥으로 드셔보세요.",
      createdAt: "10분 전",
      likes: 2,
      isLiked: false
    }
  ],
  2: [
    {
      id: 21,
      author: { nickname: "요리초보", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=50&h=50&fit=crop&crop=face", region: "서초동" },
      content: "에어프라이어 온도 정보 완전 꿀팁이네요! 오늘 밤에 바로 도전해볼게요.",
      createdAt: "20분 전",
      likes: 1,
      isLiked: false
    },
    {
      id: 22,
      author: { nickname: "다이어터", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face", region: "논현동" },
      content: "삼겹살에 구운 마늘 조합은 참을 수 없죠.. 정말 잘 구우셨네요 👍",
      createdAt: "25분 전",
      likes: 1,
      isLiked: false
    }
  ],
  3: [
    {
      id: 31,
      author: { nickname: "배달매니아", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=50&h=50&fit=crop&crop=face", region: "송도동" },
      content: "투움바 로제 떡볶이에 소스 가득 묻힌 순살 치킨.. 역시 먹잘알이십니다!",
      createdAt: "1시간 전",
      likes: 2,
      isLiked: false
    },
    {
      id: 32,
      author: { nickname: "야식유혹", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=50&h=50&fit=crop&crop=face", region: "송도동" },
      content: "이 글 보고 결국 배달앱 켰습니다.. 책임지세요 ㅠㅠ ㅋㅋ",
      createdAt: "1.5시간 전",
      likes: 4,
      isLiked: false
    }
  ],
  4: [
    {
      id: 41,
      author: { nickname: "달달구리", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop&crop=face", region: "대치동" },
      content: "우유 얼음이라 부드럽고 쌉싸름해서 물리지 않고 먹기 정말 좋겠어요!",
      createdAt: "4시간 전",
      likes: 1,
      isLiked: false
    },
    {
      id: 42,
      author: { nickname: "녹차덕후", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face", region: "역삼동" },
      content: "강남역 삼겹살 먹고 후식으로 무조건 들르는 녹차빙수 성지죠~ 완전 공감!",
      createdAt: "4.5시간 전",
      likes: 2,
      isLiked: false
    }
  ],
  5: [
    {
      id: 51,
      author: { nickname: "이웃사촌", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=50&h=50&fit=crop&crop=face", region: "청라동" },
      content: "와 튀김옷 두께랑 바삭함이 눈으로도 느껴지네요. 비법 소스 알고 싶어요!",
      createdAt: "5시간 전",
      likes: 3,
      isLiked: false
    },
    {
      id: 52,
      author: { nickname: "집밥매니아", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop&crop=face", region: "청라동" },
      content: "역시 사 먹는 것보다 직접 정성 들여 만든 수제 돈까스가 최고죠!",
      createdAt: "5.5시간 전",
      likes: 2,
      isLiked: false
    }
  ],
  6: [
    {
      id: 61,
      author: { nickname: "동네주민", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=50&h=50&fit=crop&crop=face", region: "청라동" },
      content: "여기 새로 오픈한 거기군요! 핫소스 잔뜩 뿌려 먹으면 진짜 맛있겠어요.",
      createdAt: "6시간 전",
      likes: 1,
      isLiked: false
    },
    {
      id: 62,
      author: { nickname: "피자러버", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face", region: "청라동" },
      content: "맥주 안주로 피자라니 완전 대찬성입니다! 오늘 야식 메뉴는 피맥이네요 🍕🍺",
      createdAt: "6.5시간 전",
      likes: 3,
      isLiked: false
    }
  ]
}

// 카테고리 옵션
const categoryOptions = [
  { id: "all", label: "전체" },
  { id: "homemade", label: "집밥" },
  { id: "delivery", label: "배달" },
  { id: "dineout", label: "외식" },
]

function parseRegionFromAddress(address: string, defaultCity = "인천", defaultGu = "서구", defaultDong = "청라동") {
  if (!address) return { city: defaultCity, gu: defaultGu, dong: defaultDong }
  const parts = address.split(/\s+/)
  let city = defaultCity
  let gu = defaultGu
  let dong = defaultDong

  if (parts.length > 0) {
    const p0 = parts[0]
    if (p0.endsWith("시") || p0.endsWith("도")) {
      city = p0.substring(0, 2)
    } else {
      city = p0
    }
  }
  if (parts.length > 1) {
    const p1 = parts[1]
    if (p1.endsWith("구") || p1.endsWith("군")) {
      gu = p1
    }
  }
  for (const part of parts) {
    if (part.endsWith("동") || part.endsWith("읍") || part.endsWith("면")) {
      dong = part
      break
    }
  }

  return { city, gu, dong }
}

export function TalkPage({ isActive }: { isActive?: boolean }) {
  const { isLoggedIn, user } = useHub()
  const PAGE_SIZE = 12
  const [posts, setPosts] = useState<TalkPost[]>(() => dummyPosts.map(p => ({ ...p, isSample: true })))
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest")
  const [userRegion, setUserRegion] = useState<string>("청라동") // 사용자 기본 지역
  const [viewerImage, setViewerImage] = useState<string | null>(null) // 이미지 뷰어 상태 추가
  const [userAddressState, setUserAddressState] = useState<{
    city: string
    gu: string
    dong: string
  }>({
    city: "인천",
    gu: "서구",
    dong: "청라동"
  })
  const [scopeFilter, setScopeFilter] = useState<string>("all") // 범위: dong/gu/city/all
  const [searchRegion, setSearchRegion] = useState<string>("") // 검색 지역
  const [showScopeDropdown, setShowScopeDropdown] = useState(false)
  const [showRegionSearch, setShowRegionSearch] = useState(false)
  const [showOnlyNew, setShowOnlyNew] = useState(false) // 전체(All)를 디폴트로 설정하기 위해 기존 true에서 false로 변경
  const [showOnlyLiked, setShowOnlyLiked] = useState(false)
  const [showOnlySubscribed, setShowOnlySubscribed] = useState(false)
  const [expandedComments, setExpandedComments] = useState<string | number | null>(null)
  const [commentsTrigger, setCommentsTrigger] = useState(0)
  const [postComments, setPostComments] = useState<Record<string | number, any[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string | number, string>>({})
  const likesChannelRef = useRef<any>(null)
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ mealId: any; commentId: string } | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | number | null>(null)
  const [editCommentText, setEditCommentText] = useState("")
  const [editingReplyId, setEditingReplyId] = useState<string | number | null>(null)
  const [editReplyText, setEditReplyText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [saveDropdownPostId, setSaveDropdownPostId] = useState<string | number | null>(null)

  // 맛톡 담기: 좋아요 자동 처리 + WhatEatApp으로 이벤트 발신
  const handleSaveToReservation = (post: TalkPost, target: "solo" | "family") => {
    // 1. 좋아요 자동 처리 (아직 누르지 않은 경우)
    if (!post.isLiked) {
      setPosts(prev => prev.map(p =>
        p.id === post.id
          ? { ...p, isLiked: true, likes: p.likes + 1 }
          : p
      ))
    }
    // 2. 담기 드롭다운 닫기
    setSaveDropdownPostId(null)

    // 3. 식사유형 매핑
    const mealTypeMap: Record<string, "집밥" | "배달" | "외식"> = {
      homemade: "집밥",
      delivery: "배달",
      dineout: "외식",
    }
    const mealType = mealTypeMap[post.type] ?? "외식"

    // 4. WhatEatApp으로 이벤트 발신
    window.dispatchEvent(new CustomEvent("openReservationFromTalk", {
      detail: {
        target,
        menuName: post.title,
        mealType,
        placeName: post.restaurant?.name ?? "",
      }
    }))
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

  // 댓글창이 확장될 때 실시간 댓글 및 대댓글 로드
  useEffect(() => {
    if (!expandedComments) return

    const fetchCommentsForPost = async () => {
      // 샘플 포스트(숫자 ID 1, 2, 3)인 경우 더미 댓글 사용
      if (typeof expandedComments === "number" && expandedComments <= 3) {
        setPostComments(prev => ({
          ...prev,
          [expandedComments]: dummyComments[expandedComments] || []
        }))
        return
      }

      try {
        const supabase = createClient()
        // 1. comments 조회
        const { data: commentsData } = await supabase
          .from("comments")
          .select("*")
          .eq("meal_id", expandedComments)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true })

        const dbComments = commentsData || []

        // 2. 대댓글 조회
        const commentIds = dbComments.map(c => c.id)
        let dbReplies: any[] = []
        if (commentIds.length > 0) {
          const { data: repliesData } = await supabase
            .from("comment_replies")
            .select("*")
            .in("comment_id", commentIds)
            .eq("is_deleted", false)
            .order("created_at", { ascending: true })
          dbReplies = repliesData || []
        }

        // 3. 유저 프로필 조회
        const uids = Array.from(new Set([
          ...dbComments.map(c => c.user_id),
          ...dbReplies.map(r => r.user_id)
        ].filter(Boolean)))

        let dbUsers: any[] = []
        if (uids.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, nickname, profile_image, region")
            .in("id", uids)
          dbUsers = usersData || []
        }
        const userMap = new Map(dbUsers.map(u => [u.id, u]))

        // Map replies by comment_id
        const repliesMap = new Map<string, any[]>()
        dbReplies.forEach(r => {
          const arr = repliesMap.get(r.comment_id) || []
          const rUser = userMap.get(r.user_id)
          let parsedDong = "동네"
          if (rUser?.region) {
            try {
              const regionParsed = JSON.parse(rUser.region)
              parsedDong = regionParsed.dong || "동네"
            } catch (e) {
              parsedDong = rUser.region
            }
          }
          arr.push({
            id: r.id,
            userId: r.user_id,
            author: {
              nickname: rUser?.nickname || "익명 회원",
              avatar: rUser?.profile_image || "",
              region: parsedDong
            },
            content: r.content,
            createdAt: new Date(r.created_at).toLocaleDateString("ko-KR"),
            likes: 0,
            isLiked: false
          })
          repliesMap.set(r.comment_id, arr)
        })

        // Map comments
        const mappedComments = dbComments.map(c => {
          const cUser = userMap.get(c.user_id)
          let parsedDong = "동네"
          if (cUser?.region) {
            try {
              const regionParsed = JSON.parse(cUser.region)
              parsedDong = regionParsed.dong || "동네"
            } catch (e) {
              parsedDong = cUser.region
            }
          }
          return {
            id: c.id,
            userId: c.user_id,
            author: {
              nickname: cUser?.nickname || "익명 회원",
              avatar: cUser?.profile_image || "",
              region: parsedDong
            },
            content: c.content,
            createdAt: new Date(c.created_at).toLocaleDateString("ko-KR"),
            likes: 0,
            isLiked: false,
            replies: repliesMap.get(c.id) || []
          }
        })

        setPostComments(prev => ({
          ...prev,
          [expandedComments]: mappedComments
        }))

      } catch (err) {
        console.error("Failed to fetch comments for post:", err)
      }
    }

    fetchCommentsForPost()
  }, [expandedComments, commentsTrigger])

  // 실시간 연동 (1) 좋아요: Broadcast를 사용하여 DB REPLICA IDENTITY 버그 우회
  useEffect(() => {
    const supabase = createClient()
    const channelName = 'public:meal_likes_broadcast'

    const likesChannel = supabase.channel(channelName)
    likesChannelRef.current = likesChannel

    likesChannel
      .on('broadcast', { event: 'LIKE' }, (payload) => {
        const { meal_id, user_id } = payload.payload
        if (user?.id && user_id === user.id) return // 본인 좋아요는 optimistic update로 반영됨
        
        setPosts(prevPosts => prevPosts.map(p => 
          p.id === meal_id ? { ...p, likes: p.likes + 1 } : p
        ))
      })
      .on('broadcast', { event: 'UNLIKE' }, (payload) => {
        const { meal_id, user_id } = payload.payload
        if (user?.id && user_id === user.id) return // 본인 취소는 optimistic update로 반영됨
        
        setPosts(prevPosts => prevPosts.map(p => 
          p.id === meal_id ? { ...p, likes: Math.max(0, p.likes - 1) } : p
        ))
      })
      .subscribe((status, err) => {
        if (err) console.error('[Realtime:meal_likes_broadcast] Error:', err)
      })

    return () => {
      supabase.removeChannel(likesChannel)
    }
  }, [user?.id])

  // 실시간 연동 (2) 댓글/대댓글: expandedComments가 바뀌었을 때만 재구독
  useEffect(() => {
    const supabase = createClient()
    const ts = Date.now()

    // 댓글 개수 실시간 갱신 공통 함수
    const refreshCommentCount = async (mealId: string) => {
      try {
        const { data: commentsData } = await supabase
          .from("comments")
          .select("id")
          .eq("meal_id", mealId)
          .eq("is_deleted", false)
        const dbComments = commentsData || []
        const commentIds = dbComments.map(c => c.id)
        let count = dbComments.length

        if (commentIds.length > 0) {
          const { count: repliesCount } = await supabase
            .from("comment_replies")
            .select("id", { count: 'exact', head: true })
            .in("comment_id", commentIds)
            .eq("is_deleted", false)
          count += (repliesCount || 0)
        }

        setPosts(prev => prev.map(p =>
          p.id === mealId ? { ...p, commentCount: count } : p
        ))
      } catch (err) {
        console.error("Failed to refresh comment count:", err)
      }
    }

    const commentsChannel = supabase
      .channel(`realtime:comments:${ts}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        async (payload) => {
          const targetMealId = payload.new?.meal_id || payload.old?.meal_id
          if (!targetMealId) return

          refreshCommentCount(targetMealId)

          if (expandedComments === targetMealId) {
            setCommentsTrigger(prev => prev + 1)
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error('[Realtime:comments] Error:', err)
      })

    const repliesChannel = supabase
      .channel(`realtime:comment_replies:${ts}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_replies' },
        async (payload) => {
          const commentId = payload.new?.comment_id || payload.old?.comment_id
          if (!commentId) return

          const { data } = await supabase
            .from("comments")
            .select("meal_id")
            .eq("id", commentId)
            .single()

          if (data?.meal_id) {
            refreshCommentCount(data.meal_id)

            if (expandedComments === data.meal_id) {
              setCommentsTrigger(prev => prev + 1)
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error('[Realtime:comment_replies] Error:', err)
      })

    return () => {
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(repliesChannel)
    }
  }, [expandedComments, user?.id])

  // 댓글 등록 처리 함수
  const handleAddComment = async (postId: string | number) => {
    const inputVal = commentInputs[postId]?.trim()
    if (!inputVal) return

    if (typeof postId === "number" && postId <= 3) {
      const newComment = {
        id: Date.now(),
        author: {
          nickname: user?.nickname || "나",
          avatar: user?.profile_image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
          region: "내 동네"
        },
        content: inputVal,
        createdAt: "방금 전",
        likes: 0,
        isLiked: false,
        replies: []
      }
      setPostComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }))
      setCommentInputs(prev => ({ ...prev, [postId]: "" }))
      return
    }

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const newCommentId = generateUUID()
      await secureWrite({
        table: "comments",
        action: "insert",
        data: {
          id: newCommentId,
          meal_id: postId,
          user_id: user.id,
          content: inputVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        }
      })

      const newComment = {
        id: newCommentId,
        userId: user.id,
        author: {
          nickname: user.nickname || "나",
          avatar: user.profile_image || "",
          region: "내 동네"
        },
        content: inputVal,
        createdAt: new Date().toLocaleDateString("ko-KR"),
        likes: 0,
        isLiked: false,
        replies: []
      }

      setPostComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }))
      setCommentInputs(prev => ({ ...prev, [postId]: "" }))
      
      // 상위 포스트 목록의 댓글 수 업데이트
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p))
    } catch (err) {
      console.error("Failed to insert comment:", err)
      toast.error("댓글 등록에 실패했습니다.")
    }
  }

  // 대댓글(답글) 등록 처리 함수
  const handleAddReply = async (postId: string | number, commentId: string) => {
    const inputVal = replyInputs[commentId]?.trim()
    if (!inputVal) return

    if (typeof postId === "number" && postId <= 3) {
      const newReply = {
        id: Date.now(),
        author: {
          nickname: user?.nickname || "나",
          avatar: user?.profile_image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
          region: "내 동네"
        },
        content: inputVal,
        createdAt: "방금 전",
        likes: 0,
        isLiked: false
      }
      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c: any) => {
          if (c.id === commentId) {
            return {
              ...c,
              replies: [...(c.replies || []), newReply]
            }
          }
          return c
        })
      }))
      setReplyInputs(prev => ({ ...prev, [commentId]: "" }))
      setActiveReplyTarget(null)
      return
    }

    if (!isLoggedIn || !user?.id) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    try {
      const newReplyId = generateUUID()
      await secureWrite({
        table: "comment_replies",
        action: "insert",
        data: {
          id: newReplyId,
          comment_id: commentId,
          user_id: user.id,
          content: inputVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        }
      })

      const newReply = {
        id: newReplyId,
        userId: user.id,
        author: {
          nickname: user.nickname || "나",
          avatar: user.profile_image || "",
          region: "내 동네"
        },
        content: inputVal,
        createdAt: new Date().toLocaleDateString("ko-KR"),
        likes: 0,
        isLiked: false
      }

      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c: any) => {
          if (c.id === commentId) {
            return {
              ...c,
              replies: [...(c.replies || []), newReply]
            }
          }
          return c
        })
      }))
      setReplyInputs(prev => ({ ...prev, [commentId]: "" }))
      setActiveReplyTarget(null)
    } catch (err) {
      console.error("Failed to insert reply:", err)
      toast.error("답글 등록에 실패했습니다.")
    }
  }

  const handleEditComment = (commentId: string | number, currentContent: string) => {
    setEditingCommentId(commentId)
    setEditCommentText(currentContent)
  }

  const handleUpdateComment = async (postId: string | number, commentId: string | number) => {
    const trimmed = editCommentText.trim()
    if (!trimmed) return

    try {
      if (typeof commentId !== "number") {
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

      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c: any) =>
          c.id === commentId ? { ...c, content: trimmed } : c
        )
      }))

      setEditingCommentId(null)
      setEditCommentText("")
    } catch (err) {
      console.error("Failed to update comment:", err)
      toast.error("댓글 수정에 실패했습니다.")
    }
  }

  const handleDeleteComment = async (postId: string | number, commentId: string | number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return

    try {
      if (typeof commentId !== "number") {
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

      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c: any) => c.id !== commentId)
      }))

      // 상위 포스트 목록의 댓글 수 업데이트
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p))
      toast.success("댓글이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete comment:", err)
      toast.error("댓글 삭제에 실패했습니다.")
    }
  }

  const handleEditReply = (replyId: string | number, currentContent: string) => {
    setEditingReplyId(replyId)
    setEditReplyText(currentContent)
  }

  const handleUpdateReply = async (postId: string | number, commentId: string | number, replyId: string | number) => {
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

      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c: any) => {
          if (c.id === commentId) {
            return {
              ...c,
              replies: (c.replies || []).map((r: any) =>
                r.id === replyId ? { ...r, content: trimmed } : r
              )
            }
          }
          return c
        })
      }))

      setEditingReplyId(null)
      setEditReplyText("")
    } catch (err) {
      console.error("Failed to update reply:", err)
      toast.error("답글 수정에 실패했습니다.")
    }
  }

  const handleDeleteReply = async (postId: string | number, commentId: string | number, replyId: string | number) => {
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

      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c: any) => {
          if (c.id === commentId) {
            return {
              ...c,
              replies: (c.replies || []).filter((r: any) => r.id !== replyId)
            }
          }
          return c
        })
      }))

      // 상위 포스트 목록의 댓글 수 업데이트
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p))
      toast.success("답글이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete reply:", err)
      toast.error("답글 삭제에 실패했습니다.")
    }
  }


  // Fetch user region dynamically from users
  useEffect(() => {
    if (isLoggedIn && user?.id) {
      const fetchUserRegion = async () => {
        try {
          const supabase = createClient()
          const { data: userData } = await supabase
            .from("users")
            .select("region")
            .eq("id", user.id)
            .single()
          
          if (userData && userData.region) {
            try {
              const parsed = JSON.parse(userData.region)
              if (parsed.dong) {
                setUserRegion(parsed.dong)
                setUserAddressState({
                  city: parsed.city || "인천",
                  gu: parsed.gu || "서구",
                  dong: parsed.dong
                })
              }
            } catch (e) {
              setUserRegion(userData.region)
              setUserAddressState({
                city: "인천",
                gu: "서구",
                dong: userData.region
              })
            }
          }
        } catch (err) {
          console.warn("Failed to fetch user region from users", err)
        }
      }
      fetchUserRegion()
    }
  }, [isLoggedIn, user?.id])

  // Load real posts from Supabase and merge with dummy samples
  useEffect(() => {
    const fetchDbPosts = async () => {
      try {
        const supabase = createClient()
        const { data: imgData, error: imgError } = await supabase
          .from("meal_images")
          .select("*")
          .eq("status", "approved")
          .order("created_at", { ascending: false })

        if (imgError) throw imgError

        if (!imgData || imgData.length === 0) {
          // If no database posts, ensure we show all default samples
          setPosts(dummyPosts.map(p => ({ ...p, isSample: true })))
          return
        }

        const uploaderIds = Array.from(new Set(imgData.map(img => img.uploaded_by).filter(Boolean)))
        const mealIds = imgData.map(img => img.meal_id).filter(Boolean)
        
        // Fetch users (region 컬럼 포함)
        let dbUsers: any[] = []
        if (uploaderIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, nickname, profile_image, region")
            .in("id", uploaderIds)
          dbUsers = usersData || []
        }
        const userMap = new Map(dbUsers.map(u => [u.id, u]))

        // Fetch all ratings for these meals to display real-time accumulated rating
        let dbRatings: any[] = []
        if (mealIds.length > 0) {
          const { data: ratingsData } = await supabase
            .from("meal_ratings")
            .select("meal_id, rating")
            .in("meal_id", mealIds)
          dbRatings = ratingsData || []
        }

        // Aggregate ratings by meal_id
        const mealRatingStatsMap = new Map<string, { sum: number; count: number }>()
        dbRatings.forEach((rt) => {
          const mId = rt.meal_id
          const current = mealRatingStatsMap.get(mId) || { sum: 0, count: 0 }
          mealRatingStatsMap.set(mId, {
            sum: current.sum + rt.rating,
            count: current.count + 1
          })
        })

        const getRatingStats = (mId: string) => {
          const stats = mealRatingStatsMap.get(mId)
          if (!stats || stats.count === 0) {
            return { average: 5, count: 1 }
          }
          return {
            average: Math.round((stats.sum / stats.count) * 10) / 10,
            count: stats.count
          }
        }

        // Fetch meal likes count and whether current user liked it
        const mealLikesCountMap = new Map<string, number>()
        const userLikedMealSet = new Set<string>()
        const postIds = imgData.map((img: any) => img.id)

        if (postIds.length > 0) {
          const { data: likesData } = await supabase
            .from("meal_likes")
            .select("meal_id, user_id")
            .in("meal_id", postIds)

          const dbLikes = likesData || []
          dbLikes.forEach((lk: any) => {
            mealLikesCountMap.set(lk.meal_id, (mealLikesCountMap.get(lk.meal_id) || 0) + 1)
            if (isLoggedIn && user?.id && lk.user_id === user.id) {
              userLikedMealSet.add(lk.meal_id)
            }
          })
        }

        // Fetch comment counts (comments + replies)
        const commentCountMap = new Map<string, number>()
        if (postIds.length > 0) {
          const { data: commentsData } = await supabase
            .from("comments")
            .select("id, meal_id")
            .in("meal_id", postIds)
            .eq("is_deleted", false)
          
          const dbComments = commentsData || []
          const commentIds = dbComments.map(c => c.id)
          
          dbComments.forEach(c => {
            commentCountMap.set(c.meal_id, (commentCountMap.get(c.meal_id) || 0) + 1)
          })
          
          if (commentIds.length > 0) {
            const { data: repliesData } = await supabase
              .from("comment_replies")
              .select("comment_id")
              .in("comment_id", commentIds)
              .eq("is_deleted", false)
            
            const dbReplies = repliesData || []
            const commentToPostMap = new Map<string, string>()
            dbComments.forEach(c => {
              commentToPostMap.set(c.id, c.meal_id)
            })
            
            dbReplies.forEach(r => {
              const postId = commentToPostMap.get(r.comment_id)
              if (postId) {
                commentCountMap.set(postId, (commentCountMap.get(postId) || 0) + 1)
              }
            })
          }
        }

        const parsedPosts: TalkPost[] = imgData.map((img: any) => {
          let meta: any = {}
          try {
            meta = img.explanation ? JSON.parse(img.explanation) : {}
          } catch (e) {
            meta = { title: img.explanation || "식사" }
          }

          const u = userMap.get(img.uploaded_by)

          let parsedCity = "인천"
          let parsedGu = "서구"
          let parsedDong = "청라동"

          if (u && u.region) {
            try {
              const r = JSON.parse(u.region)
              parsedCity = r.city || "인천"
              parsedGu = r.gu || "서구"
              parsedDong = r.dong || "청라동"
            } catch (e) {
              parsedDong = u.region
            }
          }

          const rawType = img.meal_type || meta.mealType || ""
          let mappedType: "homemade" | "delivery" | "dineout" = "homemade"
          let isExplicit = false
          if (rawType === "집밥" || rawType === "homemade") {
            mappedType = "homemade"
            isExplicit = true
          } else if (rawType === "배달" || rawType === "delivery") {
            mappedType = "delivery"
            isExplicit = true
          } else if (rawType === "외식" || rawType === "dineout") {
            mappedType = "dineout"
            isExplicit = true
          }
          
          if ((mappedType === "dineout" || mappedType === "delivery") && meta.placeAddress) {
            const parts = meta.placeAddress.split(" ")
            if (parts.length >= 3) {
              let cityStr = parts[0]
              if (cityStr.length > 2 && (cityStr.endsWith("시") || cityStr.endsWith("도") || cityStr.endsWith("특별시") || cityStr.endsWith("광역시"))) {
                cityStr = cityStr.substring(0, 2)
              } else if (cityStr.length === 4 && cityStr.endsWith("특도")) {
                cityStr = "제주"
              }
              parsedCity = cityStr
              parsedGu = parts[1]
              parsedDong = parts.find((p: string) => p.match(/\d*(동|읍|면)$/)) || parts[2]
            }
          }

          const rawSource = img.source || ""
          let mappedSource: "solo" | "family" | "group" = "solo"
          if (rawSource === "family-shared") {
            mappedSource = "family"
          } else if (rawSource === "group") {
            mappedSource = "group"
          }

          // 솔로는 항상 5점 고정(박제), 가족/모임은 DB 누계 통계 활용 (디폴트 1명)
          const finalRating = mappedSource === "solo"
            ? { average: 5, count: 1 }
            : (img.meal_id ? getRatingStats(img.meal_id) : { average: 5, count: 1 })

          return {
            id: img.id,
            type: mappedType,
            source: mappedSource,
            title: meta.title || "맛있는 식사",
            image: img.image_url || "/images/placeholder-food.jpg",
            description: meta.description || meta.recipe || img.explanation || "별점 5점 식사 기록입니다. 😋",
            region: {
              dong: parsedDong,
              gu: parsedGu,
              city: parsedCity
            },
            restaurant: (mappedType === "dineout" || mappedType === "delivery") ? {
              name: meta.placeName || "맛집",
              address: meta.placeAddress || ""
            } : undefined,
            author: {
              id: img.uploaded_by,
              nickname: meta.familyName || u?.nickname || "익명 회원",
              avatar: u?.profile_image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
              region: parsedDong
            },
            createdAt: meta.promotedAt || img.created_at,
            rating: finalRating,
            likes: mealLikesCountMap.get(img.id) || 0,
            isLiked: userLikedMealSet.has(img.id),
            commentCount: commentCountMap.get(img.id) || 0,
            isSubscribed: false,
            isSample: false,
            isExplicit,
            linkUrl: meta.linkUrl || "",
            linkThumbnail: meta.linkThumbnail || ""
          }
        })

        // 진짜 포스트의 타입(집밥, 배달, 외식)이 존재하면 해당 타입의 샘플만 글로벌 노출 해제
        const hasRealHomemade = parsedPosts.some(p => p.type === 'homemade');
        const hasRealDelivery = parsedPosts.some(p => p.type === 'delivery');
        const hasRealDineout = parsedPosts.some(p => p.type === 'dineout');

        const activeSamples = dummyPosts
          .map(p => ({ ...p, isSample: true }))
          .filter(sample => {
            if (sample.type === 'homemade' && hasRealHomemade) return false;
            if (sample.type === 'delivery' && hasRealDelivery) return false;
            if (sample.type === 'dineout' && hasRealDineout) return false;
            return true;
          });

        setPosts([...parsedPosts, ...activeSamples])
      } catch (err) {
        console.error("Failed to fetch posts from Supabase", err)
      }
    }

    if (isActive !== false) {
      fetchDbPosts()
    }
  }, [isActive, isLoggedIn, user?.id])

  const userAddress = {
    dong: userAddressState.dong,
    gu: userAddressState.gu,
    city: userAddressState.city,
  }
  const hasProfileAddress = Boolean(userAddress.dong && userAddress.gu && userAddress.city)
  const regionScopeOptions = hasProfileAddress
    ? [
        { id: "dong", label: userAddress.dong },
        { id: "gu", label: userAddress.gu },
        { id: "city", label: userAddress.city },
        { id: "all", label: "전국" },
      ]
    : [{ id: "all", label: "전국" }]

  const getDropdownButtonLabel = () => {
    if (searchRegion) {
      return searchRegion
    }
    return regionScopeOptions.find((s) => s.id === scopeFilter)?.label || "전국"
  }

  // 좋아요 토글
  const toggleLike = async (postId: number | string) => {
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent('openLoginModal'))
      return
    }

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const wasLiked = post.isLiked
    
    // 1. UI 상태 즉각 업데이트 (Optimistic Update)
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { ...p, isLiked: !wasLiked, likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1 }
        : p
    ))

    try {
      if (wasLiked) {
        // 좋아요 해제 (DELETE)
        await secureWrite({
          table: "meal_likes",
          action: "delete",
          filters: {
            meal_id: postId
          }
        })
        if (likesChannelRef.current) {
          likesChannelRef.current.send({
            type: 'broadcast',
            event: 'UNLIKE',
            payload: { meal_id: postId, user_id: user.id }
          }).catch(console.error)
        }
      } else {
        // 좋아요 등록 (INSERT)
        await secureWrite({
          table: "meal_likes",
          action: "insert",
          data: {
            meal_id: postId,
            user_id: user.id
          }
        })
        if (likesChannelRef.current) {
          likesChannelRef.current.send({
            type: 'broadcast',
            event: 'LIKE',
            payload: { meal_id: postId, user_id: user.id }
          }).catch(console.error)
        }
      }
    } catch (err) {
      console.error("Failed to toggle like in database:", err)
      // 실패 시 원래 상태로 원복
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, isLiked: wasLiked, likes: post.likes }
          : p
      ))
    }
  }

  // 구독 토글 (집밥만)
  const toggleSubscribe = (postId: number | string) => {
    setPosts(posts.map(p => 
      p.id === postId && p.type === "homemade"
        ? { ...p, isSubscribed: !p.isSubscribed }
        : p
    ))
  }

  // 필터링된 포스트
  const toKstDateKey = (date: Date) => {
    const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000)
    const y = kstDate.getUTCFullYear()
    const m = String(kstDate.getUTCMonth() + 1).padStart(2, "0")
    const d = String(kstDate.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const isTodayPost = (createdAt: string) => {
    // 출시 초반 유저 수 부족으로 인해 'NEW' 탭 노출 기간을 당일(1일)에서 1주일(7일)로 확대
    // 나중에 유저가 많이 늘어나면 다시 당일 기준으로 원복 예정 (isTodayPost)
    const parsed = Date.parse(createdAt)
    if (!Number.isNaN(parsed)) {
      const now = new Date().getTime()
      const diffTime = now - parsed
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
      return diffTime >= 0 && diffTime <= ONE_WEEK_MS
    }

    if (createdAt.includes("방금") || createdAt.includes("분 전") || createdAt.includes("시간 전") || createdAt.includes("어제")) return true
    
    const daysMatch = createdAt.match(/(\d+)일 전/)
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10)
      return days <= 7
    }

    return false
  }

  const isSameCity = (c1?: string, c2?: string) => {
    if (!c1 || !c2) return false
    return c1.substring(0, 2) === c2.substring(0, 2)
  }

  const filteredPostsRaw = posts.filter(post => {
    // 샘플 카드는 카테고리 필터만 적용받고 나머지 필터(NEW, 좋아요, 지역 등)는 모두 우회
    if (post.isSample) {
      return categoryFilter === "all" || post.type === categoryFilter
    }

    if (categoryFilter !== "all" && post.type !== categoryFilter) return false
    if (showOnlyNew && !isTodayPost(post.createdAt)) return false
    if (showOnlyLiked && !post.isLiked) return false
    if (showOnlySubscribed && !post.isSubscribed) return false

    // 지역 필터: 검색 지역이 있으면 우선, 없으면 내 지역 + 범위
    const targetRegion = searchRegion || userRegion
    const postRegion = post.author?.region || post.region?.dong || ""
    
    if (scopeFilter === "dong") {
      if (searchRegion) {
        return postRegion === targetRegion
      } else {
        return isSameCity(post.region.city, userAddress.city) &&
               post.region.gu === userAddress.gu &&
               postRegion === targetRegion
      }
    } else if (scopeFilter === "gu") {
      return isSameCity(post.region.city, userAddress.city) && post.region.gu === userAddress.gu
    } else if (scopeFilter === "city") {
      return isSameCity(post.region.city, userAddress.city)
    }
    // all: 모든 지역
    return true
  })

  const realPostsFiltered = filteredPostsRaw.filter(p => !p.isSample)
  const samplePostsFiltered = filteredPostsRaw.filter(p => p.isSample)
  const filteredPosts = [...realPostsFiltered, ...samplePostsFiltered]

  const getCategoryCount = (categoryId: string) => {
    const rawFiltered = posts.filter((post) => {
      // 샘플 카드는 카테고리 필터만 적용받고 나머지 조건(NEW, 좋아요, 지역 등)은 우회
      if (post.isSample) {
        return categoryId === "all" || post.type === categoryId
      }

      if (categoryId !== "all" && post.type !== categoryId) return false

      const targetRegion = searchRegion || userRegion
      const postRegion = post.author?.region || post.region?.dong || ""

      if (scopeFilter === "dong") {
        if (searchRegion) {
          return postRegion === targetRegion
        } else {
          return isSameCity(post.region.city, userAddress.city) &&
                 post.region.gu === userAddress.gu &&
                 postRegion === targetRegion
        }
      } else if (scopeFilter === "gu") {
        return isSameCity(post.region.city, userAddress.city) && post.region.gu === userAddress.gu
      } else if (scopeFilter === "city") {
        return isSameCity(post.region.city, userAddress.city)
      }

      return true
    })

    return rawFiltered.length
  }

  const getPostTimestamp = (createdAt: string, fallbackId: number) => {
    const parsed = Date.parse(createdAt)
    if (!Number.isNaN(parsed)) return parsed

    const hourMatch = createdAt.match(/(\d+)\s*시간\s*전/)
    if (hourMatch) return Date.now() - Number(hourMatch[1]) * 60 * 60 * 1000

    const dayMatch = createdAt.match(/(\d+)\s*일\s*전/)
    if (dayMatch) return Date.now() - Number(dayMatch[1]) * 24 * 60 * 60 * 1000

    if (createdAt.includes("어제")) return Date.now() - 24 * 60 * 60 * 1000

    return fallbackId
  }

  const formatRelativeTime = (createdAt: string) => {
    const parsed = Date.parse(createdAt)
    if (Number.isNaN(parsed)) return createdAt

    const diffMs = Date.now() - parsed
    const diffMinutes = Math.floor(diffMs / (60 * 1000))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return "방금 전"
    if (diffMinutes < 60) return `${diffMinutes}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays === 1) return "어제"
    return `${diffDays}일 전`
  }

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    const aTs = getPostTimestamp(a.createdAt, typeof a.id === "number" ? a.id : 0)
    const bTs = getPostTimestamp(b.createdAt, typeof b.id === "number" ? b.id : 0)
    return sortOrder === "latest" ? bTs - aTs : aTs - bTs
  })

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [
    categoryFilter,
    sortOrder,
    scopeFilter,
    searchRegion,
    searchQuery,
    showOnlyNew,
    showOnlyLiked,
    showOnlySubscribed,
  ])

  const visiblePosts = sortedPosts.slice(0, visibleCount)
  const hasMorePosts = visibleCount < sortedPosts.length

  // 별점 렌더링
  const renderStars = (average: number) => {
    const fullStars = Math.floor(average)
    const hasHalf = average - fullStars >= 0.5
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={cn(
              "size-3",
              i < fullStars 
                ? "fill-yellow-400 text-yellow-400" 
                : i === fullStars && hasHalf 
                  ? "fill-yellow-400/50 text-yellow-400"
                  : "text-muted-foreground/30"
            )} 
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-white shadow-lg">
        {/* 지역 필터 + 타이틀 + 식당/메뉴 검색 통합 한 줄 바 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* 지역 필터 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative z-50">
              <button
                onClick={() => {
                  const nextState = !showScopeDropdown
                  setShowScopeDropdown(nextState)
                  if (nextState) {
                    setShowRegionSearch(false)
                    setSearchRegion("")
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-extrabold transition-all whitespace-nowrap border",
                  (scopeFilter === "all" && !searchRegion)
                    ? "bg-white text-foreground border-gray-300 hover:border-orange-200"
                    : "bg-orange-50 text-orange-600 border-orange-200"
                )}
              >
                {getDropdownButtonLabel()}
                <ChevronDown className="size-3" />
              </button>
              {showScopeDropdown && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  {regionScopeOptions.map((scope) => (
                    <button
                      key={scope.id}
                      onClick={() => {
                        setScopeFilter(scope.id)
                        setSearchRegion("")
                        setShowRegionSearch(false)
                        setShowScopeDropdown(false)
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between gap-2",
                        scopeFilter === scope.id && !searchRegion
                          ? "bg-orange-50 text-orange-500 font-bold"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <span>{scope.label}</span>
                      {scopeFilter === scope.id && !searchRegion && <span className="text-[10px]">선택된 항목</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 지역 검색 토글 돋보기 버튼 */}
            <button
              onClick={() => {
                const nextState = !showRegionSearch
                setShowRegionSearch(nextState)
                if (nextState) {
                  setShowScopeDropdown(false)
                } else {
                  setSearchRegion("")
                  setScopeFilter("all")
                }
              }}
              className={cn(
                "flex items-center justify-center size-9 rounded-xl border transition-all shrink-0",
                showRegionSearch
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white border-gray-300 text-muted-foreground hover:border-orange-200"
              )}
              title="지역 검색"
            >
              <Search className="size-4" />
            </button>

            {/* 1/3 너비 지역 검색창 */}
            {showRegionSearch && (
              <input
                type="text"
                autoFocus
                placeholder="동/구/시 입력"
                value={searchRegion}
                onChange={(e) => {
                  setSearchRegion(e.target.value)
                  if (e.target.value.trim() !== "") {
                    setScopeFilter("dong")
                  } else {
                    setScopeFilter("all")
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowRegionSearch(false)
                    setSearchRegion("")
                    setScopeFilter("all")
                  }
                }}
                className="w-36 px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-orange-300/40 focus:border-orange-300 outline-none placeholder:text-muted-foreground/50 animate-in slide-in-from-left-2 duration-200 h-9"
              />
            )}
          </div>

          {/* 우리동네 5점 맛집 모음 타이틀 */}
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            <p className="text-xs font-semibold text-cyan-500 whitespace-nowrap">우리 동네 5점 맛집 모음</p>
            <div className="relative group">
              <button
                type="button"
                aria-label="맛톡 노출 규칙 도움말"
                className="size-4 rounded-full border border-cyan-300 text-[10px] leading-none font-bold text-cyan-600 bg-cyan-50 flex items-center justify-center"
              >
                ?
              </button>
              <div className="pointer-events-none absolute left-0 top-full mt-1 w-72 rounded-lg border border-cyan-100 bg-white px-3 py-2 text-[11px] leading-4 text-muted-foreground shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 z-50">
                솔로/패밀리에서 5점 부여한 식사는 맛톡에 자동으로 올라오며, 3일간 좋아요 3개 받지 못하면 사라집니다.
              </div>
            </div>
          </div>

          {/* 메인 레시피/식당 검색바 */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="음식, 식당, 별명 검색"
              className="w-full pl-11 pr-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300/40 focus:border-orange-300 outline-none text-xs placeholder:text-muted-foreground/50 h-9"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5">
          {categoryOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setCategoryFilter(option.id)}
              className={cn(
                "relative px-3 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap",
                categoryFilter === option.id
                  ? "bg-orange-500 text-white shadow-md shadow-orange-300/50"
                  : "bg-white/70 text-muted-foreground hover:bg-white"
              )}
            >
              <span className="absolute -top-2 right-0 z-10 text-[11px] leading-none font-black text-cyan-600">
                {getCategoryCount(option.id)}
              </span>
              {option.label}
            </button>
          ))}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-muted/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowOnlyNew(false)
                setShowOnlyLiked(false)
                setShowOnlySubscribed(false)
              }}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                !showOnlyNew && !showOnlyLiked && !showOnlySubscribed
                  ? "bg-orange-50 text-orange-500 border border-orange-200"
                  : "bg-white/50 text-muted-foreground border border-transparent hover:border-muted"
              )}
            >
              전체
            </button>
            <button
              onClick={() => setShowOnlyNew(!showOnlyNew)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                showOnlyNew
                  ? "bg-cyan-50 text-cyan-600 border border-cyan-200"
                  : "bg-white/50 text-muted-foreground border border-transparent hover:border-muted"
              )}
            >
              NEW
            </button>
            <button
              onClick={() => setShowOnlyLiked(!showOnlyLiked)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                showOnlyLiked
                  ? "bg-orange-50 text-orange-500 border border-orange-200"
                  : "bg-white/50 text-muted-foreground border border-transparent hover:border-muted"
              )}
            >
              <Heart className={cn("size-3", showOnlyLiked && "fill-current")} />
              my 좋아요
            </button>
            <button
              onClick={() => setShowOnlySubscribed(!showOnlySubscribed)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                showOnlySubscribed
                  ? "bg-orange-50 text-orange-500 border border-orange-200"
                  : "bg-white/50 text-muted-foreground border border-transparent hover:border-muted"
              )}
            >
              <UserCheck className={cn("size-3")} />
              구독중
            </button>
          </div>

          <button
            onClick={() => setSortOrder((prev) => (prev === "latest" ? "oldest" : "latest"))}
            className="flex items-center gap-1 text-xs text-muted-foreground px-1"
          >
            <ArrowUpDown className="size-3" />
            {sortOrder === "latest" ? "최신순" : "오래된순"}
          </button>
        </div>
      </div>

      {/* Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visiblePosts.map((post) => (
          <div key={post.id} className="relative bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white shadow-lg">
            {/* 샘플 리본 */}
            {post.isSample && (
              <div className="absolute top-0 right-0 overflow-hidden w-20 h-20 z-10 pointer-events-none">
                <div className="absolute top-3 -right-6 w-24 bg-yellow-400 text-yellow-900 text-[9px] font-black py-0.5 text-center rotate-45 shadow-md">
                  💡 SAMPLE
                </div>
              </div>
            )}
            {/* Author Header */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={post.author.avatar}
                  alt={post.author.nickname}
                  className="size-10 rounded-xl object-cover border-2 border-white shadow-sm"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{post.author.nickname}</span>
                    {post.type === "homemade" && (
                      <button
                        onClick={() => toggleSubscribe(post.id)}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all",
                          post.isSubscribed
                            ? "bg-orange-500 text-white"
                            : "bg-muted/50 text-muted-foreground hover:bg-orange-50 hover:text-orange-500"
                        )}
                      >
                        {post.isSubscribed ? <UserCheck className="size-3" /> : <UserPlus className="size-3" />}
                        {post.isSubscribed ? "구독중" : "구독"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin className="size-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {(post.type === "dineout" || post.type === "delivery") && post.placeAddress
                        ? (() => {
                            const parsed = parseRegionFromAddress(post.placeAddress)
                            return `${parsed.city}/${parsed.dong}`
                          })()
                        : post.author.region}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(post.createdAt)}</span>
                  </div>
                </div>
              </div>
              {/* Type Badge */}
              <div className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold",
                post.type === "homemade" && "bg-green-50 text-green-600",
                post.type === "delivery" && "bg-blue-50 text-blue-600",
                post.type === "dineout" && "bg-purple-50 text-purple-600"
              )}>
                {post.type === "homemade" && "집밥"}
                {post.type === "delivery" && "배달"}
                {post.type === "dineout" && "외식"}
              </div>
            </div>

            {/* Card Content — 좌우 분할 (좌: 음식사진, 우: 레시피/Place 썸네일) */}
            <div className="flex h-[200px]">
              {/* Left: 음식 대표 사진 */}
              <div
                className="w-1/2 relative overflow-hidden cursor-zoom-in"
                onClick={() => setViewerImage(post.image)}
              >
                {post.image ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 hover:scale-105"
                    style={{ backgroundImage: `url("${post.image}")` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              </div>

              {/* Right: 레시피 / Place 썸네일 or 텍스트 설명 */}
              <div className="w-1/2 bg-gray-50/80 flex overflow-hidden relative">
                {post.linkUrl ? (
                  (() => {
                    const isKakao = post.linkUrl.includes("kko.to") || post.linkUrl.includes("kakao.com")
                    const isGoogle = post.linkUrl.includes("google.com") || post.linkUrl.includes("google.co.kr") || post.linkUrl.includes("goo.gl")
                    const isYoutube = post.linkUrl.includes("youtube.com") || post.linkUrl.includes("youtu.be")
                    const isInstagram = post.linkUrl.includes("instagram.com")
                    const isTiktok = post.linkUrl.includes("tiktok.com")
                    const isNaver = post.linkUrl.includes("naver.com") || post.linkUrl.includes("naver.me")
                    const isGeneric = !isKakao && !isGoogle && !isYoutube && !isInstagram && !isTiktok && !isNaver

                    const isRecipe = isGeneric && (post.type === "homemade")
                    const isStoreLink = isGeneric && !isRecipe

                    return (
                      <a
                        href={post.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-full relative group overflow-hidden block"
                      >
                        {post.linkThumbnail ? (
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                            style={{ backgroundImage: `url("${post.linkThumbnail.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(post.linkThumbnail)}` : post.linkThumbnail}")` }}
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
                              <span>
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
                            )}>{formatPlaceNameWithRegion(post.restaurant?.name, post.restaurant?.address) || "상세 보기"}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm whitespace-nowrap">
                          {(isKakao || isGoogle || isNaver) ? (
                            <>
                              <div className={cn(
                                "size-4 rounded-full flex items-center justify-center",
                                isKakao && "bg-[#FEE500] text-[#3C1E1E]",
                                isGoogle && "bg-[#4285F4] text-white",
                                isNaver && "bg-[#03C75A] text-white"
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
                                isRecipe && "bg-orange-500 text-white",
                                isStoreLink && "bg-slate-600 text-white"
                              )}>
                                <span>
                                  {isYoutube ? "Y" : isInstagram ? "I" : isTiktok ? "T" : isRecipe ? "R" : "P"}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-foreground">
                                {isYoutube ? "YouTube" : isInstagram ? "Reels" : isTiktok ? "TikTok" : isRecipe ? "Recipe" : "Link"}
                              </span>
                            </>
                          )}
                        </div>
                      </a>
                    )
                  })()
                ) : (
                  <div className="p-4 flex flex-col justify-center h-full w-full">
                    <p className="text-[11px] text-muted-foreground leading-normal line-clamp-5">{post.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 하단 정보 영역: 식당명 + 별점 / 메뉴명 */}
            <div className="px-4 pt-3 pb-1">
              {/* 식당명 + 별점 한 줄 */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] text-muted-foreground font-medium truncate">
                  {formatPlaceNameWithRegion(post.restaurant?.name, post.restaurant?.address) || (post.type === "homemade" ? "집밥" : "")}
                </span>
                {post.rating.count > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="size-3 fill-orange-400 text-orange-400" />
                    <span className="text-[11px] font-bold text-orange-500">
                      {post.rating.average.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({post.rating.count}명)
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold",
                      post.source === "solo" ? "text-cyan-500" :
                      post.source === "family" ? "text-orange-500" : "text-purple-500"
                    )}>
                      {post.source === "solo" ? "솔로" : post.source === "family" ? "가족" : "모임"}
                    </span>
                  </div>
                )}
              </div>
              {/* 메뉴명 */}
              <h4 className="font-bold text-sm text-foreground line-clamp-1 mb-2">{post.title}</h4>
            </div>

            {/* Stats & Actions */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* 좋아요 */}
                <button 
                  onClick={() => toggleLike(post.id)}
                  className="flex items-center gap-1.5"
                >
                  <Heart className={cn(
                    "size-5 transition-all",
                    post.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-bold",
                    post.isLiked ? "text-red-500" : "text-muted-foreground"
                  )}>{post.likes}</span>
                </button>
                {/* 댓글 */}
                <button 
                  onClick={() => setExpandedComments(expandedComments === post.id ? null : post.id)}
                  className="flex items-center gap-1.5"
                >
                  <MessageCircle className={cn(
                    "size-5 transition-all",
                    expandedComments === post.id ? "text-orange-500" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-bold text-muted-foreground">{post.commentCount}</span>
                </button>
              </div>
              {/* 담기 버튼 (별점 자리 대체) */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSaveDropdownPostId(
                      saveDropdownPostId === post.id ? null : post.id
                    )
                  }}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Pin className={cn(
                    "size-4 transition-all rotate-45",
                    saveDropdownPostId === post.id
                      ? "fill-red-500 text-red-500 scale-110"
                      : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-xs font-bold",
                    saveDropdownPostId === post.id ? "text-red-500" : ""
                  )}>담기</span>
                </button>
                {saveDropdownPostId === post.id && (
                  <div className="absolute bottom-8 right-0 bg-white border border-orange-100 rounded-2xl shadow-xl z-50 overflow-hidden min-w-[130px] animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => handleSaveToReservation(post, "solo")}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-foreground hover:bg-orange-50 flex items-center gap-2 transition-colors"
                    >
                      <span>👤</span> 솔로 먹예약
                    </button>
                    <div className="h-px bg-orange-50" />
                    <button
                      onClick={() => handleSaveToReservation(post, "family")}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-foreground hover:bg-orange-50 flex items-center gap-2 transition-colors"
                    >
                      <span>👨‍👩‍👧</span> 가족 먹예약
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            {expandedComments === post.id && (
              <div className="border-t border-muted/30 p-4 space-y-3">
                {/* Comment List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {(postComments[post.id] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
                  ) : (
                    (postComments[post.id] || []).map((comment) => (
                      <div key={comment.id} className="rounded-xl bg-orange-50/50 border border-orange-100 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-foreground">{comment.author.nickname}</span>
                            <span className="text-[9px] text-muted-foreground">{comment.author.region}</span>
                            <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
                          </div>
                          {comment.userId === user?.id && (
                            <div className="flex items-center gap-1.5">
                              {editingCommentId === comment.id ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateComment(post.id, comment.id)}
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
                                    onClick={() => handleEditComment(comment.id, comment.content)}
                                    className="text-muted-foreground hover:text-orange-500 transition-colors"
                                    title="수정"
                                  >
                                    <Pencil className="size-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComment(post.id, comment.id)}
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
                                  handleUpdateComment(post.id, comment.id)
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
                            onClick={() => {
                              const isSameTarget =
                                activeReplyTarget?.mealId === post.id &&
                                activeReplyTarget.commentId === comment.id

                              if (isSameTarget) {
                                setActiveReplyTarget(null)
                                return
                              }
                              setActiveReplyTarget({ mealId: post.id, commentId: comment.id })
                            }}
                            className="text-[10px] text-orange-500 font-bold hover:underline"
                          >
                            답글 쓰기
                          </button>
                        </div>

                        {/* 대댓글(답글) 리스트 */}
                        {(comment.replies || []).length > 0 && (
                          <div className="mt-2.5 pl-2 border-l-2 border-orange-200 space-y-1.5">
                            {(comment.replies || []).map((reply: any) => (
                              <div key={reply.id} className="bg-white/70 rounded-lg px-2 py-1.5 border border-orange-50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-foreground">{reply.author.nickname}</span>
                                    <span className="text-[8px] text-muted-foreground">{reply.author.region}</span>
                                    <span className="text-[9px] text-muted-foreground">{reply.createdAt}</span>
                                  </div>
                                  {reply.userId === user?.id && (
                                    <div className="flex items-center gap-1.5">
                                      {editingReplyId === reply.id ? (
                                        <>
                                          <button
                                            onClick={() => handleUpdateReply(post.id, comment.id, reply.id)}
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
                                            onClick={() => handleEditReply(reply.id, reply.content)}
                                            className="text-muted-foreground hover:text-orange-500 transition-colors"
                                            title="수정"
                                          >
                                            <Pencil className="size-2.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteReply(post.id, comment.id, reply.id)}
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
                                          handleUpdateReply(post.id, comment.id, reply.id)
                                        }
                                      }}
                                      className="flex-1 px-2 py-1 rounded bg-white border border-gray-200 text-[10px] outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                                    />
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-foreground mt-0.5 leading-relaxed">{reply.content}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 대댓글 입력창 */}
                        {activeReplyTarget?.mealId === post.id && activeReplyTarget.commentId === comment.id && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={replyInputs[comment.id] || ""}
                              onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                  e.preventDefault()
                                  handleAddReply(post.id, comment.id)
                                }
                              }}
                              placeholder="답글을 입력하세요"
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] outline-none focus:ring-2 focus:ring-orange-300"
                            />
                            <button
                              onClick={() => handleAddReply(post.id, comment.id)}
                              className="size-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0"
                            >
                              <Send className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <div className="pt-2 border-t border-muted/20 flex items-center gap-2">
                  <input
                    type="text"
                    value={commentInputs[post.id] || ""}
                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        handleAddComment(post.id)
                      }
                    }}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 px-3 py-2 bg-orange-50/20 border border-orange-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={() => handleAddComment(post.id)}
                    className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors shrink-0"
                  >
                    등록
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {hasMorePosts && (
        <div className="flex justify-center -mt-1">
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-white/80 border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors"
          >
            게시물 더보기
          </button>
        </div>
      )}

      <ImageViewer
        src={viewerImage ?? ""}
        isOpen={viewerImage !== null}
        onClose={() => setViewerImage(null)}
      />
    </div>
  )
}
