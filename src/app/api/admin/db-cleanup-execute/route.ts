import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * DB 정리 실행 API
 * - 2개월 이전 급식정보 중 사용되지 않는 데이터 실제 삭제
 * - 안전장치: 별점/퀴즈가 있는 데이터는 절대 삭제 안 함
 */
export async function POST() {
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

    console.log(`🧹 DB 정리 실행 시작 - 기준일: ${cutoffDate} 이전`);

    // 1단계: 삭제 대상 급식정보 조회 (안전 확인)
    const { data: oldMeals, error: oldMealsError } = await supabase
      .from('meal_menus')
      .select(`
        id,
        school_code,
        meal_date,
        meal_type,
        meal_menu_items!meal_menu_items_meal_id_fkey(
          id,
          menu_item_ratings(id)
        )
      `)
      .lt('meal_date', cutoffDate);

    if (oldMealsError) {
      console.error('삭제 대상 조회 오류:', oldMealsError);
      throw oldMealsError;
    }

    // 2단계: 안전 필터링 - 별점이 없는 급식정보만 선별
    const safeToDeleteIds = [];
    
    if (oldMeals) {
      for (const meal of oldMeals) {
        let hasRatings = false;
        
        if (meal.meal_menu_items && meal.meal_menu_items.length > 0) {
          // 하나라도 별점이 있는 메뉴 아이템이 있는지 확인
          hasRatings = meal.meal_menu_items.some(item => 
            item.menu_item_ratings && item.menu_item_ratings.length > 0
          );
        }
        
        // 별점이 없는 급식정보만 삭제 대상에 포함
        if (!hasRatings) {
          safeToDeleteIds.push(meal.id);
        } else {
          console.log(`🛡️ 보호됨: ${meal.meal_date} (별점 있음)`);
        }
      }
    }

    console.log(`📊 삭제 대상: 전체 ${oldMeals?.length || 0}개 중 ${safeToDeleteIds.length}개`);

    if (safeToDeleteIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: '삭제할 데이터가 없습니다.',
        deletedCount: 0,
        summary: {
          totalChecked: oldMeals?.length || 0,
          safeToDelete: 0,
          protected: oldMeals?.length || 0
        }
      });
    }

    // 3단계: 관련 데이터 삭제 (순서 중요 - 외래키 관계 고려)
    let deletedMenuItems = 0;
    let deletedMeals = 0;

    // 3-1. meal_menu_items 먼저 삭제 (외래키 관계)
    const { error: menuItemsError, count: menuItemsCount } = await supabase
      .from('meal_menu_items')
      .delete({ count: 'exact' })
      .in('meal_id', safeToDeleteIds);

    if (menuItemsError) {
      console.error('메뉴 아이템 삭제 오류:', menuItemsError);
      throw menuItemsError;
    }

    deletedMenuItems = menuItemsCount || 0;
    console.log(`✅ 메뉴 아이템 삭제 완료: ${deletedMenuItems}개`);

    // 3-2. meal_menus 삭제
    const { error: mealsError, count: mealsCount } = await supabase
      .from('meal_menus')
      .delete({ count: 'exact' })
      .in('id', safeToDeleteIds);

    if (mealsError) {
      console.error('급식 메뉴 삭제 오류:', mealsError);
      throw mealsError;
    }

    deletedMeals = mealsCount || 0;
    console.log(`✅ 급식 메뉴 삭제 완료: ${deletedMeals}개`);

    // 4단계: 결과 반환
    const summary = {
      totalChecked: oldMeals?.length || 0,
      safeToDelete: safeToDeleteIds.length,
      protected: (oldMeals?.length || 0) - safeToDeleteIds.length,
      deletedMeals,
      deletedMenuItems,
      cutoffDate,
      executedAt: new Date().toISOString()
    };

    console.log('🎉 DB 정리 완료:', summary);

    return NextResponse.json({
      success: true,
      message: `DB 정리가 완료되었습니다. ${deletedMeals}개의 급식정보와 ${deletedMenuItems}개의 메뉴 아이템이 삭제되었습니다.`,
      deletedCount: deletedMeals,
      summary
    });

  } catch (error) {
    console.error('DB 정리 실행 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'DB 정리 실행 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}
