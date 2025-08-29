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
    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: '신고 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 신고 상태를 'dismissed'로 업데이트 (삭제하지 않고 보존)
    const { error } = await supabaseAdmin
      .from('meal_image_reports')
      .update({
        status: 'dismissed',
        admin_notes: '관리자에 의해 기각됨',
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin'
      })
      .eq('id', reportId);

    if (error) {
      console.error('신고 상태 업데이트 오류:', error);
      return NextResponse.json(
        { error: '신고 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: '신고가 기각 처리되었습니다.' 
    });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
