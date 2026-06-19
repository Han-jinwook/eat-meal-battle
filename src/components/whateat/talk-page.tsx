"use client"

import { useEffect, useState } from "react"
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
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { ImageViewer } from "@/components/whateat/image-viewer"

// 타입 정의
interface TalkPost {
  id: number | string
  type: "homemade" | "delivery" | "dineout"
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
    title: "청라 찐 맛집 [인생 소갈비살] 육즙 폭발 숯불구이 🥩",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&fit=crop",
    description: "웨이팅이 전혀 아깝지 않은 인생 갈비살 맛집이에요! 참숯 향이 고기에 그대로 배어 있어서 소금만 콕 찍어 먹어도 감칠맛이 폭발합니다. 육즙이 뚝뚝 떨어지는 극강의 부드러움.. 가족 모임 장소로 강력 추천해요! 💯",
    region: { dong: "청라동", gu: "서구", city: "인천" },
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
    title: "에어프라이어로 뚝딱! 마늘 통삼겹 겉바속촉 오븐구이 🥓",
    image: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600&fit=crop",
    description: "에어프라이어 180도에서 20분 뒤집어서 15분 구웠더니 겉은 과자처럼 바삭하고 속은 육즙 가득 촉촉하게 구워졌어요. 통마늘이랑 아스파라거스도 같이 구워 쌈장에 찍어 먹으면 밥 한 공기 뚝딱입니다! 초간단 영양 만점 메뉴 😋",
    region: { dong: "논현동", gu: "강남구", city: "서울" },
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
    title: "꾸덕함의 끝판왕! 매콤 투움바 떡볶이 & 바삭 크리스피 치킨 세트 🍗",
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&fit=crop",
    description: "오늘 야식은 투움바 로제 떡볶이에 크리스피 순살 치킨입니다! 꾸덕하고 매콤한 소스에 바삭한 치킨을 푹 찍어 먹으면 스트레스가 다 날아가요. 넙적당면이랑 치즈 핫도그 토핑 추가는 선택이 아닌 필수입니다.. 강력 추천! 👍",
    region: { dong: "송도동", gu: "연수구", city: "인천" },
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
  const [showOnlyNew, setShowOnlyNew] = useState(true)
  const [showOnlyLiked, setShowOnlyLiked] = useState(false)
  const [showOnlySubscribed, setShowOnlySubscribed] = useState(false)
  const [expandedComments, setExpandedComments] = useState<string | number | null>(null)
  const [commentInput, setCommentInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const { isLoggedIn, user } = useHub()

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
            return { average: 5, count: 0 }
          }
          return {
            average: Math.round((stats.sum / stats.count) * 10) / 10,
            count: stats.count
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

          let mappedType: "homemade" | "delivery" | "dineout" = "homemade"
          const rawType = meta.mealType || ""
          if (rawType === "집밥" || rawType === "homemade") {
            mappedType = "homemade"
          } else if (rawType === "배달" || rawType === "delivery") {
            mappedType = "delivery"
          } else if (rawType === "외식" || rawType === "dineout") {
            mappedType = "dineout"
          }

          return {
            id: img.id,
            type: mappedType,
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
              nickname: u?.nickname || "익명 회원",
              avatar: u?.profile_image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
              region: parsedDong
            },
            createdAt: meta.promotedAt || img.created_at,
            rating: img.meal_id ? getRatingStats(img.meal_id) : { average: 5, count: 0 },
            likes: 0,
            isLiked: false,
            commentCount: 0,
            isSubscribed: false,
            isSample: false,
            linkUrl: meta.linkUrl || "",
            linkThumbnail: meta.linkThumbnail || ""
          }
        })

        // Filter dummy posts based on loaded real types
        const hasRealHomemade = parsedPosts.some(p => p.type === "homemade")
        const hasRealDelivery = parsedPosts.some(p => p.type === "delivery")
        const hasRealDineout = parsedPosts.some(p => p.type === "dineout")

        const activeDummyPosts = dummyPosts.map(p => ({ ...p, isSample: true })).filter(p => {
          if (p.type === "homemade" && hasRealHomemade) return false
          if (p.type === "delivery" && hasRealDelivery) return false
          if (p.type === "dineout" && hasRealDineout) return false
          return true
        })

        setPosts([...parsedPosts, ...activeDummyPosts])
      } catch (err) {
        console.error("Failed to fetch posts from Supabase", err)
      }
    }

    if (isActive !== false) {
      fetchDbPosts()
    }
  }, [isActive])

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

  // 좋아요 토글
  const toggleLike = (postId: number | string) => {
    setPosts(posts.map(p => 
      p.id === postId 
        ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
        : p
    ))
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
    const parsed = Date.parse(createdAt)
    if (!Number.isNaN(parsed)) {
      return toKstDateKey(new Date()) === toKstDateKey(new Date(parsed))
    }

    if (createdAt.includes("어제") || createdAt.includes("일 전")) return false
    if (createdAt.includes("방금") || createdAt.includes("분 전") || createdAt.includes("시간 전")) return true
    return false
  }

  const filteredPosts = posts.filter(post => {
    if (categoryFilter !== "all" && post.type !== categoryFilter) return false
    if (showOnlyNew && !isTodayPost(post.createdAt)) return false
    if (showOnlyLiked && !post.isLiked) return false
    if (showOnlySubscribed && !post.isSubscribed) return false
    
    // 지역 필터: 검색 지역이 있으면 우선, 없으면 내 지역 + 범위
    const targetRegion = searchRegion || userRegion
    const postRegion = post.author?.region || post.region?.dong || ""
    
    if (scopeFilter === "dong") {
      return postRegion === targetRegion
    } else if (scopeFilter === "gu") {
      return post.region.gu === userAddress.gu
    } else if (scopeFilter === "city") {
      return post.region.city === userAddress.city
    }
    // all: 모든 지역
    return true
  })

  const getCategoryCount = (categoryId: string) => {
    return posts.filter((post) => {
      if (categoryId !== "all" && post.type !== categoryId) return false
      if (showOnlyNew && !isTodayPost(post.createdAt)) return false
      if (showOnlyLiked && !post.isLiked) return false
      if (showOnlySubscribed && !post.isSubscribed) return false

      const targetRegion = searchRegion || userRegion
      const postRegion = post.author?.region || post.region?.dong || ""

      if (scopeFilter === "dong") {
        return postRegion === targetRegion
      } else if (scopeFilter === "gu") {
        return post.region.gu === userAddress.gu
      } else if (scopeFilter === "city") {
        return post.region.city === userAddress.city
      }

      return true
    }).length
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
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 shrink-0">
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
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="음식, 식당, 별명 검색"
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-300/40 focus:border-orange-300 outline-none text-sm placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* 지역 필터: 사용자 행정구역 드롭다운 + 검색 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative">
            <button
              onClick={() => setShowScopeDropdown(!showScopeDropdown)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-extrabold transition-all whitespace-nowrap border",
                scopeFilter === "all"
                  ? "bg-white text-foreground border-gray-300 hover:border-orange-200"
                  : "bg-orange-50 text-orange-600 border-orange-200"
              )}
            >
              {regionScopeOptions.find((s) => s.id === scopeFilter)?.label}
              <ChevronDown className="size-3" />
            </button>
            {showScopeDropdown && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                {regionScopeOptions.map((scope) => (
                  <button
                    key={scope.id}
                    onClick={() => {
                      setScopeFilter(scope.id)
                      setShowScopeDropdown(false)
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between gap-2",
                      scopeFilter === scope.id
                        ? "bg-orange-50 text-orange-500 font-bold"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <span>{scope.label}</span>
                    {scopeFilter === scope.id && <span className="text-[10px]">선택된 항목</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {showRegionSearch && (
            <input
              type="text"
              autoFocus
              placeholder="지역명 입력 (동/구/시) - ESC로 취소"
              value={searchRegion}
              onChange={(e) => setSearchRegion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowRegionSearch(false)
                  setSearchRegion("")
                }
              }}
              className="flex-1 px-4 py-2 bg-white border border-orange-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-300/40 outline-none placeholder:text-muted-foreground/50"
            />
          )}

          {!showRegionSearch && <div className="flex-1" />}

          {/* 지역 검색 */}
          <button
            onClick={() => setShowRegionSearch(!showRegionSearch)}
            className="flex items-center gap-1 px-3 py-2 bg-white/60 border border-white/80 rounded-lg text-xs font-medium text-muted-foreground hover:border-orange-200 transition-all whitespace-nowrap"
          >
            <Search className="size-3.5" />
            지역 검색
          </button>
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
                    <span className="text-[11px] text-muted-foreground">{post.author.region}</span>
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

            {/* Card Content (flex h-[200px] 구조) */}
            <div className="flex h-[200px] border-y border-muted/20">
              {/* Left Section: 요리 대표 사진 */}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                
                {post.restaurant && (
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 z-10">
                    <span className="font-bold text-white text-[10px]">{post.restaurant.name}</span>
                  </div>
                )}
              </div>

              {/* Right Section: 레시피 썸네일 or 텍스트 설명 */}
              <div className="w-1/2 bg-gray-50/80 border-l border-muted flex overflow-hidden relative">
                {post.linkUrl && post.linkThumbnail ? (
                  <a
                    href={post.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full relative group overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundImage: `url("${post.linkThumbnail}")` }}
                    />
                    <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors" />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm whitespace-nowrap">
                      {(post.type === "외식" || post.type === "배달") ? (
                        <>
                          <div className="size-4 rounded-full bg-[#03C75A] flex items-center justify-center">
                            <span className="text-white text-[7px] font-black">N</span>
                          </div>
                          <span className="text-[10px] font-bold text-foreground">Place</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="size-3 text-orange-500" />
                          <span className="text-[10px] font-bold text-foreground">recipe</span>
                        </>
                      )}
                    </div>
                  </a>
                ) : (
                  <div className="p-4 flex flex-col justify-between h-full w-full">
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-xs text-foreground mb-1 line-clamp-1">{post.title}</h4>
                      <p className="text-[11px] text-muted-foreground leading-normal line-clamp-4">{post.description}</p>
                    </div>
                    {/* 평점 표시 */}
                    <div className="text-[10px] font-bold text-orange-500 flex items-center gap-1 mt-1">
                      <Star className="size-3 fill-orange-400 text-orange-400" />
                      {post.rating.average.toFixed(1)} ({post.rating.count}명)
                    </div>
                  </div>
                )}
              </div>
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
              {/* 별점 */}
              <div className="flex items-center gap-2">
                {renderStars(post.rating.average)}
                <span className="text-xs text-muted-foreground">
                  {post.rating.average.toFixed(1)} ({post.rating.count}명)
                </span>
              </div>
            </div>

            {/* Comments Section */}
            {expandedComments === post.id && (
              <div className="border-t border-muted/30">
                {/* Comment List */}
                <div className="divide-y divide-muted/20">
                  {(dummyComments[post.id] || []).map((comment) => (
                    <div key={comment.id} className="p-4 flex gap-3">
                      <img
                        src={comment.author.avatar}
                        alt={comment.author.nickname}
                        className="size-8 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{comment.author.nickname}</span>
                          <span className="text-[10px] text-muted-foreground">{comment.author.region}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
                        </div>
                        <p className="text-sm text-foreground mt-1">{comment.content}</p>
                        <button className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                          <Heart className={cn(
                            "size-3",
                            comment.isLiked && "fill-red-500 text-red-500"
                          )} />
                          <span className="text-[10px]">{comment.likes}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Comment Input */}
                <div className="p-4 pt-3 border-t border-muted/30 flex items-center gap-3">
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 px-4 py-2.5 bg-muted/30 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300/40"
                  />
                  <button className="size-10 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:bg-orange-600 transition-colors">
                    <Send className="size-4" />
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
