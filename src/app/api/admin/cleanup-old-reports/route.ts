import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 7일 이전 날짜 계산
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString();

    // 7일 이상 된 처리완료(resolved, dismissed) 신고 레코드 삭제
    const { data, error, count } = await supabase
      .from('meal_image_reports')
      .delete({ count: 'exact' })
      .in('status', ['resolved', 'dismissed'])
      .lt('created_at', cutoffDate);

    if (error) {
      console.error('신고 레코드 정리 오류:', error);
      return NextResponse.json(
        { error: '신고 레코드 정리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: count || 0,
      message: `${count || 0}개의 처리완료 신고가 정리되었습니다.`
    });

  } catch (error) {
    console.error('신고 레코드 정리 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
