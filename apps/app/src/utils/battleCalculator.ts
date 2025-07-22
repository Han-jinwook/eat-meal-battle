import { createClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 🔧 모드 설정 (주석 처리로 전환)
const BATTLE_MODE = 'TEST'; // 'TEST' | 'PRODUCTION'
// const BATTLE_MODE = 'PRODUCTION';

interface MenuBattleResult {
  menu_item_id: string;
  item_name: string;
  school_code: string;
  battle_date: string;
  final_avg_rating: number;
  final_rating_count: number;
  daily_rank: number;
}

interface MonthlyBattleResult {
  menu_item_id: string;
  item_name: string;
  school_code: string;
  battle_year: number;
  battle_month: number;
  final_avg_rating: number;
  final_rating_count: number;
  monthly_rank: number;
}

/**
 * 🏆 메뉴 배틀 일별 순위 계산 및 저장
 */
export async function calculateDailyMenuBattle(targetDate?: string, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  
  if (BATTLE_MODE === 'TEST') {
    return await calculateDailyMenuBattleTest(targetDate, schoolCode, supabase);
  } else {
    return await calculateDailyMenuBattleProduction(targetDate, schoolCode, supabase);
  }
}

/**
 * 🧪 테스트 모드: 실시간 집계 계산 후 DB 저장
 */
export async function calculateDailyMenuBattleTest(targetDate?: string, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🧪 [TEST MODE] 일별 메뉴 배틀 계산 시작: ${date}`);
  console.log(`📋 입력 파라미터: targetDate=${targetDate}, schoolCode=${schoolCode}`);
  
  // 1. 해당 날짜의 메뉴 아이템들과 평점 정보 조회
  let query = supabase
    .from('meal_menu_items')
    .select(`
      id,
      item_name,
      avg_rating,
      rating_count,
      meal_menus!inner(
        meal_id,
        school_code,
        meal_date
      )
    `)
    .eq('meal_menus.meal_date', date)
    .gt('rating_count', 0); // 평가가 있는 메뉴만
    
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
  
  // 2. 학교별로 그룹화하여 순위 계산
  const schoolGroups = menuItems.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const battleResults: MenuBattleResult[] = [];
  
  // 3. 각 학교별로 순위 매기기
  for (const [school, items] of Object.entries(schoolGroups)) {
    // 평점 순으로 정렬 (높은 순)
    const sortedItems = items.sort((a, b) => b.avg_rating - a.avg_rating);
    
    sortedItems.forEach((item, index) => {
      battleResults.push({
        menu_item_id: item.id,
        item_name: item.item_name,
        school_code: school,
        battle_date: date,
        final_avg_rating: Number(item.avg_rating),
        final_rating_count: item.rating_count,
        daily_rank: index + 1
      });
    });
  }
  
  // 4. 🔥 테스트 모드: 계산 후 즉시 DB에 저장
  console.log(`📊 배틀 결과 계산 완료: ${battleResults.length}개 항목`);
  
  if (battleResults.length > 0) {
    console.log(`🔍 첫 번째 배틀 결과:`, battleResults[0]);
    // 기존 데이터 삭제 (해당 날짜)
    await supabase
      .from('menu_battle_daily')
      .delete()
      .eq('battle_date', date);
    
    // 새 데이터 저장
    const { error: insertError } = await supabase
      .from('menu_battle_daily')
      .insert(battleResults.map(result => ({
        menu_item_id: result.menu_item_id,
        battle_date: result.battle_date,
        final_avg_rating: result.final_avg_rating,
        final_rating_count: result.final_rating_count,
        daily_rank: result.daily_rank
      })));
    
    if (insertError) {
      console.error('테스트 모드 DB 저장 실패:', insertError);
      return { success: false, error: insertError };
    }
  }
  
  console.log(`🧪 [TEST MODE] 계산 완료 및 DB 저장: ${battleResults.length}개 메뉴`);
  
  return { 
    success: true, 
    data: battleResults,
    mode: 'TEST',
    message: '테스트 모드: 실시간 계산 후 DB 저장 완료'
  };
}

/**
 * 🚀 실전 모드: 스케줄러용 배치 처리
 */
async function calculateDailyMenuBattleProduction(targetDate?: string, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  console.log(`🚀 [PRODUCTION MODE] 일별 메뉴 배틀 배치 처리 시작: ${date}`);
  
  // 1. 해당 날짜의 메뉴 아이템들과 평점 정보 조회 (테스트 모드와 동일)
  let query = supabase
    .from('meal_menu_items')
    .select(`
      id,
      item_name,
      avg_rating,
      rating_count,
      meal_menus!inner(
        meal_id,
        school_code,
        meal_date
      )
    `)
    .eq('meal_menus.meal_date', date)
    .gt('rating_count', 0);
    
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
  
  // 2. 학교별로 그룹화하여 순위 계산 (테스트 모드와 동일)
  const schoolGroups = menuItems.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const battleResults: any[] = [];
  
  // 3. 각 학교별로 순위 매기기
  for (const [school, items] of Object.entries(schoolGroups)) {
    const sortedItems = items.sort((a, b) => b.avg_rating - a.avg_rating);
    
    sortedItems.forEach((item, index) => {
      battleResults.push({
        menu_item_id: item.id,
        final_avg_rating: Number(item.avg_rating),
        final_rating_count: item.rating_count,
        daily_rank: index + 1
      });
    });
  }
  
  // 4. 실전 모드에서는 DB에 실제 저장
  if (battleResults.length > 0) {
    // 기존 데이터 삭제 (재실행 대비)
    await supabase
      .from('menu_battle_daily')
      .delete()
      .in('menu_item_id', battleResults.map(r => r.menu_item_id));
    
    // 새 데이터 삽입
    const { error: insertError } = await supabase
      .from('menu_battle_daily')
      .insert(battleResults);
    
    if (insertError) {
      console.error('일별 배틀 결과 저장 실패:', insertError);
      return { success: false, error: insertError };
    }
  }
  
  console.log(`🚀 [PRODUCTION MODE] 배치 처리 완료: ${battleResults.length}개 메뉴 저장`);
  
  return { 
    success: true, 
    data: battleResults,
    mode: 'PRODUCTION',
    message: `일별 배틀 결과 DB 저장 완료: ${battleResults.length}개`
  };
}

/**
 * 🏆 메뉴 배틀 월별 순위 계산 및 저장
 */
export async function calculateMonthlyMenuBattle(year?: number, month?: number, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  
  if (BATTLE_MODE === 'TEST') {
    return await calculateMonthlyMenuBattleTest(year, month, schoolCode, supabase);
  } else {
    return await calculateMonthlyMenuBattleProduction(year, month, schoolCode, supabase);
  }
}

/**
 * 🧪 월별 테스트 모드: 실시간 집계 계산 후 DB 저장
 */
export async function calculateMonthlyMenuBattleTest(targetYear?: number, targetMonth?: number, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  const year = targetYear || new Date().getFullYear();
  const month = targetMonth || new Date().getMonth() + 1;
  
  console.log(`🧪 [TEST MODE] 월별 메뉴 배틀 계산 시작: ${year}년 ${month}월`);
  
  // 1. 해당 월의 모든 메뉴 아이템들과 평점 정보 조회
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
  
  let query = supabase
    .from('meal_menu_items')
    .select(`
      id,
      item_name,
      avg_rating,
      rating_count,
      meal_menus!inner(
        meal_id,
        school_code,
        meal_date
      )
    `)
    .gte('meal_menus.meal_date', startDate)
    .lte('meal_menus.meal_date', endDate)
    .gt('rating_count', 0);
    
  if (schoolCode) {
    query = query.eq('meal_menus.school_code', schoolCode);
  }
  
  const { data: menuItems, error } = await query;
  
  if (error) {
    console.error('월별 메뉴 아이템 조회 실패:', error);
    return { success: false, error };
  }
  
  if (!menuItems || menuItems.length === 0) {
    console.log('해당 월에 평가된 메뉴가 없습니다.');
    return { success: true, data: [] };
  }
  
  // 2. 학교별로 그룹화하여 순위 계산 (각 menu_item_id는 개별 경쟁자)
  const schoolGroups = menuItems.reduce((acc, item) => {
    const school = item.meal_menus.school_code;
    if (!acc[school]) acc[school] = [];
    acc[school].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const monthlyResults: MonthlyBattleResult[] = [];
  
  // 3. 각 학교별로 순위 매기기 (각 menu_item_id별 개별 경쟁)
  for (const [school, items] of Object.entries(schoolGroups)) {
    // 평점 순으로 정렬 (높은 순) - 7/3 김치 vs 7/11 김치 개별 경쟁
    const sortedItems = items.sort((a, b) => b.avg_rating - a.avg_rating);
    
    sortedItems.forEach((item, index) => {
      monthlyResults.push({
        menu_item_id: item.id,
        item_name: item.item_name,
        school_code: school,
        battle_year: year,
        battle_month: month,
        final_avg_rating: Number(item.avg_rating),
        final_rating_count: item.rating_count,
        monthly_rank: index + 1
      });
    });
  }
  
  // 4. 🔥 테스트 모드: 계산 후 즉시 DB에 저장
  if (monthlyResults.length > 0) {
    // 기존 데이터 삭제 (해당 년월)
    await supabase
      .from('menu_battle_monthly')
      .delete()
      .eq('battle_year', year)
      .eq('battle_month', month);
    
    // 새 데이터 저장
    const { error: insertError } = await supabase
      .from('menu_battle_monthly')
      .insert(monthlyResults.map(result => ({
        menu_item_id: result.menu_item_id,
        battle_year: result.battle_year,
        battle_month: result.battle_month,
        final_avg_rating: result.final_avg_rating,
        final_rating_count: result.final_rating_count,
        monthly_rank: result.monthly_rank
      })));
    
    if (insertError) {
      console.error('월별 테스트 모드 DB 저장 실패:', insertError);
      return { success: false, error: insertError };
    }
  }
  
  console.log(`🧪 [TEST MODE] 월별 계산 완료 및 DB 저장: ${monthlyResults.length}개 메뉴`);
  
  return { 
    success: true, 
    data: monthlyResults,
    mode: 'TEST',
    message: '테스트 모드: 실시간 월별 계산 후 DB 저장 완료'
  };
}

/**
 * 🚀 월별 실전 모드: 스케줄러용 배치 처리
 */
async function calculateMonthlyMenuBattleProduction(year?: number, month?: number, schoolCode?: string, supabaseClient?: SupabaseClient) {
  const supabase = supabaseClient || createClient();
  // 실전 모드 구현 (테스트 모드와 유사하지만 DB 저장 포함)
  console.log('🚀 [PRODUCTION MODE] 월별 배치 처리는 추후 구현 예정');
  return { success: false, message: '월별 실전 모드 구현 예정' };
}

/**
 * 📊 배틀 결과 조회 (UI용) - 항상 DB에서만 조회
 */
export async function getBattleResults(type: 'daily' | 'monthly', date?: string, schoolCode?: string) {
  const supabase = createClient();
  
  console.log(`📊 배틀 결과 조회: ${type}, 날짜: ${date}`);
  
  try {
    // 🔥 핵심: 테스트/출시 모드 관계없이 항상 DB에서만 조회
    if (type === 'daily') {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      // 일별 배틀 결과 조회 (menu_item_id로 JOIN)
      let query = supabase
        .from('menu_battle_daily')
        .select(`
          menu_item_id,
          battle_date,
          final_avg_rating,
          final_rating_count,
          daily_rank,
          meal_menu_items(
            item_name,
            meal_menus(
              school_code,
              meal_date
            )
          )
        `)
        .eq('battle_date', targetDate)
        .order('daily_rank');
      
      if (schoolCode) {
        query = query.eq('meal_menu_items.meal_menus.school_code', schoolCode);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('일별 배틀 결과 조회 실패:', error);
        throw new Error('배틀 데이터를 조회하는데 실패했습니다.');
      }
      
      return { success: true, data: data || [] };
    } else {
      // 월별 조회
      const targetDate = date ? new Date(date) : new Date();
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      
      let query = supabase
        .from('menu_battle_monthly')
        .select(`
          menu_item_id,
          battle_year,
          battle_month,
          final_avg_rating,
          final_rating_count,
          monthly_rank,
          meal_menu_items(
            item_name,
            meal_menus(
              school_code
            )
          )
        `)
        .eq('battle_year', year)
        .eq('battle_month', month)
        .order('monthly_rank');
      
      if (schoolCode) {
        query = query.eq('meal_menu_items.meal_menus.school_code', schoolCode);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('월별 배틀 결과 조회 실패:', error);
        throw new Error('배틀 데이터를 조회하는데 실패했습니다.');
      }
      
      return { success: true, data: data || [] };
    }
  } catch (error) {
    console.error('배틀 결과 조회 중 오류:', error);
    throw error;
  }
}
