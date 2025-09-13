'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient, signInWithRetry, clearSession } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// SearchParams를 사용하는 컴포넌트 분리 (useSearchParams는 반드시 Suspense로 감싸야 함)
function LoginContent() {
  const [kakaoLoading, setKakaoLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [showParentVideoModal, setShowParentVideoModal] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  useEffect(() => {
    // URL 파라미터에서 오류 처리
    const errorType = searchParams.get('error')
    const errorCode = searchParams.get('error_code')
    const errorDetail = searchParams.get('error_detail')
    
    console.log('🔍 로그인 페이지 오류 파라미터:', { errorType, errorCode, errorDetail })
    
    if (errorType === 'auth') {
      setError('인증 오류가 발생했습니다. 다시 시도해주세요.')
    } else if (errorType === 'session_expired') {
      setError('세션이 만료되었습니다. 다시 로그인해주세요.')
    } else if (errorType === 'access_denied') {
      setError('로그인이 취소되었습니다. 다시 시도해주세요.')
    } else if (errorType === 'oauth_error') {
      const detailMessage = errorDetail ? ` (상세: ${errorDetail})` : ''
      setError(`OAuth 인증 중 오류가 발생했습니다${detailMessage}`)
    } else if (errorType) {
      setError(`로그인 중 오류가 발생했습니다: ${errorType}`)
    }
    
    if (errorType) {
      // URL에서 오류 파라미터 제거
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('error')
      newUrl.searchParams.delete('error_code')
      newUrl.searchParams.delete('error_detail')
      newUrl.searchParams.delete('error_description')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [searchParams])
  
  // 사용자가 이미 로그인되어 있는지 확인
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('현재 세션 상태:', session ? '로그인됨' : '로그인되지 않음')
        if (session) {
          // 이미 로그인되어 있으면 홈으로 리다이렉트
          router.push('/')
        }
      } catch (error) {
        console.error('세션 확인 중 오류:', error)
      }
    }
    
    checkUser()
  }, [router, supabase])

  // 오디오 재생/정지 토글 함수
  const handleAudioToggle = (audioType: string, audioPath: string) => {
    // 현재 재생 중인 오디오가 있고, 같은 버튼을 클릭한 경우 정지
    if (currentAudio && playingAudio === audioType) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
      setPlayingAudio(null)
      return
    }

    // 다른 오디오가 재생 중이면 정지
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }

    // 새 오디오 재생
    const audio = new Audio(audioPath)
    audio.play().catch(e => {
      console.error('오디오 재생 실패:', e)
      alert('음성 파일을 재생할 수 없습니다.')
      setCurrentAudio(null)
      setPlayingAudio(null)
      return
    })

    // 오디오 종료 시 상태 초기화
    audio.addEventListener('ended', () => {
      setCurrentAudio(null)
      setPlayingAudio(null)
    })

    setCurrentAudio(audio)
    setPlayingAudio(audioType)
  }

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true)
      setError(null)
      
      console.log('구글 로그인 시도 중...')
      
      // 현재 URL에서 공유 파라미터 추출
      const currentUrl = new URL(window.location.href)
      const schoolCode = currentUrl.searchParams.get('school_code')
      const shareType = currentUrl.searchParams.get('share_type')
      
      // OAuth state에 공유 파라미터 포함
      let stateData = {}
      if (schoolCode) {
        stateData = {
          share_school_code: schoolCode,
          ...(shareType && { share_type: shareType })
        }
      }
      
      console.log('🔗 OAuth state 데이터:', stateData)
      
      // 구글 OAuth에 생일 정보 scope 추가
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'openid email profile https://www.googleapis.com/auth/user.birthday.read',
            ...(Object.keys(stateData).length > 0 && { 
              state: btoa(JSON.stringify(stateData))
            })
          }
        }
      });
      
      if (error) {
        console.error('구글 로그인 오류:', error)
        throw error
      }
      
      console.log('로그인 성공, 리다이렉트 완료:', data)
    } catch (error: any) {
      console.error('로그인 시도 중 오류:', error)
      setError(error.message || '구글 로그인 중 오류가 발생했습니다.')
      setGoogleLoading(false)
    }
    // signInWithOAuth이 성공하면 사용자가 리디렉션되므로 setGoogleLoading(false)를 호출할 필요 없음
  }

  const handleKakaoLogin = async () => {
    try {
      setKakaoLoading(true)
      setError(null)
      
      console.log('카카오 로그인 시도 중...')
      
      // 현재 URL에서 공유 파라미터 추출
      const currentUrl = new URL(window.location.href)
      const schoolCode = currentUrl.searchParams.get('school_code')
      const shareType = currentUrl.searchParams.get('share_type')
      
      // OAuth state에 공유 파라미터 포함
      let stateData = {}
      if (schoolCode) {
        stateData = {
          share_school_code: schoolCode,
          ...(shareType && { share_type: shareType })
        }
      }
      
      console.log('🔗 카카오 OAuth state 데이터:', stateData)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            scope: 'profile_nickname,profile_image,account_email,birthyear,birthday',
            prompt: 'consent',
            ...(Object.keys(stateData).length > 0 && { 
              state: btoa(JSON.stringify(stateData))
            })
          },
        },
      })
      
      if (error) {
        console.error('카카오 로그인 오류:', error)
        throw error
      }
      
      console.log('로그인 성공, 리다이렉트 완료:', data)
    } catch (error: any) {
      console.error('로그인 시도 중 오류:', error)
      setError(error.message || '카카오 로그인 중 오류가 발생했습니다.')
      setKakaoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 모바일: 상하단 구조, 데스크톱: 기존 좌우 구조 */}
      <div className="lg:container lg:mx-auto lg:px-4 lg:py-0">
        <div className="flex min-h-screen lg:items-start lg:justify-center lg:pt-4">
          <div className="w-full lg:max-w-6xl flex flex-col lg:grid lg:grid-cols-2 lg:gap-16">
            
            {/* 상단: 슬라이드 카드 (모바일), 왼쪽: 앱 소개 (데스크톱) */}
            <div className="lg:flex lg:flex-col lg:justify-start lg:space-y-6 order-1 lg:order-1">
              {/* 모바일: 슬라이드 카드 컨테이너 */}
              <div className="lg:hidden">
                <div className="overflow-x-auto scrollbar-hide">
                  <div className="flex gap-4 px-4 py-6" style={{width: 'max-content'}}>
                    
                    {/* 카드 1: 메인 소개 */}
                    <div className="bg-white rounded-xl p-6 shadow-lg min-w-[280px] max-w-[280px]">
                      <div className="text-center">
                        <div className="flex justify-center mb-4">
                          <img src="/images/sublogo.png" alt="급식배틀 로고" className="w-[140px] h-auto" />
                        </div>
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                          영양과 원산지는 Good! 그렇다면 '맛'은 ?
                        </p>
                        <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                          이제 500만 학생의 목소리를 되찾을 시간,
                        </p>
                        <p className="mt-1 text-sm text-gray-700 font-medium">
                          우리들 별점이 새로운 기준이 됩니다.
                        </p>
                      </div>
                    </div>

                    {/* 카드 2: AI 기능 */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 shadow-lg min-w-[280px] max-w-[280px] border-l-4 border-purple-400">
                      <div className="text-center">
                        <h2 className="text-xl font-bold text-purple-700 mb-3">급식배틀의 핵심, AI 5대 천왕!</h2>
                        <p className="text-sm text-gray-700 mb-3">
                          귀찮은 건 AI에게 맡기고, 여러분은 즐기기만 하세요!
                        </p>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p>1. 급식사진 검증</p>
                          <p>2. 급식이미지 생성</p>
                          <p>3. 급식퀴즈 출제</p>
                          <p>4. 오출제 검증</p>
                          <p>5. 평가결과 리포트</p>
                        </div>
                      </div>
                    </div>

                    {/* 카드 3: 급식 기능 */}
                    <div className="bg-orange-50 rounded-xl p-6 shadow-lg min-w-[280px] max-w-[280px]">
                      <div className="text-center">
                        <p className="text-xs text-blue-600 mb-3">[5조원 식판의 주인은 나! 500억 잔반을 바꾸는 맛주권 투표]</p>
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <img src="/images/characters/meal-rabbit.png" alt="급식" className="w-16 h-16 object-contain" />
                          <h3 className="text-lg font-semibold text-gray-900">급식</h3>
                        </div>
                        <p className="text-gray-600 text-sm">
                          오늘 급식, 몇 점? AI가 그려준 이미지와 함께 별점으로 점수를 매겨봐!
                        </p>
                        <p className="text-gray-600 text-xs mt-1">
                          - 메뉴별 하나하나 별점 메기고 소감댓글 남기기
                        </p>
                        <p className="text-gray-600 text-xs">
                          - 학부모님은 관심학교 등록해 우리아이 급식 맛 현황 파악
                        </p>
                      </div>
                    </div>

                    {/* 카드 4: 배틀 기능 */}
                    <div className="bg-red-50 rounded-xl p-6 shadow-lg min-w-[280px] max-w-[280px]">
                      <div className="text-center">
                        <p className="text-xs text-blue-600 mb-3">[우리의 솔직한 리뷰, 영양사님을 위한 최고의 레시피가 됩니다.]</p>
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <img src="/images/characters/battle-tiger.png" alt="배틀" className="w-16 h-16 object-contain" />
                          <h3 className="text-lg font-semibold text-gray-900">배틀</h3>
                        </div>
                        <p className="text-gray-600 text-xs">
                          - 우리학교/우리동네/전국 최고의 메뉴, 최악의 메뉴 실시간 확인
                        </p>
                        <p className="text-gray-600 text-xs">
                          - 우리동네/전국 최고 급식평점을 준 학교와 최하 평점 학교순위 확인
                        </p>
                        <p className="text-gray-600 text-xs">
                          - Data 기반한 월별 AI분석 리포트 - 급식담당자/학교당국/학부모 참고용
                        </p>
                      </div>
                    </div>

                    {/* 카드 5: 퀴즈 기능 */}
                    <div className="bg-green-50 rounded-xl p-6 shadow-lg min-w-[280px] max-w-[280px]">
                      <div className="text-center">
                        <p className="text-xs text-blue-600 mb-3">[식판 위에서 만나는 교과서, 음식으로 세상을 맛보는 지적 탐험!]</p>
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <img src="/images/characters/quiz-fox.png" alt="퀴즈" className="w-16 h-16 object-contain" />
                          <h3 className="text-lg font-semibold text-gray-900">퀴즈</h3>
                        </div>
                        <p className="text-gray-600 text-xs">
                          - 오늘 먹은 메뉴/학변별 맞춤 AI가 출제한 꿀잼 퀴즈 1일 1개 풀기
                        </p>
                        <p className="text-gray-600 text-xs">
                          - 먹고 끝이 아니라 전 교과와 연계/확장된 교육소재로 공부흥미와 편식방지까지
                        </p>
                        <p className="text-gray-600 text-xs">
                          - 학부모님은 우리아이 퀴즈구독하여 주장원/월장원 시 맛있는 간식선물 하세요!
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 음성 듣기 버튼 섹션 - 모바일 */}
                <div className="px-4 pb-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-center mb-3">
                      <h2 className="text-lg font-bold text-blue-800 mb-1">📹 앱 소개 영상</h2>
                    </div>
                    <div className="flex flex-row gap-3 justify-center">
                      <button
                        onClick={() => setShowVideoModal(true)}
                        className={`px-6 py-3 ${
                          playingAudio === 'student' 
                            ? 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600' 
                            : 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600'
                        } text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2 min-h-[60px]`}
                      >
                        {playingAudio === 'student' ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.846 13.5H2a1 1 0 01-1-1v-3a1 1 0 011-1h2.846l3.537-3.316a1 1 0 011.617.816zM16 10a6 6 0 01-1.71 4.24l-1.42-1.42A4 4 0 0015 10a4 4 0 00-2.13-3.82l1.42-1.42A6 6 0 0116 10z" clipRule="evenodd" />
                          </svg>
                        )}
                        <div className="text-center">
                          <div className="font-bold text-sm">초중고 학생</div>
                        </div>
                      </button>
                      <button
                        onClick={() => setShowParentVideoModal(true)}
                        className={`px-6 py-3 ${
                          playingAudio === 'parent' 
                            ? 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600' 
                            : 'bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600'
                        } text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2 min-h-[60px]`}
                      >
                        {playingAudio === 'parent' ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.846 13.5H2a1 1 0 01-1-1v-3a1 1 0 011-1h2.846l3.537-3.316a1 1 0 011.617.816zM16 10a6 6 0 01-1.71 4.24l-1.42-1.42A4 4 0 0015 10a4 4 0 00-2.13-3.82l1.42-1.42A6 6 0 0116 10z" clipRule="evenodd" />
                          </svg>
                        )}
                        <div className="text-center">
                          <div className="font-bold text-sm">학부모/급식관계자</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                
              </div>

              {/* 데스크톱: 기존 레이아웃 */}
              <div className="hidden lg:block">
                <div className="text-center lg:text-left">
                  <div className="flex justify-center lg:justify-start mb-4">
                    <img src="/images/sublogo.png" alt="급식배틀 로고" className="w-[140px] h-auto" />
                  </div>
                  <p className="mt-2 text-lg text-gray-600 leading-relaxed">
                    영양과 원산지는 Good! 그렇다면 '맛'은 ?
                  </p>
                  <p className="mt-1 text-lg text-gray-600 leading-relaxed">
                    이제 500만 학생의 목소리를 되찾을 시간,
                  </p>
                  <p className="mt-1 text-lg text-gray-700 font-medium">
                    우리들 별점이 새로운 기준이 됩니다.
                  </p>
                  <div className="mt-2 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-l-4 border-purple-400">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-purple-700">급식배틀의 핵심, AI 5대 천왕!</span>
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      귀찮은 건 AI에게 맡기고, 여러분은 즐기기만 하세요!
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      1) 사진 분석   2) 이미지 생성   3) 퀴즈 출제   4) 오답노트   5) 리포트 생성
                    </p>
                  </div>
                </div>

                <div className="space-y-5 mt-4">
                  {/* 급식 메뉴 */}
                  <div className="flex items-start space-x-4">
                    <img src="/images/characters/meal-rabbit.png" alt="급식" className="w-16 h-16 object-contain" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">급식 <span className="text-xs text-blue-600">[5조원 식판의 주인은 나! 500억 잔반을 바꾸는 맛주권 투표]</span></h3>
                      <p className="text-gray-600 text-sm">
                        오늘 급식, 몇 점? AI가 그려준 이미지와 함께 별점으로 점수를 매겨봐!
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        - 메뉴별 하나하나 별점 메기고 소감댓글 남기기
                      </p>
                      <p className="text-gray-600 text-xs">
                        - 학부모님은 관심학교 등록해 우리아이 급식 맛 현황 파악
                      </p>
                    </div>
                  </div>

                  {/* 배틀 메뉴 */}
                  <div className="flex items-start space-x-4">
                    <img src="/images/characters/battle-tiger.png" alt="배틀" className="w-16 h-16 object-contain" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">배틀 <span className="text-xs text-blue-600">[우리의 솔직한 리뷰, 영양사님을 위한 최고의 레시피가 됩니다.]</span></h3>
                      <p className="text-gray-600 text-xs">
                        - 우리학교/우리동네/전국 최고의 메뉴, 최악의 메뉴 실시간 확인
                      </p>
                      <p className="text-gray-600 text-xs">
                        - 우리동네/전국 최고 급식평점을 준 학교와 최하 평점 학교순위 확인
                      </p>
                      <p className="text-gray-600 text-xs">
                        - Data 기반한 월별 AI분석 리포트 - 급식담당자/학교당국/학부모 참고용
                      </p>
                    </div>
                  </div>

                  {/* 퀴즈 메뉴 */}
                  <div className="flex items-start space-x-4">
                    <img src="/images/characters/quiz-fox.png" alt="퀴즈" className="w-16 h-16 object-contain" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">퀴즈 <span className="text-xs text-blue-600">[식판 위에서 만나는 교과서, 음식으로 세상을 맛보는 지적 탐험!]</span></h3>
                      <p className="text-gray-600 text-xs">
                        - 오늘 먹은 메뉴/학변별 맞춤 AI가 출제한 꿀잼 퀴즈 1일 1개 풀기
                      </p>
                      <p className="text-gray-600 text-xs">
                        - 먹고 끝이 아니라 전 교과와 연계/확장된 교육소재로 공부흥미와 편식방지까지
                      </p>
                      <p className="text-gray-600 text-xs">
                        - 학부모님은 우리아이 퀴즈구독하여 주장원/월장원 시 맛있는 간식선물 하세요!
                      </p>
                    </div>
                  </div>
                </div>

                {/* 음성 듣기 버튼 섹션 - 데스크톱 */}
                <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-center mb-3">
                    <h2 className="text-lg font-bold text-blue-800 mb-1">📹 앱 소개 영상</h2>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setShowVideoModal(true)}
                      className={`flex-1 sm:flex-none px-6 py-3 ${
                        playingAudio === 'student' 
                          ? 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600' 
                          : 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600'
                      } text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2 min-h-[60px]`}
                    >
                      {playingAudio === 'student' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.846 13.5H2a1 1 0 01-1-1v-3a1 1 0 011-1h2.846l3.537-3.316a1 1 0 011.617.816zM16 10a6 6 0 01-1.71 4.24l-1.42-1.42A4 4 0 0015 10a4 4 0 00-2.13-3.82l1.42-1.42A6 6 0 0116 10z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="text-center">
                        <div className="font-bold text-sm">초중고 학생</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setShowParentVideoModal(true)}
                      className={`flex-1 sm:flex-none px-6 py-3 ${
                        playingAudio === 'parent' 
                          ? 'bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600' 
                          : 'bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600'
                      } text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center gap-2 min-h-[60px]`}
                    >
                      {playingAudio === 'parent' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.846 13.5H2a1 1 0 01-1-1v-3a1 1 0 011-1h2.846l3.537-3.316a1 1 0 011.617.816zM16 10a6 6 0 01-1.71 4.24l-1.42-1.42A4 4 0 0015 10a4 4 0 00-2.13-3.82l1.42-1.42A6 6 0 0116 10z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className="text-center">
                        <div className="font-bold text-sm">학부모/급식관계자</div>
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* 하단: 로그인 폼 (모바일), 오른쪽: 로그인 폼 (데스크톱) */}
            <div className="flex items-center justify-center order-2 lg:order-2 px-4 pb-8 lg:px-0 lg:pb-0">
              <div className="w-full max-w-md space-y-6 rounded-xl bg-white p-6 lg:p-8 shadow-lg">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">간편 로그인</h2>
                  <p className="mt-2 text-gray-600">소셜 계정으로 시작하세요</p>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <button
                    onClick={handleKakaoLogin}
                    disabled={kakaoLoading}
                    className="flex w-full items-center justify-center rounded-lg bg-[#FEE500] px-4 py-3 text-gray-900 shadow-sm transition-colors hover:bg-[#F3D900] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3C7.03125 3 3 6.03125 3 9.75C3 12.3125 4.71875 14.5312 7.21875 15.5625L6.46875 18.5625C6.40625 18.7812 6.625 18.9688 6.84375 18.8438L10.6562 16.2812C11.0938 16.3438 11.5312 16.375 12 16.375C16.9688 16.375 21 13.3438 21 9.625C21 5.90625 16.9688 3 12 3Z"
                        fill="black"
                      />
                    </svg>
                    {kakaoLoading ? '로그인 중...' : '카카오로 로그인'}
                  </button>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
                        fill="#4285F4"
                      />
                    </svg>
                    Google로 로그인
                  </button>
                </div>

                <div className="text-center text-sm text-gray-500">
                  <span>계정이 없으신가요? 소셜 로그인으로 자동 가입됩니다.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 사용법 가이드 모달 */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">🍚 급식배틀 사용법</h2>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">1️⃣</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">회원가입</h3>
                <p className="text-gray-600 text-sm">구글 또는 카카오 계정으로 간편하게 가입하세요</p>
              </div>

              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">2️⃣</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">학교 등록</h3>
                <p className="text-gray-600 text-sm">내 학교를 등록하고 학년, 반 정보를 입력하세요</p>
              </div>

              <div className="text-center">
                <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">3️⃣</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">급식 평가</h3>
                <p className="text-gray-600 text-sm">오늘의 급식을 먹고 별점과 댓글을 남겨보세요</p>
              </div>

              <div className="text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">4️⃣</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">퀴즈 도전</h3>
                <p className="text-gray-600 text-sm">친구들과 퀴즈 대결을 통해 챔피언에 도전하세요</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 주요 기능</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🍽️</span>
                  <div>
                    <span className="font-medium">급식 평가:</span>
                    <span className="text-gray-600 ml-2">AI 생성 이미지와 함께 급식 메뉴 확인 및 평점</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚔️</span>
                  <div>
                    <span className="font-medium">급식 배틀:</span>
                    <span className="text-gray-600 ml-2">학교별, 메뉴별 급식 평점 경쟁</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <span className="font-medium">급식 퀴즈:</span>
                    <span className="text-gray-600 ml-2">급식 메뉴 맞추기 퀴즈로 주장원, 월장원 도전</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => setShowGuideModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생용 비디오 모달 */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">📹 급식배틀앱 소개 영상 (학생용)</h2>
              <button 
                onClick={() => setShowVideoModal(false)}
                className="text-gray-500 hover:text-gray-800 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <video 
                controls 
                autoPlay
                className="w-full h-auto max-h-[70vh] rounded-lg"
                onEnded={() => setShowVideoModal(false)}
              >
                <source src="/video/student-intro.mp4" type="video/mp4" />
                브라우저가 비디오를 지원하지 않습니다.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* 학부모/급식관계자용 비디오 모달 */}
      {showParentVideoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">📹 급식배틀앱 소개 영상 (학부모/급식관계자용)</h2>
              <button 
                onClick={() => setShowParentVideoModal(false)}
                className="text-gray-500 hover:text-gray-800 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <video 
                controls 
                autoPlay
                className="w-full h-auto max-h-[70vh] rounded-lg"
                onEnded={() => setShowParentVideoModal(false)}
              >
                <source src="/video/parent-staff-intro.mp4" type="video/mp4" />
                브라우저가 비디오를 지원하지 않습니다.
              </video>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ...
export default function Login() {
  return (
    <Suspense fallback={<div className="p-4 text-center">로딩 중...</div>}>
      <LoginContent />
    </Suspense>
  )
}
