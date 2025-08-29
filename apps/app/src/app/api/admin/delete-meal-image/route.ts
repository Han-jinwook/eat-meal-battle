import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function DELETE(request: NextRequest) {
  try {
    const { imageId, reportId } = await request.json();

    if (!imageId || !reportId) {
      return NextResponse.json(
        { error: '이미지 ID와 신고 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 신고 정보 조회 (급식페이지 새로고침을 위한 정보 수집)
    const { data: reportInfo, error: reportFetchError } = await supabaseAdmin
      .from('meal_image_reports')
      .select('school_code, meal_date, meal_type')
      .eq('id', reportId)
      .single();

    if (reportFetchError || !reportInfo) {
      console.error('신고 정보 조회 오류:', reportFetchError);
      return NextResponse.json(
        { error: '신고 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 1. meal_images에서만 이미지 삭제 (신고 레코드는 영구 보존)
    const { error: imageDeleteError } = await supabaseAdmin
      .from('meal_images')
      .delete()
      .eq('id', imageId);

    if (imageDeleteError) {
      console.error('이미지 삭제 오류:', imageDeleteError);
      return NextResponse.json(
        { error: '이미지 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 2. 신고 상태를 'resolved'로 업데이트 (레코드는 삭제하지 않고 영구 보존)
    const { error: reportUpdateError } = await supabaseAdmin
      .from('meal_image_reports')
      .update({
        status: 'resolved',
        admin_notes: '부적절한 이미지로 판단되어 삭제 처리됨',
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin'
      })
      .eq('id', reportId);

    if (reportUpdateError) {
      console.error('신고 상태 업데이트 오류:', reportUpdateError);
      return NextResponse.json(
        { error: '신고 상태 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 3. 급식페이지 새로고침 신호 전송
    try {
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/.netlify/functions/refresh-meal-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          school_code: reportInfo.school_code,
          meal_date: reportInfo.meal_date,
          meal_type: reportInfo.meal_type
        })
      });

      if (!refreshResponse.ok) {
        console.error('급식페이지 새로고침 신호 전송 실패');
      }
    } catch (refreshError) {
      console.error('급식페이지 새로고침 오류:', refreshError);
      // 새로고침 실패해도 메인 작업은 성공으로 처리
    }

    return NextResponse.json({ 
      success: true, 
      message: '이미지가 삭제되고 신고가 해결 처리되었습니다.',
      mealInfo: {
        school_code: reportInfo.school_code,
        meal_date: reportInfo.meal_date,
        meal_type: reportInfo.meal_type
      }
    });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
