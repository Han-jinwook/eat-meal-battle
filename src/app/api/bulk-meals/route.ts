import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';
const API_KEY = process.env.NEIS_API_KEY || '';

/**
 * 급식 정보 API 호출 (기존 /api/meals 로직 재사용)
 */
async function fetchMealInfo(schoolCode: string, officeCode: string, date: string) {
  // 날짜 형식 변환 (YYYY-MM-DD -> YYYYMMDD)
  let apiDate = date;
  if (date && date.includes('-')) {
    apiDate = date.replace(/-/g, '');
  }
  
  const apiUrl = `${NEIS_API_BASE_URL}/mealServiceDietInfo`;
  const queryParams = new URLSearchParams({
    KEY: API_KEY,
    Type: 'json',
    pIndex: '1',
    pSize: '100',
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
    MLSV_YMD: apiDate,
    MMEAL_SC_CODE: '2', // 중식
  });

  const response = await fetch(`${apiUrl}?${queryParams.toString()}`);
  const data = await response.json();
  
  return data;
}

/**
 * 급식 정보 파싱 및 저장 (기존 로직 재사용)
 */
async function processMealData(supabase: any, schoolCode: string, officeCode: string, date: string, apiData: any) {
  // DB 형식으로 날짜 변환 (YYYY-MM-DD)
  const dbDate = date.includes('-') ? date : `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;

  if (!apiData.mealServiceDietInfo || !apiData.mealServiceDietInfo[1]?.row) {
    // 급식 정보가 없는 경우 빈 정보 저장
    const { error } = await supabase
      .from('meal_menus')
      .upsert({
        school_code: schoolCode,
        office_code: officeCode,
        meal_date: dbDate,
        meal_type: '중식',
        menu_items: ['급식 정보가 없습니다'],
        kcal: '0 kcal',
        origin_info: null,
        ntr_info: '',
        is_empty_result: true
      }, {
        onConflict: 'school_code,meal_date,meal_type'
      });

    if (error) throw error;
    return false; // 빈 정보 저장됨
  }

  // 급식 정보 파싱
  const mealRows = apiData.mealServiceDietInfo[1].row;
  for (const meal of mealRows) {
    let menuItems = [];
    if (meal.DDISH_NM) {
      menuItems = meal.DDISH_NM
        .split('<br/>')
        .map((item: string) => {
          return item
            .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, '')
            .split('/')
            .map((part: string) => {
              return part
                .trim()
                .replace(/[\-\.]?u$/gi, '')
                .replace(/[\-~]?\d*$/, '')
                .trim();
            })
            .join('/')
            .trim();
        })
        .filter((item: string) => item && item.length > 0);
    }

    // DB에 저장
    const { error } = await supabase
      .from('meal_menus')
      .upsert({
        school_code: schoolCode,
        office_code: officeCode,
        meal_date: dbDate,
        meal_type: '중식',
        menu_items: menuItems,
        kcal: meal.CAL_INFO || '정보 없음',
        origin_info: meal.ORPLC_INFO || null,
        ntr_info: meal.NTR_INFO || '',
        is_empty_result: false
      }, {
        onConflict: 'school_code,meal_date,meal_type'
      });

    if (error) throw error;
  }
  
  return true; // 실제 급식 정보 저장됨
}

/**
 * 학교 등록 시 전월 1일부터 오늘까지 급식정보 일괄 생성
 */
export async function POST(request: NextRequest) {
  try {
    const { school_code, office_code } = await request.json();
    
    if (!school_code || !office_code) {
      return NextResponse.json(
        { error: '학교 코드와 교육청 코드가 필요합니다' },
        { status: 400 }
      );
    }

    console.log(`🚀 벌크 급식정보 생성 시작: ${school_code}`);

    // Supabase 클라이언트 생성
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // 날짜 범위 계산 (전월 1일 ~ 오늘)
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    const dates = [];
    const current = new Date(lastMonth);
    
    while (current <= today) {
      // 주말 제외
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    console.log(`📅 처리 대상 날짜: ${dates.length}개 (${dates[0]} ~ ${dates[dates.length-1]})`);

    let successCount = 0;
    let errorCount = 0;

    // 각 날짜별로 급식 정보 처리
    for (const date of dates) {
      try {
        // 1. DB에 이미 있는지 확인
        const { data: existingMeal } = await supabase
          .from('meal_menus')
          .select('id')
          .eq('school_code', school_code)
          .eq('meal_date', date)
          .eq('meal_type', '중식')
          .single();

        if (existingMeal) {
          console.log(`⏭️ ${date} 급식정보 이미 존재, 건너뜀`);
          continue;
        }

        // 2. NEIS API 호출
        const apiData = await fetchMealInfo(school_code, office_code, date);
        
        // 3. 데이터 파싱 및 저장
        await processMealData(supabase, school_code, office_code, date, apiData);
        
        successCount++;
        console.log(`✅ ${date} 급식정보 처리 완료`);

        // API 호출 제한을 위한 지연 (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (dateError) {
        errorCount++;
        console.error(`❌ ${date} 급식정보 처리 오류:`, dateError);
      }
    }

    console.log(`🎉 벌크 급식정보 생성 완료: 성공 ${successCount}개, 실패 ${errorCount}개`);

    return NextResponse.json({
      success: true,
      message: '벌크 급식정보 생성이 완료되었습니다',
      results: {
        total: dates.length,
        success: successCount,
        error: errorCount,
        dateRange: `${dates[0]} ~ ${dates[dates.length-1]}`
      }
    });

  } catch (error) {
    console.error('벌크 급식정보 생성 오류:', error);
    return NextResponse.json(
      { 
        error: '벌크 급식정보 생성 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
