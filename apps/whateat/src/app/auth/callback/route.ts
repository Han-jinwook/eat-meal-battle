import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@meal-battle/auth';

export async function GET(request: NextRequest) {
  // URL에서 코드와 오류 매개변수 추출
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');

  // 오류가 있는 경우 오류 페이지로 리다이렉트
  if (error) {
    console.error('인증 콜백 오류:', error, error_description);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error_description || '인증 중 오류가 발생했습니다')}`, requestUrl.origin)
    );
  }

  // 코드가 없는 경우 홈으로 리다이렉트
  if (!code) {
    return NextResponse.redirect(new URL('/', requestUrl.origin));
  }

  try {
    // Supabase 클라이언트 생성
    const supabase = createClient();
    
    // 현재 URL에서 인증 코드 교환
    await supabase.auth.exchangeCodeForSession(code);

    // 성공적으로 인증되면 홈페이지로 리다이렉트
    return NextResponse.redirect(new URL('/', requestUrl.origin));
  } catch (error) {
    console.error('인증 코드 교환 중 오류:', error);
    return NextResponse.redirect(
      new URL('/login?error=인증+처리+중+오류가+발생했습니다', requestUrl.origin)
    );
  }
}
