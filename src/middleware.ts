import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const protectedPaths = ['/dashboard'];
  const isProtectedPath = protectedPaths.some(path => nextUrl.pathname.startsWith(path));

  const supabase = await createClient();
  await supabase.auth.getSession(); // 세션 강제 동기화
  const { data: { user }, error } = await supabase.auth.getUser();

  if (isProtectedPath && (!user || error)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectedFrom', nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 보안 헤더 추가
  const response = NextResponse.next();
  
  // Content-Security-Policy 설정
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' https://*.supabase.co https://*.googleapis.com https://os.sundreamer.app https://images.unsplash.com; " +
    "frame-src 'self' https://*.googleapis.com;"
  );
  
  // XSS 방지 헤더
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // MIME 타입 스니핑 방지
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Referrer 정책
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // iFrame 내 표시 제한
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
