import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getConfig } from '@/services/merlin-hub-sdk/CoreLogic/config';

async function verifyMerlinSession(token: string) {
  if (token === 'test-session-token') {
    let testUserId = '00000000-0000-4000-8000-000000000001';
    // 로컬 개발 환경에서 해당 테스트 유저가 auth.users에 없을 경우 첫 번째 사용자의 ID를 사용
    if (process.env.NODE_ENV === 'development') {
      try {
        const { data: firstUser } = await createAdminClient().from('users').select('id').limit(1).maybeSingle();
        if (firstUser) {
          testUserId = firstUser.id;
        }
      } catch (err) {
        console.error('[verifyMerlinSession] Fallback user resolution failed:', err);
      }
    }
    return {
      id: testUserId,
      email: 'test@aggrofilter.com',
      nickname: 'KCP심사관'
    };
  }

  const config = getConfig();
  const url = `${config.hubUrl}/api/auth/me`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Id': config.clientId,
    'X-Client-Secret': config.clientSecret,
    'Authorization': `Bearer ${token}`
  };
  
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && data.user) {
      return data.user;
    }
  } catch (err) {
    console.error('[verifyMerlinSession] Error:', err);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    // 1. Authorization 헤더 검증
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증 헤더가 유효하지 않습니다.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyMerlinSession(token);
    if (!user || (!user.id && !user.userId)) {
      return NextResponse.json({ error: '유효하지 않은 세션입니다. 다시 로그인해주세요.' }, { status: 401 });
    }

    const userId = user.userId || user.id;

    // 2. 요청 데이터 파싱
    const { image, fileName } = await request.json();
    if (!image) {
      return NextResponse.json({ error: '이미지 데이터가 누락되었습니다.' }, { status: 400 });
    }

    // base64 접두사 제거 및 버퍼 변환
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 파일명 안전하게 구성
    const safeFileName = fileName || `solo_${userId}_${Date.now()}.webp`;

    const supabaseAdmin = createAdminClient();

    // 3. Supabase Storage에 관리자 권한으로 업로드
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('meal-images')
      .upload(safeFileName, buffer, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError);
      return NextResponse.json({ error: `파일 업로드 중 오류가 발생했습니다: ${uploadError.message}` }, { status: 500 });
    }

    // 4. 공개 URL 획득
    const { data: urlData } = supabaseAdmin.storage
      .from('meal-images')
      .getPublicUrl(safeFileName);

    return NextResponse.json({ publicUrl: urlData.publicUrl });
  } catch (error: any) {
    console.error('[Upload Image API] Error:', error);
    return NextResponse.json({ error: error.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
