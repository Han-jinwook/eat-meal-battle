"use client"

import { useState } from "react"
import { 
  Users, 
  UserPlus, 
  Crown, 
  Share2, 
  Vote as VoteIcon, 
  ChefHat, 
  Bell, 
  Check, 
  X, 
  Plus,
  Heart,
  Clock,
  Utensils,
  MoreVertical,
  Settings
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
  likes: number
  isLiked: boolean
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
    likes: 3,
    isLiked: true
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop",
    title: "건강 샐러드",
    sharedBy: "딸",
    sharedAt: "어제",
    likes: 2,
    isLiked: false
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

export function FamilyPage() {
  const [activeTab, setActiveTab] = useState<TabType>("shared")
  const [meals, setMeals] = useState(sharedMeals)
  const [vote, setVote] = useState(activeVote)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateVoteModal, setShowCreateVoteModal] = useState(false)
  const [showDecideMenuModal, setShowDecideMenuModal] = useState(false)

  const toggleLike = (mealId: number) => {
    setMeals(meals.map(meal => 
      meal.id === mealId 
        ? { ...meal, isLiked: !meal.isLiked, likes: meal.isLiked ? meal.likes - 1 : meal.likes + 1 }
        : meal
    ))
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

  const tabs = [
    { id: "shared" as TabType, label: "공유된 식사", icon: Share2 },
    { id: "vote" as TabType, label: "투표", icon: VoteIcon },
    { id: "menu" as TabType, label: "오늘의 메뉴", icon: ChefHat },
  ]

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Family Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 border border-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center">
              <Users className="size-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">우리 가족</h2>
              <p className="text-xs text-muted-foreground">4명의 구성원</p>
            </div>
          </div>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="size-10 rounded-xl bg-orange-50 flex items-center justify-center text-primary hover:bg-orange-100 transition-colors"
          >
            <UserPlus className="size-5" />
          </button>
        </div>

        {/* Family Members */}
        <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1">
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all",
              activeTab === tab.id
                ? "bg-primary text-white shadow-md"
                : "bg-white/70 text-muted-foreground hover:bg-white"
            )}
          >
            <tab.icon className="size-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "shared" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">가족이 공유한 식사</h3>
            <button className="text-xs text-primary font-bold">내 기록에서 공유하기</button>
          </div>
          
          {meals.length === 0 ? (
            <div className="bg-white/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <Share2 className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">아직 공유된 식사가 없어요</p>
              <p className="text-xs text-muted-foreground/70 mt-1">먹로그에서 가족에게 공유해보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {meals.map((meal) => (
                <div key={meal.id} className="bg-white/80 rounded-2xl overflow-hidden border border-white shadow-md">
                  <div className="relative aspect-square">
                    <img src={meal.image || "/placeholder.svg"} alt={meal.title} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => toggleLike(meal.id)}
                      className="absolute top-2 right-2 size-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center"
                    >
                      <Heart className={cn("size-4", meal.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                    </button>
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-sm text-foreground truncate">{meal.title}</h4>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">{meal.sharedBy} · {meal.sharedAt}</span>
                      <span className="text-[10px] text-primary font-bold">{meal.likes} likes</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "vote" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground">진행 중인 투표</h3>
            <button 
              onClick={() => setShowCreateVoteModal(true)}
              className="flex items-center gap-1 text-xs text-primary font-bold"
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
                    <span className="text-xs text-primary font-bold flex items-center gap-1">
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
                          ? "border-primary bg-orange-50" 
                          : "border-muted hover:border-primary/50 bg-white"
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
                        <span className="font-bold text-primary">{option.votes}</span>
                        {hasVoted && <Check className="size-4 text-primary" />}
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
              className="flex items-center gap-1 text-xs text-primary font-bold"
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
                      menu ? "bg-gradient-to-br from-primary to-orange-400" : "bg-muted"
                    )}>
                      <Utensils className={cn("size-5", menu ? "text-white" : "text-muted-foreground")} />
                    </div>
                    
                    {menu ? (
                      <div className="flex-1 flex items-center gap-3">
                        <img src={menu.image || "/placeholder.svg"} alt={menu.title} className="size-14 rounded-xl object-cover" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">{label}</span>
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
          <div className="bg-gradient-to-r from-primary/10 to-orange-100/50 rounded-2xl p-4 border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Bell className="size-5 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-sm">알림 설정</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {"메뉴가 결정되면 가족 모두에게 알림이 전송돼요"}
                </p>
                <button className="text-xs text-primary font-bold mt-2">설정 변경</button>
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
              <p className="text-xs text-muted-foreground break-all">https://whateat.app/invite/abc123xyz</p>
            </div>
            <button className="w-full py-3 bg-primary text-white font-bold rounded-xl">
              링크 복사하기
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
                  className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">후보 메뉴 (2-3개)</label>
                <div className="flex flex-col gap-2">
                  <input type="text" placeholder="메뉴 1" className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" />
                  <input type="text" placeholder="메뉴 2" className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" />
                  <input type="text" placeholder="메뉴 3 (선택)" className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <button className="w-full py-3 bg-primary text-white font-bold rounded-xl mt-2">
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
                    <button key={time} className="flex-1 py-2 px-3 rounded-xl border-2 border-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors">
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
                  className="w-full px-4 py-3 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button className="w-full py-3 bg-primary text-white font-bold rounded-xl mt-2 flex items-center justify-center gap-2">
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
