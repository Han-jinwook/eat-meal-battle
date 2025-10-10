/**
 * 매주 일요일 2주치 장원 조건 갱신 함수
 * 
 * 현재 주차 + 다음 주차 (2주치)의 급식일수를 최신 NEIS 데이터로 갱신
 * 지난 주차는 그대로 유지
 */

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  // API 키 검증
  const authToken = event.headers?.['x-api-key']
  const queryApiKey = event.queryStringParameters?.api_key
  
  if (!process.env.ADMIN_API_KEY || (authToken !== process.env.ADMIN_API_KEY && queryApiKey !== process.env.ADMIN_API_KEY)) {
    console.log('API 키 인증 실패');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized', message: '유효한 API 키가 필요합니다' })
    }
  }

  try {
    console.log('📅 매주 2주치 장원 조건 갱신 시작...')
    
    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const urlParams = new URLSearchParams(event.queryStringParameters || {})
    const schoolCode = urlParams.get('school_code')
    const getSchools = urlParams.get('get_schools') === 'true'
    
    // 학교 목록만 반환하는 경우
    if (getSchools) {
      const { data: allSchools, error: schoolError } = await supabase
        .from('school_infos')
        .select('school_code')

      if (schoolError) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: `학교 목록 조회 실패: ${schoolError.message}` })
        }
      }

      // 중복 학교 제거
      const uniqueSchoolCodes = [...new Set((allSchools || []).map(school => school.school_code))]
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          school_codes: uniqueSchoolCodes,
          total_schools: uniqueSchoolCodes.length
        })
      }
    }

    // 일요일 실행 시 다음 주 월요일 기준으로 계산
    const now = new Date()
    const nextMonday = new Date(now)
    
    // 일요일이면 다음 날(월요일)로 설정
    if (now.getDay() === 0) {
      nextMonday.setDate(now.getDate() + 1)
    }
    
    const currentYear = nextMonday.getFullYear()
    const currentMonth = nextMonday.getMonth() + 1
    
    // 다음 주 월요일 기준 주차 계산 (ISO 8601 기준)
    const nextWeekNumber = getWeekOfMonth(nextMonday)
    
    console.log(`📍 실행 시점: ${now.toISOString().split('T')[0]} (${['일','월','화','수','목','금','토'][now.getDay()]}요일)`)
    console.log(`📍 기준 날짜: ${nextMonday.toISOString().split('T')[0]} (다음 주 월요일)`)
    console.log(`📍 ${currentYear}년 ${currentMonth}월 ${nextWeekNumber}주차 시작`)
    console.log(`🔄 갱신 대상: ${nextWeekNumber}주차 + ${nextWeekNumber + 1}주차`)
    
    // 특정 학교만 조회 (school_code 파라미터가 있는 경우)
    let schools = []
    if (schoolCode) {
      const { data: schoolData, error: schoolError } = await supabase
        .from('school_infos')
        .select('school_code, office_code')
        .eq('school_code', schoolCode)
        .limit(1)  // 첫 번째 행만 가져오기

      if (schoolError) {
        throw new Error(`학교 조회 실패: ${schoolError.message}`)
      }
      
      if (!schoolData || schoolData.length === 0) {
        throw new Error(`학교를 찾을 수 없습니다: ${schoolCode}`)
      }
      
      schools = [schoolData[0]]
    } else {
      // 모든 학교 조회 (중복 제거)
      const { data: allSchools, error: schoolError } = await supabase
        .from('school_infos')
        .select('school_code, office_code')

      if (schoolError) {
        throw new Error(`학교 목록 조회 실패: ${schoolError.message}`)
      }
      
      // 중복 학교 제거 (school_code 기준)
      const uniqueSchools = []
      const seenSchoolCodes = new Set()
      
      for (const school of (allSchools || [])) {
        if (!seenSchoolCodes.has(school.school_code)) {
          seenSchoolCodes.add(school.school_code)
          uniqueSchools.push(school)
        }
      }
      
      schools = uniqueSchools
      console.log(`중복 제거: ${allSchools?.length || 0}개 → ${schools.length}개 학교`)
    }

    if (schools.length === 0) {
      throw new Error('처리할 학교 정보가 없습니다');
    }

    console.log(`총 ${schools.length}개 학교 처리 시작`)
    
    const results = {
      success: 0,
      error: 0,
      details: []
    }

    // 각 학교별로 2주치 갱신
    for (const school of schools) {
      try {
        console.log(`[${school.school_code}] 학교 처리 중...`)
        
        if (!school.office_code) {
          console.log(`[${school.school_code}] 교육청 코드 없음, 건너뜀`);
          results.error++;
          results.details.push({
            school_code: school.school_code,
            status: 'error',
            message: '교육청 코드 없음'
          });
          continue;
        }
        
        // 다음 주차 + 그 다음 주차 갱신
        await updateTwoWeeks(supabase, school, currentYear, currentMonth, nextWeekNumber)
        
        results.success++;
        results.details.push({
          school_code: school.school_code,
          status: 'success',
          message: `${nextWeekNumber}주차, ${nextWeekNumber + 1}주차 갱신 완료`
        });
        
        console.log(`[${school.school_code}] 갱신 완료`);
        
        // API 호출 제한을 위한 지연
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (schoolError) {
        console.error(`[${school.school_code}] 처리 중 오류:`, schoolError);
        results.error++;
        results.details.push({
          school_code: school.school_code,
          status: 'error',
          message: schoolError.message
        });
      }
    }

    console.log('✅ 매주 갱신 완료:', results);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: '매주 2주치 장원 조건 갱신 완료',
        results
      })
    }
    
  } catch (error) {
    console.error('장원 조건 갱신 오류:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack
      })
    }
  }
}

// 현재 날짜의 주차 계산 (해당 월의 첫 월요일 기준)
function getWeekOfMonth(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  
  // 해당 월의 1일
  const firstDayOfMonth = new Date(year, month, 1)
  
  // 해당 월의 첫 월요일 찾기
  const dayOfWeek = firstDayOfMonth.getDay() // 0: 일, 1: 월, ..., 6: 토
  let daysToMonday
  
  if (dayOfWeek === 0) {
    // 1일이 일요일이면 다음 날(2일)이 월요일
    daysToMonday = 1
  } else if (dayOfWeek === 1) {
    // 1일이 월요일이면 그날이 첫 월요일
    daysToMonday = 0
  } else {
    // 1일이 화~토요일이면 다음 주 월요일까지 일수
    daysToMonday = 8 - dayOfWeek
  }
  
  const firstMonday = new Date(firstDayOfMonth)
  firstMonday.setDate(1 + daysToMonday)
  
  console.log(`  첫 월요일: ${firstMonday.toISOString().split('T')[0]}`)
  
  // 현재 날짜가 첫 월요일 이전이면 0주차 (해당 월 시작 전)
  if (date < firstMonday) {
    console.log(`  ${date.toISOString().split('T')[0]}는 첫 월요일 이전 (0주차)`)
    return 0
  }
  
  // 첫 월요일부터 현재 날짜까지의 일수
  const daysSinceFirstMonday = Math.floor((date - firstMonday) / (1000 * 60 * 60 * 24))
  
  // 주차 계산 (1부터 시작)
  const weekNumber = Math.floor(daysSinceFirstMonday / 7) + 1
  
  console.log(`  ${date.toISOString().split('T')[0]} = ${weekNumber}주차 (첫 월요일로부터 ${daysSinceFirstMonday}일 후)`)
  
  return Math.min(weekNumber, 5) // 최대 5주차
}

// 2주치 갱신 함수
async function updateTwoWeeks(supabase, school, year, month, currentWeekNumber) {
  const weeksToUpdate = [currentWeekNumber, currentWeekNumber + 1]
  
  console.log(`[${school.school_code}] ${weeksToUpdate.join(', ')}주차 갱신 시작`)
  
  // 기존 champion_criteria 조회
  const { data: existingCriteria, error: selectError } = await supabase
    .from('champion_criteria')
    .select('*')
    .eq('school_code', school.school_code)
    .eq('year', year)
    .eq('month', month)
    .single()
  
  if (selectError && selectError.code !== 'PGRST116') {
    throw new Error(`기존 데이터 조회 실패: ${selectError.message}`)
  }
  
  if (!existingCriteria) {
    console.log(`[${school.school_code}] ${year}년 ${month}월 크리테리아 없음, 건너뜀`)
    return
  }
  
  // 각 주차별로 최신 급식일수 조회
  const updatedWeeklyDays = {}
  
  for (const week of weeksToUpdate) {
    // 다음 주차가 다음 달로 넘어가는 경우 처리
    let targetYear = year
    let targetMonth = month
    
    if (week > 5) {
      // 다음 달 1주차로 처리
      targetMonth = month + 1
      if (targetMonth > 12) {
        targetMonth = 1
        targetYear = year + 1
      }
      
      console.log(`[${school.school_code}] ${week}주차는 다음 달(${targetYear}년 ${targetMonth}월)로 처리`)
      
      // 다음 달 크리테리아 갱신
      await updateNextMonthFirstWeek(supabase, school, targetYear, targetMonth)
      continue
    }
    
    // 해당 주차의 급식일수 조회
    const weekMealDays = await fetchMealDaysForSpecificWeek(
      school.school_code,
      school.office_code,
      year,
      month,
      week
    )
    
    updatedWeeklyDays[`week_${week}_days`] = weekMealDays.length
    console.log(`[${school.school_code}] ${week}주차: ${weekMealDays.length}일`)
  }
  
  // month_total 재계산 (전체 주차 합산)
  const monthTotal = 
    (updatedWeeklyDays.week_1_days !== undefined ? updatedWeeklyDays.week_1_days : existingCriteria.week_1_days || 0) +
    (updatedWeeklyDays.week_2_days !== undefined ? updatedWeeklyDays.week_2_days : existingCriteria.week_2_days || 0) +
    (updatedWeeklyDays.week_3_days !== undefined ? updatedWeeklyDays.week_3_days : existingCriteria.week_3_days || 0) +
    (updatedWeeklyDays.week_4_days !== undefined ? updatedWeeklyDays.week_4_days : existingCriteria.week_4_days || 0) +
    (updatedWeeklyDays.week_5_days !== undefined ? updatedWeeklyDays.week_5_days : existingCriteria.week_5_days || 0)
  
  // 업데이트
  const updateData = {
    ...updatedWeeklyDays,
    month_total: monthTotal,
    updated_at: new Date().toISOString()
  }
  
  const { error: updateError } = await supabase
    .from('champion_criteria')
    .update(updateData)
    .eq('id', existingCriteria.id)
  
  if (updateError) {
    throw new Error(`업데이트 실패: ${updateError.message}`)
  }
  
  console.log(`[${school.school_code}] 갱신 완료 - month_total: ${monthTotal}일`)
}

// 다음 달 1주차 갱신
async function updateNextMonthFirstWeek(supabase, school, year, month) {
  console.log(`[${school.school_code}] ${year}년 ${month}월 1주차 갱신`)
  
  // 다음 달 크리테리아 조회
  const { data: nextMonthCriteria, error: selectError } = await supabase
    .from('champion_criteria')
    .select('*')
    .eq('school_code', school.school_code)
    .eq('year', year)
    .eq('month', month)
    .single()
  
  if (selectError && selectError.code !== 'PGRST116') {
    console.log(`[${school.school_code}] 다음 달 크리테리아 조회 실패, 건너뜀`)
    return
  }
  
  if (!nextMonthCriteria) {
    console.log(`[${school.school_code}] ${year}년 ${month}월 크리테리아 없음, 건너뜀`)
    return
  }
  
  // 1주차 급식일수 조회
  const week1MealDays = await fetchMealDaysForSpecificWeek(
    school.school_code,
    school.office_code,
    year,
    month,
    1
  )
  
  // month_total 재계산
  const monthTotal = 
    week1MealDays.length +
    (nextMonthCriteria.week_2_days || 0) +
    (nextMonthCriteria.week_3_days || 0) +
    (nextMonthCriteria.week_4_days || 0) +
    (nextMonthCriteria.week_5_days || 0)
  
  // 업데이트
  const { error: updateError } = await supabase
    .from('champion_criteria')
    .update({
      week_1_days: week1MealDays.length,
      month_total: monthTotal,
      updated_at: new Date().toISOString()
    })
    .eq('id', nextMonthCriteria.id)
  
  if (updateError) {
    console.log(`[${school.school_code}] 다음 달 1주차 업데이트 실패:`, updateError.message)
  } else {
    console.log(`[${school.school_code}] 다음 달 1주차 갱신 완료: ${week1MealDays.length}일`)
  }
}

// 특정 주차의 급식일수 조회
async function fetchMealDaysForSpecificWeek(schoolCode, officeCode, year, month, weekNumber) {
  // 해당 주차의 월요일~일요일 계산
  const firstDayOfMonth = new Date(year, month - 1, 1)
  const dayOfWeek = firstDayOfMonth.getDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
  
  const firstMonday = new Date(firstDayOfMonth)
  firstMonday.setDate(1 + daysToMonday)
  
  // 해당 주차의 월요일
  const weekMonday = new Date(firstMonday)
  weekMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
  
  // 해당 주차의 일요일
  const weekSunday = new Date(weekMonday)
  weekSunday.setDate(weekMonday.getDate() + 6)
  
  console.log(`  ${weekNumber}주차 기간: ${weekMonday.toISOString().split('T')[0]} ~ ${weekSunday.toISOString().split('T')[0]}`)
  
  // 주차가 여러 월에 걸쳐있을 수 있으므로 각 월별로 조회
  const mealDays = []
  const startMonth = weekMonday.getMonth() + 1
  const endMonth = weekSunday.getMonth() + 1
  const startYear = weekMonday.getFullYear()
  const endYear = weekSunday.getFullYear()
  
  const monthsToCheck = []
  
  if (startYear === endYear && startMonth === endMonth) {
    monthsToCheck.push({ year: startYear, month: startMonth })
  } else {
    monthsToCheck.push({ year: startYear, month: startMonth })
    if (endYear !== startYear || endMonth !== startMonth) {
      monthsToCheck.push({ year: endYear, month: endMonth })
    }
  }
  
  // 각 월의 급식일 조회
  for (const { year: y, month: m } of monthsToCheck) {
    const monthMealDays = await fetchMealDaysFromNEIS(schoolCode, officeCode, y, m)
    
    // 주차 기간에 해당하는 급식일만 필터링
    for (const dateStr of monthMealDays) {
      const mealDate = new Date(dateStr)
      if (mealDate >= weekMonday && mealDate <= weekSunday) {
        mealDays.push(dateStr)
      }
    }
  }
  
  return mealDays
}

// NEIS API에서 급식 일수 조회
async function fetchMealDaysFromNEIS(schoolCode, officeCode, year, month) {
  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo`
    const params = new URLSearchParams({
      KEY: process.env.NEIS_API_KEY,
      Type: 'json',
      pIndex: '1',
      pSize: '1000',
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      MLSV_YMD: `${year}${month.toString().padStart(2, '0')}`
    })
    
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    
    const mealDays = []
    
    if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
      const meals = data.mealServiceDietInfo[1].row
      const uniqueDates = new Set()
      
      for (const meal of meals) {
        // '중식'만 카운트
        if (meal.MMEAL_SC_NM === '중식') {
          const dateStr = meal.MLSV_YMD
          const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
          uniqueDates.add(formattedDate)
        }
      }
      
      mealDays.push(...Array.from(uniqueDates))
    }
    
    return mealDays
    
  } catch (error) {
    console.error(`NEIS API 호출 오류 (${schoolCode}, ${year}-${month}):`, error)
    return []
  }
}
