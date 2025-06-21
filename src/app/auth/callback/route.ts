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

      // (수정) Supabase 클라이언트를 await로 받아야 함
      const supabase = await createClient()

      // 인증 코드로 세션 교환
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      // 인증 성공 시 프로필 이미지 URL이 HTTP로 시작하는지 검사하고 수정
      if (data?.session?.user?.user_metadata?.avatar_url) {
        const avatarUrl = data.session.user.user_metadata.avatar_url;
        if (avatarUrl.startsWith('http://')) {
          console.log('프로필 이미지 URL을 HTTPS로 변환합니다:', avatarUrl);
          
          // 사용자 메타데이터 업데이트
          const httpsAvatarUrl = avatarUrl.replace('http://', 'https://');
          await supabase.auth.updateUser({
            data: { 
              avatar_url: httpsAvatarUrl 
            }
          });
          
          console.log('URL이 업데이트되었습니다:', httpsAvatarUrl);
        }
      }

      if (error) {
        console.error('Session exchange error:', error.message)
        return NextResponse.redirect(new URL('/login?error=auth', request.url))
      }

      if (data.session) {
        console.log('Session successfully created')
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
