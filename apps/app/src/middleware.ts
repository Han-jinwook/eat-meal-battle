import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const protectedPaths = ['/profile', '/dashboard'];
  const isProtectedPath = protectedPaths.some(path => nextUrl.pathname.startsWith(path));

  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (isProtectedPath && (!user || error)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectedFrom', nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/dashboard/:path*'],
};
