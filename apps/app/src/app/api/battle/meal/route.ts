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
    const schoolType = searchParams.get('schoolType');

    console.log('🔍 급식 배틀 API 호출:', { schoolCode, type, date, month, schoolType });
    console.log('📋 요청 파라미터 상세:', {
      schoolCode: schoolCode,
      type: type,
      date: date,
      month: month,
      schoolType: schoolType,
      url: request.url
    });

    if (!type) {
      return NextResponse.json(
        { error: 'type 파라미터가 필요합니다 (daily 또는 monthly)' },
        { status: 400 }
      );
    }

    let data;
    let error;

    if (type === 'daily') {
      if (!date) {
        return NextResponse.json(
          { error: '일별 조회에는 date 파라미터가 필요합니다' },
          { status: 400 }
        );
      }

      console.log('📅 일별 급식 배틀 데이터 조회 시작:', { table: 'meal_battle_daily', battle_date: date });

      // 일별 급식 배틀 데이터 조회
      let query = supabase
        .from('meal_battle_daily')
        .select(`
          school_code,
          battle_date,
          avg_rating,
          rating_count,
          daily_rank
        `)
        .eq('battle_date', date)
        .order('daily_rank');

      if (schoolCode) {
        query = query.eq('school_code', schoolCode);
      }

      const result = await query;
      data = result.data;
      error = result.error;

      console.log('✅ DB 쿼리 결과:', { 
        dataLength: data?.length || 0, 
        sampleData: data?.[0] || null,
        allData: data
      });

      if (data && data.length > 0) {
        const actualDates = [...new Set(data.map(item => item.battle_date))];
        console.log('🗓️ 반환된 데이터의 날짜 확인:', { 
          requestedDate: date, 
          actualDates: actualDates 
        });
      }

    } else if (type === 'monthly') {
      if (!month) {
        return NextResponse.json(
          { error: '월별 조회에는 month 파라미터가 필요합니다 (YYYY-MM 형식)' },
          { status: 400 }
        );
      }

      const [year, monthNum] = month.split('-').map(Number);
      
      console.log('📅 월별 급식 배틀 데이터 조회 시작:', { 
        table: 'meal_battle_monthly', 
        battle_year: year, 
        battle_month: monthNum 
      });

      // 월별 급식 배틀 데이터 조회
      let query = supabase
        .from('meal_battle_monthly')
        .select(`
          school_code,
          battle_year,
          battle_month,
          avg_rating,
          rating_count,
          monthly_rank
        `)
        .eq('battle_year', year)
        .eq('battle_month', monthNum)
        .order('monthly_rank');

      if (schoolCode) {
        query = query.eq('school_code', schoolCode);
      }

      const result = await query;
      data = result.data;
      error = result.error;

      console.log('✅ DB 쿼리 결과:', { 
        dataLength: data?.length || 0, 
        sampleData: data?.[0] || null,
        allData: data
      });
    }

    if (error) {
      console.error('급식 배틀 데이터 조회 오류:', error);
      return NextResponse.json(
        { error: `급식 배틀 데이터를 조회하는데 실패했습니다: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.log('⚠️ 조회된 급식 배틀 데이터가 없습니다');
      return NextResponse.json({
        data: [],
        message: '해당 조건에 맞는 급식 배틀 데이터가 없습니다'
      });
    }

    // 학교 정보 조회하여 학교명과 지역 정보 추가
    const schoolCodes = [...new Set(data.map(item => item.school_code))];
    const { data: schoolInfos, error: schoolError } = await supabase
      .from('school_infos')
      .select('school_code, school_name, region, school_type')
      .in('school_code', schoolCodes);

    if (schoolError) {
      console.error('학교 정보 조회 오류:', schoolError);
      // 학교 정보 조회 실패해도 배틀 데이터는 반환
    }

    // 학교 유형 필터링 (선택사항)
    let filteredData = data;
    if (schoolType && schoolInfos) {
      const filteredSchoolCodes = schoolInfos
        .filter(school => school.school_type?.includes(schoolType.charAt(0))) // 초/중/고
        .map(school => school.school_code);
      
      filteredData = data.filter(item => filteredSchoolCodes.includes(item.school_code));
      
      console.log('🏫 학교 유형 필터링:', {
        requestedType: schoolType,
        originalCount: data.length,
        filteredCount: filteredData.length
      });
    }

    // 학교 정보와 배틀 데이터 결합
    const enrichedData = filteredData.map(battleItem => {
      const schoolInfo = schoolInfos?.find(school => school.school_code === battleItem.school_code);
      return {
        ...battleItem,
        school_name: schoolInfo?.school_name || '알 수 없는 학교',
        region: schoolInfo?.region || '알 수 없는 지역',
        school_type: schoolInfo?.school_type || '알 수 없는 유형'
      };
    });

    console.log('📤 최종 응답 데이터:', {
      count: enrichedData.length,
      sample: enrichedData[0] || null
    });

    return NextResponse.json({
      data: enrichedData,
      total: enrichedData.length,
      type: type,
      ...(type === 'daily' ? { date } : { month }),
      ...(schoolType && { schoolType })
    });

  } catch (error) {
    console.error('급식 배틀 API 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다',
        message: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}
