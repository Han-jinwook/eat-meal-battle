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

export async function POST(request: NextRequest) {
  try {
    const { reportId, status, adminNotes } = await request.json();

    if (!reportId || !status) {
      return NextResponse.json(
        { error: '필수 데이터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 유효한 상태값 확인
    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태값입니다.' },
        { status: 400 }
      );
    }

    // 신고 상태 업데이트
    const updateData: any = {
      status,
      reviewed_at: new Date().toISOString(),
      // reviewed_by는 추후 관리자 인증 시스템 구현 시 추가
    };

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    const { data, error } = await supabaseAdmin
      .from('meal_image_reports')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();

    if (error) {
      console.error('신고 상태 업데이트 오류:', error);
      return NextResponse.json(
        { error: '신고 상태 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      report: data,
      message: '신고 상태가 업데이트되었습니다.' 
    });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
