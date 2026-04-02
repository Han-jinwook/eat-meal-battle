"use client"

import { useState } from "react"
import { 
  UserPlus, 
  MapPin, 
  List, 
  Star,
  Heart,
  MoreHorizontal,
  Plus,
  X,
  Search,
  Navigation,
  ExternalLink,
  Bookmark
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Friend {
  id: number
  name: string
  avatar: string
  isOnline: boolean
}

interface Restaurant {
  id: number
  name: string
  image: string
  category: string
  location: string
  address: string
  rating: 5
  sharedBy: {
    name: string
    avatar: string
  }
  sharedAt: string
  comment: string
  likes: number
  isLiked: boolean
  isSaved: boolean
  coordinates: {
    lat: number
    lng: number
  }
}

interface FriendGroup {
  id: number
  name: string
  members: Friend[]
  restaurantCount: number
}

const myFriends: Friend[] = [
  { id: 1, name: "민수", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face", isOnline: true },
  { id: 2, name: "수진", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face", isOnline: true },
  { id: 3, name: "현우", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face", isOnline: false },
  { id: 4, name: "지은", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face", isOnline: true },
  { id: 5, name: "태현", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face", isOnline: false },
]

const friendGroups: FriendGroup[] = [
  {
    id: 1,
    name: "대학 동기",
    members: myFriends.slice(0, 3),
    restaurantCount: 12
  },
  {
    id: 2,
    name: "회사 동료",
    members: myFriends.slice(2, 5),
    restaurantCount: 8
  }
]

const sharedRestaurants: Restaurant[] = [
  {
    id: 1,
    name: "스시 오마카세 히든",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop",
    category: "일식",
    location: "강남",
    address: "서울 강남구 역삼동 123-45",
    rating: 5,
    sharedBy: { name: "민수", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" },
    sharedAt: "2시간 전",
    comment: "여기 진짜 대박... 도로 녹아요 ㅠㅠ 예약 필수!",
    likes: 5,
    isLiked: true,
    isSaved: true,
    coordinates: { lat: 37.4979, lng: 127.0276 }
  },
  {
    id: 2,
    name: "라멘 이치란 홍대점",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop",
    category: "일식",
    location: "홍대",
    address: "서울 마포구 서교동 456-78",
    rating: 5,
    sharedBy: { name: "수진", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face" },
    sharedAt: "어제",
    comment: "혼밥하기 좋고 국물이 진짜 깊어요",
    likes: 3,
    isLiked: false,
    isSaved: false,
    coordinates: { lat: 37.5563, lng: 126.9220 }
  },
  {
    id: 3,
    name: "고기리 막국수",
    image: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=400&h=400&fit=crop",
    category: "한식",
    location: "용인",
    address: "경기 용인시 처인구 고기리 789",
    rating: 5,
    sharedBy: { name: "현우", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face" },
    sharedAt: "3일 전",
    comment: "드라이브 겸 가기 좋아요. 웨이팅 있어도 가치있음",
    likes: 8,
    isLiked: true,
    isSaved: true,
    coordinates: { lat: 37.2636, lng: 127.1780 }
  },
  {
    id: 4,
    name: "평양냉면 을밀대",
    image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400&h=400&fit=crop",
    category: "한식",
    location: "을지로",
    address: "서울 중구 을지로 234",
    rating: 5,
    sharedBy: { name: "지은", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face" },
    sharedAt: "1주일 전",
    comment: "전통 평양냉면의 진수. 어른들 모시고 가기 좋아요",
    likes: 12,
    isLiked: false,
    isSaved: false,
    coordinates: { lat: 37.5660, lng: 126.9910 }
  }
]

type ViewMode = "feed" | "list"

export function TalkPage() {
  const [restaurants, setRestaurants] = useState(sharedRestaurants)
  const [viewMode, setViewMode] = useState<ViewMode>("feed")
  const [selectedGroup, setSelectedGroup] = useState<FriendGroup | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)

  const toggleLike = (restaurantId: number) => {
    setRestaurants(restaurants.map(r => 
      r.id === restaurantId 
        ? { ...r, isLiked: !r.isLiked, likes: r.isLiked ? r.likes - 1 : r.likes + 1 }
        : r
    ))
  }

  const toggleSave = (restaurantId: number) => {
    setRestaurants(restaurants.map(r => 
      r.id === restaurantId 
        ? { ...r, isSaved: !r.isSaved }
        : r
    ))
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-foreground text-lg">맛톡</h2>
            <p className="text-xs text-muted-foreground mt-0.5">믿을 수 있는 지인의 5점 맛집</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCreateGroupModal(true)}
              className="size-10 rounded-xl bg-orange-50 flex items-center justify-center text-primary hover:bg-orange-100 transition-colors"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>

        {/* Friend Groups */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">내 그룹</span>
            <button className="text-xs text-primary font-bold">전체보기</button>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <button
              onClick={() => setSelectedGroup(null)}
              className={cn(
                "shrink-0 px-4 py-2.5 rounded-2xl border-2 transition-all",
                selectedGroup === null
                  ? "border-primary bg-orange-50 text-primary"
                  : "border-muted bg-white text-muted-foreground hover:border-primary/30"
              )}
            >
              <span className="text-sm font-bold">전체</span>
              <span className="text-xs ml-1.5 opacity-70">{sharedRestaurants.length}</span>
            </button>
            {friendGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={cn(
                  "shrink-0 px-4 py-2.5 rounded-2xl border-2 transition-all",
                  selectedGroup?.id === group.id
                    ? "border-primary bg-orange-50 text-primary"
                    : "border-muted bg-white text-muted-foreground hover:border-primary/30"
                )}
              >
                <span className="text-sm font-bold">{group.name}</span>
                <span className="text-xs ml-1.5 opacity-70">{group.restaurantCount}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Friends in selected group */}
        {selectedGroup && (
          <div className="mt-4 pt-4 border-t border-muted/50">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              {selectedGroup.members.map((friend) => (
                <div key={friend.id} className="flex flex-col items-center gap-1 shrink-0">
                  <div className="relative">
                    <img
                      src={friend.avatar || "/placeholder.svg"}
                      alt={friend.name}
                      className="size-10 rounded-xl object-cover border-2 border-white shadow-sm"
                    />
                    {friend.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-green-400 border-2 border-white" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">{friend.name}</span>
                </div>
              ))}
              <button 
                onClick={() => setShowInviteModal(true)}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div className="size-10 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <UserPlus className="size-4 text-muted-foreground/50" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">초대</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-white/70 rounded-xl">
          <button
            onClick={() => setViewMode("feed")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewMode === "feed" ? "bg-primary text-white" : "text-muted-foreground hover:bg-white"
            )}
          >
            피드
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
              viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-white"
            )}
          >
            <List className="size-3.5" />
            리스트
          </button>
        </div>
        <span className="text-xs text-muted-foreground">{restaurants.length}개의 맛집</span>
      </div>

      {/* Content by View Mode */}
      {viewMode === "feed" && (
        <div className="flex flex-col gap-4">
          {restaurants.map((restaurant) => (
            <div key={restaurant.id} className="bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white shadow-lg">
              {/* Author Header */}
              <div className="flex items-center justify-between p-4 pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={restaurant.sharedBy.avatar || "/placeholder.svg"}
                    alt={restaurant.sharedBy.name}
                    className="size-10 rounded-xl object-cover border-2 border-white shadow-sm"
                  />
                  <div>
                    <span className="font-bold text-sm text-foreground">{restaurant.sharedBy.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="size-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{restaurant.sharedAt}</span>
                    </div>
                  </div>
                </div>
                <button className="size-8 rounded-lg hover:bg-muted/50 flex items-center justify-center">
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </button>
              </div>

              {/* Image */}
              <div className="relative aspect-[4/3]">
                <img src={restaurant.image || "/placeholder.svg"} alt={restaurant.name} className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2">
                    <h3 className="font-bold text-white text-sm">{restaurant.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="size-3 text-white/70" />
                      <span className="text-xs text-white/70">{restaurant.location} · {restaurant.category}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div className="p-4 pt-3">
                <p className="text-sm text-foreground leading-relaxed">"{restaurant.comment}"</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-4 pb-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleLike(restaurant.id)}
                    className="flex items-center gap-1.5"
                  >
                    <Heart className={cn(
                      "size-5 transition-all",
                      restaurant.isLiked ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-sm font-bold",
                      restaurant.isLiked ? "text-red-500" : "text-muted-foreground"
                    )}>{restaurant.likes}</span>
                  </button>
                  <button 
                    onClick={() => toggleSave(restaurant.id)}
                    className="flex items-center gap-1.5"
                  >
                    <Bookmark className={cn(
                      "size-5 transition-all",
                      restaurant.isSaved ? "fill-primary text-primary" : "text-muted-foreground"
                    )} />
                  </button>
                </div>
                <button 
                  onClick={() => setSelectedRestaurant(restaurant)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg text-primary text-xs font-bold hover:bg-orange-100 transition-colors"
                >
                  <Navigation className="size-3.5" />
                  <span>길찾기</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "list" && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white shadow-lg">
          {/* Search */}
          <div className="p-4 border-b border-muted/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="맛집 검색"
                className="w-full pl-10 pr-4 py-2.5 bg-muted/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-muted/50">
            {restaurants.map((restaurant) => (
              <div key={restaurant.id} className="p-4 flex items-center gap-3">
                <img src={restaurant.image || "/placeholder.svg"} alt="" className="size-14 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-foreground truncate">{restaurant.name}</h4>
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-orange-50 text-primary rounded font-bold">
                      {restaurant.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <MapPin className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{restaurant.location}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <img src={restaurant.sharedBy.avatar || "/placeholder.svg"} alt="" className="size-4 rounded-full" />
                    <span className="text-[10px] text-muted-foreground">{restaurant.sharedBy.name}</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="size-2.5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button 
                    onClick={() => toggleSave(restaurant.id)}
                    className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"
                  >
                    <Bookmark className={cn(
                      "size-4",
                      restaurant.isSaved ? "fill-primary text-primary" : "text-muted-foreground"
                    )} />
                  </button>
                  <button className="size-8 rounded-lg hover:bg-muted flex items-center justify-center">
                    <ExternalLink className="size-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">친구 초대하기</h3>
              <button onClick={() => setShowInviteModal(false)} className="size-8 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">초대 링크를 공유하여 친구를 그룹에 초대하세요</p>
            <div className="bg-muted rounded-xl p-3 mb-4">
              <p className="text-xs text-muted-foreground break-all">https://whateat.app/talk/invite/xyz789</p>
            </div>
            <button className="w-full py-3 bg-primary text-white font-bold rounded-xl">
              링크 복사하기
            </button>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">새 그룹 만들기</h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="size-8 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">그룹 이름</label>
                <input 
                  type="text"
                  placeholder="예: 대학 동기, 회사 점심팟"
                  className="w-full px-4 py-3 bg-muted/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">친구 초대</label>
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-xl min-h-[60px]">
                  {myFriends.slice(0, 2).map((friend) => (
                    <div key={friend.id} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg">
                      <img src={friend.avatar || "/placeholder.svg"} alt="" className="size-5 rounded-full" />
                      <span className="text-xs font-medium">{friend.name}</span>
                      <X className="size-3 text-muted-foreground cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full py-3 bg-primary text-white font-bold rounded-xl mt-2">
                그룹 만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
