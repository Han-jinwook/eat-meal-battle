/**
 * 주차별 토요일 계산 유틸리티
 * 매달 ISO 8601 기준 주차별 토요일 날짜를 계산하고 저장하는 기능 제공
 */

import { createClient } from '@supabase/supabase-js';

// 환경 변수 체크 및 Supabase 클라이언트 생성
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase 환경 변수가 설정되지 않았습니다.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * ISO 8601 기준으로 주차별 토요일 날짜를 계산
 * @param year 연도
 * @param month 월
 * @returns 주차별 토요일 날짜 객체
 */
function calculateWeeklySaturdays(year: number, month: number) {
  // 해당 월의 1일
  const firstDayOfMonth = new Date(year, month - 1, 1);
  
  // ISO 8601 첫 주의 월요일 찾기
  const dayOfWeek = firstDayOfMonth.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  
  const firstMonday = new Date(firstDayOfMonth);
  firstMonday.setDate(1 + daysToMonday);
  
  // 각 주차별 토요일 계산 (월요일+5)
  const weeklySaturdays: Record<string, string> = {};
  let saturday = new Date(firstMonday);
  saturday.setDate(firstMonday.getDate() + 5);
  
  // 최대 5주차까지 계산
  for (let week = 1; week <= 5; week++) {
    const formattedDate = `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, '0')}-${String(saturday.getDate()).padStart(2, '0')}`;
    weeklySaturdays[`week_${week}_saturday`] = formattedDate;
    
    // 다음 주 토요일
    saturday = new Date(saturday);
    saturday.setDate(saturday.getDate() + 7);
  }
  
  return weeklySaturdays;
}

/**
 * 특정 학교의 주차별 토요일 날짜를 업데이트
 * @param schoolCode 학교코드
 * @param year 연도
 * @param month 월
 */
async function updateSchoolSaturdays(schoolCode: string, year: number, month: number) {
  try {
    // 기존 데이터 조회
    const { data: existingData, error: fetchError } = await supabase
      .from('champion_criteria')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('year', year)
      .eq('month', month)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: Did not return a single row
      throw new Error(`데이터 조회 오류: ${fetchError.message}`);
    }

    if (!existingData) {
      return {
        success: false,
        message: `${schoolCode} 학교의 ${year}년 ${month}월 기준 데이터가 없습니다. 먼저 champion_criteria 데이터를 생성해주세요.`
      };
    }

    // 주차별 토요일 계산
    const weeklySaturdays = calculateWeeklySaturdays(year, month);

    // 업데이트 데이터 구성
    const updateData: Record<string, any> = {
      ...weeklySaturdays,
      updated_at: new Date().toISOString()
    };

    // 데이터 업데이트
    const { error: updateError } = await supabase
      .from('champion_criteria')
      .update(updateData)
      .eq('school_code', schoolCode)
      .eq('year', year)
      .eq('month', month);

    if (updateError) {
      throw new Error(`데이터 업데이트 오류: ${updateError.message}`);
    }

    return {
      success: true,
      message: `${schoolCode} 학교의 ${year}년 ${month}월 주차별 토요일 업데이트 완료`,
      data: weeklySaturdays
    };
  } catch (error: any) {
    console.error(`${schoolCode} 학교 토요일 업데이트 오류:`, error);
    return {
      success: false,
      message: `${schoolCode} 학교 오류: ${error.message}`,
      error
    };
  }
}

/**
 * 모든 학교(또는 지정 학교들)의 주차별 토요일 날짜를 업데이트
 * @param year 연도
 * @param month 월
 * @param specificSchools 특정 학교 코드 배열 (옵션)
 */
async function updateAllSchoolsSaturdays(year: number, month: number, specificSchools?: string[]) {
  try {
    // 대상 학교 조회
    const { data: schoolData, error: schoolError } = await supabase
      .from('champion_criteria')
      .select('school_code')
      .eq('year', year)
      .eq('month', month)
      .order('school_code');

    if (schoolError) {
      throw new Error(`학교 데이터 조회 오류: ${schoolError.message}`);
    }

    if (!schoolData || schoolData.length === 0) {
      return {
        success: false,
        message: `${year}년 ${month}월 champion_criteria 데이터가 없습니다.`,
        processed: 0,
        failed: 0,
        results: []
      };
    }

    // 학교 목록 추출 및 중복 제거
    let schoolCodes = [...new Set(schoolData.map(item => item.school_code))];

    // 특정 학교만 처리해야 하는 경우
    if (specificSchools && specificSchools.length > 0) {
      schoolCodes = schoolCodes.filter(code => specificSchools.includes(code));
    }

    console.log(`${year}년 ${month}월 토요일 업데이트 대상 학교: ${schoolCodes.length}개`);

    // 각 학교별 업데이트 실행
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const schoolCode of schoolCodes) {
      const result = await updateSchoolSaturdays(schoolCode, year, month);
      results.push({
        school_code: schoolCode,
        ...result
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    return {
      success: successCount > 0,
      message: `${year}년 ${month}월 토요일 업데이트 완료: 성공 ${successCount}개, 실패 ${failCount}개`,
      processed: successCount,
      failed: failCount,
      results
    };
  } catch (error: any) {
    console.error(`토요일 일괄 업데이트 오류:`, error);
    return {
      success: false,
      message: `토요일 일괄 업데이트 오류: ${error.message}`,
      processed: 0,
      failed: 0,
      error,
      results: []
    };
  }
}

export const weekSaturdayCalculator = {
  calculateWeeklySaturdays,
  updateSchoolSaturdays,
  updateAllSchoolsSaturdays
};
