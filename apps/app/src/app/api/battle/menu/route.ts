import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const schoolCode = searchParams.get('schoolCode');
    const type = searchParams.get('type') as 'daily' | 'monthly';
    const month = searchParams.get('month');

    console.log('배틀 API 호출:', { schoolCode, type, date, month });

    if (!schoolCode) {
      return NextResponse.json(
        { error: '학교 코드가 필요합니다.' },
        { status: 400 }
      );
    }

    if (type === 'daily' && !date) {
      return NextResponse.json(
        { error: '일별 배틀에는 날짜가 필요합니다.' },
        { status: 400 }
      );
    }

    if (type === 'monthly' && !month) {
      return NextResponse.json(
        { error: '월별 배틀에는 연월이 필요합니다.' },
        { status: 400 }
      );
    }

    // DB에서 저장된 배틀 데이터만 조회
    let query;
    if (type === 'daily') {
      // 일별 배틀 데이터 조회
      query = supabase
        .from('menu_battle_daily')
        .select(`
          menu_item_id,
          final_avg_rating,
          final_rating_count,
          daily_rank,
          meal_menu_items!inner(
            item_name,
            meal_menus!inner(
              school_code,
              meal_date
            )
          )
        `)
        .eq('meal_menu_items.meal_menus.school_code', schoolCode)
        .eq('meal_menu_items.meal_menus.meal_date', date)
        .order('daily_rank', { ascending: true });
    } else {
      // 월별 배틀 데이터 조회
      const [year, monthNum] = month.split('-');
      query = supabase
        .from('menu_battle_monthly')
        .select(`
          menu_item_id,
          final_avg_rating,
          final_rating_count,
          monthly_rank,
          meal_menu_items!inner(
            item_name,
            meal_menus!inner(
              school_code,
              meal_date
            )
          )
        `)
        .eq('meal_menu_items.meal_menus.school_code', schoolCode)
        .gte('meal_menu_items.meal_menus.meal_date', `${year}-${monthNum}-01`)
        .lt('meal_menu_items.meal_menus.meal_date', `${year}-${String(parseInt(monthNum) + 1).padStart(2, '0')}-01`)
        .order('monthly_rank', { ascending: true });
    }

    console.log('DB 쿼리 실행 중...');
    const { data, error } = await query;

    if (error) {
      console.error('배틀 데이터 조회 오류:', error);
      console.error('오류 세부사항:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json(
        { error: `배틀 데이터를 조회하는데 실패했습니다: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('DB 쿼리 결과:', { dataLength: data?.length || 0, data: data?.slice(0, 2) });

    // 데이터 변환
    const battleResults = data?.map(item => ({
      menu_item_id: item.menu_item_id,
      item_name: item.meal_menu_items.item_name,
      final_avg_rating: item.final_avg_rating,
      final_rating_count: item.final_rating_count,
      daily_rank: item.daily_rank,
      monthly_rank: item.monthly_rank
    })) || [];

    return NextResponse.json({
      success: true,
      data: battleResults
    });

  } catch (error) {
    console.error('메뉴 배틀 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
