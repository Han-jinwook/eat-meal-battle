import { createClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 🔧 배틀 계산 함수 통합 완료 (TEST/PRODUCTION 모드 분리 제거)

interface MenuBattleResult {
  menu_item_id: string;
  battle_date: string;
  school_code: string;
  final_avg_rating: number;
  final_rating_count: number;
  daily_rank: number;
  national_rank?: number;
}

interface MonthlyBattleResult {
  menu_item_id: string;
  battle_year: number;
  battle_month: number;
  school_code: string;
  final_avg_rating: number;
  final_rating_count: number;
  monthly_rank: number;
  national_rank?: number;
}

interface MealBattleResult {
  school_code: string;
  battle_date: string;
  avg_rating: number;
  rating_count: number;
  daily_rank: number;
  national_rank?: number;
}

interface MealMonthlyBattleResult {
  school_code: string;
  battle_year: number;
  battle_month: number;
  avg_rating: number;
  rating_count: number;
  monthly_rank: number;
  national_rank?: number;
}

/**
 * 🏆 메뉴 배틀 일별 순위 계산 및 저장 (통합 버전)
 */
export async function calculateDailyMenuBattle(targetDate?: string, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🏆 일별 메뉴 배틀 계산 시작: ${date}`);
  
  // 1. 해당 날짜의 메뉴 아이템들과 평점 정보 조회
  const { data: menuRatings, error: ratingsError } = await supabase
    .from('menu_item_rating_stats')
    .select('menu_item_id, avg_rating, rating_count')
    .gt('rating_count', 0);
    
  if (ratingsError) {
    console.error('메뉴 평점 조회 실패:', ratingsError);
    return { success: false, error: ratingsError };
  }
  
  if (!menuRatings || menuRatings.length === 0) {
    return { success: true, data: [] };
  }
  
  // 2. 메뉴 아이템 정보 조회
  let query = supabase
    .from('meal_menu_items')
    .select(`
      id,
      item_name,
      meal_menus!meal_menu_items_meal_id_fkey!inner(
        id,
        school_code,
        meal_date
      )
    `)
    .eq('meal_menus.meal_date', date)
    .in('id', menuRatings.map(r => r.menu_item_id));
    
  if (schoolCode) {
    query = query.eq('meal_menus.school_code', schoolCode);
  }
  
  const { data: menuItems, error } = await query;
  
  if (error) {
    console.error('메뉴 아이템 조회 실패:', error);
    return { success: false, error };
  }
  
  if (!menuItems || menuItems.length === 0) {
    console.log('해당 날짜에 평가된 메뉴가 없습니다.');
    return { success: true, data: [] };
  }
  
  // 3. 학교별로 그룹화하여 순위 계산
  const schoolGroups = menuItems.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const battleResults: MenuBattleResult[] = [];
  
  // 4. 각 학교별로 순위 매기기 (평점 정보와 메뉴 정보 결합)
  for (const [school, items] of Object.entries(schoolGroups)) {
    const itemsWithRatings = items.map(item => {
      const rating = menuRatings.find(r => r.menu_item_id === item.id);
      return {
        ...item,
        avg_rating: rating?.avg_rating || 0,
        rating_count: rating?.rating_count || 0
      };
    });
    
    const sortedItems = itemsWithRatings.sort((a, b) => {
      if (b.avg_rating !== a.avg_rating) {
        return b.avg_rating - a.avg_rating;
      }
      return b.rating_count - a.rating_count;
    });
    
    sortedItems.forEach((item, index) => {
      battleResults.push({
        menu_item_id: item.id,
        battle_date: date,
        school_code: school,
        final_avg_rating: Number(item.avg_rating),
        final_rating_count: item.rating_count,
        daily_rank: index + 1
      });
    });
  }
  
  // 5. 전국 등수 계산
  const battleResultsWithNationalRank = battleResults
    .sort((a, b) => {
      if (b.final_avg_rating !== a.final_avg_rating) {
        return b.final_avg_rating - a.final_avg_rating;
      }
      return b.final_rating_count - a.final_rating_count;
    })
    .map((result, index) => ({
      ...result,
      national_rank: index + 1
    }));
  
  console.log(`📊 생성된 배틀 결과 개수: ${battleResultsWithNationalRank.length}개`);
  
  // 6. 기존 데이터 삭제 후 새 데이터 삽입
  const { error: deleteError } = await supabase
    .from('menu_battle_daily')
    .delete()
    .eq('battle_date', date);
    
  if (deleteError) {
    console.error('기존 배틀 데이터 삭제 실패:', deleteError);
    return { success: false, error: deleteError };
  }
  
  if (battleResultsWithNationalRank.length > 0) {
    const { error: insertError } = await supabase
      .from('menu_battle_daily')
      .insert(battleResultsWithNationalRank);
      
    if (insertError) {
      console.error('배틀 데이터 삽입 실패:', insertError);
      return { success: false, error: insertError };
    }
  }
  
  console.log(`✅ 일별 메뉴 배틀 계산 완료: ${date}`);
  return { success: true, data: battleResultsWithNationalRank };
}

/**
 * 🏆 메뉴 배틀 월별 순위 계산 및 저장 (통합 버전)
 */
export async function calculateMonthlyMenuBattle(year?: number, month?: number, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const currentYear = year || new Date().getFullYear();
  const currentMonth = month || new Date().getMonth() + 1;
  
  console.log(`🏆 월별 메뉴 배틀 계산 시작: ${currentYear}-${currentMonth}`);
  
  // 1. 해당 월의 메뉴 아이템들과 평점 정보 조회
  const { data: menuRatings, error: ratingsError } = await supabase
    .from('menu_item_rating_stats')
    .select('menu_item_id, avg_rating, rating_count')
    .gt('rating_count', 0);
    
  if (ratingsError) {
    console.error('메뉴 평점 조회 실패:', ratingsError);
    return { success: false, error: ratingsError };
  }
  
  if (!menuRatings || menuRatings.length === 0) {
    return { success: true, data: [] };
  }
  
  // 2. 메뉴 아이템 정보 조회
  let query = supabase
    .from('meal_menu_items')
    .select(`
      id,
      item_name,
      meal_menus!meal_menu_items_meal_id_fkey!inner(
        id,
        school_code,
        meal_date
      )
    `)
    .gte('meal_menus.meal_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
    .lt('meal_menus.meal_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
    .in('id', menuRatings.map(r => r.menu_item_id));
    
  if (schoolCode) {
    query = query.eq('meal_menus.school_code', schoolCode);
  }
  
  const { data: menuItems, error } = await query;
  
  if (error) {
    console.error('메뉴 아이템 조회 실패:', error);
    return { success: false, error };
  }
  
  if (!menuItems || menuItems.length === 0) {
    console.log('해당 월에 평가된 메뉴가 없습니다.');
    return { success: true, data: [] };
  }
  
  // 3. 학교별로 그룹화하여 월별 평균 계산
  const schoolGroups = menuItems.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const monthlyResults: MonthlyBattleResult[] = [];
  
  // 4. 각 학교별로 월별 순위 계산
  for (const [school, items] of Object.entries(schoolGroups)) {
    const itemsWithRatings = items.map(item => {
      const rating = menuRatings.find(r => r.menu_item_id === item.id);
      return {
        ...item,
        avg_rating: rating?.avg_rating || 0,
        rating_count: rating?.rating_count || 0
      };
    });
    
    // 학교별 월별 평균 계산
    const totalRating = itemsWithRatings.reduce((sum, item) => sum + (item.avg_rating * item.rating_count), 0);
    const totalCount = itemsWithRatings.reduce((sum, item) => sum + item.rating_count, 0);
    
    if (totalCount > 0) {
      monthlyResults.push({
        menu_item_id: school, // 월별은 학교 단위로 계산
        battle_year: currentYear,
        battle_month: currentMonth,
        school_code: school,
        final_avg_rating: Number((totalRating / totalCount).toFixed(1)),
        final_rating_count: totalCount,
        monthly_rank: 0 // 임시값, 나중에 계산
      });
    }
  }
  
  // 5. 월별 순위 계산
  monthlyResults.sort((a, b) => {
    if (b.final_avg_rating !== a.final_avg_rating) {
      return b.final_avg_rating - a.final_avg_rating;
    }
    return b.final_rating_count - a.final_rating_count;
  });
  
  monthlyResults.forEach((result, index) => {
    result.monthly_rank = index + 1;
  });
  
  // 6. 전국 등수 계산
  const monthlyResultsWithNationalRank = monthlyResults
    .sort((a, b) => {
      if (b.final_avg_rating !== a.final_avg_rating) {
        return b.final_avg_rating - a.final_avg_rating;
      }
      return b.final_rating_count - a.final_rating_count;
    })
    .map((result, index) => ({
      ...result,
      national_rank: index + 1
    }));
  
  console.log(`📊 생성된 월별 배틀 결과 개수: ${monthlyResultsWithNationalRank.length}개`);
  
  // 7. 기존 데이터 삭제 후 새 데이터 삽입
  const { error: deleteError } = await supabase
    .from('menu_battle_monthly')
    .delete()
    .eq('battle_year', currentYear)
    .eq('battle_month', currentMonth);
    
  if (deleteError) {
    console.error('기존 월별 배틀 데이터 삭제 실패:', deleteError);
    return { success: false, error: deleteError };
  }
  
  if (monthlyResultsWithNationalRank.length > 0) {
    const { error: insertError } = await supabase
      .from('menu_battle_monthly')
      .insert(monthlyResultsWithNationalRank);
      
    if (insertError) {
      console.error('월별 배틀 데이터 삽입 실패:', insertError);
      return { success: false, error: insertError };
    }
  }
  
  console.log(`✅ 월별 메뉴 배틀 계산 완료: ${currentYear}-${currentMonth}`);
  return { success: true, data: monthlyResultsWithNationalRank };
}

/**
 * 🏆 급식 배틀 일별 순위 계산 및 저장 (통합 버전)
 */
export async function calculateDailyMealBattle(targetDate?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🏆 일별 급식 배틀 계산 시작: ${date}`);
  
  // 1. 해당 날짜의 급식 평점 통계 조회 (schoolCode 필터링 없음 - 전국 단위)
  const { data: mealStats, error } = await supabase
    .from('meal_rating_stats')
    .select(`
      school_code,
      avg_rating,
      rating_count,
      meal_menus!inner(
        meal_date
      )
    `)
    .eq('meal_menus.meal_date', date)
    .gt('rating_count', 0);
    
  if (error) {
    console.error('급식 평점 통계 조회 실패:', error);
    return { success: false, error };
  }
  
  if (!mealStats || mealStats.length === 0) {
    console.log('해당 날짜에 평가된 급식이 없습니다.');
    return { success: true, data: [] };
  }
  
  // 2. 평점 순으로 정렬하여 순위 계산
  const sortedStats = mealStats.sort((a, b) => {
    if (b.avg_rating !== a.avg_rating) {
      return b.avg_rating - a.avg_rating;
    }
    return b.rating_count - a.rating_count;
  });
  
  // 3. 순위 매기기
  const battleResults: MealBattleResult[] = sortedStats.map((stat, index) => ({
    school_code: stat.school_code,
    battle_date: date,
    avg_rating: Number(stat.avg_rating),
    rating_count: stat.rating_count,
    daily_rank: index + 1,
    national_rank: index + 1 // 급식 배틀은 전국 단위이므로 동일
  }));
  
  console.log(`📊 생성된 급식 배틀 결과 개수: ${battleResults.length}개`);
  
  // 4. 기존 데이터 삭제 후 새 데이터 삽입
  const { error: deleteError } = await supabase
    .from('meal_battle_daily')
    .delete()
    .eq('battle_date', date);
    
  if (deleteError) {
    console.error('기존 급식 배틀 데이터 삭제 실패:', deleteError);
    return { success: false, error: deleteError };
  }
  
  if (battleResults.length > 0) {
    const { error: insertError } = await supabase
      .from('meal_battle_daily')
      .insert(battleResults);
      
    if (insertError) {
      console.error('급식 배틀 데이터 삽입 실패:', insertError);
      return { success: false, error: insertError };
    }
  }
  
  console.log(`✅ 일별 급식 배틀 계산 완료: ${date}`);
  return { success: true, data: battleResults };
}

/**
 * 🏆 급식 배틀 월별 순위 계산 및 저장 (통합 버전)
 */
export async function calculateMonthlyMealBattle(year?: number, month?: number, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const currentYear = year || new Date().getFullYear();
  const currentMonth = month || new Date().getMonth() + 1;
  
  console.log(`🏆 월별 급식 배틀 계산 시작: ${currentYear}-${currentMonth}`);
  
  // 1. 해당 월의 급식 평점 통계 조회
  const { data: mealStats, error } = await supabase
    .from('meal_rating_stats')
    .select(`
      school_code,
      avg_rating,
      rating_count,
      meal_menus!inner(
        meal_date
      )
    `)
    .gte('meal_menus.meal_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
    .lt('meal_menus.meal_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
    .gt('rating_count', 0);
    
  if (error) {
    console.error('월별 급식 평점 통계 조회 실패:', error);
    return { success: false, error };
  }
  
  if (!mealStats || mealStats.length === 0) {
    console.log('해당 월에 평가된 급식이 없습니다.');
    return { success: true, data: [] };
  }
  
  // 2. 학교별로 그룹화하여 월별 평균 계산
  const schoolGroups = mealStats.reduce((acc, stat) => {
    if (!acc[stat.school_code]) {
      acc[stat.school_code] = [];
    }
    acc[stat.school_code].push(stat);
    return acc;
  }, {} as Record<string, any[]>);
  
  const monthlyResults: MealMonthlyBattleResult[] = [];
  
  // 3. 각 학교별로 월별 평균 계산
  for (const [schoolCode, stats] of Object.entries(schoolGroups)) {
    const totalRating = stats.reduce((sum, stat) => sum + (stat.avg_rating * stat.rating_count), 0);
    const totalCount = stats.reduce((sum, stat) => sum + stat.rating_count, 0);
    
    if (totalCount > 0) {
      monthlyResults.push({
        school_code: schoolCode,
        battle_year: currentYear,
        battle_month: currentMonth,
        avg_rating: Number((totalRating / totalCount).toFixed(1)),
        rating_count: totalCount,
        monthly_rank: 0 // 임시값, 나중에 계산
      });
    }
  }
  
  // 4. 월별 순위 계산
  monthlyResults.sort((a, b) => {
    if (b.avg_rating !== a.avg_rating) {
      return b.avg_rating - a.avg_rating;
    }
    return b.rating_count - a.rating_count;
  });
  
  monthlyResults.forEach((result, index) => {
    result.monthly_rank = index + 1;
    result.national_rank = index + 1; // 급식 배틀은 전국 단위
  });
  
  console.log(`📊 생성된 월별 급식 배틀 결과 개수: ${monthlyResults.length}개`);
  
  // 5. 기존 데이터 삭제 후 새 데이터 삽입
  const { error: deleteError } = await supabase
    .from('meal_battle_monthly')
    .delete()
    .eq('battle_year', currentYear)
    .eq('battle_month', currentMonth);
    
  if (deleteError) {
    console.error('기존 월별 급식 배틀 데이터 삭제 실패:', deleteError);
    return { success: false, error: deleteError };
  }
  
  if (monthlyResults.length > 0) {
    const { error: insertError } = await supabase
      .from('meal_battle_monthly')
      .insert(monthlyResults);
      
    if (insertError) {
      console.error('월별 급식 배틀 데이터 삽입 실패:', insertError);
      return { success: false, error: insertError };
    }
  }
  
  console.log(`✅ 월별 급식 배틀 계산 완료: ${currentYear}-${currentMonth}`);
  return { success: true, data: monthlyResults };
}
