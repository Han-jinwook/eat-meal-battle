"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Heart, MessageCircle, UserPlus, UserCheck, Star, Send, X, BookOpen, ChefHat, ChevronDown, ChevronUp, ArrowUpDown, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

type FeedFilterType = "all" | "subscribed" | "liked"

interface Recipe {
  type: "url" | "memo"
  url?: string
  thumbnail?: string
  memo?: string
}

interface Comment {
  id: number
  author: string
  avatar: string
  content: string
  createdAt: string
}

interface FeedPost {
  id: number
  author: {
    name: string
    avatar: string
    isFollowing: boolean
  }
  image: string
  date: string
  title: string
  rating: number
  description: string
  tags: string[]
  type: string
  likes: number
  isLiked: boolean
  comments: Comment[]
  recipe?: Recipe
}

const initialFeedPosts: FeedPost[] = [
  {
    id: 1,
    author: {
      name: "미식가_제이",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      isFollowing: false
    },
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
    date: "2시간 전",
    title: "오마카세 런치 코스",
    rating: 5,
    description: "점심 오마카세로 이 가격에 이 퀄리티라니! 특히 도로 초밥이 입에서 녹았어요. 재방문 의사 100%입니다.",
    tags: ["#오마카세", "#런치특선", "#강남맛집"],
    type: "외식",
    likes: 42,
    isLiked: false,
    comments: [
      {
        id: 1,
        author: "foodie_kim",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
        content: "여기 어디에요? 저도 가보고 싶어요!",
        createdAt: "1시간 전"
      },
      {
        id: 2,
        author: "맛집헌터",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
        content: "도로 초밥 대박이죠 ㅎㅎ",
        createdAt: "30분 전"
      }
    ],
    recipe: {
      type: "url",
      url: "https://www.instagram.com/reel/DUX3akGCWTG/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==",
      thumbnail: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&h=300&fit=crop"
    }
  },
  {
    id: 2,
    author: {
      name: "홈쿡러버",
      avatar: "https://images.unsplash.com/photo-1544005313947-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      isFollowing: true
    },
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=400&fit=crop",
    date: "5시간 전",
    title: "주말 브런치 팬케이크",
    rating: 4,
    description: "리코타 치즈 팬케이크에 메이플 시럽 듬뿍! 블루베리랑 같이 먹으니 너무 행복한 주말 아침이에요.",
    tags: ["#브런치", "#홈쿡", "#팬케이크"],
    type: "집밥",
    likes: 128,
    isLiked: true,
    comments: [
      {
        id: 1,
        author: "요리초보",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
        content: "레시피 공유해주실 수 있나요?",
        createdAt: "4시간 전"
      }
    ],
    recipe: {
      type: "memo",
      memo: "리코타 치즈 200g + 밀가루 1컵 + 달걀 2개 섞어서 약불에 노릇하게 구우면 끝! 메이플 시럽이랑 블루베리 토핑 필수 :)"
    }
  },
  {
    id: 3,
    author: {
      name: "야식킹",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      isFollowing: false
    },
    image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop",
    date: "어제",
    title: "심야 치킨 파티",
    rating: 5,
    description: "퇴근 후 혼자 치킨 한 마리 뜯기. 양념 반 후라이드 반에 맥주 한 캔이면 하루의 피로가 싹 풀려요.",
    tags: ["#야식", "#치킨", "#혼술"],
    type: "배달",
    likes: 89,
    isLiked: false,
    comments: [],
    recipe: {
      type: "url",
      url: "https://www.youtube.com/watch?v=example",
      thumbnail: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&h=300&fit=crop"
    }
  },
  {
    id: 4,
    author: {
      name: "베이킹마스터",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      isFollowing: true
    },
    image: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=400&h=400&fit=crop",
    date: "3일 전",
    title: "수플레 치즈케이크",
    rating: 5,
    description: "공기처럼 가벼운 수플레 치즈케이크! 오븐에서 나올 때 흔들흔들 거리는 게 너무 귀여워요.",
    tags: ["#베이킹", "#치즈케이크", "#홈베이킹"],
    type: "집밥",
    likes: 256,
    isLiked: true,
    comments: [
      {
        id: 1,
        author: "달콤러버",
        avatar: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=100&h=100&fit=crop&crop=face",
        content: "너무 맛있어 보여요! 레시피 감사합니다",
        createdAt: "2일 전"
      }
    ],
    recipe: {
      type: "url",
      url: "https://www.instagram.com/reel/example2",
      thumbnail: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=300&h=300&fit=crop"
    }
  }
]

const feedFilters = [
  { id: "all" as FeedFilterType, label: "전체" },
  { id: "subscribed" as FeedFilterType, label: "구독 레시퍼" },
  { id: "liked" as FeedFilterType, label: "좋아요" },
]

export function FeedTab() {
  const [posts, setPosts] = useState<FeedPost[]>(initialFeedPosts)
  const [feedFilter, setFeedFilter] = useState<FeedFilterType>("all")
  const [expandedComments, setExpandedComments] = useState<number | null>(null)
  const [expandedRecipe, setExpandedRecipe] = useState<number | null>(null)
  const [newComment, setNewComment] = useState("")
  const [showSubscribedTooltip, setShowSubscribedTooltip] = useState(false)
  const [hasSeenSubscribedTooltip, setHasSeenSubscribedTooltip] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<FeedFilterType | null>(null)
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null)
  const [selectedLikedType, setSelectedLikedType] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const subscribedAuthors = [...new Set(
    posts.filter(p => p.author.isFollowing).map(p => p.author.name)
  )]

  const handleFilterClick = (filterId: FeedFilterType) => {
    if (filterId === "subscribed") {
      setFeedFilter(filterId)
      // First time: show tooltip only (no dropdown)
      if (!hasSeenSubscribedTooltip) {
        setShowSubscribedTooltip(true)
        setHasSeenSubscribedTooltip(true)
        setOpenDropdown(null)
        setSelectedAuthor(null)
        setTimeout(() => setShowSubscribedTooltip(false), 6000)
      } else {
        // After first time: toggle dropdown
        setShowSubscribedTooltip(false)
        if (openDropdown === "subscribed") {
          setOpenDropdown(null)
        } else {
          setOpenDropdown("subscribed")
        }
      }
    } else if (filterId === "liked") {
      setFeedFilter(filterId)
      setShowSubscribedTooltip(false)
      if (feedFilter !== "liked") {
        setSelectedLikedType(null)
        setOpenDropdown("liked")
      } else if (openDropdown === "liked") {
        setOpenDropdown(null)
      } else {
        setOpenDropdown("liked")
      }
    } else {
      setFeedFilter(filterId)
      setOpenDropdown(null)
      setSelectedAuthor(null)
      setSelectedLikedType(null)
      setShowSubscribedTooltip(false)
    }
  }

  const handleSelectAuthor = (author: string | null) => {
    setSelectedAuthor(author)
    setOpenDropdown(null)
    setShowSubscribedTooltip(false)
  }

  const handleSelectLikedType = (type: string | null) => {
    setSelectedLikedType(type)
    setOpenDropdown(null)
  }

  // 필터에 따른 게시글 필터링
  const filteredPosts = posts.filter(post => {
    if (feedFilter === "subscribed") {
      if (!post.author.isFollowing) return false
      if (selectedAuthor) return post.author.name === selectedAuthor
      return true
    }
    if (feedFilter === "liked") {
      if (!post.isLiked) return false
      if (selectedLikedType) return post.type === selectedLikedType
      return true
    }
    return true
  })

  const handleLike = (postId: number) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1
        }
      }
      return post
    }))
  }

  const handleFollow = (postId: number) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          author: {
            ...post.author,
            isFollowing: !post.author.isFollowing
          }
        }
      }
      return post
    }))
  }

  const handleAddComment = (postId: number) => {
    if (!newComment.trim()) return
    
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [
            ...post.comments,
            {
              id: Date.now(),
              author: "나",
              avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
              content: newComment,
              createdAt: "방금 전"
            }
          ]
        }
      }
      return post
    }))
    setNewComment("")
  }

  const toggleComments = (postId: number) => {
    setExpandedComments(expandedComments === postId ? null : postId)
  }

  const toggleRecipe = (postId: number) => {
    setExpandedRecipe(expandedRecipe === postId ? null : postId)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sticky Search + Filter */}
      <div className="sticky top-0 z-30 -mx-5 px-5 pt-4 pb-3 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex flex-col gap-3">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <input
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 outline-none text-sm placeholder:text-muted-foreground/50 shadow-xs transition-all duration-300"
            placeholder="별명, 음식, 태그 검색"
            type="text"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2.5 bg-white/60 border border-white/80 rounded-xl text-sm font-medium text-muted-foreground hover:border-primary/30 transition-all whitespace-nowrap">
          <ArrowDown className="size-3.5" />
          날짜순
        </button>
      </div>

      {/* Feed Filter Tabs */}
      <div ref={dropdownRef} className="relative flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          {feedFilters.map((filter) => (
            <div key={filter.id} className="relative">
              <button
                onClick={() => handleFilterClick(filter.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-1",
                  feedFilter === filter.id
                    ? "bg-primary text-white shadow-md"
                    : "bg-white/70 text-muted-foreground hover:bg-white"
                )}
              >
                {filter.label}
                {(filter.id === "subscribed" || filter.id === "liked") && (
                  <ChevronDown className={cn(
                    "size-3 transition-transform",
                    openDropdown === filter.id && "rotate-180"
                  )} />
                )}
              </button>

              {/* Tooltip for 구독 레시퍼 */}
              {filter.id === "subscribed" && showSubscribedTooltip && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30">
                  <div className="relative bg-foreground text-white text-[11px] font-medium px-3 py-2 rounded-xl whitespace-nowrap shadow-lg">
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 size-3 bg-foreground rotate-45 rounded-[2px]" />
                    내가 구독한 레시퍼의 최신 레시피만 모아봅니다
                  </div>
                </div>
              )}

              {/* 구독 레시퍼 Dropdown */}
              {filter.id === "subscribed" && openDropdown === "subscribed" && (
                <div className="absolute top-full left-0 mt-2 z-20 w-44 bg-white rounded-2xl shadow-xl border border-muted/30 overflow-hidden">
                  <button
                    onClick={() => handleSelectAuthor(null)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-[13px] font-bold transition-colors",
                      !selectedAuthor ? "text-primary bg-orange-50" : "text-foreground hover:bg-gray-50"
                    )}
                  >
                    전체 레시퍼
                  </button>
                  {subscribedAuthors.length > 0 ? (
                    subscribedAuthors.map((author) => (
                      <button
                        key={author}
                        onClick={() => handleSelectAuthor(author)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors border-t border-muted/20",
                          selectedAuthor === author ? "text-primary bg-orange-50" : "text-foreground hover:bg-gray-50"
                        )}
                      >
                        {author}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-[12px] text-muted-foreground border-t border-muted/20">
                      구독 중인 레시퍼가 없습니다
                    </div>
                  )}
                </div>
              )}

              {/* 좋아요 Dropdown */}
              {filter.id === "liked" && openDropdown === "liked" && (
                <div className="absolute top-full left-0 mt-2 z-20 w-36 bg-white rounded-2xl shadow-xl border border-muted/30 overflow-hidden">
                  {[
                    { id: null, label: "전체 좋아요" },
                    { id: "집밥", label: "집밥" },
                    { id: "배달", label: "배달" },
                    { id: "외식", label: "외식" },
                  ].map((option, idx) => (
                    <button
                      key={option.label}
                      onClick={() => handleSelectLikedType(option.id)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors",
                        idx > 0 && "border-t border-muted/20",
                        (selectedLikedType === option.id || (!selectedLikedType && !option.id))
                          ? "text-primary bg-orange-50 font-bold"
                          : "text-foreground hover:bg-gray-50"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Active sub-filter label */}
        {feedFilter === "subscribed" && selectedAuthor && (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-primary">구독 레시퍼 :</span>
            <span className="text-[12px] font-bold text-foreground">{selectedAuthor}</span>
            <button onClick={() => setSelectedAuthor(null)} className="ml-1">
              <X className="size-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}
        {feedFilter === "liked" && selectedLikedType && (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-primary">좋아요 :</span>
            <span className="text-[12px] font-bold text-foreground">{selectedLikedType}</span>
            <button onClick={() => setSelectedLikedType(null)} className="ml-1">
              <X className="size-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}
      </div>
      </div>{/* end sticky */}

      {/* Feed Posts */}
      <div className="flex flex-col gap-5">
        {filteredPosts.length === 0 ? (
          <div className="relative overflow-hidden bg-white rounded-[2rem] shadow-[0_10px_25px_rgba(0,0,0,0.04)] opacity-80 pointer-events-none">
            {/* 샘플 리본 */}
            <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 z-10">
              <div className="absolute top-4 -right-8 w-32 bg-yellow-400 text-yellow-900 text-[10px] font-black py-1 text-center rotate-45 shadow-md">
                💡 SAMPLE
              </div>
            </div>
            
            {/* Author Header */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="size-10 rounded-full bg-cover bg-center ring-2 ring-orange-100 bg-slate-200"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold text-foreground">허브 매니저</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600">
                      공식
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">1시간 전</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-3">
              <p className="text-[14px] font-medium leading-relaxed text-foreground whitespace-pre-line">
                {feedFilter === "subscribed" 
                  ? "아직 구독한 레시퍼가 없습니다.\n먹톡에서 마음에 드는 레시퍼를 구독해보세요!"
                  : "아직 좋아요한 게시글이 없습니다.\n마음에 드는 게시글에 좋아요를 눌러보세요!"}
              </p>
            </div>

            {/* Image placeholder */}
            <div className="relative w-full aspect-square bg-slate-100 flex items-center justify-center">
               <div className="size-20 rounded-full bg-orange-50 flex items-center justify-center mb-5">
                 {feedFilter === "subscribed" ? (
                   <UserPlus className="size-9 text-primary/40" />
                 ) : (
                   <Heart className="size-9 text-primary/40" />
                 )}
               </div>
               <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent flex items-end justify-center pb-4">
                 <span className="text-xs font-black text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm">
                   실제 활동을 시작하면 샘플은 사라져요!
                 </span>
               </div>
            </div>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-[2rem] overflow-hidden shadow-[0_10px_25px_rgba(0,0,0,0.04)]">
              {/* Author Header */}
              <div className="flex items-center justify-between p-4 pb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="size-10 rounded-full bg-cover bg-center ring-2 ring-orange-100"
                    style={{ backgroundImage: `url("${post.author.avatar}")` }}
                  />
                  <div>
                    <p className="font-bold text-sm text-foreground">{post.author.name}</p>
                    <p className="text-[10px] text-muted-foreground">{post.date}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleFollow(post.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                    post.author.isFollowing
                      ? "bg-gray-100 text-muted-foreground"
                      : "bg-primary text-white"
                  )}
                >
                  {post.author.isFollowing ? (
                    <>
                      <UserCheck className="size-3.5" />
                      <span>구독중</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" />
                      <span>구독</span>
                    </>
                  )}
                </button>
              </div>

              {/* Image */}
              <div className="relative aspect-square">
                <div 
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url("${post.image}")` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold rounded-md border border-white/30">
                    {post.type}
                  </span>
                </div>
              </div>

              {/* Interaction Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-muted/50">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1.5 group"
                  >
                    <Heart 
                      className={cn(
                        "size-6 transition-all",
                        post.isLiked 
                          ? "fill-red-500 text-red-500 scale-110" 
                          : "text-muted-foreground group-hover:text-red-400"
                      )}
                    />
                    <span className={cn(
                      "text-sm font-bold",
                      post.isLiked ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {post.likes}
                    </span>
                  </button>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1.5 group"
                  >
                    <MessageCircle className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-bold text-muted-foreground">
                      {post.comments.length}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-0.5 text-primary">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`size-3.5 ${i < post.rating ? 'fill-current' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 pt-3">
                <h3 className="font-bold text-foreground text-lg mb-2">{post.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground mb-3">
                  {post.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <span key={tag} className="text-[10px] font-bold text-primary bg-orange-50 px-2.5 py-1 rounded-lg">
                      {tag}
                    </span>
                  ))}
                </div>
                
                {/* Recipe Section */}
                {post.recipe && (
                  <div className="mt-3">
                      <button
                        onClick={() => toggleRecipe(post.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-t-2xl text-xs font-bold transition-all",
                          expandedRecipe === post.id
                            ? "bg-primary text-white shadow-md shadow-primary/20 rounded-b-none"
                            : "bg-orange-50 text-primary hover:bg-orange-100 rounded-2xl"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="size-3.5" />
                          <span>레시피</span>
                        </div>
                        {expandedRecipe === post.id
                          ? <ChevronUp className="size-3" />
                          : <ChevronDown className="size-3" />
                        }
                      </button>
                      
                      {/* Recipe Content Box */}
                      {expandedRecipe === post.id && post.recipe && (
                        <div className="rounded-b-2xl overflow-hidden border-x border-b border-primary/20 bg-orange-50/40 px-4 py-4">
                          {/* URL type - thumbnail only */}
                          {post.recipe.type === "url" && post.recipe.thumbnail && (
                            <a
                              href={post.recipe.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block relative group rounded-xl overflow-hidden"
                            >
                              <div 
                                className="aspect-video bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                                style={{ backgroundImage: `url("${post.recipe.thumbnail}")` }}
                              />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <div className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full flex items-center gap-2 shadow-lg">
                                  {post.recipe.url?.includes("instagram") ? (
                                    <div className="size-5 rounded-md bg-gradient-to-br from-[#E1306C] via-[#C13584] to-[#833AB4] flex items-center justify-center">
                                      <svg className="size-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                      </svg>
                                    </div>
                                  ) : (
                                    <div className="size-5 rounded-md bg-red-600 flex items-center justify-center">
                                      <svg className="size-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                      </svg>
                                    </div>
                                  )}
                                  <span className="text-xs font-bold text-foreground">레시피 보기</span>
                                </div>
                              </div>
                            </a>
                          )}
                          
                          {/* Memo type - simple text */}
                          {post.recipe.type === "memo" && post.recipe.memo && (
                            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                              {post.recipe.memo}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* Comments Section */}
              {expandedComments === post.id && (
                <div className="border-t border-muted/50 bg-gray-50/50">
                  {/* Comments List */}
                  <div className="max-h-[200px] overflow-y-auto hide-scrollbar">
                    {post.comments.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        첫 번째 댓글을 남겨보세요!
                      </div>
                    ) : (
                      post.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 p-4 border-b border-muted/30 last:border-b-0">
                          <div 
                            className="size-8 rounded-full bg-cover bg-center shrink-0"
                            style={{ backgroundImage: `url("${comment.avatar}")` }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-xs text-foreground">{comment.author}</span>
                              <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Input */}
                  <div className="flex items-center gap-2 p-3 border-t border-muted/50 bg-white">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddComment(post.id)
                      }}
                      placeholder="댓글을 입력하세요..."
                      className="flex-1 px-3 py-2 bg-gray-100 rounded-full text-xs outline-none focus:ring-2 focus:ring-orange-200"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!newComment.trim()}
                      className={cn(
                        "p-2 rounded-full transition-all",
                        newComment.trim()
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-muted-foreground"
                      )}
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
