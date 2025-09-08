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
    const region = searchParams.get('region'); // 지역 필터
    const schoolType = searchParams.get('schoolType'); // 학교 유형 필터
    const schoolOnly = searchParams.get('schoolOnly'); // 우리학교만 필터

    console.log('🔍 배틀 API 호출:', { schoolCode, type, date, month, region, schoolType, schoolOnly });
    console.log('📋 요청 파라미터 상세:', {
      schoolCode: schoolCode,
      type: type,
      date: date,
      month: month,
      region: region,
      schoolType: schoolType,
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

    // 전국 데이터 조회 여부 결정
    const isNationalView = !region || region === '전국';
    const isSchoolOnlyView = schoolOnly === 'true';
    
    // DB에서 저장된 배틀 데이터 조회 (전국 또는 지역별)
    let query;
    if (type === 'daily') {
      // 일별 배틀 데이터 조회
      console.log('📅 일별 배틀 데이터 조회 시작:', {
        table: 'menu_battle_daily',
        battle_date: date,
        school_code: isNationalView ? 'ALL' : schoolCode,
        region: region,
        schoolType: schoolType,
        isNationalView: isNationalView
      });
      
      if (isSchoolOnlyView) {
        // 우리학교만 데이터: 해당 학교의 메뉴별 배틀 데이터만 조회
        console.log('🏫 우리학교만 모드 - 필터링 조건:', {
          school_code: schoolCode,
          battle_date: date,
          table: 'menu_battle_daily'
        });
        
        query = supabase
          .from('menu_battle_daily')
          .select(`
            menu_item_id,
            battle_date,
            school_code,
            final_avg_rating,
            final_rating_count,
            daily_rank,
            school_name
          `)
          .eq('battle_date', date)
          .eq('school_code', schoolCode)
          .order('daily_rank', { ascending: true });
      } else if (isNationalView) {
        // 전국 데이터: national_rank 기준으로 조회
        query = supabase
          .from('menu_battle_daily')
          .select(`
            menu_item_id,
            battle_date,
            school_code,
            final_avg_rating,
            final_rating_count,
            daily_rank,
            national_rank,
            school_name
          `)
          .eq('battle_date', date)
          .not('national_rank', 'is', null)
          .order('national_rank', { ascending: true });
          
        // 학교 유형 필터링이 있으면 school_name에서 직접 필터링
        if (schoolType) {
          query = query.ilike('school_name', `%${schoolType}%`);
        }
      } else {
        // 지역별 데이터: region 필드로 직접 필터링
        query = supabase
          .from('menu_battle_daily')
          .select(`
            menu_item_id,
            battle_date,
            school_code,
            final_avg_rating,
            final_rating_count,
            daily_rank,
            region_rank,
            school_name,
            region
          `)
          .eq('battle_date', date)
          .eq('region', region)  // 지역 필터링 추가
          .order('region_rank', { ascending: true });
          
        // 학교 유형 필터링
        if (schoolType) {
          query = query.ilike('school_name', `%${schoolType}%`);
        }
      }
    } else {
      // 월별 배틀 데이터 조회
      const [year, monthNum] = month.split('-');
      const battleYear = parseInt(year);
      const battleMonth = parseInt(monthNum);
      
      console.log('📅 월별 배틀 데이터 조회 시작:', {
        table: 'menu_battle_monthly',
        battle_year: battleYear,
        battle_month: battleMonth,
        school_code: isNationalView ? 'ALL' : schoolCode,
        region: region,
        schoolType: schoolType,
        isNationalView: isNationalView
      });
      
      if (isSchoolOnlyView) {
        // 우리학교만 데이터: 해당 학교의 메뉴별 배틀 데이터만 조회
        console.log('🏫 우리학교만 모드 (월별) - 필터링 조건:', {
          school_code: schoolCode,
          battle_year: battleYear,
          battle_month: battleMonth,
          table: 'menu_battle_monthly'
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
            monthly_rank,
            national_rank,
            region_rank,
            school_name,
            region
          `)
          .eq('battle_year', battleYear)
          .eq('battle_month', battleMonth)
          .eq('school_code', schoolCode)
          .order('monthly_rank', { ascending: true });
      } else if (isNationalView) {
        // 전국 데이터: national_rank 기준으로 조회
        query = supabase
          .from('menu_battle_monthly')
          .select(`
            menu_item_id,
            battle_year,
            battle_month,
            school_code,
            final_avg_rating,
            final_rating_count,
            monthly_rank,
            national_rank,
            school_name
          `)
          .eq('battle_year', battleYear)
          .eq('battle_month', battleMonth)
          .not('national_rank', 'is', null)
          .order('national_rank', { ascending: true });
          
        // 학교 유형 필터링이 있으면 school_name에서 직접 필터링
        if (schoolType) {
          query = query.ilike('school_name', `%${schoolType}%`);
        }
      } else {
        // 지역별 데이터: region 필드로 직접 필터링
        query = supabase
          .from('menu_battle_monthly')
          .select(`
            menu_item_id,
            battle_year,
            battle_month,
            school_code,
            final_avg_rating,
            final_rating_count,
            monthly_rank,
            region_rank,
            school_name,
            region
          `)
          .eq('battle_year', battleYear)
          .eq('battle_month', battleMonth)
          .eq('region', region)  // 지역 필터링 추가
          .not('region_rank', 'is', null)
          .order('region_rank', { ascending: true });
          
        // 학교 유형 필터링
        if (schoolType) {
          query = query.ilike('school_name', `%${schoolType}%`);
        }
      }
    }

    console.log('🔍 DB 쿼리 실행 중...');
    const { data, error } = await query;
    
    console.log('📊 쿼리 결과 디버깅:', {
      error: error,
      dataLength: data?.length || 0,
      sampleData: data?.slice(0, 2),
      queryParams: { date, month, schoolCode, region, schoolType, schoolOnly },
      rawDataStructure: data?.[0] ? Object.keys(data[0]) : []
    });
    
    if (error) {
      console.error('배틀 데이터 조회 오류:', error);
      return NextResponse.json(
        { error: `배틀 데이터를 조회하는데 실패했습니다: ${error.message}` },
        { status: 500 }
      );
    }
    
    // school_name 컬럼을 직접 사용하므로 평면화 불필요
    console.log('✅ school_name 컬럼 직접 사용 - 조인 없음');
    
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
        console.log(`     region_rank: ${item.region_rank}`);
        console.log(`     school_code: ${item.school_code}`);
      });
      
      // 지역 모드 순위 정렬 확인
      if (region && region !== '전국') {
        console.log('🌍 지역 모드 순위 정렬 확인:', {
          region,
          isRegionSorted: data.every((item, index) => 
            index === 0 || (data[index - 1].region_rank || 999) <= (item.region_rank || 999)
          ),
          regionRanks: data.map(item => item.region_rank).slice(0, 10)
        });
      }
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
      console.log('⚠️ 배틀 데이터가 비어있음 - 직접 테이블 확인');
      
      // 디버깅: 테이블에 실제 데이터가 있는지 확인
      const debugQuery = await supabase
        .from(type === 'daily' ? 'menu_battle_daily' : 'menu_battle_monthly')
        .select('*')
        .limit(5);
      
      console.log('🔍 테이블 직접 조회 결과:', debugQuery);
      
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    // 데이터를 그대로 사용 (메뉴별 집계 제거)
    let processedData = data;
    console.log('✅ 학교별 데이터 그대로 사용 - 메뉴별 집계 제거');
    
    // 메뉴 아이템 이름 및 급식 날짜 조회
    const menuItemIds = processedData.map(item => item.menu_item_id);
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
    const menuItemMap: Record<string, { item_name: string; meal_date: string | null }> = {};
    menuItems?.forEach((item: any) => {
      menuItemMap[item.id] = {
        item_name: item.item_name,
        meal_date: Array.isArray(item.meal_menus) ? item.meal_menus[0]?.meal_date : item.meal_menus?.meal_date || null
      };
    });
    
    // 배틀 결과와 메뉴 아이템 정보 합치기
    let battleResults = processedData?.map((item: any) => {
      const menuInfo = menuItemMap[item.menu_item_id] || { item_name: '알 수 없는 메뉴', meal_date: null };
      const result = {
        menu_item_id: item.menu_item_id,
        item_name: menuInfo.item_name,
        meal_date: menuInfo.meal_date,
        final_avg_rating: item.final_avg_rating,
        final_rating_count: item.final_rating_count,
        daily_rank: item.daily_rank,
        monthly_rank: item.monthly_rank,
        region_rank: item.region_rank,
        school_name: item.school_name || '알 수 없음',
        school_code: item.school_code
      };
      
      console.log('🔍 배틀 결과 변환:', {
        original: { menu_item_id: item.menu_item_id, school_name: item.school_name },
        transformed: { menu_item_id: result.menu_item_id, school_name: result.school_name }
      });
      
      return result;
    }) || [];

    // 메뉴명을 가져온 후 최종 정렬 및 순위 재조정 (메뉴배틀: 동점 시 메뉴명 가나다순)
    battleResults.sort((a, b) => {
      // 1차: 평점 내림차순
      if (b.final_avg_rating !== a.final_avg_rating) {
        return b.final_avg_rating - a.final_avg_rating;
      }
      // 2차: 동점 시 메뉴명 가나다순 (오름차순)
      return (a.item_name || '').localeCompare(b.item_name || '', 'ko-KR');
    });
    
    // 동점 처리를 위한 순위 재부여 (같은 점수면 같은 순위, 다음 순위는 건너뛰기)
    let currentRank = 1;
    battleResults.forEach((item, index) => {
      if (index > 0 && battleResults[index - 1].final_avg_rating !== item.final_avg_rating) {
        currentRank = index + 1;
      }
      
      if (type === 'daily') {
        item.daily_rank = currentRank;
      } else {
        item.monthly_rank = currentRank;
        // 지역 모드일 때는 region_rank도 업데이트
        if (region && !schoolOnly) {
          item.region_rank = currentRank;
        }
      }
    });
    
    console.log('📋 최종 배틀 결과:', battleResults.slice(0, 2));

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
