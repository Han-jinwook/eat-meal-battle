'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient, signInWithRetry, clearSession } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// SearchParams를 사용하는 컴포넌트 분리 (useSearchParams는 반드시 Suspense로 감싸야 함)
function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  useEffect(() => {
    // URL 파라미터에서 오류 처리
    const errorType = searchParams.get('error')
    if (errorType === 'auth') {
      setError('인증 오류가 발생했습니다. 다시 시도해주세요.')
    } else if (errorType === 'server_error') {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
    
    // 사용자가 이미 로그인되어 있는지 확인
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
  }, [router, searchParams, supabase])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('구글 로그인 시도 중...')
      
      // 새로운 재시도 로직 사용 (세션 안정성 개선)
      const { data, error } = await signInWithRetry('google');
      
      if (error) {
        console.error('구글 로그인 오류:', error)
        throw error
      }
      
      console.log('로그인 성공, 리다이렉트 완료:', data)
    } catch (error: any) {
      console.error('로그인 시도 중 오류:', error)
      setError(error.message || '구글 로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
    // signInWithOAuth이 성공하면 사용자가 리디렉션되므로 setLoading(false)를 호출할 필요 없음
  }

  const handleKakaoLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('카카오 로그인 시도 중...')
      
      // 카카오는 기존 방식 유지 (signInWithRetry는 Google 전용)
      // 리디렉션 URL 설정 - 항상 현재 도메인의 /auth/callback 사용
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/auth/callback`
      
      console.log('현재 도메인:', baseUrl)
      
      console.log('카카오 리디렉션 URL:', redirectUrl)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            scope: 'profile_nickname,profile_image,account_email,birthyear',
            prompt: 'consent',
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
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <div className="grid w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
            
            {/* 왼쪽: 앱 소개 */}
            <div className="flex flex-col justify-center space-y-8">
              <div className="text-center lg:text-left">
                <h1 className="text-4xl font-bold text-gray-900 lg:text-5xl">
                  뭐먹지?
                </h1>
                <p className="mt-2 text-2xl font-semibold text-blue-600">
                  급식배틀
                </p>
                <p className="mt-4 text-xl font-bold text-red-600">
                  급식도 민주주의!
                </p>
                <p className="mt-3 text-lg text-gray-600 leading-relaxed">
                  원산지와 영양은 따지는데, 누구도 500만 학생들의 급식 맛에 대해선 알려고 하지 않는 놀~라운 세상
                </p>
                <p className="mt-2 text-lg text-gray-700 font-medium">
                  우리 스스로 맛을 평가하자! 🍽️
                </p>
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-l-4 border-purple-400">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-purple-700">AI 54가지 기능</span>으로 
                    <span className="mx-1">필요</span>와 
                    <span className="mx-1">재미</span>와 
                    <span className="mx-1">공감</span>과 
                    <span className="mx-1 font-medium">AI 첨단</span>의 만남
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    급식사진 검증 • 급식이미지 생성 • 퀴즈 생성 • 오답 검증 • 급식 월간 분석리포트
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {/* 급식 메뉴 */}
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                    <span className="text-2xl">🍽️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">급식</h3>
                    <p className="text-gray-600 text-sm">
                      오늘의 급식을 확인하고 별점으로 평가하세요. AI가 생성한 이미지로 더욱 생생하게!
                    </p>
                  </div>
                </div>

                {/* 배틀 메뉴 */}
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                    <span className="text-2xl">⚔️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">배틀</h3>
                    <p className="text-gray-600 text-sm">
                      학교별, 메뉴별 급식 평점 경쟁! 우리 학교가 1등인지 확인해보세요.
                    </p>
                  </div>
                </div>

                {/* 퀴즈 메뉴 */}
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">퀴즈</h3>
                    <p className="text-gray-600 text-sm">
                      급식 메뉴 맞추기 퀴즈로 친구들과 대결! 주장원, 월장원에 도전하세요.
                    </p>
                  </div>
                </div>
              </div>

              {/* 사용법 보기 버튼 */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowGuideModal(true)}
                  className="w-full lg:w-auto bg-blue-50 hover:bg-blue-100 text-blue-700 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>📖</span>
                  <span>자세한 사용법 보기</span>
                </button>
              </div>
            </div>

            {/* 오른쪽: 로그인 폼 */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-lg">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">로그인</h2>
                  <p className="mt-2 text-gray-600">소셜 계정으로 시작하세요</p>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"
                        fill="#4285F4"
                      />
                    </svg>
                    {loading ? '로그인 중...' : 'Google로 로그인'}
                  </button>

                  <button
                    onClick={handleKakaoLogin}
                    disabled={loading}
                    className="flex w-full items-center justify-center rounded-lg bg-[#FEE500] px-4 py-3 text-gray-900 shadow-sm transition-colors hover:bg-[#F3D900] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3C7.03125 3 3 6.03125 3 9.75C3 12.3125 4.71875 14.5312 7.21875 15.5625L6.46875 18.5625C6.40625 18.7812 6.625 18.9688 6.84375 18.8438L10.6562 16.2812C11.0938 16.3438 11.5312 16.375 12 16.375C16.9688 16.375 21 13.3438 21 9.625C21 5.90625 16.9688 3 12 3Z"
                        fill="black"
                      />
                    </svg>
                    {loading ? '로그인 중...' : '카카오로 로그인'}
                  </button>
                </div>

                <div className="text-xs text-gray-500 rounded-lg bg-gray-50 p-3">
                  <p className="font-medium">💡 로그인 팁</p>
                  <p className="mt-1">처음 로그인하시거나 문제가 있다면 시크릿 창을 이용해보세요.</p>
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
    </div>
  )
}

// 메인 Login 컴포넌트는 useSearchParams()를 사용하는 LoginContent를 Suspense로 감싸야 함
export default function Login() {
  return (
    <Suspense fallback={<div className="p-4 text-center">로딩 중...</div>}>
      <LoginContent />
    </Suspense>
  )
}
