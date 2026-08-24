"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Lightbulb, BookOpen, Star, MessageSquare, Pencil, Search, ChevronDown, ArrowUpDown, ArrowDown, ChefHat, Bike, UtensilsCrossed, ExternalLink, Plus, Trash2, Heart, Send, X, MapPin, Loader2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { cn, formatPlaceNameWithRegion, formatRegionStr, parseRegionFromAddress } from "@/lib/utils"
import { AddLogModal, type MealLogData } from "@/components/whateat/add-log-modal"
import { ImageViewer } from "@/components/whateat/image-viewer"
import { createClient } from "@/lib/supabase"
import { secureWrite } from "@/lib/supabase-safe"
import { useHub } from "@/services/merlin-hub-sdk/react"
import { getSessionToken } from "@/services/merlin-hub-sdk/CoreLogic/client"


const cleanDongName = (dong: string) => {
  if (!dong) return ""
  let cleaned = dong.trim()
  // Remove "제[0-9]동", "제 [0-9]동", or trailing numbers like "청라1동" -> "청라동"
  cleaned = cleaned.replace(/제?\s*\d+([·\d]+)?동$/, "동")
  cleaned = cleaned.replace(/\d+동$/, "동")
  cleaned = cleaned.replace(/제\d+/, "")
  return cleaned
}


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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)

  // 기등록된 배달 식당 목록 추출
  const registeredDeliveryStores = useMemo(() => {
    const storesMap = new Map<string, any>()
    mealLogs.forEach(log => {
      if ((log.type === "배달" || log.mealType === "delivery") && log.placeName) {
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
  }, [mealLogs])

  // 거주 지역 등록 모달 관련 상태 변수
  const [regionModalOpen, setRegionModalOpen] = useState(false)
  const [inputCity, setInputCity] = useState("")
  const [inputGu, setInputGu] = useState("")
  const [inputDong, setInputDong] = useState("")
  const [isRegionSaving, setIsRegionSaving] = useState(false)
  const [regionList, setRegionList] = useState<string[]>([])
  const [addressSearchQuery, setAddressSearchQuery] = useState("")
  const [filteredRegions, setFilteredRegions] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  // 댓글 및 대댓글 관련 상태
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({})
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ mealId: any; commentId: string } | null>(null)
  const [visibleMemoInputs, setVisibleMemoInputs] = useState<Record<string | number, boolean>>({})
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText] = useState<string>("")
  const [userRegion, setUserRegion] = useState<string | null>(null)

  // Supabase Storage에 파일 업로드하는 함수
  const uploadImageToStorage = async (base64Image: string): Promise<string> => {
    if (!user?.id) throw new Error("User not logged in")
    const token = getSessionToken();
    const fileName = `solo_${user.id}_${Date.now()}.webp`

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

  const handleAddComment = async (mealId: any) => {
    const inputContent = commentInputs[mealId]?.trim()
    if (!inputContent) return

    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("샘플이라 메모 작성 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
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

      await secureWrite({
        table: "comments",
        action: "insert",
        data: newComment
      })

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
    } catch (err) {
      console.error("Failed to add comment:", err)
      toast.error("댓글 등록에 실패했습니다.")
    }
  }

  const handleEditComment = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId)
    setEditCommentText(currentContent)
  }

  const handleUpdateComment = async (mealId: any, commentId: string) => {
    const trimmed = editCommentText.trim()
    if (!trimmed) return

    try {
      const supabase = createClient()
      await secureWrite({
        table: "comments",
        action: "update",
        data: {
          content: trimmed,
          updated_at: new Date().toISOString()
        },
        filters: { id: commentId }
      })

      setMealLogs(prev => prev.map(log => {
        if (log.id === mealId) {
          const updatedComments = (log.comments || []).map((c: any) => 
            c.id === commentId ? { ...c, content: trimmed } : c
          )
          const firstComment = updatedComments.find(c => c.userId === log.uploaded_by)
          return {
            ...log,
            description: firstComment?.content || log.description,
            comments: updatedComments
          }
        }
        return log
      }))

      setEditingCommentId(null)
      setEditCommentText("")
    } catch (err) {
      console.error("Failed to update comment:", err)
      toast.error("메모 수정에 실패했습니다.")
    }
  }

  const handleDeleteComment = async (mealId: any, commentId: string) => {
    if (!confirm("메모를 삭제하시겠습니까?")) return

    try {
      const supabase = createClient()
      await secureWrite({
        table: "comments",
        action: "update",
        data: {
          is_deleted: true,
          updated_at: new Date().toISOString()
        },
        filters: { id: commentId }
      })

      setMealLogs(prev => prev.map(log => {
        if (log.id === mealId) {
          const updatedComments = (log.comments || []).filter((c: any) => c.id !== commentId)
          const firstComment = updatedComments.find(c => c.userId === log.uploaded_by)
          return {
            ...log,
            description: firstComment?.content || "",
            comments: updatedComments
          }
        }
        return log
      }))
      
      toast.success("메모가 deleted되었습니다.")
    } catch (err) {
      console.error("Failed to delete comment:", err)
      toast.error("메모 삭제에 실패했습니다.")
    }
  }

  const handleAddReply = async (mealId: any, commentId: string) => {
    const inputContent = replyInputs[commentId]?.trim()
    if (!inputContent) return

    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("샘플이라 메모 작성 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
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

      await secureWrite({
        table: "comment_replies",
        action: "insert",
        data: newReply
      })

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
      await secureWrite({
        table: 'users',
        action: 'update',
        data: { region: JSON.stringify(regionData) },
        filters: { id: user.id }
      })

      setUserRegion(JSON.stringify(regionData))
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

  // 거주 지역 등록 모달 오픈 시 검색어 및 선택 정보 초기화
  useEffect(() => {
    if (regionModalOpen) {
      setAddressSearchQuery("")
      setSelectedRegion(null)
      setFilteredRegions([])
      setInputCity("")
      setInputGu("")
      setInputDong("")
    }
  }, [regionModalOpen])

  // 1. regions.json 주소 데이터베이스 로드
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const res = await fetch("/data/regions.json")
        if (res.ok) {
          const list = await res.json()
          setRegionList(list)
        }
      } catch (err) {
        console.error("Failed to load regions database:", err)
      }
    }
    loadRegions()
  }, [])

  // 2. 검색어에 따른 읍면동 리스트 실시간 필터링 (최대 10개)
  useEffect(() => {
    const query = addressSearchQuery.trim()
    if (!query) {
      setFilteredRegions([])
      return
    }
    const filtered = regionList
      .filter((r) => r.includes(query))
      .slice(0, 10)
    setFilteredRegions(filtered)
  }, [addressSearchQuery, regionList])

  const handleSelectRegionItem = (regionStr: string) => {
    setSelectedRegion(regionStr)
    setAddressSearchQuery("")
    setFilteredRegions([])
    
    const parts = regionStr.split(/\s+/)
    if (parts.length >= 3) {
      setInputCity(parts[0])
      setInputGu(parts[1])
      setInputDong(parts[parts.length - 1])
    } else if (parts.length === 2) {
      setInputCity(parts[0])
      setInputGu("")
      setInputDong(parts[1])
    }
  }

  const [isLoaded, setIsLoaded] = useState(false)

  // DB에서 식사 및 댓글 불러오기
  useEffect(() => {
    const fetchDbLogs = async () => {
      if (!isLoggedIn || !user?.id) {
        // 비로그인이면 기본 샘플 3개 표시
        setMealLogs([])
        setIsLoaded(true)
        return
      }

      try {
        const supabase = createClient()
        const { data: imgData, error: imgError } = await supabase
          .from("meal_images")
          .select("*")
          .eq("uploaded_by", user.id)
          .neq("source", "family-shared")
          .order("created_at", { ascending: false })

        if (imgError) throw imgError

        if (!imgData || imgData.length === 0) {
          setMealLogs([])
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
            .eq("user_id", user.id)
            .eq("is_deleted", false)
            .order("created_at", { ascending: true })
          dbComments = commentsData || []

          const commentIds = dbComments.map(c => c.id)
          dbReplies = []

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
          if (arr.length > 0) return // 솔로 탭은 단일 메모만 유지하므로 최초 1개만 바인딩
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
            rating: img.rating ?? meta.rating ?? 0,
            tips: meta.tips || [],
            tipTitle: mappedType === "집밥" ? "조리 팁" : "추천 메뉴",
            linkUrl: img.link_url || meta.linkUrl || "",
            linkThumbnail: img.link_thumbnail || meta.linkThumbnail || "",
            placeName: img.place_name || meta.placeName || "",
            placeAddress: (img.place_address && img.place_address.trim() !== "") ? img.place_address : (meta.placeAddress || ""),
            aiTag: img.source === "solo-5star" || img.source === "solo",
            healthy: mappedType === "집밥",
            status: img.status,
            description: displayDescription,
            comments: cardComments
          }
        })

        setMealLogs(mappedLogs)

        // 4. 유저의 region 정보 조회 및 캐싱
        if (user?.id) {
          const { data: userData } = await supabase
            .from('users')
            .select('region')
            .eq('id', user.id)
            .single()
          setUserRegion(userData?.region || null)
        }
      } catch (err) {
        console.error("Failed to load logs from Supabase:", err)
        setMealLogs([])
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
      tips: data.recipe ? data.recipe.split("\n").filter((t) => t.trim()) : [],
      placeName: data.place?.name || data.deliveryStoreName || (data as any).placeName || (data.linkUrl ? "식사 공유 상세" : "식사 일지"),
      placeAddress: data.place?.address || "",
      description: data.description || data.recipe || "",
      promotedAt: new Date().toISOString(), // 맛톡 승격 시점의 일시 저장
      linkUrl: data.linkUrl || "",
      linkThumbnail: data.linkThumbnail || ""
    }

    // Generate supabaseId if not already present
    const uuid = data.id || (data as any).supabaseId || generateUUID()

    await secureWrite({
      table: "meal_images",
      action: "upsert",
      data: {
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
      }
    })
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
        await secureWrite({
          table: "comments",
          action: "update",
          data: {
            content: data.description,
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
            meal_id: uuid,
            user_id: user.id,
            content: data.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false
          }
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

    // Supabase DB 비동기 조회 제거! 캐시된 userRegion 사용
    const hasRegion = userRegion ? (() => {
      try {
        const parsed = JSON.parse(userRegion)
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
      toast("5점 별점 식사가 맛톡 동네 피드에 자동 공유되었습니다!", { icon: "✨", duration: 2500 })
      await upload5StarMealToSupabase(data, imageUrl)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("navigateToTalk"))
      }, 1500)
    } else if (pref === "rejected") {
      console.log("User rejected auto-sharing of 5-star meals.")
    } else {
      setPendingShareData({ logData: data, imageUrl })
      setShareConsentModalOpen(true)
    }
  }

  const [focusedMealId, setFocusedMealId] = useState<number | null>(null)
  const [isSharingModalSubmitting, setIsSharingModalSubmitting] = useState(false)
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
    if (!dateStr) return new Date(0)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T00:00:00`)
    }
    const cleanStr = dateStr.replace(/\s+/g, "")
    const parts = cleanStr.split(".")
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      if (!isNaN(d.getTime())) return d
    }
    const fallback = new Date(dateStr.replace(/\./g, "-"))
    return isNaN(fallback.getTime()) ? new Date(0) : fallback
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
      const query = searchQuery ? searchQuery.trim().toLowerCase() : ""
      const matchesSearch = !query || 
        (log.title && log.title.toLowerCase().includes(query)) ||
        (log.description && log.description.toLowerCase().includes(query)) ||
        (log.placeName && log.placeName.toLowerCase().includes(query)) ||
        (log.placeAddress && log.placeAddress.toLowerCase().includes(query))
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
      // 샘플 카드는 항상 맨 아래로 가도록 설정 (id가 1, 2, 3인 카드)
      const aIsSample = a.id === 1 || a.id === 2 || a.id === 3
      const bIsSample = b.id === 1 || b.id === 2 || b.id === 3

      if (aIsSample && !bIsSample) return 1
      if (!aIsSample && bIsSample) return -1

      // 기간 필터 적용 시 기본적으로 날짜 최신순 고정 (또는 선택된 정렬)
      // a.date, b.date 는 "YYYY.MM.DD" 포맷이므로 문자열 비교로 안전하게 정렬
      const descBase = sortOption === "별점순"
        ? b.rating - a.rating
        : b.date.localeCompare(a.date)

      return sortDirection === "desc" ? descBase : -descBase
    })

  const getOptionCount = (optionId: (typeof mealTypeOptions)[number]["id"]) => {
    if (optionId === "전체") return displayLogs.length
    return displayLogs.filter((log) => log.type === optionId).length
  }

  const handleRatingChange = async (mealId: any, newRating: number) => {
    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("샘플이라 별점 수정 안 되며, 식사를 등록하면 샘플은 사라집니다.", { icon: "💡", duration: 3000 })
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    const targetLog = mealLogs.find(log => log.id === mealId)
    if (!targetLog) return

    // 기존 값 백업 (에러 시 롤백용)
    const oldRating = targetLog.rating
    const oldStatus = targetLog.status

    let status = "pending"
    let source = "solo"

    // 5점 -> 4점 이하로 다운그레이드 시 맛톡 수거 검증
    if (oldRating === 5 && newRating < 5 && oldStatus === "approved") {
      try {
        const supabase = createClient()
        // 다른 이웃의 댓글이 달렸는지 확인
        const { data: otherComments, error: commentError } = await supabase
          .from("comments")
          .select("id")
          .eq("meal_id", mealId)
          .eq("is_deleted", false)
          .neq("user_id", user.id)

        if (commentError) throw commentError

        if (otherComments && otherComments.length > 0) {
          toast("'맛톡'에 올라간 후, 다른 이웃의 댓글/좋아요 활동이 발생하여 평점을 낮출 수 없습니다.", { icon: "🔒", duration: 4000 })
          return
        }

        // 수거 성공 안내 토스트 노출
        toast("다른 유저의 활동이 없어 맛톡 피드에서 식사 기록을 수거했습니다.", { icon: "🧹", duration: 3000 })
      } catch (err) {
        console.error("Downgrade check failed:", err)
        toast.error("평점 변경 검증에 실패했습니다.")
        return
      }
    }

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

    // 1. UI 상태 즉각 업데이트 (낙관적 업데이트)
    setMealLogs(prev => prev.map(log => 
      log.id === mealId ? { ...log, rating: newRating, status: status } : log
    ))

    try {
      const supabase = createClient()
      
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

      // 2. 백그라운드 DB 업데이트 (await을 마지막에 대기하여 병렬 처리)
      const savePromise = secureWrite({
        table: 'meal_images',
        action: 'update',
        data: {
          rating: newRating,
          status: status,
          source: source,
          explanation: JSON.stringify(metadata)
        },
        filters: { id: mealId }
      })

      if (newRating === 5 && oldStatus !== "approved") {
        // DB 쓰기 완료를 기다리지 않고 즉시 모달 판단(오픈) 로직 실행
        await checkConsentAndUpload({
          id: targetLog.id,
          mealType: targetLog.type,
          menuName: targetLog.title,
          rating: 5,
          recipe: targetLog.tips?.join("\n"),
          linkUrl: targetLog.linkUrl || "",
          linkThumbnail: targetLog.linkThumbnail || "",
          place: { name: targetLog.placeName || "", address: targetLog.placeAddress || "", category: "" },
          description: targetLog.description,
          image: targetLog.image
        }, targetLog.image)
      }

      await savePromise
    } catch (err) {
      console.error("Failed to update rating on Supabase:", err)
      toast.error("평점 저장에 실패했습니다.")
      // 3. 실패 시 원래 상태로 복구 (롤백)
      setMealLogs(prev => prev.map(log => 
        log.id === mealId ? { ...log, rating: oldRating, status: oldStatus } : log
      ))
    }
  }

  const handleDeleteClick = async (mealId: any) => {
    if (mealId === 1 || mealId === 2 || mealId === 3) {
      toast("샘플이라 삭제 안 되며, 식사를 등록하면 샘플은 사라집니다.", {
        icon: "💡",
        duration: 3000,
      })
      return
    }

    if (!isLoggedIn || !user?.id) {
      toast.error("로그인이 필요한 작업입니다.")
      return
    }

    try {
      const supabase = createClient()
      
      try {
        await secureWrite({
          table: "comments",
          action: "delete",
          filters: { meal_id: mealId }
        })
      } catch (commentError) {
        console.warn("Failed to delete comments for meal:", commentError)
      }

      await secureWrite({
        table: "meal_images",
        action: "delete",
        filters: { id: mealId }
      })

      setMealLogs(prev => prev.filter(log => log.id !== mealId))
      toast.success("식사 기록이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete meal from Supabase:", err)
      toast.error("식사 기록 삭제에 실패했습니다.")
    }
  }

  const handleEditClick = async (meal: any) => {
    // 1. 맛톡 공유된 기록인지 확인 (status === 'approved')
    if (meal.status === "approved" && meal.id) {
      const supabase = createClient()
      
      // 다른 사용자의 댓글 확인
      const { data: otherComments } = await supabase
        .from("comments")
        .select("id")
        .eq("meal_id", meal.id)
        .eq("is_deleted", false)
        .neq("user_id", user?.id)
        
      // 다른 사용자의 좋아요 확인
      const { data: otherLikes } = await supabase
        .from("meal_likes")
        .select("id")
        .eq("meal_id", meal.id)
        .neq("user_id", user?.id)

      if ((otherComments && otherComments.length > 0) || (otherLikes && otherLikes.length > 0)) {
        toast("맛톡 이웃의 활동(댓글/좋아요)이 있어 수정할 수 없습니다.", { icon: "🔒" })
        return
      }
    }

    const recipeText = meal.tips?.join("\n") || ""
    const isUrl = recipeText.trim().startsWith("http")

    const editData: MealLogData = {
      id: meal.id,
      date: toIsoDate(parseDateString(meal.date)),
      mealType: meal.type as "집밥" | "배달" | "외식",
      menuName: meal.title,
      image: meal.image,
      description: meal.description,
      rating: meal.rating,
      recipe: recipeText,
      recipeType: isUrl ? "url" : "manual",
      linkUrl: meal.linkUrl,
      linkThumbnail: meal.linkThumbnail || "",
      deliveryStoreName: meal.type === "배달" ? meal.placeName : undefined,
      place: meal.placeName ? { name: meal.placeName, address: meal.placeAddress || "", category: "" } : undefined
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

    const mealUuid = data.id || generateUUID()
    const rating = data.rating || 0
    let status = "pending"
    let source = "solo"

    const targetLog = data.id ? mealLogs.find(log => log.id === data.id) : null
    const oldRating = targetLog ? targetLog.rating : 0
    const oldStatus = targetLog ? targetLog.status : "pending"
    const newRating = rating

    // 5점 -> 4점 이하로 다운그레이드 시 맛톡 수거 검증
    if (data.id && oldRating === 5 && newRating < 5 && oldStatus === "approved") {
      try {
        const supabase = createClient()
        // 다른 이웃의 댓글이 달렸는지 확인
        const { data: otherComments, error: commentError } = await supabase
          .from("comments")
          .select("id")
          .eq("meal_id", data.id)
          .eq("is_deleted", false)
          .neq("user_id", user.id)

        if (commentError) throw commentError

        if (otherComments && otherComments.length > 0) {
          toast("'맛톡'에 올라간 후, 다른 이웃의 댓글/좋아요 활동이 발생하여 평점을 낮출 수 없습니다.", { icon: "🔒", duration: 4000 })
          return
        }

        // 수거 성공 안내 토스트 노출
        toast("다른 유저의 활동이 없어 맛톡 피드에서 식사 기록을 수거했습니다.", { icon: "🧹", duration: 3000 })
      } catch (err) {
        console.error("Downgrade check failed:", err)
        toast.error("평점 변경 검증에 실패했습니다.")
        return
      }
    }

    if (rating === 5) {
      if (oldStatus === "approved") {
        status = "approved"
        source = targetLog ? targetLog.source : "solo-5star"
      } else {
        const pref = localStorage.getItem("whateat_auto_share_5star")
        if (pref === "approved") {
          status = "approved"
          source = "solo-5star"
        } else {
          status = "pending"
          source = "solo-5star"
        }
      }
    }

    const formattedDate = data.date 
      ? toDisplayDate(data.date) 
      : toDisplayDate(toIsoDate(new Date()))

    // 1. 낙관적 업데이트 생성
    const optimisticLog = {
      id: mealUuid,
      date: formattedDate,
      title: data.menuName,
      type: data.mealType,
      image: data.image || "/images/placeholder-food.jpg",
      rating: rating,
      tips: data.recipe?.split("\n").filter(t => t.trim()) || [],
      tipTitle: data.mealType === "집밥" ? "조리 팁" : "추천 메뉴",
      linkUrl: data.linkUrl || "",
      linkThumbnail: data.linkThumbnail || "",
      placeName: data.place?.name || data.deliveryStoreName || "",
      placeAddress: data.place?.address || "",
      aiTag: true,
      healthy: data.mealType === "집밥",
      status: status,
      description: data.description || "",
      comments: []
    }

    // 로컬 상태 즉각 반영 (렉 없이 피드에 카드 표시!)
    if (data.id) {
      setMealLogs(prev => prev.map(log => log.id === data.id ? { ...optimisticLog, comments: log.comments } : log))
    } else {
      setMealLogs(prev => [optimisticLog, ...prev])
    }

    // 모달 즉각 닫기
    setEditModalOpen(false)
    setEditingMeal(null)

    // 2. 백그라운드 비동기 저장 수행
    try {
      let finalImageUrl = data.image || "/images/placeholder-food.jpg"

      if (data.image && data.image.startsWith("data:image")) {
        try {
          finalImageUrl = await uploadImageToStorage(data.image)
          setMealLogs(prev => prev.map(log => log.id === mealUuid ? { ...log, image: finalImageUrl } : log))
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr)
          finalImageUrl = "/images/placeholder-food.jpg"
          setMealLogs(prev => prev.map(log => log.id === mealUuid ? { ...log, image: finalImageUrl } : log))
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
      await secureWrite({
        table: "meal_images",
        action: "upsert",
        data: {
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
        }
      })

      if (data.description !== undefined) {
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
            const firstCommentId = existingComments[0].id
            await secureWrite({
              table: "comments",
              action: "update",
              data: {
                content: cleanDesc,
                updated_at: new Date().toISOString()
              },
              filters: { id: firstCommentId }
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
        } else {
          // description이 빈 문자열인 경우 기존 댓글이 있으면 soft delete
          if (existingComments && existingComments.length > 0) {
            const firstCommentId = existingComments[0].id
            await secureWrite({
              table: "comments",
              action: "update",
              data: {
                is_deleted: true,
                updated_at: new Date().toISOString()
              },
              filters: { id: firstCommentId }
            })
          }
        }
      }

      if (rating === 5 && oldStatus !== "approved") {
        await checkConsentAndUpload({
          id: mealUuid,
          mealType: data.mealType,
          menuName: data.menuName,
          rating: 5,
          recipe: data.recipe,
          linkUrl: data.linkUrl || "",
          linkThumbnail: data.linkThumbnail || "",
          place: data.place || (data.deliveryStoreName ? { name: data.deliveryStoreName, address: "", category: "" } : undefined),
          description: data.description,
          image: finalImageUrl
        }, finalImageUrl)
      }
    } catch (err) {
      console.error("Background save failed on Supabase:", err)
      toast.error("백그라운드 저장 중 오류가 발생했습니다.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky Search + Filter */}
      <div className="sticky top-[116px] z-30 -mx-4 px-4 pt-3 pb-2 bg-gradient-to-b from-[#fffaf5] via-[#fff7ed] to-[#fffbf2] flex items-center justify-between gap-2">
        
        {/* Left Side: Filters */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar flex-shrink-0 max-w-[50%] sm:max-w-[60%] pt-1.5 pb-1">
          {mealTypeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setMealTypeFilter(option.id)}
                className={cn(
                  "relative px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                  mealTypeFilter === option.id
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-white/70 text-muted-foreground hover:bg-white flex-shrink-0"
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

        {/* Right Side: Actions (Search, Sort, FAB) */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-1 min-w-0">
          
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
              className={cn(
                "flex items-center gap-1.5 px-3.5 h-[38px] rounded-xl text-sm font-medium transition-all border cursor-pointer",
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
                className="inline-flex cursor-pointer hover:opacity-80 transition-opacity"
              >
                <ArrowDown className={cn("size-3 transition-transform duration-300", sortDirection === "asc" && "rotate-180")} />
              </span>
              <span className="hidden sm:inline">{sortOption}</span>
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
                
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1 block">시작 날짜</label>
                  <input
                    type="date"
                    value={dateRangeStart || ""}
                    onChange={(e) => setDateRangeStart(e.target.value || null)}
                    className="w-full px-3 py-2 border border-muted/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="text-xs text-muted-foreground mb-1 block">종료 날짜</label>
                  <input
                    type="date"
                    value={dateRangeEnd || ""}
                    onChange={(e) => setDateRangeEnd(e.target.value || null)}
                    className="w-full px-3 py-2 border border-muted/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>

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

          {/* FAB and Back Button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {showBackToCalendar && onBackToCalendar && (
              <button
                onClick={onBackToCalendar}
                className="px-3.5 py-2 rounded-full text-sm font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors cursor-pointer"
              >
                ← 캘린더
              </button>
            )}
            <button
              onClick={() => {
                setEditingMeal(null)
                setEditModalOpen(true)
              }}
              className="size-10 bg-orange-500 text-white rounded-full border-2 border-orange-100 shadow-md shadow-orange-300/60 flex items-center justify-center hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <Plus className="size-5" strokeWidth={2.8} />
            </button>
          </div>
        </div>
      </div>


      {/* Meal Cards - PC에서 2열 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
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

                 {/* Case 1: linkUrl 있음 -> 썸네일 혹은 기본 템플릿 표시 */}
                {meal.linkUrl ? (
                  (() => {
                    const isKakao = meal.linkUrl.includes("kko.to") || meal.linkUrl.includes("kakao.com")
                    const isGoogle = meal.linkUrl.includes("google.com") || meal.linkUrl.includes("google.co.kr") || meal.linkUrl.includes("goo.gl")
                    const isYoutube = meal.linkUrl.includes("youtube.com") || meal.linkUrl.includes("youtu.be")
                    const isInstagram = meal.linkUrl.includes("instagram.com")
                    const isTiktok = meal.linkUrl.includes("tiktok.com")
                    const isGeneric = !isKakao && !isGoogle && !isYoutube && !isInstagram && !isTiktok

                    return (
                      <a
                        href={meal.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-full relative group overflow-hidden block"
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
                            isGeneric && "bg-gradient-to-br from-orange-50 to-orange-100/60",
                            (!isKakao && !isGoogle && !isYoutube && !isInstagram && !isTiktok && !isGeneric) && "bg-gradient-to-br from-green-50 to-emerald-100"
                          )}>
                            <div className={cn(
                              "size-8 rounded-full flex items-center justify-center mb-1.5 shadow-sm text-sm font-black",
                              isKakao && "bg-[#FEE500] border border-amber-200 text-[#3C1E1E]",
                              isGoogle && "bg-[#4285F4] text-white",
                              isYoutube && "bg-[#FF0000] text-white",
                              isInstagram && "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white",
                              isTiktok && "bg-[#010101] text-white border border-slate-700",
                              isGeneric && "bg-orange-500 text-white",
                              (!isKakao && !isGoogle && !isYoutube && !isInstagram && !isTiktok && !isGeneric) && "bg-[#03C75A] text-white"
                            )}>
                              <span>
                                {isKakao ? "K" : isGoogle ? "G" : isYoutube ? "Y" : isInstagram ? "I" : isTiktok ? "T" : isGeneric ? "R" : "N"}
                              </span>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold",
                              isKakao && "text-amber-800",
                              isGoogle && "text-blue-800",
                              isYoutube && "text-red-800",
                              isInstagram && "text-pink-800",
                              isTiktok && "text-slate-800",
                              isGeneric && "text-orange-800"
                            )}>
                              {isKakao ? "카카오맵" : isGoogle ? "구글 지도" : isYoutube ? "유튜브" : isInstagram ? "인스타그램" : isTiktok ? "틱톡" : isGeneric ? "레시피" : "네이버 플레이스"}
                            </span>
                            <span className={cn(
                              "text-[9px] truncate max-w-full px-2 mt-0.5",
                              isKakao && "text-amber-700/80",
                              isGoogle && "text-blue-700/80",
                              isYoutube && "text-red-700/80",
                              isInstagram && "text-pink-700/80",
                              isTiktok && "text-slate-700/80",
                              isGeneric && "text-orange-700/80"
                            )}>{meal.placeName || "상세 보기"}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm">
                          {(meal.type === "외식" || meal.type === "배달") ? (
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

            {/* Place info bar - 외식/배달 */}
            {(meal.type === "외식" || meal.type === "배달") && meal.placeName && (
              <div
                className={`flex items-center gap-2.5 px-5 py-2 bg-gray-50/50 border-t border-muted/20 transition-all ${meal.linkUrl ? 'hover:bg-gray-100/60 group cursor-pointer' : ''}`}
                onClick={() => { if (meal.linkUrl) window.open(meal.linkUrl, '_blank', 'noopener,noreferrer') }}
              >
                {meal.linkUrl ? (
                  <div className="size-5 rounded-md bg-[#03C75A] flex items-center justify-center shrink-0">
                    <span className="text-white text-[8px] font-black">N</span>
                  </div>
                ) : (
                  <div className="size-5 rounded-md bg-orange-100 flex items-center justify-center shrink-0">
                    <MapPin className="size-3 text-orange-500" />
                  </div>
                )}
                <span className="text-[11px] font-bold text-foreground truncate flex items-center">
                  <span className="truncate">{meal.placeName}</span>
                  {meal.placeAddress && (
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
                          } catch (e) {
                            defaultDong = userRegion
                          }
                        }
                        const parsed = parseRegionFromAddress(meal.placeAddress, defaultCity, defaultGu, defaultDong)
                        return formatRegionStr(parsed.city, parsed.gu, parsed.dong)
                      })()}
                    </span>
                  )}
                </span>
                {meal.placeRating && (
                  <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                    <Star className="size-2.5 text-[#03C75A] fill-[#03C75A]" />
                    <span className="text-[11px] font-bold text-[#03C75A]">{meal.placeRating}</span>
                  </div>
                )}
              </div>
            )}

            {/* Card Footer */}
            <div className="px-5 pt-2.5 pb-3 flex flex-col">
              <div className="flex items-center justify-between mb-1">
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
              <div className="flex items-center justify-between mb-0.5 gap-2">
                <h3 className="font-bold text-foreground text-lg truncate">{meal.title}</h3>
                <span className={cn(
                  "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold",
                  meal.type === "집밥" ? "bg-green-50 text-green-600" :
                  meal.type === "배달" ? "bg-blue-50 text-blue-600" :
                  "bg-purple-50 text-purple-600"
                )}>
                  {meal.type}
                </span>
              </div>
              {/* Comment Section (기존 Memo Section 전면 대체) */}
              <div className="mt-0.5">
                <div 
                  className="flex items-center gap-1.5 cursor-pointer group hover:bg-muted/10 p-1 -mx-1 rounded-md transition-colors"
                  onClick={() => setVisibleMemoInputs(prev => {
                    const isCurrentlyVisible = prev[meal.id] ?? ((meal.comments || []).length > 0)
                    return { ...prev, [meal.id]: !isCurrentlyVisible }
                  })}
                >
                  <MessageSquare className="size-3.5 text-orange-500" />
                  <span className="text-xs font-bold text-foreground select-none">메모</span>
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                    {(meal.comments || []).length}
                  </span>
                </div>

                {(visibleMemoInputs[meal.id] ?? ((meal.comments || []).length > 0)) && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200 pt-2">
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {(meal.comments || []).length === 0 ? null : (
                        (meal.comments || []).map((comment: any) => (
                          <div key={comment.id} className="rounded-xl bg-orange-50/50 border border-orange-100 p-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-foreground">{comment.author}</span>
                                <span className="text-[9px] text-muted-foreground">{comment.createdAt}</span>
                              </div>
                              {comment.userId === user?.id && (
                                <div className="flex items-center gap-1.5">
                                  {editingCommentId === comment.id ? (
                                    <>
                                      <button
                                        onClick={() => handleUpdateComment(meal.id, comment.id)}
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
                                        onClick={() => handleDeleteComment(meal.id, comment.id)}
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
                                      handleUpdateComment(meal.id, comment.id)
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 rounded bg-white border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-orange-300 text-foreground"
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-foreground mt-1 leading-relaxed">{comment.content}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* 댓글 입력창 - 패밀리 스타일 통일 (이미 댓글이 있는 경우는 숨김) */}
                    {(meal.comments || []).length === 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="text"
                          value={commentInputs[meal.id] || ""}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [meal.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                              e.preventDefault()
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
        registeredDeliveryStores={registeredDeliveryStores}
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
                disabled={isSharingModalSubmitting}
                onClick={async () => {
                  if (rememberSharePref) {
                    localStorage.setItem("whateat_auto_share_5star", "approved")
                  }
                  setIsSharingModalSubmitting(true)
                  if (pendingShareData) {
                    const hasRegion = userRegion ? (() => {
                      try {
                        const parsed = JSON.parse(userRegion)
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
                        setShareConsentModalOpen(false)
                        setIsSharingModalSubmitting(false)
                      }, 100)
                      setPendingShareData(null)
                    }
                  } else {
                    setShareConsentModalOpen(false)
                    setIsSharingModalSubmitting(false)
                  }
                }}
                className="flex-1 py-2.5 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharingModalSubmitting ? <Loader2 className="size-4 animate-spin" /> : "승낙 (공개)"}
              </button>
              <button
                disabled={isSharingModalSubmitting}
                onClick={() => {
                  if (rememberSharePref) {
                    localStorage.setItem("whateat_auto_share_5star", "rejected")
                  }
                  setShareConsentModalOpen(false)
                  setPendingShareData(null)
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-muted-foreground font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-in fade-in zoom-in duration-200 relative space-y-4">
            {/* Close Button */}
            <button
              onClick={() => {
                setRegionModalOpen(false)
                setPendingShareData(null)
                setSelectedRegion(null)
                setAddressSearchQuery("")
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <span className="text-orange-500">📍</span> 거주 지역 등록
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                맛톡(동네 맛집 피드)에 '5점' 식사 기록을 연동하기 위해,<br />회원님의 거주 주소 중 '동' 정보까지만 등록해 주세요 ^^
              </p>
            </div>

            {!selectedRegion ? (
              <div className="space-y-3 pt-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                  <input
                    type="text"
                    value={addressSearchQuery}
                    onChange={(e) => setAddressSearchQuery(e.target.value)}
                    placeholder="예: 청라동, 화곡동, 삼평동"
                    className="w-full pl-9 pr-4 h-[38px] bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm placeholder:text-muted-foreground/50 text-foreground"
                    autoFocus
                  />
                </div>

                {/* 검색 결과 자동완성 리스트 */}
                {addressSearchQuery.trim() && (
                  <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl bg-white divide-y divide-gray-50 shadow-inner">
                    {filteredRegions.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        검색 결과가 없습니다.
                      </div>
                    ) : (
                      filteredRegions.map((region) => (
                        <button
                          key={region}
                          onClick={() => handleSelectRegionItem(region)}
                          className="w-full text-left px-4 py-2.5 hover:bg-orange-50/50 text-xs text-foreground transition-colors font-medium flex items-center gap-1.5"
                        >
                          <span className="text-orange-400">📍</span>
                          {region}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-center mt-2 space-y-2 animate-in fade-in zoom-in duration-200">
                  <span className="text-3xl">📍</span>
                  <div className="text-[11px] text-orange-600 font-semibold uppercase tracking-wider">선택하신 거주 지역</div>
                  <div className="text-base font-extrabold text-foreground">
                    {selectedRegion}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed">
                    * 동 정보는 맛톡 동네 맛집 피드 매칭에 사용되며,<br />상세 주소는 일절 수집하지 않습니다.
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedRegion(null)
                      setInputCity("")
                      setInputGu("")
                      setInputDong("")
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-muted-foreground font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    다른 지역 검색
                  </button>
                  <button
                    onClick={handleSaveRegionAndUpload}
                    disabled={isRegionSaving}
                    className="flex-[2] py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:bg-orange-300 flex items-center justify-center"
                  >
                    {isRegionSaving ? "저장 중..." : "등록 및 공유 완료"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
