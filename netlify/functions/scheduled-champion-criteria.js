// Netlify 서버리스 함수: 장원 조건 자동 계산 스케줄러
// 주간/월간 장원 조건(급식일수)을 자동으로 계산하여 DB에 저장합니다
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase 환경 변수가 설정되지 않았습니다!');
  throw new Error('Supabase 환경 변수 설정 필요');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 현재 날짜 기준으로 주차 정보를 계산합니다
 * @returns {{year: number, month: number, weekNumber: number}}
 */
function getCurrentWeekInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed를 1-indexed로 변환
  
  // 현재 날짜의 일(day)
  const day = now.getDate();
  
  // 해당 월의 1일의 요일 (0: 일요일, 1: 월요일, ...)
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  
  // 주차 계산: (일 + 월의 첫날 요일 - 2) / 7 + 1 (월요일 시작 기준)
  // firstDayOfMonth가 0(일요일)이면 6으로, 그 외에는 firstDayOfMonth - 1로 조정
  const weekNumber = Math.ceil((day + (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1)) / 7);
  
  return { year, month, weekNumber };
}

/**
 * 특정 월의 주차별 범위를 계산합니다
 * @param {number} year - 년도
 * @param {number} month - 월 (1-12)
 * @returns {Array<{weekNumber: number, startDate: Date, endDate: Date}>} - 주차별 시작일/종료일 배열
 */
function getWeekRangesForMonth(year, month) {
  const weeks = [];
  
  // 해당 월의 1일
  const firstDay = new Date(year, month - 1, 1);
  
  // 해당 월의 마지막 날
  const lastDay = new Date(year, month, 0);
  
  // 첫번째 월요일 찾기
  let currentDate = new Date(firstDay);
  const dayOfWeek = currentDate.getDay(); // 0: 일요일, 1: 월요일, ...
  
  // 첫번째 월요일로 조정 (이미 월요일이면 그대로, 아니면 다음 월요일로)
  if (dayOfWeek !== 1) { // 월요일이 아니면
    // 일요일(0)이면 1일 추가, 화요일(2)이면 6일 추가... 등으로 다음 월요일을 찾음
    currentDate.setDate(currentDate.getDate() + (8 - dayOfWeek) % 7);
  }
  
  // 월의 1일부터 첫번째 월요일 전까지는 1주차
  if (currentDate.getDate() > 1) {
    const weekEndDate = new Date(currentDate);
    weekEndDate.setDate(weekEndDate.getDate() - 1);
    weeks.push({
      weekNumber: 1,
      startDate: new Date(firstDay),
      endDate: weekEndDate
    });
  }
  
  // 나머지 주차 계산
  let weekNumber = weeks.length > 0 ? 2 : 1;
  
  while (currentDate <= lastDay) {
    const weekStartDate = new Date(currentDate);
    
    // 주의 끝 (일요일)
    const weekEndDate = new Date(currentDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6); // 월요일로부터 6일 후 = 일요일
    
    // 월의 마지막 날을 초과하면 마지막 날로 조정
    const endDate = weekEndDate > lastDay ? new Date(lastDay) : new Date(weekEndDate);
    
    weeks.push({
      weekNumber,
      startDate: weekStartDate,
      endDate: endDate
    });
    
    // 다음 주 월요일
    currentDate.setDate(currentDate.getDate() + 7);
    weekNumber++;
  }
  
  return weeks;
}

/**
 * 특정 기간 동안의 급식일수를 계산합니다
 * @param {string} schoolCode - 학교 코드
 * @param {number} grade - 학년
 * @param {Date} startDate - 시작일
 * @param {Date} endDate - 종료일
 * @returns {Promise<number>} - 급식일수
 */
async function countMealDays(schoolCode, grade, startDate, endDate) {
  // 날짜 형식 변환 (YYYY-MM-DD)
  const formatDate = date => {
    return date.toISOString().split('T')[0];
  };
  
  try {
    // 해당 기간의 급식 데이터 조회
    const { data, error, count } = await supabase
      .from('meals')
      .select('date', { count: 'exact' })
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .gte('date', formatDate(startDate))
      .lte('date', formatDate(endDate));
    
    if (error) {
      console.error('급식 데이터 조회 실패:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('급식일수 계산 중 오류:', error);
    return 0;
  }
}

/**
 * 모든 학교의 장원 조건을 계산합니다
 * @param {boolean} isMonthly - 월간 계산 여부 (false: 주간)
 * @returns {Promise<{processed: number, updated: number, errors: number}>}
 */
async function calculateAllSchoolsCriteria(isMonthly = false) {
  try {
    // 등록된 모든 학교 목록 조회
    const { data: schools, error: schoolError } = await supabase
      .from('schools')
      .select('school_code, grade');
    
    if (schoolError) {
      console.error('학교 목록 조회 실패:', schoolError);
      return { processed: 0, updated: 0, errors: 1 };
    }
    
    const stats = { processed: 0, updated: 0, errors: 0 };
    const uniqueSchools = new Map();
    
    // 중복 제거 (학교코드-학년 조합)
    schools.forEach(school => {
      const key = `${school.school_code}-${school.grade}`;
      if (!uniqueSchools.has(key)) {
        uniqueSchools.set(key, school);
      }
    });
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // 0-indexed를 1-indexed로 변환
    
    for (const [_, school] of uniqueSchools) {
      try {
        stats.processed++;
        
        if (isMonthly) {
          // 월간: 해당 월의 첫날과 마지막날
          const firstDayOfMonth = new Date(year, month - 1, 1);
          const lastDayOfMonth = new Date(year, month, 0);
          
          // 월별 급식일수 계산
          const monthlyMealDays = await countMealDays(
            school.school_code,
            school.grade,
            firstDayOfMonth,
            lastDayOfMonth
          );
          
          // DB에 월간 장원 조건 저장/업데이트
          await upsertMonthlyCriteria(
            school.school_code,
            school.grade,
            year,
            month,
            monthlyMealDays
          );
        } else {
          // 주간: 현재 주차 정보 및 날짜 범위 계산
          const { weekNumber } = getCurrentWeekInfo();
          const weekRanges = getWeekRangesForMonth(year, month);
          
          // 현재 주차 찾기
          const currentWeek = weekRanges.find(w => w.weekNumber === weekNumber);
          
          if (currentWeek) {
            // 주간 급식일수 계산
            const weeklyMealDays = await countMealDays(
              school.school_code,
              school.grade,
              currentWeek.startDate,
              currentWeek.endDate
            );
            
            // DB에 주간 장원 조건 저장/업데이트
            await upsertWeeklyCriteria(
              school.school_code,
              school.grade,
              year,
              month,
              weekNumber,
              weeklyMealDays
            );
          }
        }
        
        stats.updated++;
      } catch (error) {
        console.error(`학교 ${school.school_code} 처리 중 오류:`, error);
        stats.errors++;
      }
    }
    
    return stats;
  } catch (error) {
    console.error('장원 조건 계산 중 오류:', error);
    return { processed: 0, updated: 0, errors: 1 };
  }
}

/**
 * 주간 장원 조건을 저장/업데이트합니다
 * @param {string} schoolCode - 학교 코드
 * @param {number} grade - 학년
 * @param {number} year - 년도
 * @param {number} month - 월 (1-12)
 * @param {number} weekNumber - 주차 (1-5)
 * @param {number} mealDays - 급식일수
 * @returns {Promise<boolean>} - 성공 여부
 */
async function upsertWeeklyCriteria(schoolCode, grade, year, month, weekNumber, mealDays) {
  try {
    // 주차가 유효한지 확인
    if (weekNumber < 1 || weekNumber > 5) {
      console.error('유효하지 않은 주차:', weekNumber);
      return false;
    }
    
    // 해당 학교/학년/년월의 장원 조건 레코드가 이미 있는지 확인
    const { data, error } = await supabase
      .from('champion_criteria')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .eq('year', year)
      .eq('month', month)
      .single();
    
    const weekField = `week_${weekNumber}_days`;
    
    if (error && error.code !== 'PGRST116') { // PGRST116: 결과 없음
      console.error('장원 조건 조회 실패:', error);
      return false;
    }
    
    if (data) {
      // 기존 레코드 업데이트
      const { error: updateError } = await supabase
        .from('champion_criteria')
        .update({ [weekField]: mealDays })
        .eq('id', data.id);
      
      if (updateError) {
        console.error('장원 조건 업데이트 실패:', updateError);
        return false;
      }
    } else {
      // 새 레코드 삽입 (해당 주차 필드만 설정)
      const { error: insertError } = await supabase
        .from('champion_criteria')
        .insert({
          school_code: schoolCode,
          grade: grade,
          year: year,
          month: month,
          [weekField]: mealDays
        });
      
      if (insertError) {
        console.error('장원 조건 삽입 실패:', insertError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('주간 장원 조건 저장 중 오류:', error);
    return false;
  }
}

/**
 * 월간 장원 조건을 저장/업데이트합니다
 * @param {string} schoolCode - 학교 코드
 * @param {number} grade - 학년
 * @param {number} year - 년도
 * @param {number} month - 월 (1-12)
 * @param {number} mealDays - 급식일수
 * @returns {Promise<boolean>} - 성공 여부
 */
async function upsertMonthlyCriteria(schoolCode, grade, year, month, mealDays) {
  try {
    // 해당 학교/학년/년월의 장원 조건 레코드가 이미 있는지 확인
    const { data, error } = await supabase
      .from('champion_criteria')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .eq('year', year)
      .eq('month', month)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116: 결과 없음
      console.error('장원 조건 조회 실패:', error);
      return false;
    }
    
    if (data) {
      // 기존 레코드 업데이트
      const { error: updateError } = await supabase
        .from('champion_criteria')
        .update({ month_total: mealDays })
        .eq('id', data.id);
      
      if (updateError) {
        console.error('월간 장원 조건 업데이트 실패:', updateError);
        return false;
      }
    } else {
      // 새 레코드 삽입 (월간 필드만 설정)
      const { error: insertError } = await supabase
        .from('champion_criteria')
        .insert({
          school_code: schoolCode,
          grade: grade,
          year: year,
          month: month,
          month_total: mealDays
        });
      
      if (insertError) {
        console.error('월간 장원 조건 삽입 실패:', insertError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('월간 장원 조건 저장 중 오류:', error);
    return false;
  }
}

/**
 * 주간 장원 조건 계산 (매주 금요일 오전 9시 실행)
 */
exports.weeklyChampionCriteria = async function(event, context) {
  // API 키 검증
  const apiKey = event.queryStringParameters?.api_key;
  
  // 환경 변수에서 API 키 가져오기
  const validApiKey = process.env.CRON_API_KEY;
  if (!validApiKey) {
    console.log('환경 변수 CRON_API_KEY가 설정되지 않았습니다!');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error: CRON_API_KEY not set' })
    };
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid API key' })
    };
  }

  try {
    console.log('주간 장원 조건 계산 시작');
    
    const { weekNumber } = getCurrentWeekInfo();
    const stats = await calculateAllSchoolsCriteria(false); // 주간 계산
    
    console.log(`주간(${weekNumber}주차) 장원 조건 계산 결과:`, JSON.stringify(stats));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '주간 장원 조건 계산 완료',
        date: new Date().toISOString(),
        weekNumber,
        stats
      })
    };
  } catch (error) {
    console.error('주간 장원 조건 계산 실패:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};

/**
 * 월간 장원 조건 계산 (매월 말일 오전 9시 실행)
 */
exports.monthlyChampionCriteria = async function(event, context) {
  // API 키 검증
  const apiKey = event.queryStringParameters?.api_key;
  
  // 환경 변수에서 API 키 가져오기
  const validApiKey = process.env.CRON_API_KEY;
  if (!validApiKey) {
    console.log('환경 변수 CRON_API_KEY가 설정되지 않았습니다!');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error: CRON_API_KEY not set' })
    };
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid API key' })
    };
  }

  try {
    console.log('월간 장원 조건 계산 시작');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 0-indexed를 1-indexed로 변환
    
    const stats = await calculateAllSchoolsCriteria(true); // 월간 계산
    
    console.log(`월간(${year}년 ${month}월) 장원 조건 계산 결과:`, JSON.stringify(stats));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '월간 장원 조건 계산 완료',
        date: new Date().toISOString(),
        year,
        month,
        stats
      })
    };
  } catch (error) {
    console.error('월간 장원 조건 계산 실패:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
