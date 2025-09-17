import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🔍 닉네임 업데이트 API 호출됨');
  
  const { nickname } = await request.json();
  console.log('📝 요청된 닉네임:', nickname);
  
  const supabase = createRouteHandlerClient({ cookies });

  // 사용자 세션 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('👤 사용자 인증 상태:', { 
    userId: user?.id, 
    hasError: !!authError,
    errorMessage: authError?.message 
  });

  if (authError || !user) {
    return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
  }

  // 서버 사이드에서 직접 Supabase 호출
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ API 라우트 환경변수 누락:', {
      supabaseUrl: !!supabaseUrl,
      supabaseServiceKey: !!supabaseServiceKey
    });
    return NextResponse.json({ 
      error: 'Supabase 환경 변수가 설정되지 않았습니다.',
      debug: {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey
      }
    }, { status: 500 });
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // users 테이블에서 닉네임 업데이트
    const { data, error } = await adminSupabase
      .from('users')
      .update({ nickname: nickname })
      .eq('id', user.id)
      .select();

    if (error) {
      console.error('Supabase 닉네임 업데이트 오류:', error);
      throw error;
    }

    // auth.users 테이블에서도 닉네임(user_metadata) 업데이트
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(
      user.id,
      { user_metadata: { name: nickname } }
    );

    if (authError) {
      console.error('Supabase Auth 사용자 메타데이터 업데이트 오류:', authError);
      // 이 오류는 치명적이지 않을 수 있으므로, 로깅만 하고 계속 진행합니다.
    }

    console.log('✅ 닉네임 업데이트 성공:', { userId: user.id, nickname, data });
    
    return NextResponse.json({ 
      message: '닉네임이 성공적으로 업데이트되었습니다.', 
      data 
    });

  } catch (error: any) {
    console.error('닉네임 업데이트 오류:', error);
    return NextResponse.json({ 
      error: error.message || '서버 내부 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
