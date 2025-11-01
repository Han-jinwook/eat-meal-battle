import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * DB 정리 통계 조회 API
 * - 2개월 이전 급식정보 개수
 * - 사용되지 않는 급식정보 개수 (별점/퀴즈 없음)
 * - 예상 절약 용량
 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // 2개월 이전 날짜 계산 (지난달 1일 기준)
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1);
    const cutoffDate = twoMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`📊 DB 정리 통계 조회 - 기준일: ${cutoffDate} 이전`);

    // 1. 2개월 이전 급식정보 총 개수
    const { count: oldMealsCount, error: oldMealsError } = await supabase
      .from('meal_menus')
      .select('*', { count: 'exact', head: true })
      .lt('meal_date', cutoffDate);

    if (oldMealsError) {
      console.error('2개월 이전 급식정보 조회 오류:', oldMealsError);
      throw oldMealsError;
    }

    // 2. 사용되지 않는 급식정보 개수 (별점이 없는 것들)
    const { data: unusedMeals, error: unusedError } = await supabase
      .from('meal_menus')
      .select(`
        id,
        meal_menu_items!meal_menu_items_meal_id_fkey(
          id,
          menu_item_ratings(id)
        )
      `)
      .lt('meal_date', cutoffDate);

    if (unusedError) {
      console.error('사용되지 않는 급식정보 조회 오류:', unusedError);
      throw unusedError;
    }

    // 별점이 없는 급식정보 필터링
    let unusedCount = 0;
    if (unusedMeals) {
      unusedCount = unusedMeals.filter(meal => {
        // meal_menu_items가 없거나, 모든 menu_item에 ratings가 없는 경우
        if (!meal.meal_menu_items || meal.meal_menu_items.length === 0) {
          return true; // 메뉴 아이템이 없으면 사용되지 않음
        }
        
        // 모든 메뉴 아이템에 별점이 없는지 확인
        return meal.meal_menu_items.every(item => 
          !item.menu_item_ratings || item.menu_item_ratings.length === 0
        );
      }).length;
    }

    // 3. 예상 절약 용량 계산 (대략적)
    // 급식정보 1개당 평균 2KB로 가정 (JSON 데이터 + 메뉴 아이템들)
    const estimatedSizeMB = (unusedCount * 2) / 1024; // KB to MB

    const stats = {
      oldMealsCount: oldMealsCount || 0,
      unusedMealsCount: unusedCount,
      estimatedSizeMB: estimatedSizeMB,
      lastUpdated: new Date().toISOString(),
      cutoffDate: cutoffDate
    };

    console.log('📊 DB 정리 통계 결과:', stats);

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('DB 정리 통계 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'DB 정리 통계를 조회하는데 실패했습니다.' 
      },
      { status: 500 }
    );
  }
}
