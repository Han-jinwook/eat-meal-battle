'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthLoading() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      // 세션 정보를 가져오기 위해 여러 번, 시간 간격을 두고 시도합니다.
      for (let i = 0; i < 5; i++) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          console.log('세션 확인 성공, 홈으로 이동합니다.')
          // 세션이 확인되면 홈으로 리디렉션합니다.
          router.push('/')
          return
        }
        // 200ms 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // 5번 시도 후에도 세션이 없으면 로그인 페이지로 보냅니다.
      console.log('세션 확인 실패, 로그인 페이지로 이동합니다.')
      router.push('/login?error=session_failed')
    }

    checkSessionAndRedirect()
  }, [router, supabase])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg font-semibold">로그인 중입니다...</p>
        <p className="text-gray-500">잠시만 기다려주세요.</p>
      </div>
    </div>
  )
}
