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

    console.log('🔍 배틀 API 호출:', { schoolCode, type, date, month });
    console.log('📋 요청 파라미터 상세:', {
      schoolCode: schoolCode,
      type: type,
      date: date,
      month: month,
      url: request.url
    });

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
      // 일별 배틀 데이터 조회 - 명확한 필터링
      console.log('📅 일별 배틀 데이터 조회 시작:', {
        table: 'menu_battle_daily',
        battle_date: date,
        school_code: schoolCode,
        dateType: typeof date
      });
      
      query = supabase
        .from('menu_battle_daily')
        .select(`
          menu_item_id,
          battle_date,
          school_code,
          final_avg_rating,
          final_rating_count,
          daily_rank
        `)
        .eq('school_code', schoolCode)
        .eq('battle_date', date)
        .order('daily_rank', { ascending: true });
        
      console.log('🔍 일별 쿼리 필터 조건:', {
        school_code: schoolCode,
        battle_date: date
      });
    } else {
      // 월별 배틀 데이터 조회 - 명확한 필터링
      const [year, monthNum] = month.split('-');
      const battleYear = parseInt(year);
      const battleMonth = parseInt(monthNum);
      
      console.log('📅 월별 배틀 데이터 조회 시작:', {
        table: 'menu_battle_monthly',
        battle_year: battleYear,
        battle_month: battleMonth,
        school_code: schoolCode,
        originalMonth: month
      });
      
      query = supabase
        .from('menu_battle_monthly')
        .select(`
          menu_item_id,
          battle_year,
          battle_month,
          school_code,
          final_avg_rating,
          final_rating_count,
          monthly_rank
        `)
        .eq('school_code', schoolCode)
        .eq('battle_year', battleYear)
        .eq('battle_month', battleMonth)
        .order('monthly_rank', { ascending: true });
        
      console.log('🔍 월별 쿼리 필터 조건:', {
        school_code: schoolCode,
        battle_year: battleYear,
        battle_month: battleMonth
      });
    }

    console.log('🔍 DB 쿼리 실행 중...');
    const { data, error } = await query;
    
    // 긴급 디버깅: 월별 쿼리 결과 상세 로깅
    if (type === 'monthly') {
      console.log('😨 긴급 디버깅 - 월별 쿼리 결과:');
      console.log('  오류:', error);
      console.log('  데이터 길이:', data?.length || 0);
      console.log('  전체 데이터:', data);
      
      // 수동 쿼리 테스트
      console.log('🔧 수동 쿼리 테스트 시작...');
      const testQuery = await supabase
        .from('menu_battle_monthly')
        .select('*')
        .eq('school_code', schoolCode)
        .limit(5);
      
      console.log('🔍 테스트 쿼리 결과:', testQuery);
    }

    if (error) {
      console.error('❌ 배틀 데이터 조회 오류:', error);
      console.error('🚨 오류 세부사항:', {
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

    console.log('✅ DB 쿼리 결과:', { 
      dataLength: data?.length || 0, 
      sampleData: data?.slice(0, 2),
      allData: data
    });
    
    // 특별 로깅: 월별 배틀 데이터 상세 분석
    if (type === 'monthly' && data && data.length > 0) {
      console.log('📅 월별 배틀 데이터 상세 분석:');
      data.forEach((item, index) => {
        console.log(`  ${index + 1}. menu_item_id: ${item.menu_item_id}`);
        console.log(`     battle_year: ${item.battle_year}`);
        console.log(`     battle_month: ${item.battle_month}`);
        console.log(`     final_avg_rating: ${item.final_avg_rating}`);
        console.log(`     monthly_rank: ${item.monthly_rank}`);
      });
    }
    
    // 필터링 검증: 실제 반환된 데이터의 날짜 확인
    if (data && data.length > 0) {
      console.log('🗓️ 반환된 데이터의 날짜 확인:', {
        requestedDate: type === 'daily' ? date : `${month} (월별)`,
        actualDates: data.map(item => ({
          menu_item_id: item.menu_item_id,
          battle_date: item.battle_date || 'N/A',
          battle_year: item.battle_year || 'N/A',
          battle_month: item.battle_month || 'N/A'
        }))
      });
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    // 메뉴 아이템 이름 및 급식 날짜 조회
    const menuItemIds = data.map(item => item.menu_item_id);
    const { data: menuItems, error: menuItemsError } = await supabase
      .from('meal_menu_items')
      .select(`
        id, 
        item_name,
        meal_menus!meal_menu_items_meal_id_fkey(
          meal_date
        )
      `)
      .in('id', menuItemIds);
      
    if (menuItemsError) {
      console.error('메뉴 아이템 조회 오류:', menuItemsError);
      return NextResponse.json(
        { error: `메뉴 아이템 정보를 조회하는데 실패했습니다: ${menuItemsError.message}` },
        { status: 500 }
      );
    }
    
    // 데이터 변환 - 메뉴 아이템 정보와 급식 날짜 조합
    const menuItemMap = {};
    menuItems?.forEach(item => {
      menuItemMap[item.id] = {
        item_name: item.item_name,
        meal_date: item.meal_menus?.meal_date || null
      };
    });
    
    // 배틀 결과와 메뉴 아이템 정보 합치기
    const battleResults = data?.map(item => {
      const menuInfo = menuItemMap[item.menu_item_id] || { item_name: '알 수 없는 메뉴', meal_date: null };
      return {
        menu_item_id: item.menu_item_id,
        item_name: menuInfo.item_name,
        meal_date: menuInfo.meal_date,
        final_avg_rating: item.final_avg_rating,
        final_rating_count: item.final_rating_count,
        daily_rank: item.daily_rank,
        monthly_rank: item.monthly_rank
      };
    }) || [];

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
