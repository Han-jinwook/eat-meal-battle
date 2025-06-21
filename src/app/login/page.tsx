'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
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
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // 이미 로그인되어 있으면 홈으로 리다이렉트
        router.push('/')
      }
    }
    
    checkUser()
  }, [router, searchParams, supabase])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('구글 로그인 시도 중...')
      // 정확한 포트(3001)를 사용하는 리디렉션 URL 설정
      // 개발환경에서는 http, 프로덕션에서는 https 사용
      const baseUrl = window.location.origin;
      const redirectUrl = baseUrl.includes('localhost') 
        ? 'http://localhost:3001/auth/callback'
        : `${baseUrl}/auth/callback`
      console.log('리디렉션 URL:', redirectUrl)
      
      // 철저한 세션 초기화 - 모든 스토리지 비우기
      await supabase.auth.signOut()
      
      // localStorage에서 관련 상태 모두 삭제
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('google') || key.includes('oauth')) {
          localStorage.removeItem(key)
        }
      })
      
      // 랜덤한 상태값 생성
      const randomState = Math.random().toString(36).substring(2, 15)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectUrl}?state=${randomState}&t=${Date.now()}`,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account consent',
            include_granted_scopes: 'false', // 이전 동의를 무시
          },
        },
      })
      
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
      // 정확한 포트(3001)를 사용하는 리디렉션 URL 설정
      // 개발환경에서는 http, 프로덕션에서는 https 사용
      const baseUrl = window.location.origin;
      const redirectUrl = baseUrl.includes('localhost') 
        ? 'http://localhost:3001/auth/callback'
        : `${baseUrl}/auth/callback`
      console.log('리디렉션 URL:', redirectUrl)
      
      // 철저한 세션 초기화 - 모든 스토리지 비우기
      await supabase.auth.signOut()
      
      // localStorage에서 관련 상태 모두 삭제
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('kakao') || key.includes('oauth')) {
          localStorage.removeItem(key)
        }
      })
      
      // 랜덤한 상태값 생성
      const randomState = Math.random().toString(36).substring(2, 15)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${redirectUrl}?state=${randomState}&t=${Date.now()}`,
          skipBrowserRedirect: false,
          queryParams: {
            prompt: 'login consent',
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
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">급식배틀</h1>
          <p className="mt-2 text-gray-600">소셜 계정으로 로그인하세요</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
            className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-[#FEE500] px-4 py-2 text-gray-900 shadow-sm hover:bg-[#F3D900] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3C7.03125 3 3 6.03125 3 9.75C3 12.3125 4.71875 14.5312 7.21875 15.5625L6.46875 18.5625C6.40625 18.7812 6.625 18.9688 6.84375 18.8438L10.6562 16.2812C11.0938 16.3438 11.5312 16.375 12 16.375C16.9688 16.375 21 13.3438 21 9.625C21 5.90625 16.9688 3 12 3Z"
                fill="black"
              />
            </svg>
            {loading ? '로그인 중...' : '카카오로 로그인'}
          </button>
          
          <div className="text-xs text-gray-500 mt-4 p-2 bg-gray-100 rounded">
            <p>💡 <strong>알림:</strong> 로그인 시 항상 2차 인증과 필수 정보 동의 화면을 보시려면:</p>
            <ul className="list-disc pl-5 mt-1">
              <li>브라우저의 개인정보 보호 모드(시크릿 창)에서 로그인을 시도해 보세요.</li>
              <li>또는 브라우저 설정에서 쿠키와 사이트 데이터를 삭제한 후 시도해 보세요.</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <Link href="/" className="text-indigo-600 hover:text-indigo-500">
            홈으로 돌아가기
          </Link>
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
