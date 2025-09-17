import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { nickname } = await request.json();
  const supabase = createRouteHandlerClient({ cookies });

  // 사용자 세션 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
  }

  // Netlify 함수 URL 구성
  const functionUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/.netlify/functions/user`;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'update-nickname', userId: user.id, nickname }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result.error || 'Netlify 함수 호출에 실패했습니다.' }, { status: response.status });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: error.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
