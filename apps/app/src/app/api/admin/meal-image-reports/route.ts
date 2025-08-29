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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    // 기본 쿼리
    let query = supabaseAdmin
      .from('meal_image_reports')
      .select('*')
      .order('created_at', { ascending: false });

    // 상태 필터 적용
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('신고 데이터 조회 오류:', error);
      return NextResponse.json(
        { error: '신고 데이터를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reports });

  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
