import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabaseAdmin';

// 이미지 정보 저장 API
export async function POST(request: Request) {
  try {
    console.log('API 호출: /api/meal-images/create');
    
    // 일반 클라이언트 생성 (사용자 인증 확인용)
    const supabase = createClient();
    
    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('인증되지 않은 요청');
      return NextResponse.json(
        { error: '인증되지 않은 요청입니다.' },
        { status: 401 }
      );
    }
    
    // 중앙 집중화된 방식으로 관리자 권한의 Supabase 클라이언트 생성
    const supabaseAdmin = createAdminClient();
    
    const { meal_id, image_url, user_id, status, source } = await request.json();
    console.log('요청 데이터:', { meal_id, image_url, user_id, status, source });

    // 필수 필드 검증
    if (!meal_id || !image_url || !source) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다. (meal_id, image_url, source)' },
        { status: 400 }
      );
    }
    
    // user_id가 인증된 사용자와 일치하는지 확인
    if (user_id !== user.id) {
      console.log('불일치하는 사용자 ID:', { 요청된_ID: user_id, 인증된_ID: user.id });
      return NextResponse.json(
        { error: '인증된 사용자와 일치하지 않는 사용자 ID입니다.' },
        { status: 403 }
      );
    }
    
    // URL 형식 검증
    try {
      new URL(image_url);
    } catch (error) {
      return NextResponse.json(
        { error: '잘못된 이미지 URL 형식입니다.' },
        { status: 400 }
      );
    }

    // 서비스 롤 키를 사용하여 RLS 정책을 우회
    // 오늘 혹은 과거 날짜에 대해 이미 approved 상태인 이미지가 있는지 확인
    const { data: existingApproved, error: checkError } = await supabaseAdmin
      .from('meal_images')
      .select('id')
      .eq('meal_id', meal_id)
      .eq('status', 'approved')
      .limit(1);
    if (checkError) {
      console.error('기존 승인 이미지 조회 오류:', checkError);
      return NextResponse.json(
        { error: '기존 승인 이미지 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    if (existingApproved && existingApproved.length) {
      return NextResponse.json(
        { error: '이미 승인된 급식사진이 있습니다.' },
        { status: 409 }
      );
    }
    console.log('서비스 롤 키로 데이터 삽입 시도...');
    
    // 유니크 제약조건 문제 해결을 위해 upsert 방식 사용
    // meal_id + status 조합으로 충돌 처리 (동일 meal에 대해 동일 status를 가진 경우 업데이트)
    const { data: insertedMealImage, error } = await supabaseAdmin
      .from('meal_images')
      .upsert(
        {
          meal_id,
          image_url,
          uploaded_by: user_id,
          status: status || 'pending',
          source,
          updated_at: new Date().toISOString(),
        },
        { 
          onConflict: 'meal_id,status',  
          ignoreDuplicates: false         
        }
      )
      .select()
      .single();

    if (error) {
      console.error('이미지 정보 저장 오류:', error);
      return NextResponse.json(
        { error: `이미지 정보 저장 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }

    if (!insertedMealImage) {
      console.error('Upsert 후 반환된 데이터가 없습니다.');
      return NextResponse.json(
        { error: '이미지 정보 저장 후 데이터를 받지 못했습니다.' },
        { status: 500 }
      );
    }
    
    console.log('이미지 정보 저장 성공:', insertedMealImage);

    // 업로더 닉네임 조회
    let uploaderNickname = null;
    if (insertedMealImage.uploaded_by) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('nickname')
        .eq('id', insertedMealImage.uploaded_by)
        .single();

      if (userError) {
        console.error('업로더 닉네임 조회 오류:', userError);
      } else if (userData) {
        uploaderNickname = userData.nickname;
      }
    }

    const responseData = {
      ...insertedMealImage,
      uploader_nickname: uploaderNickname,
    };

    console.log('최종 반환 데이터:', responseData);

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    // 에러 처리 개선 - 에러 타입 처리 및 로깅 강화
    const errorMessage = error instanceof Error 
      ? error.message 
      : '알 수 없는 서버 오류가 발생했습니다.';
    
    // 중요 오류의 경우 자세한 로깅 추가
    console.error('API 오류 발생:', {
      endpoint: '/api/meal-images/create',
      errorType: error instanceof Error ? error.name : typeof error,
      errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: 'INTERNAL_SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}
