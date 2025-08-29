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

    // 1. meal_images에서 이미지 삭제
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

    // 2. 신고 상태를 'resolved'로 업데이트하고 관리자 노트 추가
    const { error: reportUpdateError } = await supabaseAdmin
      .from('meal_image_reports')
      .update({
        status: 'resolved',
        admin_notes: '부적절한 이미지로 판단되어 삭제 처리됨',
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin' // 실제로는 관리자 ID를 사용
      })
      .eq('id', reportId);

    if (reportUpdateError) {
      console.error('신고 상태 업데이트 오류:', reportUpdateError);
      return NextResponse.json(
        { error: '신고 상태 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: '이미지가 삭제되고 신고가 해결 처리되었습니다.' 
    });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
