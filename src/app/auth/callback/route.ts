import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('Auth callback route triggered')
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  let redirectUrl = '/'
  
  try {
    if (code) {
      console.log('Auth code received, exchanging for session')
      const supabase = createClient()
      
      // 인증 코드로 세션 교환
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Session exchange error:', error.message)
        return NextResponse.redirect(new URL('/login?error=auth', request.url))
      }
      
      if (data.session) {
        console.log('Session successfully created')
        // 세션이 성공적으로 생성되면 프로필 페이지로 리다이렉트
        redirectUrl = '/profile'
      }
    } else {
      console.error('No auth code received')
    }
    
    console.log('Redirecting to:', redirectUrl)
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (error) {
    console.error('Unexpected error in auth callback:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
