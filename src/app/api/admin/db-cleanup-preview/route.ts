import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * DB 정리 미리보기 API
 * - 2개월 이전 급식정보 중 사용되지 않는 데이터 목록 조회
 * - 삭제 전 확인용 미리보기 제공
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

    console.log(`🔍 DB 정리 미리보기 조회 - 기준일: ${cutoffDate} 이전`);

    // 2개월 이전 급식정보 중 사용되지 않는 데이터 조회
    const { data: oldMeals, error: oldMealsError } = await supabase
      .from('meal_menus')
      .select(`
        id,
        school_code,
        meal_date,
        meal_type,
        menu_items,
        created_at,
        meal_menu_items!meal_menu_items_meal_id_fkey(
          id,
          menu_item_ratings(id)
        )
      `)
      .lt('meal_date', cutoffDate)
      .order('meal_date', { ascending: false })
      .limit(500); // 최대 500개까지만 미리보기

    if (oldMealsError) {
      console.error('2개월 이전 급식정보 조회 오류:', oldMealsError);
      throw oldMealsError;
    }

    // 사용되지 않는 급식정보 필터링 (별점이 없는 것들)
    const unusedMeals = [];
    
    if (oldMeals) {
      for (const meal of oldMeals) {
        // meal_menu_items가 없거나, 모든 menu_item에 ratings가 없는 경우
        let hasRatings = false;
        
        if (meal.meal_menu_items && meal.meal_menu_items.length > 0) {
          // 하나라도 별점이 있는 메뉴 아이템이 있는지 확인
          hasRatings = meal.meal_menu_items.some(item => 
            item.menu_item_ratings && item.menu_item_ratings.length > 0
          );
        }
        
        // 별점이 없는 급식정보만 삭제 대상에 포함
        if (!hasRatings) {
          unusedMeals.push({
            id: meal.id,
            school_code: meal.school_code,
            school_name: `학교코드: ${meal.school_code}`, // school_infos 조회 없이 school_code만 표시
            meal_date: meal.meal_date,
            meal_type: meal.meal_type,
            menu_items: meal.menu_items || [],
            created_at: meal.created_at,
            has_ratings: false,
            has_quizzes: false // TODO: 퀴즈 연결 확인 (현재는 false로 설정)
          });
        }
      }
    }

    // 최대 100개까지만 미리보기 제공 (성능 고려)
    const previewData = unusedMeals.slice(0, 100);

    console.log(`🔍 미리보기 결과: 전체 ${oldMeals?.length || 0}개 중 삭제 대상 ${unusedMeals.length}개, 미리보기 ${previewData.length}개`);

    return NextResponse.json({
      success: true,
      preview: previewData,
      summary: {
        totalOldMeals: oldMeals?.length || 0,
        totalUnusedMeals: unusedMeals.length,
        previewCount: previewData.length,
        cutoffDate: cutoffDate
      }
    });

  } catch (error) {
    console.error('DB 정리 미리보기 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'DB 정리 미리보기를 조회하는데 실패했습니다.' 
      },
      { status: 500 }
    );
  }
}
