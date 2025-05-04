import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// 이미지 업로드 및 저장 통합 API
export async function POST(request: Request) {
  console.log('API 호출: /api/meal-images/upload');
  
  try {
    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mealId = formData.get('meal_id') as string;
    const schoolCode = formData.get('school_code') as string;
    const mealDate = formData.get('meal_date') as string;
    const mealType = formData.get('meal_type') as string;
    const userId = formData.get('user_id') as string;
    
    // 특별히 'undefined' 문자열 처리
    if (mealId === 'undefined') {
      console.error('mealId가 문자열 "undefined"로 전달됨');
      return NextResponse.json(
        { error: '급식 정보가 없습니다. 다른 날짜를 선택해주세요.' },
        { status: 400 }
      );
    }

    console.log('요청 데이터:', { 
      mealId, 
      schoolCode, 
      mealDate, 
      mealType,
      fileName: file?.name,
      fileSize: file?.size,
      userId
    });

    // UUID 형식 검증 
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!file || !userId) {
      return NextResponse.json(
        { error: '파일과 사용자 정보는 필수입니다.' },
        { status: 400 }
      );
    }
    
    if (!uuidRegex.test(mealId || '')) {
      console.error('유효하지 않은 mealId 형식:', mealId);
      return NextResponse.json(
        { error: '급식 정보가 올바르지 않습니다. 날짜를 다시 선택해주세요.' },
        { status: 400 }
      );
    }

    // 서비스 롤 키를 사용하여 관리자 권한으로 Supabase 클라이언트 생성
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    // 일반 클라이언트도 생성 (사용자 정보 확인용)
    const supabase = createClient();

    // 1. 파일 이름 생성 (고유한 이름)
    const fileExt = file.name.split('.').pop();
    // 파일 이름에 특수문자 제거 및 간소화
    const safeDate = mealDate.replace(/-/g, '');
    // 한글 제거 및 영문/숫자만 사용
    const safeFileName = `${schoolCode}_${safeDate}_${Date.now()}.${fileExt}`;
    // Storage 버킷에 직접 업로드
    const filePath = safeFileName;

    console.log('파일 업로드 시도:', { filePath, fileSize: file.size });

    // 2. 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // 3. Supabase Storage에 이미지 업로드 (관리자 권한 사용)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('meal-images')
      .upload(filePath, fileBuffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) {
      console.error('파일 업로드 오류:', uploadError);
      return NextResponse.json(
        { error: `파일 업로드 중 오류가 발생했습니다: ${uploadError.message}` },
        { status: 500 }
      );
    }

    console.log('파일 업로드 성공:', uploadData);

    // 4. 이미지 URL 가져오기
    const { data: urlData } = supabaseAdmin.storage
      .from('meal-images')
      .getPublicUrl(filePath);

    console.log('이미지 URL:', urlData.publicUrl);

    // 5. meal_images 테이블에 레코드 추가 (관리자 권한 사용)
    console.log('데이터베이스 저장 시도:', { 
      meal_id: mealId,
      image_url: urlData.publicUrl,
      user_id: userId 
    });

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('meal_images')
      .insert({
        meal_id: mealId,
        image_url: urlData.publicUrl,
        uploaded_by: userId,
        status: 'pending',
        is_shared: false
      })
      .select()
      .single();

    if (dbError) {
      console.error('데이터베이스 저장 오류:', dbError);
      return NextResponse.json(
        { error: `이미지 정보 저장 중 오류가 발생했습니다: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log('데이터베이스 저장 성공:', dbData);

    return NextResponse.json(dbData);
  } catch (error: any) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
