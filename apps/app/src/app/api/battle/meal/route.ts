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
    const region = searchParams.get('region'); // 지역 기반 필터링

    console.log('🔍 급식 배틀 API 호출:', { schoolCode, type, date, month, schoolType, region });
    console.log('📋 요청 파라미터 상세:', {
      schoolCode: schoolCode,
      type: type,
      date: date,
      month: month,
      schoolType: schoolType,
      region: region,
      url: request.url
    });

    if (!type) {
      return NextResponse.json(
        { error: 'type 파라미터가 필요합니다 (daily 또는 monthly)' },
        { status: 400 }
      );
    }

    if (type === 'daily') {
      if (!date) {
        return NextResponse.json(
          { error: '일별 조회에는 date 파라미터가 필요합니다' },
          { status: 400 }
        );
      }

      console.log('📅 일별 급식 배틀 데이터 조회 시작:', { table: 'meal_battle_daily', battle_date: date, region, schoolType });

      // 1. 먼저 지역 및 학교 유형에 맞는 학교들 찾기
      let schoolQuery = supabase
        .from('school_infos')
        .select('school_code, school_name, region, school_type');
      
      if (region) {
        schoolQuery = schoolQuery.eq('region', region);
        console.log(`🌍 지역 기반 필터링: ${region}`);
      }
      
      if (schoolType) {
        // 정확한 학교 유형 매칭으로 개선 (일별)
        schoolQuery = schoolQuery.eq('school_type', schoolType);
        console.log(`🏠 학교 유형 필터링 (일별, 정확 매칭): ${schoolType}`);
      }
      
      const { data: targetSchools, error: schoolError } = await schoolQuery;
      
      if (schoolError) {
        console.error('학교 정보 조회 오류:', schoolError);
        return NextResponse.json(
          { error: `학교 정보를 조회하는데 실패했습니다: ${schoolError.message}` },
          { status: 500 }
        );
      }
      
      if (!targetSchools || targetSchools.length === 0) {
        console.log('⚠️ 조건에 맞는 학교가 없습니다');
        return NextResponse.json({
          data: [],
          message: '해당 지역/학교 유형에 맞는 학교가 없습니다'
        });
      }
      
      const targetSchoolCodes = targetSchools.map(school => school.school_code);
      console.log(`🏠 대상 학교 수: ${targetSchoolCodes.length}개`);
      
      // 2. 해당 학교들의 배틀 데이터만 조회
      const query = supabase
        .from('meal_battle_daily')
        .select('*')
        .eq('battle_date', date)
        .in('school_code', targetSchoolCodes)
        .order('avg_rating', { ascending: false });
      
      console.log(`🎆 지역 기반 급식 배틀 조회: ${date} (지역: ${region || '전체'}, 학교유형: ${schoolType || '전체'})`);

      const result = await query;
      const data = result.data;
      const error = result.error;

      console.log('✅ DB 쿼리 결과:', { 
        dataLength: data?.length || 0, 
        sampleData: data?.[0] || null,
        allData: data
      });

      if (data && data.length > 0) {
        const actualDates = [...new Set(data.map(item => item.battle_date))];
        console.log('🗺️ 반환된 데이터의 날짜 확인:', { 
          requestedDate: date, 
          actualDates: actualDates 
        });
      }
      
      // 일별 배틀 오류 처리
      if (error) {
        console.error('일별 급식 배틀 데이터 조회 오류:', error);
        return NextResponse.json(
          { error: `일별 급식 배틀 데이터를 조회하는데 실패했습니다: ${error.message}` },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        console.log('⚠️ 일별 급식 배틀 데이터가 없습니다');
        return NextResponse.json({
          data: [],
          message: '해당 조건에 맞는 일별 급식 배틀 데이터가 없습니다'
        });
      }
      
      // 일별 데이터와 학교 정보 결합 + 공백 레코드 방지
      const enrichedData = data
        .map(battleItem => {
          const schoolInfo = targetSchools?.find(school => school.school_code === battleItem.school_code);
          return {
            ...battleItem,
            school_name: schoolInfo?.school_name,
            region: schoolInfo?.region,
            school_type: schoolInfo?.school_type,
            _hasSchoolInfo: !!schoolInfo
          };
        })
        .filter(item => {
          if (!item._hasSchoolInfo) {
            console.warn(`⚠️ 학교 정보 누락된 배틀 데이터 제외: school_code=${item.school_code}`);
            return false;
          }
          return true;
        })
        .map(({ _hasSchoolInfo, ...item }) => item); // _hasSchoolInfo 필드 제거

      console.log('📤 일별 최종 응답 데이터:', {
        count: enrichedData.length,
        sample: enrichedData[0] || null
      });

      return NextResponse.json({
        data: enrichedData,
        total: enrichedData.length,
        type: 'daily',
        date: date,
        ...(schoolType && { schoolType }),
        ...(region && { region })
      });

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
        battle_month: monthNum,
        region,
        schoolType
      });

      // 1. 먼저 지역 및 학교 유형에 맞는 학교들 찾기 (일별과 동일)
      let schoolQuery = supabase
        .from('school_infos')
        .select('school_code, school_name, region, school_type');
      
      if (region) {
        schoolQuery = schoolQuery.eq('region', region);
        console.log(`🌍 지역 기반 필터링: ${region}`);
      }
      
      if (schoolType) {
        // 정확한 학교 유형 매칭으로 개선 (월별)
        schoolQuery = schoolQuery.eq('school_type', schoolType);
        console.log(`🏠 학교 유형 필터링 (월별, 정확 매칭): ${schoolType}`);
      }
      
      const { data: targetSchools, error: schoolError } = await schoolQuery;
      
      if (schoolError) {
        console.error('학교 정보 조회 오류:', schoolError);
        return NextResponse.json(
          { error: `학교 정보를 조회하는데 실패했습니다: ${schoolError.message}` },
          { status: 500 }
        );
      }
      
      if (!targetSchools || targetSchools.length === 0) {
        console.log('⚠️ 조건에 맞는 학교가 없습니다');
        return NextResponse.json({
          data: [],
          message: '해당 지역/학교 유형에 맞는 학교가 없습니다'
        });
      }
      
      const targetSchoolCodes = targetSchools.map(school => school.school_code);
      console.log(`🏠 대상 학교 수: ${targetSchoolCodes.length}개`);
      
      // 2. 해당 학교들의 월별 배틀 데이터만 조회
      const query = supabase
        .from('meal_battle_monthly')
        .select(`
          school_code,
          battle_year,
          battle_month,
          final_avg_rating,
          final_rating_count,
          monthly_rank
        `)
        .eq('battle_year', year)
        .eq('battle_month', monthNum)
        .in('school_code', targetSchoolCodes)
        .order('monthly_rank');

      console.log(`🎆 지역 기반 월별 급식 배틀 조회: ${year}-${monthNum} (지역: ${region || '전체'}, 학교유형: ${schoolType || '전체'})`);

      const result = await query;
      const data = result.data;
      const error = result.error;

      console.log('✅ DB 쿼리 결과:', { 
        dataLength: data?.length || 0, 
        sampleData: data?.[0] || null,
        allData: data
      });
      
      // 월별 배틀 오류 처리
      if (error) {
        console.error('월별 급식 배틀 데이터 조회 오류:', error);
        return NextResponse.json(
          { error: `월별 급식 배틀 데이터를 조회하는데 실패했습니다: ${error.message}` },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        console.log('⚠️ 월별 급식 배틀 데이터가 없습니다');
        return NextResponse.json({
          data: [],
          message: '해당 조건에 맞는 월별 급식 배틀 데이터가 없습니다'
        });
      }
      
      // 월별 데이터와 학교 정보 결합 + 공백 레코드 방지
      const enrichedData = data
        .map(battleItem => {
          const schoolInfo = targetSchools?.find(school => school.school_code === battleItem.school_code);
          return {
            ...battleItem,
            school_name: schoolInfo?.school_name,
            region: schoolInfo?.region,
            school_type: schoolInfo?.school_type,
            _hasSchoolInfo: !!schoolInfo
          };
        })
        .filter(item => {
          if (!item._hasSchoolInfo) {
            console.warn(`⚠️ 학교 정보 누락된 배틀 데이터 제외: school_code=${item.school_code}`);
            return false;
          }
          return true;
        })
        .map(({ _hasSchoolInfo, ...item }) => item); // _hasSchoolInfo 필드 제거

      console.log('📤 월별 최종 응답 데이터:', {
        count: enrichedData.length,
        sample: enrichedData[0] || null
      });

      return NextResponse.json({
        data: enrichedData,
        total: enrichedData.length,
        type: 'monthly',
        month: month,
        ...(schoolType && { schoolType }),
        ...(region && { region })
      });
    }

    // 잘못된 타입인 경우 오류 반환
    return NextResponse.json(
      { error: '지원하지 않는 타입입니다. daily 또는 monthly를 사용해주세요.' },
      { status: 400 }
    );

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
