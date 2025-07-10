/**
 * 미제출 사용자 자동 실패 처리 스케줄러
 * 
 * 이 함수는 금요일 마감시간(오후 1시) 이후에 실행되어
 * 해당 주차의 퀴즈를 제출하지 않은 사용자들을 자동으로 실패로 표시합니다.
 * 테스트 모드에서는 실행되지 않습니다.
 */

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  // API 키 검증
  const authToken = event.headers['x-api-key']
  if (authToken !== process.env.CRON_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    }
  }
  
  // 테스트 모드 확인
  const isTestMode = process.env.CHAMPION_TEST_MODE === 'true'
  if (isTestMode) {
    console.log('테스트 모드에서는 자동 실패 처리가 비활성화됩니다')
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: '테스트 모드에서는 자동 실패 처리가 비활성화됩니다',
        status: 'skipped' 
      })
    }
  }
  
  // 새 시스템 사용 여부 확인
  const useNewSystem = process.env.USE_NEW_CHAMPION_SYSTEM === 'true'
  if (!useNewSystem) {
    console.log('새 장원 시스템이 비활성화되어 있습니다. 기존 시스템만 사용합니다.')
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: '새 장원 시스템 비활성화 상태',
        status: 'skipped' 
      })
    }
  }

  try {
    console.log('미제출 사용자 자동 실패 처리 시작')
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
    
    // 현재 날짜 기준 연도, 월, 주차 정보 계산
    const { year, month, weekNumber } = getCurrentWeekInfo()
    
    console.log(`처리 대상: ${year}년 ${month}월 ${weekNumber}주차`)
    
    // 모든 활성 사용자 목록 조회
    const { data: activeUsers, error: userError } = await supabase
      .from('profiles')
      .select('id, school_code, grade')
      .eq('active', true)
    
    if (userError) {
      throw new Error(`활성 사용자 목록 조회 실패: ${userError.message}`)
    }
    
    console.log(`총 ${activeUsers.length}명의 활성 사용자 발견`)
    
    // 현재 주차의 장원 조건 정보 조회
    const { data: weekCriteria, error: criteriaError } = await supabase
      .from('champion_criteria')
      .select('school_code, grade, required_count')
      .eq('year', year)
      .eq('month', month)
      .eq('week_number', weekNumber)
      .eq('period_type', 'weekly')
    
    if (criteriaError) {
      throw new Error(`장원 조건 조회 실패: ${criteriaError.message}`)
    }
    
    // 이미 장원 기록이 있는 사용자 목록 조회
    const { data: existingRecords, error: recordError } = await supabase
      .from('user_champion_records')
      .select('user_id, school_code, grade')
      .eq('year', year)
      .eq('month', month)
      .eq('week_number', weekNumber)
      .eq('period_type', 'weekly')
    
    if (recordError) {
      throw new Error(`기존 장원 기록 조회 실패: ${recordError.message}`)
    }
    
    // 기존 기록이 있는 사용자는 처리 대상에서 제외
    const existingUserMap = {}
    if (existingRecords && existingRecords.length > 0) {
      existingRecords.forEach(record => {
        const key = `${record.user_id}-${record.school_code}-${record.grade}`
        existingUserMap[key] = true
      })
    }
    
    // 장원 조건을 학교/학년별 맵으로 변환
    const criteriaMap = {}
    if (weekCriteria && weekCriteria.length > 0) {
      weekCriteria.forEach(criteria => {
        const key = `${criteria.school_code}-${criteria.grade}`
        criteriaMap[key] = criteria.required_count
      })
    }
    
    // 미제출 사용자 실패 처리
    const results = []
    const failures = []
    
    for (const user of activeUsers) {
      const key = `${user.id}-${user.school_code}-${user.grade}`
      const criteriaKey = `${user.school_code}-${user.grade}`
      
      // 이미 기록이 있으면 건너뛰기
      if (existingUserMap[key]) {
        results.push({
          userId: user.id,
          status: 'skipped',
          reason: '이미 기록이 존재함'
        })
        continue
      }
      
      // 해당 학교/학년에 대한 장원 조건이 없으면 건너뛰기
      if (!criteriaMap[criteriaKey]) {
        results.push({
          userId: user.id,
          status: 'skipped',
          reason: '장원 조건 정보 없음'
        })
        continue
      }
      
      try {
        // 사용자를 실패로 표시
        const requiredCount = criteriaMap[criteriaKey]
        
        // user_champion_records 테이블에 실패 기록 추가
        const { error: insertError } = await supabase
          .from('user_champion_records')
          .insert({
            user_id: user.id,
            school_code: user.school_code,
            grade: user.grade,
            year,
            month,
            week_number: weekNumber,
            period_type: 'weekly',
            correct_count: 0,
            required_count: requiredCount,
            status: 'failed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        
        if (insertError) {
          throw new Error(`실패 기록 생성 오류: ${insertError.message}`)
        }
        
        // 기존 장원 테이블과의 호환성 유지
        await updateLegacyChampionTable(
          supabase,
          user.id,
          user.school_code,
          user.grade,
          year,
          month,
          weekNumber,
          false // 실패 처리
        )
        
        results.push({
          userId: user.id,
          status: 'failed',
          reason: '퀴즈 미제출'
        })
        
        failures.push({
          userId: user.id,
          schoolCode: user.school_code,
          grade: user.grade
        })
      } catch (error) {
        console.error(`사용자 ${user.id} 실패 처리 오류:`, error)
        results.push({
          userId: user.id,
          status: 'error',
          reason: error.message
        })
      }
    }
    
    console.log(`총 ${failures.length}명의 사용자가 실패로 표시됨`)
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${failures.length}명의 사용자가 퀴즈 미제출로 실패 처리됨`,
        year,
        month,
        weekNumber,
        failureCount: failures.length,
        totalUsers: activeUsers.length,
        skippedUsers: activeUsers.length - failures.length
      })
    }
  } catch (error) {
    console.error('미제출 사용자 실패 처리 오류:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

/**
 * 현재 주차 정보 계산
 */
function getCurrentWeekInfo() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  // 주차 계산
  const firstDayOfMonth = new Date(year, month - 1, 1)
  const dayOfWeek = firstDayOfMonth.getDay() // 0: 일요일, 1: 월요일, ..., 6: 토요일
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
  
  const firstMonday = new Date(firstDayOfMonth)
  firstMonday.setDate(1 + daysToMonday)
  
  const today = new Date(now)
  // 같은 달인지 확인
  if (today.getMonth() === firstMonday.getMonth()) {
    const daysDiff = Math.floor((today - firstMonday) / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(daysDiff / 7) + 1
    
    return { year, month, weekNumber }
  } else {
    // 다른 달이면 0주차로 처리
    return { year, month, weekNumber: 0 }
  }
}

/**
 * 기존 장원 테이블 업데이트 (quiz_champion_history)
 */
async function updateLegacyChampionTable(
  supabase, 
  userId, 
  schoolCode, 
  grade, 
  year, 
  month, 
  weekNumber, 
  isChampion
) {
  try {
    // 기존 테이블은 주간(weekly)이면 week 필드 사용
    const week = weekNumber
    
    // 이미 존재하는 기록 확인
    const { data: existing, error: queryError } = await supabase
      .from('quiz_champion_history')
      .select('*')
      .eq('user_id', userId)
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .eq('year', year)
      .eq('month', month)
      .eq('week', week)
      .eq('period_type', 'weekly')
    
    if (queryError) {
      throw new Error(`기존 장원 기록 조회 실패: ${queryError.message}`)
    }
    
    if (existing && existing.length > 0) {
      // 기존 기록 업데이트
      const { error: updateError } = await supabase
        .from('quiz_champion_history')
        .update({
          is_champion: isChampion,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .eq('week', week)
        .eq('period_type', 'weekly')
      
      if (updateError) {
        throw new Error(`기존 장원 기록 업데이트 실패: ${updateError.message}`)
      }
    } else {
      // 기존 기록 없으면 새로 생성
      // 필요한 추가 정보 조회 (meal_days)
      const mealDays = await getMealDaysForWeek(
        supabase, schoolCode, grade, year, month, week
      )
      
      const correctDays = 0 // 퀴즈 미제출이므로 0
      
      const { error: insertError } = await supabase
        .from('quiz_champion_history')
        .insert({
          user_id: userId,
          school_code: schoolCode,
          grade,
          year,
          month,
          week,
          period_type: 'weekly',
          meal_days: mealDays,
          correct_days: correctDays,
          is_champion: isChampion,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (insertError) {
        throw new Error(`기존 장원 기록 생성 실패: ${insertError.message}`)
      }
    }
    
    return true
  } catch (error) {
    console.error('기존 장원 테이블 업데이트 오류:', error)
    throw error
  }
}

/**
 * 주차별 급식 일수 조회
 */
async function getMealDaysForWeek(
  supabase,
  schoolCode,
  grade,
  year,
  month,
  weekNumber
) {
  // 장원 조건 테이블에서 필요한 급식 일수 조회
  const { data: criteria, error } = await supabase
    .from('champion_criteria')
    .select('required_count')
    .eq('school_code', schoolCode)
    .eq('grade', grade)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber)
    .eq('period_type', 'weekly')
  
  if (error || !criteria || criteria.length === 0) {
    // 조건 정보가 없으면 기본값 반환
    console.warn(`급식 일수 정보가 없어 기본값 사용: 주간`)
    return 5 // 주간 5일 기본값
  }
  
  return criteria[0].required_count
}
