"use client"

import { useState } from "react"
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
  Send
} from "lucide-react"
import { cn } from "@/lib/utils"

// 타입 정의
interface TalkPost {
  id: number
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
    id: number
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
    type: "homemade",
    title: "주말 브런치 에그베네딕트",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&h=450&fit=crop",
    description: "홀란다이즈 소스 직접 만들어봤는데 생각보다 어렵지 않아요! 레시피 공유할게요",
    region: { dong: "청라동", gu: "서구", city: "인천" },
    author: {
      id: 1,
      nickname: "요리하는직장인",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      region: "청라동"
    },
    createdAt: "2시간 전",
    rating: { average: 4.8, count: 24 },
    likes: 156,
    isLiked: true,
    commentCount: 12,
    isSubscribed: true
  },
  {
    id: 2,
    type: "dineout",
    title: "부평 숨은 돈까스 맛집",
    image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&h=600&fit=crop",
    description: "두툼한 등심돈까스에 수제 데미글라스 소스가 예술이에요. 웨이팅 있어도 가치있음!",
    region: { dong: "부평동", gu: "부평구", city: "인천" },
    restaurant: {
      name: "돈까스연구소",
      address: "인천 부평구 부평동 123-45"
    },
    author: {
      id: 2,
      nickname: "인천맛집헌터",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      region: "부평동"
    },
    createdAt: "5시간 전",
    rating: { average: 4.9, count: 87 },
    likes: 342,
    isLiked: false,
    commentCount: 45
  },
  {
    id: 3,
    type: "delivery",
    title: "야식으로 시킨 마라탕",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=600&fit=crop",
    description: "3단계 매운맛에 양 많고 가성비 최고. 청라 배달 맛집 인정합니다",
    region: { dong: "청라동", gu: "서구", city: "인천" },
    restaurant: {
      name: "마라킹",
      address: "인천 서구 청라동 456-78"
    },
    author: {
      id: 3,
      nickname: "야식킹",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
      region: "청라동"
    },
    createdAt: "어제",
    rating: { average: 4.5, count: 156 },
    likes: 523,
    isLiked: true,
    commentCount: 67
  },
  {
    id: 4,
    type: "homemade",
    title: "된장찌개 황금레시피",
    image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=600&h=600&fit=crop",
    description: "어머니께 배운 비법 된장찌개. 멸치육수가 핵심이에요!",
    region: { dong: "연수동", gu: "연수구", city: "인천" },
    author: {
      id: 4,
      nickname: "집밥마스터",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      region: "연수동"
    },
    createdAt: "2일 전",
    rating: { average: 4.7, count: 312 },
    likes: 891,
    isLiked: false,
    commentCount: 89,
    isSubscribed: false
  }
]

const dummyComments: Comment[] = [
  {
    id: 1,
    author: { nickname: "맛집탐험가", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face", region: "부평동" },
    content: "레시피 공유해주세요!! 너무 맛있어 보여요",
    createdAt: "1시간 전",
    likes: 5,
    isLiked: false
  },
  {
    id: 2,
    author: { nickname: "요리초보", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face", region: "청라동" },
    content: "저도 따라해봤는데 성공했어요! 감사합니다",
    createdAt: "30분 전",
    likes: 3,
    isLiked: true
  }
]

// 카테고리 옵션
const categoryOptions = [
  { id: "all", label: "전체" },
  { id: "homemade", label: "집밥" },
  { id: "delivery", label: "배달" },
  { id: "dineout", label: "외식" },
]

// 범위 옵션 (내 지역 기준으로 확장)
const scopeOptions = [
  { id: "dong", label: "동네" },
  { id: "gu", label: "구" },
  { id: "city", label: "시" },
  { id: "all", label: "전국" },
]

export function TalkPage() {
  const [posts, setPosts] = useState(dummyPosts)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [userRegion, setUserRegion] = useState<string>("청라동") // 사용자 기본 지역
  const [scopeFilter, setScopeFilter] = useState<string>("dong") // 범위: dong/gu/city/all
  const [searchRegion, setSearchRegion] = useState<string>("") // 검색 지역
  const [showScopeDropdown, setShowScopeDropdown] = useState(false)
  const [showRegionSearch, setShowRegionSearch] = useState(false)
  const [showOnlyLiked, setShowOnlyLiked] = useState(false)
  const [showOnlySubscribed, setShowOnlySubscribed] = useState(false)
  const [expandedComments, setExpandedComments] = useState<number | null>(null)
  const [commentInput, setCommentInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // 좋아요 토글
  const toggleLike = (postId: number) => {
    setPosts(posts.map(p => 
      p.id === postId 
        ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
        : p
    ))
  }

  // 구독 토글 (집밥만)
  const toggleSubscribe = (postId: number) => {
    setPosts(posts.map(p => 
      p.id === postId && p.type === "homemade"
        ? { ...p, isSubscribed: !p.isSubscribed }
        : p
    ))
  }

  // 필터링된 포스트
  const filteredPosts = posts.filter(post => {
    if (categoryFilter !== "all" && post.type !== categoryFilter) return false
    if (showOnlyLiked && !post.isLiked) return false
    if (showOnlySubscribed && !post.isSubscribed) return false
    
    // 지역 필터: 검색 지역이 있으면 우선, 없으면 내 지역 + 범위
    const targetRegion = searchRegion || userRegion
    const postRegion = post.author?.region || post.region?.dong || ""
    
    if (scopeFilter === "dong") {
      return postRegion === targetRegion
    } else if (scopeFilter === "gu") {
      return post.region.gu === "서구" // 예시: 서구
    } else if (scopeFilter === "city") {
      return post.region.city === "인천" // 예시: 인천
    }
    // all: 모든 지역
    return true
  })

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-foreground text-lg">맛톡</h2>
            <p className="text-xs text-muted-foreground mt-0.5">우리 동네 5점 맛집 모음</p>
          </div>
        </div>

        {/* 음식 검색 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="음식, 별명 검색"
              className="w-full pl-11 pr-4 py-2.5 bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* 지역 필터: 기본 지역 + 범위 */}
        <div className="flex items-center gap-2 mb-4">
          {/* 기본 지역 표시 */}
          <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {userRegion}
          </div>
          
          {/* 범위 확장 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => setShowScopeDropdown(!showScopeDropdown)}
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap border",
                scopeFilter === "dong" 
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-white/60 border-white/80 text-muted-foreground hover:border-primary/30"
              )}
            >
              {scopeOptions.find(s => s.id === scopeFilter)?.label}
              <ChevronDown className="size-3" />
            </button>
            {showScopeDropdown && (
              <div className="absolute left-0 top-full mt-1 w-24 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                {scopeOptions.map((scope) => (
                  <button
                    key={scope.id}
                    onClick={() => {
                      setScopeFilter(scope.id)
                      setShowScopeDropdown(false)
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs transition-colors",
                      scopeFilter === scope.id
                        ? "bg-primary/20 text-primary font-bold"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* 지역 검색 */}
          <button
            onClick={() => setShowRegionSearch(!showRegionSearch)}
            className="flex items-center gap-1 px-3 py-2 bg-white/60 border border-white/80 rounded-lg text-xs font-medium text-muted-foreground hover:border-primary/30 transition-all whitespace-nowrap"
          >
            <Search className="size-3.5" />
            지역 검색
          </button>
        </div>

        {/* 지역 검색 입력 - 별도 행 */}
        {showRegionSearch && (
          <div className="mb-4">
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
              className="w-full px-4 py-2.5 bg-white/80 border border-primary/30 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        )}

        {/* Category Filter */}
        <div className="flex items-center gap-1.5">
          {categoryOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setCategoryFilter(option.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap",
                categoryFilter === option.id
                  ? "bg-primary text-white shadow-md"
                  : "bg-white/70 text-muted-foreground hover:bg-white"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-muted/30">
          <button
            onClick={() => setShowOnlyLiked(!showOnlyLiked)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1",
              showOnlyLiked
                ? "bg-red-50 text-red-500 border border-red-200"
                : "bg-white/50 text-muted-foreground border border-transparent hover:border-muted"
            )}
          >
            <Heart className={cn("size-3", showOnlyLiked && "fill-red-500")} />
            좋아요한 것
          </button>
          <button
            onClick={() => setShowOnlySubscribed(!showOnlySubscribed)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1",
              showOnlySubscribed
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-white/50 text-muted-foreground border border-transparent hover:border-muted"
            )}
          >
            <UserCheck className={cn("size-3")} />
            구독중
          </button>
        </div>
      </div>

      {/* Posts Count */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">{filteredPosts.length}개의 게시물</span>
        <button className="flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowUpDown className="size-3" />
          최신순
        </button>
      </div>

      {/* Posts */}
      <div className="flex flex-col gap-4">
        {filteredPosts.map((post) => (
          <div key={post.id} className="bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white shadow-lg">
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
                            ? "bg-primary text-white"
                            : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"
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
                    <span className="text-[10px] text-muted-foreground">{post.createdAt}</span>
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

            {/* Image */}
            <div className="relative aspect-[4/3] bg-muted/20 overflow-hidden">
              {post.image ? (
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}
              {post.restaurant && (
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2">
                  <span className="font-bold text-white text-sm">{post.restaurant.name}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-bold text-foreground mb-1">{post.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{post.description}</p>
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
                    expandedComments === post.id ? "text-primary" : "text-muted-foreground"
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
                  {dummyComments.map((comment) => (
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
                    className="flex-1 px-4 py-2.5 bg-muted/30 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button className="size-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors">
                    <Send className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
