import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const errorCode = requestUrl.searchParams.get('error_code')
  const nextParam = requestUrl.searchParams.get('next') || '/'

  if (errorCode) {
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth', request.url))
    }

    const redirectPath = nextParam.startsWith('/') ? nextParam : '/'
    return NextResponse.redirect(new URL(redirectPath, request.url))
  } catch (exchangeError) {
    console.error('Auth callback exchange error:', exchangeError)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
