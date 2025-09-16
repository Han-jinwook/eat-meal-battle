import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeAndDecompress } from '@/lib/utils';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  if (state) {
    const decompressedState = decodeAndDecompress(state);
    if (decompressedState) {
      // URL에서 압축된 state를 압축 해제된 JSON 문자열로 교체합니다.
      requestUrl.searchParams.set('state', JSON.stringify(decompressedState));
    }
  }

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${requestUrl.origin}/auth/loading`);
}
