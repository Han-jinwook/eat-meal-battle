"use client"

import { useState, useRef, useEffect } from "react"
import { Lightbulb, BookOpen, Star, MessageSquare, Pencil, Search, ChevronDown, ArrowUpDown, ChefHat, Bike, UtensilsCrossed, ExternalLink, Plus, Trash2, Heart, Send } from "lucide-react"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
import { AddLogModal, type MealLogData } from "@/components/whateat/add-log-modal"
import { ImageViewer } from "@/components/whateat/image-viewer"
import { createClient } from "@/lib/supabase"
import { useHub } from "@/services/merlin-hub-sdk/react"


const defaultMealLogs = [
  {
    id: 1,
    date: "2026. 04. 10",
    type: "외식",
    title: "채끝 스테이크",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&fit=crop",
    rating: 5,
    tips: ["미디움 레어로 굽기가 딱 좋음", "소금 and 와사비 조합 추천"],
    tipTitle: "추천 메뉴",
    linkUrl: "https://naver.me/placeholder1",
    linkThumbnail: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&fit=crop",
    placeName: "아웃백 스테이크하우스"
  },
  {
    id: 2,
    date: "2026. 03. 25",
    type: "집밥",
    title: "바질 페스토 파스타",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=500&fit=crop",
    rating: 4,
    tips: ["면수는 버리지 말고 농도 맞출 때 사용", "생 바질 잎을 고명으로 얹으면 향이 배가됨"],
    tipTitle: "조리 팁",
    healthy: true
  },
  {
    id: 3,
    date: "2026. 03. 18",
    type: "배달",
    title: "반반 치킨 (후라이드/양념)",
    image: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&fit=crop",
    rating: 5,
    tips: ["리뷰 이벤트로 감자튀김 받기", "양념 소스가 매콤달콤해서 밥이랑 어울림"],
    tipTitle: "추천 메뉴",
    linkUrl: "https://naver.me/placeholder2",
    linkThumbnail: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=100&fit=crop",
    placeName: "처갓집 양념치킨"
  }
]

const mealTypeOptions = [
  { id: "전체", label: "전체", icon: null },
  { id: "집밥", label: "집밥", icon: ChefHat },
  { id: "배달", label: "배달", icon: Bike },
  { id: "외식", label: "외식", icon: UtensilsCrossed },
] as const

interface MealLogTabProps {
  jumpToDate?: { date: string; key: number } | null
  showBackToCalendar?: boolean
  onBackToCalendar?: () => void
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

// Base64 데이터를 Blob으로 변환하는 헬퍼 함수
function base64ToBlob(base64Data: string, contentType = "image/webp") {
  const byteString = atob(base64Data.split(",")[1])
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type: contentType })
}

export function MealLogTab({ jumpToDate, showBackToCalendar = false, onBackToCalendar }: MealLogTabProps) {
  const { isLoggedIn, user } = useHub()
  const [viewerImage, setViewerImage] = useState<string | null>(null)
  const [mealLogs, setMealLogs] = useState<any[]>([])

  // 거주 지역 등록 모달 관련 상태 변수
  const [regionModalOpen, setRegionModalOpen] = useState(false)
  const [inputCity, setInputCity] = useState("")
  const [inputGu, setInputGu] = useState("")
  const [inputDong, setInputDong] = useState("")
  const [isRegionSaving, setIsRegionSaving] = useState(false)

  // 댓글 및 대댓글 관련 상태
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ mealId: any; commentId: string } | null>(null)
  const [visibleMemoInputs, setVisibleMemoInputs] = useState<Record<string | number, boolean>>({})

  // Supabase Storage에 파일 업로드하는 함수
  const uploadImageToStorage = async (base64Image: string): Promise<string> => {
    if (!user?.id) throw new Error("User not logged in")
    const supabase = createClient()
    const blob = base64ToBlob(base64Image)
    const fileName = `solo_${user.id}_${Date.now()}.webp`

    const { data, error } = await supabase.storage
      .from("meal-images")
      .upload(fileName, blob, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false
      })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from("meal-images")
      .getPublicUrl(fileName)

    return urlData.publicUrl
  }

  const handleAddComment = async (mealId: any) => {
    const inputContent = commentInputs[mealId]?.trim()
    if (!inputContent) return

    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("샘플 데이터에는 댓글을 작성할 수 없습니다.", { icon: "💡", duration: 3000 })
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    try {
      const supabase = createClient()
      const newCommentId = generateUUID()
      const newComment = {
        id: newCommentId,
        meal_id: mealId,
        user_id: user.id,
        content: inputContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      }

      const { error } = await supabase.from("comments").insert(newComment)
      if (error) throw error

      setMealLogs(prev => prev.map(log => {
        if (log.id === mealId) {
          const updatedComments = [
            ...(log.comments || []),
            {
              id: newCommentId,
              userId: user.id,
              author: user.nickname || "나",
              avatar: user.profile_image || "",
              content: inputContent,
              createdAt: new Date().toLocaleDateString("ko-KR"),
              likes: 0,
              isLiked: false,
              replies: []
            }
          ]
          const firstComment = updatedComments.find(c => c.userId === log.uploaded_by)
          return {
            ...log,
            description: firstComment?.content || log.description,
            comments: updatedComments
          }
        }
        return log
      }))

      setCommentInputs(prev => ({ ...prev, [mealId]: "" }))
      toast.success("댓글이 등록되었습니다.")
    } catch (err) {
      console.error("Failed to add comment:", err)
      toast.error("댓글 등록에 실패했습니다.")
    }
  }

  const handleAddReply = async (mealId: any, commentId: string) => {
    const inputContent = replyInputs[commentId]?.trim()
    if (!inputContent) return

    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("샘플 데이터에는 답글을 작성할 수 없습니다.", { icon: "💡", duration: 3000 })
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    try {
      const supabase = createClient()
      const newReplyId = generateUUID()
      const newReply = {
        id: newReplyId,
        comment_id: commentId,
        user_id: user.id,
        content: inputContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      }

      const { error } = await supabase.from("comment_replies").insert(newReply)
      if (error) throw error

      setMealLogs(prev => prev.map(log => {
        if (log.id === mealId) {
          const updatedComments = (log.comments || []).map((c: any) => {
            if (c.id === commentId) {
              return {
                ...c,
                replies: [
                  ...(c.replies || []),
                  {
                    id: newReplyId,
                    userId: user.id,
                    author: user.nickname || "나",
                    avatar: user.profile_image || "",
                    content: inputContent,
                    createdAt: new Date().toLocaleDateString("ko-KR"),
                    likes: 0,
                    isLiked: false
                  }
                ]
              }
            }
            return c
          })
          return { ...log, comments: updatedComments }
        }
        return log
      }))

      setReplyInputs(prev => ({ ...prev, [commentId]: "" }))
      setActiveReplyTarget(null)
      toast.success("답글이 등록되었습니다.")
    } catch (err) {
      console.error("Failed to add reply:", err)
      toast.error("답글 등록에 실패했습니다.")
    }
  }

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

      // 대기 중인 식사 업로드 속행
      if (pendingShareData) {
        await upload5StarMealToSupabase(pendingShareData.logData, pendingShareData.imageUrl)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("navigateToTalk"))
        }, 100)
      }
      setPendingShareData(null)

    } catch (err) {
      console.error("Failed to save user region on 5star promotion:", err)
      toast.error("지역 저장에 실패했습니다. 다시 시도해 주세요.")
    } finally {
      setIsRegionSaving(false)
    }
  }
  const [isLoaded, setIsLoaded] = useState(false)

  // DB에서 식사 및 댓글 불러오기
  useEffect(() => {
    const fetchDbLogs = async () => {
      if (!isLoggedIn || !user?.id) {
        // 비로그인이면 기본 샘플 3개 표시
        setMealLogs(defaultMealLogs)
        setIsLoaded(true)
        return
      }

      try {
        const supabase = createClient()
        // 1. meal_images 조회
        const { data: imgData, error: imgError } = await supabase
          .from("meal_images")
          .select("*")
          .eq("uploaded_by", user.id)
          .order("created_at", { ascending: false })

        if (imgError) throw imgError

        if (!imgData || imgData.length === 0) {
          setMealLogs(defaultMealLogs)
          setIsLoaded(true)
          return
        }

        const mealIds = imgData.map(img => img.id)

        // 2. comments 및 대댓글 조회
        let dbComments: any[] = []
        let dbCommentUsers: any[] = []
        let dbReplies: any[] = []
        if (mealIds.length > 0) {
          const { data: commentsData } = await supabase
            .from("comments")
            .select("*")
            .in("meal_id", mealIds)
            .eq("is_deleted", false)
            .order("created_at", { ascending: true })
          dbComments = commentsData || []

          const commentIds = dbComments.map(c => c.id)
          if (commentIds.length > 0) {
            const { data: repliesData } = await supabase
              .from("comment_replies")
              .select("*")
              .in("comment_id", commentIds)
              .eq("is_deleted", false)
              .order("created_at", { ascending: true })
            dbReplies = repliesData || []
          }

          const commentUserIds = Array.from(new Set([
            ...dbComments.map(c => c.user_id),
            ...dbReplies.map(r => r.user_id)
          ].filter(Boolean)))

          if (commentUserIds.length > 0) {
            const { data: usersData } = await supabase
              .from("users")
              .select("id, nickname, profile_image")
              .in("id", commentUserIds)
            dbCommentUsers = usersData || []
          }
        }
        const commentUserMap = new Map(dbCommentUsers.map(u => [u.id, u]))

        // Map replies by comment_id
        const repliesMap = new Map<string, any[]>()
        dbReplies.forEach(r => {
          const arr = repliesMap.get(r.comment_id) || []
          const rUser = commentUserMap.get(r.user_id)
          arr.push({
            id: r.id,
            userId: r.user_id,
            author: rUser?.nickname || (r.user_id === user.id ? (user.nickname || "나") : "익명 회원"),
            avatar: rUser?.profile_image || "",
            content: r.content,
            createdAt: new Date(r.created_at).toLocaleDateString("ko-KR"),
            likes: 0,
            isLiked: false
          })
          repliesMap.set(r.comment_id, arr)
        })

        // Map comments by meal_id
        const commentsMap = new Map<string, any[]>()
        dbComments.forEach(c => {
          const arr = commentsMap.get(c.meal_id) || []
          const cUser = commentUserMap.get(c.user_id)
          arr.push({
            id: c.id,
            userId: c.user_id,
            author: cUser?.nickname || (c.user_id === user.id ? (user.nickname || "나") : "익명 회원"),
            avatar: cUser?.profile_image || "",
            content: c.content,
            createdAt: new Date(c.created_at).toLocaleDateString("ko-KR"),
            likes: 0,
            isLiked: false,
            replies: repliesMap.get(c.id) || []
          })
          commentsMap.set(c.meal_id, arr)
        })

        // 3. mealLogs 매핑
        const mappedLogs = imgData.map((img: any) => {
          let meta: any = {}
          try {
            meta = img.explanation ? JSON.parse(img.explanation) : {}
          } catch (e) {
            meta = { title: img.explanation || "식사" }
          }

          let mappedType: "집밥" | "배달" | "외식" = "집밥"
          const rawType = img.meal_type || meta.mealType || ""
          if (rawType === "집밥" || rawType === "homemade") {
            mappedType = "집밥"
          } else if (rawType === "배달" || rawType === "delivery") {
            mappedType = "배달"
          } else if (rawType === "외식" || rawType === "dineout") {
            mappedType = "외식"
          }

          // Format Date YYYY. MM. DD
          const formattedDate = img.created_at 
            ? new Date(img.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\s/g, "").slice(0, -1)
            : new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\s/g, "").slice(0, -1)

          // 해당 meal의 comments 목록
          const cardComments = commentsMap.get(img.id) || []
          // 이 식사 작성자가 남긴 첫 번째 댓글을 description(메모)으로 사용하도록 함
          const firstComment = cardComments.find(c => c.userId === img.uploaded_by)
          const displayDescription = img.description || meta.description || firstComment?.content || ""

          return {
            id: img.id, // UUID
            date: formattedDate,
            type: mappedType,
            title: img.title || meta.title || "맛있는 식사",
            image: img.image_url || "/images/placeholder-food.jpg",
            rating: img.rating || meta.rating || 5,
            tips: meta.tips || [],
            tipTitle: mappedType === "집밥" ? "조리 팁" : "추천 메뉴",
            linkUrl: img.link_url || meta.linkUrl || "",
            linkThumbnail: img.link_thumbnail || meta.linkThumbnail || "",
            placeName: img.place_name || meta.placeName || "",
            aiTag: img.source === "solo-5star" || img.source === "solo",
            healthy: mappedType === "집밥",
            status: img.status,
            description: displayDescription,
            comments: cardComments
          }
        })

        setMealLogs(mappedLogs)
      } catch (err) {
        console.error("Failed to load logs from Supabase:", err)
        toast.error("식사 기록을 불러오는데 실패했습니다.")
        setMealLogs(defaultMealLogs)
      } finally {
        setIsLoaded(true)
      }
    }

    fetchDbLogs()
  }, [isLoggedIn, user?.id])



  const upload5StarMealToSupabase = async (data: MealLogData, imageUrl: string) => {
    if (!isLoggedIn || !user?.id) {
      console.log("User not logged in. Cannot upload 5-star meal to Supabase.")
      return
    }

    const supabase = createClient()
    const metadata = {
      title: data.menuName,
      mealType: data.mealType,
      rating: data.rating || 5,
      tips: data.recipe?.split("\n").filter((t) => t.trim()) || [],
      placeName: data.place?.name || data.deliveryStoreName || (data.linkUrl ? "식사 공유 상세" : "식사 일지"),
      placeAddress: data.place?.address || "",
      description: data.description || data.recipe || "",
      promotedAt: new Date().toISOString(), // 맛톡 승격 시점의 일시 저장
      linkUrl: data.linkUrl || "",
      linkThumbnail: data.linkThumbnail || ""
    }

    // Generate supabaseId if not already present
    const uuid = data.id || (data as any).supabaseId || generateUUID()

    const { error } = await supabase.from("meal_images").upsert({
      id: uuid,
      image_url: imageUrl || "/images/placeholder-food.jpg",
      uploaded_by: user.id,
      explanation: JSON.stringify(metadata),
      source: "solo-5star",
      status: "approved",
      title: data.menuName,
      rating: data.rating || 5,
      meal_type: data.mealType,
      link_url: data.linkUrl || "",
      link_thumbnail: data.linkThumbnail || "",
      place_name: data.place?.name || data.deliveryStoreName || "",
      place_address: data.place?.address || "",
      description: data.description || ""
    })

    if (error) {
      throw error
    }
    console.log("Successfully uploaded 5-star meal to Supabase!")

    // comments 테이블에 첫 댓글로 저장
    if (data.description) {
      const { data: existingComments } = await supabase
        .from("comments")
        .select("id")
        .eq("meal_id", uuid)
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })

      if (existingComments && existingComments.length > 0) {
        await supabase
          .from("comments")
          .update({
            content: data.description,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingComments[0].id)
      } else {
        await supabase.from("comments").insert({
          id: generateUUID(),
          meal_id: uuid,
          user_id: user.id,
          content: data.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        })
      }
    }

    // 로컬 로그에 supabaseId 필드 업데이트 처리
    setMealLogs((logs) =>
      logs.map((log) => (log.id === data.id ? { ...log, supabaseId: uuid } : log))
    )
  }

  const [shareConsentModalOpen, setShareConsentModalOpen] = useState(false)
  const [pendingShareData, setPendingShareData] = useState<{
    logData: MealLogData
    imageUrl: string
  } | null>(null)
  const [rememberSharePref, setRememberSharePref] = useState(false)

  const checkConsentAndUpload = async (data: MealLogData, imageUrl: string) => {
    if (!isLoggedIn || !user?.id) return

    const supabase = createClient()
    const { data: userData } = await supabase
      .from('users')
      .select('region')
      .eq('id', user.id)
      .single()

    const hasRegion = userData?.region ? (() => {
      try {
        const parsed = JSON.parse(userData.region)
        return Boolean(parsed.city && parsed.gu && parsed.dong)
      } catch (e) {
        return false
      }
    })() : false

    const pref = localStorage.getItem("whateat_auto_share_5star")
    
    // 만약 지역 정보가 없다면 무조건 주소 입력 모달을 유도함
    if (!hasRegion) {
      setPendingShareData({ logData: data, imageUrl })
      setRegionModalOpen(true)
      return
    }

    if (pref === "approved") {
      await upload5StarMealToSupabase(data, imageUrl)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("navigateToTalk"))
      }, 100)
    } else if (pref === "rejected") {
      console.log("User rejected auto-sharing of 5-star meals.")
    } else {
      setPendingShareData({ logData: data, imageUrl })
      setShareConsentModalOpen(true)
    }
  }

  const [focusedMealId, setFocusedMealId] = useState<number | null>(null)
  const [expandedMemoId, setExpandedMemoId] = useState<number | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [soloCommentLikes, setSoloCommentLikes] = useState<Record<string, boolean>>({})
  const [editingMeal, setEditingMeal] = useState<MealLogData | null>(null)
  const [mealTypeFilter, setMealTypeFilter] = useState("전체")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOption, setSortOption] = useState<"날짜순" | "별점순" | "기간">("날짜순")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null)
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null)
  const [showDateRangePicker, setShowDateRangePicker] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
        setShowDateRangePicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Helper to parse date string
  const parseDateString = (dateStr: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T00:00:00`)
    }
    const parts = dateStr.replace(/\. /g, "-").replace(".", "").split("-")
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }

  const toDisplayDate = (isoDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
    const [y, m, d] = isoDate.split("-")
    return `${y}. ${m}. ${d}`
  }

  const toIsoDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  useEffect(() => {
    if (!jumpToDate) return

    setMealTypeFilter("전체")
    setSearchQuery("")
    setSortOption("날짜순")
    setSortDirection("desc")
    setDateRangeStart(null)
    setDateRangeEnd(null)

    const target = mealLogs.find((meal) => toIsoDate(parseDateString(meal.date)) === jumpToDate.date)
    if (!target) return

    setFocusedMealId(target.id)
    const timer = setTimeout(() => {
      cardRefs.current[target.id]?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)

    return () => clearTimeout(timer)
  }, [jumpToDate, mealLogs])

  useEffect(() => {
    if (focusedMealId === null) return
    const timer = setTimeout(() => setFocusedMealId(null), 1800)
    return () => clearTimeout(timer)
  }, [focusedMealId])

  useEffect(() => {
    if (expandedMemoId === null) return

    const handleOutsideMemoClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element | null
      if (!target) return

      if (target.closest(`[data-memo-box="${expandedMemoId}"]`)) {
        return
      }

      setExpandedMemoId(null)
    }

    document.addEventListener("mousedown", handleOutsideMemoClick)
    document.addEventListener("touchstart", handleOutsideMemoClick)

    return () => {
      document.removeEventListener("mousedown", handleOutsideMemoClick)
      document.removeEventListener("touchstart", handleOutsideMemoClick)
    }
  }, [expandedMemoId])

  const hasHomeMeal = mealLogs.some(log => log.type === "집밥")
  const hasDelivery = mealLogs.some(log => log.type === "배달")
  const hasOutMeal = mealLogs.some(log => log.type === "외식")

  const activeDefaultLogs = defaultMealLogs.filter(log => {
    if (log.type === "집밥" && hasHomeMeal) return false
    if (log.type === "배달" && hasDelivery) return false
    if (log.type === "외식" && hasOutMeal) return false
    return true
  })

  const displayLogs = [...activeDefaultLogs, ...mealLogs]

  // Filter and sort logs
  const filteredLogs = displayLogs
    .filter(log => {
      const matchesSearch = !searchQuery || 
        log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesMealType = mealTypeFilter === "전체" || log.type === mealTypeFilter
      
      // Date range filter
      let matchesDateRange = true
      if (sortOption === "기간" && (dateRangeStart || dateRangeEnd)) {
        const logDate = parseDateString(log.date)
        if (dateRangeStart) {
          const startDate = new Date(dateRangeStart)
          if (logDate < startDate) matchesDateRange = false
        }
        if (dateRangeEnd) {
          const endDate = new Date(dateRangeEnd)
          if (logDate > endDate) matchesDateRange = false
        }
      }
      
      return matchesSearch && matchesMealType && matchesDateRange
    })
    .sort((a, b) => {
      const descBase =
        sortOption === "별점순"
          ? b.rating - a.rating
          : parseDateString(b.date).getTime() - parseDateString(a.date).getTime()

      return sortDirection === "desc" ? descBase : -descBase
    })

  const getOptionCount = (optionId: (typeof mealTypeOptions)[number]["id"]) => {
    if (optionId === "전체") return displayLogs.length
    return displayLogs.filter((log) => log.type === optionId).length
  }

  const handleRatingChange = async (mealId: any, newRating: number) => {
    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("샘플 데이터에는 별점을 남길 수 없습니다.", { icon: "💡", duration: 3000 })
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    try {
      const supabase = createClient()
      
      const targetLog = mealLogs.find(log => log.id === mealId)
      if (!targetLog) return

      let status = "pending"
      let source = "solo"
      if (newRating === 5) {
        const pref = localStorage.getItem("whateat_auto_share_5star")
        if (pref === "approved") {
          status = "approved"
          source = "solo-5star"
        } else {
          status = "pending"
          source = "solo-5star"
        }
      }

      const metadata = {
        title: targetLog.title,
        mealType: targetLog.type,
        rating: newRating,
        tips: targetLog.tips || [],
        placeName: targetLog.placeName || "",
        linkUrl: targetLog.linkUrl || "",
        linkThumbnail: targetLog.linkThumbnail || "",
        description: targetLog.description || "",
        promotedAt: status === "approved" ? new Date().toISOString() : undefined
      }

      const { error } = await supabase
        .from("meal_images")
        .update({
          rating: newRating,
          status: status,
          source: source,
          explanation: JSON.stringify(metadata)
        })
        .eq("id", mealId)
        .eq("uploaded_by", user.id)

      if (error) throw error

      setMealLogs(prev => prev.map(log => 
        log.id === mealId ? { ...log, rating: newRating, status: status } : log
      ))

      toast.success("평점이 변경되었습니다.")

      if (newRating === 5) {
        await checkConsentAndUpload({
          id: targetLog.id,
          mealType: targetLog.type,
          menuName: targetLog.title,
          rating: 5,
          recipe: targetLog.tips?.join("\n"),
          linkUrl: targetLog.linkUrl,
          description: targetLog.description,
          image: targetLog.image,
          supabaseId: targetLog.id
        }, targetLog.image)
      }
    } catch (err) {
      console.error("Failed to update rating on Supabase:", err)
      toast.error("평점 저장에 실패했습니다.")
    }
  }

  const handleDeleteClick = async (mealId: any) => {
    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("식사를 등록하면 샘플은 바로 사라집니다.", {
        icon: "💡",
        duration: 3000
      })
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    try {
      const supabase = createClient()
      
      const { error: commentError } = await supabase
        .from("comments")
        .delete()
        .eq("meal_id", mealId)

      if (commentError) console.warn("Failed to delete comments for meal:", commentError)

      const { error: mealError } = await supabase
        .from("meal_images")
        .delete()
        .eq("id", mealId)
        .eq("uploaded_by", user.id)

      if (mealError) throw mealError

      setMealLogs(prev => prev.filter(log => log.id !== mealId))
      toast.success("식사 기록이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete meal from Supabase:", err)
      toast.error("식사 기록 삭제에 실패했습니다.")
    }
  }

  const handleEditClick = (meal: any) => {
    const editData: MealLogData = {
      id: meal.id,
      date: toIsoDate(parseDateString(meal.date)),
      mealType: meal.type as "집밥" | "배달" | "외식",
      menuName: meal.title,
      image: meal.image,
      description: meal.description,
      rating: meal.rating,
      recipe: meal.tips?.join("\n"),
      recipeType: "manual",
      linkUrl: meal.linkUrl,
    }
    setEditingMeal(editData)
    setEditModalOpen(true)
  }

  const handleEditSave = async (data: MealLogData) => {
    if (data.id === 1 || data.id === 2 || data.id === 3) {
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    try {
      let finalImageUrl = data.image || "/images/placeholder-food.jpg"

      if (data.image && data.image.startsWith("data:image")) {
        const uploadToast = toast.loading("이미지를 업로드하고 있어요...")
        try {
          finalImageUrl = await uploadImageToStorage(data.image)
          toast.dismiss(uploadToast)
        } catch (uploadErr) {
          toast.dismiss(uploadToast)
          console.error("Image upload failed:", uploadErr)
          toast.error("이미지 업로드에 실패했습니다. 기본 이미지로 진행합니다.")
          finalImageUrl = "/images/placeholder-food.jpg"
        }
      }

      const mealUuid = data.id || generateUUID()
      const rating = data.rating || 0
      let status = "pending"
      let source = "solo"

      if (rating === 5) {
        const pref = localStorage.getItem("whateat_auto_share_5star")
        if (pref === "approved") {
          status = "approved"
          source = "solo-5star"
        } else {
          status = "pending"
          source = "solo-5star"
        }
      }

      const metadata = {
        title: data.menuName,
        mealType: data.mealType,
        rating: rating,
        tips: data.recipe?.split("\n").filter((t) => t.trim()) || [],
        placeName: data.place?.name || data.deliveryStoreName || (data.linkUrl ? "식사 공유 상세" : ""),
        placeAddress: data.place?.address || "",
        description: data.description || "",
        promotedAt: status === "approved" ? new Date().toISOString() : undefined,
        linkUrl: data.linkUrl || "",
        linkThumbnail: data.linkThumbnail || ""
      }

      const supabase = createClient()
      const { error: mealError } = await supabase.from("meal_images").upsert({
        id: mealUuid,
        image_url: finalImageUrl,
        uploaded_by: user.id,
        explanation: JSON.stringify(metadata),
        source: source,
        status: status,
        title: data.menuName,
        rating: rating,
        meal_type: data.mealType,
        link_url: data.linkUrl || "",
        link_thumbnail: data.linkThumbnail || "",
        place_name: data.place?.name || data.deliveryStoreName || "",
        place_address: data.place?.address || "",
        description: data.description || ""
      })

      if (mealError) throw mealError

      if (data.description !== undefined) {
        const { data: existingComments } = await supabase
          .from("comments")
          .select("id")
          .eq("meal_id", mealUuid)
          .eq("user_id", user.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true })

        if (existingComments && existingComments.length > 0) {
          const firstCommentId = existingComments[0].id
          await supabase
            .from("comments")
            .update({
              content: data.description,
              updated_at: new Date().toISOString()
            })
            .eq("id", firstCommentId)
        } else {
          await supabase.from("comments").insert({
            id: generateUUID(),
            meal_id: mealUuid,
            user_id: user.id,
            content: data.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false
          })
        }
      }

      toast.success(data.id ? "식사 기록이 수정되었습니다." : "식사 기록이 저장되었습니다.")

      const formattedDate = data.date 
        ? toDisplayDate(data.date) 
        : toDisplayDate(toIsoDate(new Date()))

      const updatedLog = {
        id: mealUuid,
        date: formattedDate,
        title: data.menuName,
        type: data.mealType,
        image: finalImageUrl,
        rating: rating,
        tips: data.recipe?.split("\n").filter(t => t.trim()) || [],
        tipTitle: data.mealType === "집밥" ? "조리 팁" : "추천 메뉴",
        linkUrl: data.linkUrl || "",
        linkThumbnail: data.linkThumbnail || "",
        placeName: data.place?.name || data.deliveryStoreName || "",
        aiTag: true,
        healthy: data.mealType === "집밥",
        status: status,
        description: data.description || "",
        comments: []
      }

      if (data.id) {
        setMealLogs(prev => prev.map(log => log.id === data.id ? { ...updatedLog, comments: log.comments } : log))
      } else {
        setMealLogs(prev => [updatedLog, ...prev])
      }

      if (rating === 5) {
        await checkConsentAndUpload({
          id: mealUuid,
          mealType: data.mealType,
          menuName: data.menuName,
          rating: 5,
          recipe: data.recipe,
          linkUrl: data.linkUrl,
          description: data.description,
          image: finalImageUrl,
          supabaseId: mealUuid
        }, finalImageUrl)
      }

      setEditModalOpen(false)
      setEditingMeal(null)
    } catch (err) {
      console.error("Failed to save meal on Supabase:", err)
      toast.error("식사 기록 저장에 실패했습니다.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky Search + Filter */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex flex-col gap-2">
      {/* Search + Date Filter Row */}
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground size-4.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="식당, 메뉴, 장소 검색"
            className="w-full pl-12 pr-4 py-3 bg-white/60 border border-white/80 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-base placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-base font-medium transition-all border cursor-pointer",
              sortOption !== "날짜순" || dateRangeStart || dateRangeEnd
                ? "bg-cyan-500 text-white border-cyan-500 shadow-sm shadow-cyan-200"
                : "bg-white/60 text-muted-foreground border-white/80 hover:border-primary/30"
            )}
          >
            <span
              onClick={(e) => {
                e.stopPropagation()
                setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
              }}
              className="inline-flex"
            >
              <ArrowUpDown className="size-4" />
            </span>
            <span>{sortOption}</span>
            <span className="text-[11px] font-bold">{sortDirection === "desc" ? "↓" : "↑"}</span>
            <ChevronDown className="size-3" />
          </button>

          {/* Sort Dropdown Menu */}
          {showSortDropdown && !showDateRangePicker && (
            <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-xl border border-muted/20 py-2 z-50">
              {(["날짜순", "별점순", "기간"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    if (option === "기간") {
                      setShowDateRangePicker(true)
                    } else {
                      setSortOption(option)
                      setDateRangeStart(null)
                      setDateRangeEnd(null)
                      setShowSortDropdown(false)
                    }
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

          {/* Date Range Picker */}
          {showDateRangePicker && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-muted/20 p-4 z-50">
              <h4 className="font-bold text-sm text-foreground mb-3">기간 설정</h4>
              
              {/* Start Date */}
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1 block">시작 날짜</label>
                <input
                  type="date"
                  value={dateRangeStart || ""}
                  onChange={(e) => setDateRangeStart(e.target.value || null)}
                  className="w-full px-3 py-2 border border-muted/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              {/* End Date */}
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">종료 날짜</label>
                <input
                  type="date"
                  value={dateRangeEnd || ""}
                  onChange={(e) => setDateRangeEnd(e.target.value || null)}
                  className="w-full px-3 py-2 border border-muted/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDateRangeStart(null)
                    setDateRangeEnd(null)
                    setSortOption("날짜순")
                    setShowDateRangePicker(false)
                    setShowSortDropdown(false)
                  }}
                  className="flex-1 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-lg transition-all"
                >
                  초기화
                </button>
                <button
                  onClick={() => {
                    setSortOption("기간")
                    setShowDateRangePicker(false)
                    setShowSortDropdown(false)
                  }}
                  className="flex-1 py-2 text-sm bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all"
                >
                  적용
                </button>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Meal Type Filter Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {mealTypeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setMealTypeFilter(option.id)}
                className={cn(
                  "relative px-4.5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                  mealTypeFilter === option.id
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-white/70 text-muted-foreground hover:bg-white"
                )}
              >
                <span className="absolute -top-1.5 right-1 z-10 text-xs leading-none font-black text-cyan-600">
                  {getOptionCount(option.id)}
                </span>
                {Icon && <Icon className="size-4" />}
                {option.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          {showBackToCalendar && onBackToCalendar && (
            <button
              onClick={onBackToCalendar}
              className="px-4 py-2.5 rounded-full text-sm font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors cursor-pointer"
            >
              ← 캘린더
            </button>
          )}
          <button
            onClick={() => {
              setEditingMeal(null)
              setEditModalOpen(true)
            }}
            className="size-11 bg-orange-500 text-white rounded-full border-2 border-orange-100 shadow-md shadow-orange-300/60 flex items-center justify-center hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="size-5.5" strokeWidth={2.8} />
          </button>
        </div>
      </div>
      </div>{/* end sticky */}


      {/* Meal Cards - PC에서 2열 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredLogs.map((meal) => (
          <div
            key={meal.id}
            ref={(el) => {
              cardRefs.current[meal.id] = el
            }}
            className={cn(
              "bg-white rounded-[2rem] overflow-hidden shadow-[0_10px_25px_rgba(0,0,0,0.04)] transition-all hover:ring-2 hover:ring-cyan-300 hover:shadow-cyan-100 relative",
              focusedMealId === meal.id && "ring-2 ring-cyan-400 shadow-cyan-100",
              (meal.id === 1 || meal.id === 2 || meal.id === 3) && "opacity-90"
            )}
          >
            {/* 샘플 리본 */}
             {(meal.id === 1 || meal.id === 2 || meal.id === 3) && (
               <div className="absolute top-4.5 -right-10 w-52 bg-yellow-400 text-yellow-900 text-[10px] font-black py-1 text-center rotate-45 shadow-md z-10 pointer-events-none">
                 💡 SAMPLE
               </div>
             )}
            {/* Card Content */}
            <div className="flex h-[200px]">
              {/* Image Section */}
              <div
                className="w-1/2 relative overflow-hidden cursor-zoom-in"
                onClick={() => setViewerImage(meal.image)}
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-300 hover:scale-105"
                  style={{ backgroundImage: `url("${meal.image}")` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {meal.aiTag && (
                    <span className="w-fit px-2 py-0.5 bg-primary text-white text-[8px] font-black rounded-md">AI TAG</span>
                  )}
                  {meal.healthy && (
                    <span className="w-fit px-2 py-0.5 bg-green-600 text-white text-[8px] font-black rounded-md">HEALTHY</span>
                  )}
                  <span className="w-fit px-2 py-0.5 bg-white/20 backdrop-blur-md text-white text-[8px] font-bold rounded-md border border-white/30">
                    {meal.type}
                  </span>
                </div>
              </div>

              {/* Right Section */}
              <div className="w-1/2 bg-gray-50/80 border-l border-muted flex overflow-hidden relative">
                {/* Edit Button - 항상 노출 (배경 상시 활성화하여 시인성 확보, 샘플 띠와 겹치지 않게 top-1.5 right-1.5에 배치) */}
                <button 
                  onClick={() => handleEditClick(meal)}
                  className="absolute top-1.5 right-1.5 size-7.5 flex items-center justify-center text-foreground bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-full shadow-sm hover:bg-white active:scale-95 transition-all z-20 cursor-pointer"
                  title="수정"
                >
                  <Pencil className="size-3.5" />
                </button>

                {/* Case 1: linkUrl 있음 -> 썸네일만 (레시피 내용 없음) */}
                {meal.linkUrl && meal.linkThumbnail ? (
                  <a
                    href={meal.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full relative group overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundImage: `url("${meal.linkThumbnail}")` }}
                    />
                    <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors" />
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                      {(meal.type === "외식" || meal.type === "배달") ? (
                        <>
                          <div className="size-4 rounded-full bg-[#03C75A] flex items-center justify-center">
                            <span className="text-white text-[7px] font-black">N</span>
                          </div>
                          <span className="text-[10px] font-bold text-foreground">Place</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink className="size-3 text-primary" />
                          <span className="text-[10px] font-bold text-foreground">recipe</span>
                        </>
                      )}
                    </div>
                  </a>
                ) : (
                  <>
                    {/* Case 2: linkUrl 없음 -> 직접 작성한 레시피/팁 표시 */}
                    <div className="flex-1 p-3 flex flex-col overflow-hidden">
                      <h4 className="text-[10px] font-bold text-primary mb-1.5 flex items-center gap-1">
                        {meal.healthy ? (
                          <BookOpen className="size-3" />
                        ) : (
                          <Lightbulb className="size-3" />
                        )}
                        {meal.tipTitle}
                      </h4>
                      <div className="overflow-y-auto flex-1 hide-scrollbar">
                        {meal.tips.map((tip, index) => (
                          <div key={index} className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-tight mb-1.5">
                            <div className="mt-1.5 size-1 bg-primary/40 rounded-full shrink-0" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Naver Place info bar - 외식/배달 with link */}
            {(meal.type === "외식" || meal.type === "배달") && meal.linkUrl && meal.placeName && (
              <a
                href={meal.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-5 py-2 bg-gray-50/50 border-t border-muted/20 hover:bg-gray-100/60 transition-all group"
              >
                <div className="size-5 rounded-md bg-[#03C75A] flex items-center justify-center shrink-0">
                  <span className="text-white text-[8px] font-black">N</span>
                </div>
                <span className="text-[11px] font-bold text-foreground truncate">{meal.placeName}</span>
                {meal.placeRating && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Star className="size-2.5 text-[#03C75A] fill-[#03C75A]" />
                    <span className="text-[11px] font-bold text-[#03C75A]">{meal.placeRating}</span>
                  </div>
                )}
              </a>
            )}

            {/* Card Footer */}
            <div className="px-5 pt-4 pb-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">{meal.date}</p>
                <div className="flex items-center gap-0.5 text-orange-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRatingChange(meal.id, star)}
                      className="hover:scale-110 transition-transform"
                    >
                      <Star 
                        className={cn(
                          "size-4",
                          star <= meal.rating ? "fill-current" : ""
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <h3 className="font-bold text-foreground text-lg mb-2">{meal.title}</h3>
              {/* Comment Section (기존 Memo Section 전면 대체) */}
              <div className="mt-4 pt-3 border-t border-muted/30">
                <div 
                  className="flex items-center gap-1.5 mb-2.5 cursor-pointer"
                  onClick={() => setVisibleMemoInputs(prev => ({ ...prev, [meal.id]: !prev[meal.id] }))}
                >
                  <MessageSquare className="size-3.5 text-orange-500" />
                  <span className="text-xs font-bold text-foreground select-none">메모</span>
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                    {(meal.comments || []).length}
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(meal.comments || []).length === 0 ? null : (
                    (meal.comments || []).map((comment: any) => (
                      <div key={comment.id} className="rounded-xl bg-orange-50/50 border border-orange-100 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-foreground">{comment.author}</span>
                          <span className="text-[9px] text-muted-foreground">{comment.createdAt}</span>
                        </div>
                        <p className="text-xs text-foreground mt-1 leading-relaxed">{comment.content}</p>

                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => setSoloCommentLikes(prev => ({ ...prev, [String(comment.id)]: !prev[String(comment.id)] }))}
                            className="text-[11px] text-muted-foreground flex items-center gap-1"
                          >
                            <Heart className={cn("size-3.5", soloCommentLikes[String(comment.id)] && "fill-orange-500 text-orange-500")} />
                            {soloCommentLikes[String(comment.id)] ? 1 : 0}
                          </button>
                          <button
                            onClick={() => {
                              const isSameTarget =
                                activeReplyTarget?.mealId === meal.id &&
                                activeReplyTarget.commentId === comment.id

                              if (isSameTarget) {
                                setActiveReplyTarget(null)
                                return
                              }
                              setActiveReplyTarget({ mealId: meal.id, commentId: comment.id })
                            }}
                            className="text-[11px] text-muted-foreground"
                          >
                            답글
                          </button>
                        </div>

                        {/* 대댓글(답글) 리스트 */}
                        {(comment.replies || []).length > 0 && (
                          <div className="mt-2 pl-2 border-l-2 border-orange-200 space-y-1.5">
                            {(comment.replies || []).map((reply: any) => (
                              <div key={reply.id} className="bg-white/70 rounded-lg px-2 py-1.5 border border-orange-50">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold text-foreground">{reply.author}</span>
                                  <span className="text-[8px] text-muted-foreground">{reply.createdAt}</span>
                                </div>
                                <p className="text-[11px] text-foreground mt-0.5 leading-relaxed">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 대댓글 입력창 */}
                        {activeReplyTarget?.mealId === meal.id && activeReplyTarget.commentId === comment.id && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={replyInputs[comment.id] || ""}
                              onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleAddReply(meal.id, comment.id)
                                }
                              }}
                              placeholder="답글을 입력하세요"
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] outline-none focus:ring-2 focus:ring-orange-300"
                            />
                            <button
                              onClick={() => handleAddReply(meal.id, comment.id)}
                              className="px-2.5 py-1 rounded-lg bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold"
                            >
                              전송
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* 댓글 입력창 - 패밀리 스타일 통일 */}
                {visibleMemoInputs[meal.id] && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={commentInputs[meal.id] || ""}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [meal.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddComment(meal.id)
                        }
                      }}
                      placeholder="메모를 입력하거나 소통해 보세요"
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={() => handleAddComment(meal.id)}
                      className="size-9 rounded-lg bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <AddLogModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditingMeal(null)
        }}
        editData={editingMeal}
        onSave={handleEditSave}
        onDelete={handleDeleteClick}
      />

      {/* Image Viewer */}
      <ImageViewer
        src={viewerImage ?? ""}
        isOpen={viewerImage !== null}
        onClose={() => setViewerImage(null)}
      />

      {/* 5-Star Share Consent Modal */}
      {shareConsentModalOpen && pendingShareData && (
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
                  if (pendingShareData) {
                    const supabase = createClient()
                    const { data: userData } = await supabase
                      .from('users')
                      .select('region')
                      .eq('id', user.id)
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
                      await upload5StarMealToSupabase(pendingShareData.logData, pendingShareData.imageUrl)
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent("navigateToTalk"))
                      }, 100)
                      setPendingShareData(null)
                    }
                  }
                }}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                승낙 (공개)
              </button>
              <button
                onClick={() => {
                  if (rememberSharePref) {
                    localStorage.setItem("whateat_auto_share_5star", "rejected")
                  }
                  setShareConsentModalOpen(false)
                  setPendingShareData(null)
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
