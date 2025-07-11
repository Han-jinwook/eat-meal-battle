'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient, signInWithRetry, clearSession } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// SearchParams를 사용하는 컴포넌트 분리 (useSearchParams는 반드시 Suspense로 감싸야 함)
function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
          redirectTo: redirectUrl,
          queryParams: {
            scope: 'profile_nickname,profile_image,account_email',
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
                <p className="mt-4 text-xl text-gray-600">
                  학교 급식의 모든 것을 한 곳에서
                </p>
              </div>

              <div className="space-y-6">
                {/* 급식 기능 */}
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                    <span className="text-2xl">🍽️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">급식</h3>
                    <p className="text-gray-600">
                      오늘의 급식 메뉴를 확인하고, AI가 생성한 급식 이미지로 더욱 생생하게 만나보세요!
                    </p>
                  </div>
                </div>

                {/* 배틀 기능 */}
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                    <span className="text-2xl">⚔️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">배틀</h3>
                    <p className="text-gray-600">
                      친구들과 급식 평점 배틀! 누가 더 맛있는 급식을 먹었는지 겨뤄보세요.
                    </p>
                  </div>
                </div>

                {/* 퀴즈 기능 */}
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                    <span className="text-2xl">🧩</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">퀴즈</h3>
                    <p className="text-gray-600">
                      급식 메뉴를 맞춰보는 재미있는 퀴즈! 주장원, 월장원에 도전해보세요.
                    </p>
                  </div>
                </div>
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
