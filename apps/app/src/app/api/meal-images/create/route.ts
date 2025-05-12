import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// 이미지 정보 저장 API
export async function POST(request: Request) {
  try {
    console.log('API 호출: /api/meal-images/create');
    
    // 서비스 롤 키를 사용하여 관리자 권한으로 Supabase 클라이언트 생성
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // 일반 클라이언트도 생성 (사용자 정보 확인용)
    const supabase = createClient();
    
    const { meal_id, image_url, user_id, status } = await request.json();
    console.log('요청 데이터:', { meal_id, image_url, user_id, status });

    if (!meal_id || !image_url || !user_id) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 서비스 롤 키를 사용하여 RLS 정책을 우회
    console.log('서비스 롤 키로 데이터 삽입 시도...');
    const { data, error } = await supabaseAdmin
      .from('meal_images')
      .insert({
        meal_id,
        image_url,
        uploaded_by: user_id,
        status: status || 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('이미지 정보 저장 오류:', error);
      return NextResponse.json(
        { error: `이미지 정보 저장 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }
    
    console.log('이미지 정보 저장 성공:', data);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
