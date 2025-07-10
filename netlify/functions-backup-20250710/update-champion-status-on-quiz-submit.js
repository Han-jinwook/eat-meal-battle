/**
 * 퀴즈 제출 시 장원 상태 실시간 업데이트
 * 
 * 이 함수는 사용자가 퀴즈를 제출할 때마다 호출되어
 * 해당 사용자의 주간/월간 장원 상태를 즉시 업데이트합니다.
 * 기존 시스템과 병행하여 실행됩니다.
 */

const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  try {
    // 요청 데이터 파싱
    const payload = JSON.parse(event.body)
    const { 
      userId, 
      schoolCode, 
      grade, 
      quizResults, 
      testMode = false 
    } = payload
    
    // 테스트 모드 확인 (함수 호출 시 전달된 값 또는 환경 변수)
    const isTestMode = testMode || process.env.CHAMPION_TEST_MODE === 'true'
    
    console.log(`퀴즈 제출에 따른 장원 상태 업데이트 시작 (사용자: ${userId}, 테스트 모드: ${isTestMode})`)
    
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
    
    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
    
    // 퀴즈 결과에서 연도, 월, 주차 정보 추출
    const { year, month, weekNumber, isCorrect } = quizResults
    
    // 주간 장원 상태 업데이트
    const weeklyStatus = await updateChampionStatus(
      supabase,
      userId,
      schoolCode,
      grade,
      year,
      month,
      weekNumber,
      isCorrect,
      'weekly',
      isTestMode
    )
    
    // 월간 장원 상태도 함께 업데이트 (주차와 상관없이 월 단위로 계산)
    const monthlyStatus = await updateChampionStatus(
      supabase,
      userId,
      schoolCode,
      grade,
      year,
      month,
      null, // 월간은 주차 정보 없음
      isCorrect,
      'monthly',
      isTestMode
    )
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '장원 상태 업데이트 완료',
        userId,
        weekly: weeklyStatus,
        monthly: monthlyStatus
      })
    }
  } catch (error) {
    console.error('장원 상태 업데이트 오류:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

/**
 * 사용자의 장원 상태 업데이트
 * @param {Object} supabase - Supabase 클라이언트
 * @param {string} userId - 사용자 ID
 * @param {string} schoolCode - 학교 코드
 * @param {number} grade - 학년
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {number|null} weekNumber - 주차 (월간의 경우 null)
 * @param {boolean} isCorrect - 퀴즈 정답 여부
 * @param {string} periodType - 기간 유형 ('weekly' 또는 'monthly')
 * @param {boolean} isTestMode - 테스트 모드 여부
 */
async function updateChampionStatus(
  supabase,
  userId,
  schoolCode,
  grade,
  year,
  month,
  weekNumber,
  isCorrect,
  periodType,
  isTestMode
) {
  try {
    // 1. 해당 기간의 장원 조건 조회
    const { data: criteria, error: criteriaError } = await supabase
      .from('champion_criteria')
      .select('required_count')
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .eq('year', year)
      .eq('month', month)
      .eq('period_type', periodType)
      
    if (periodType === 'weekly') {
      // 주간 조건은 주차 정보도 필요
      if (weekNumber !== null) {
        supabase.query.eq('week_number', weekNumber)
      } else {
        throw new Error('주간 장원 상태 업데이트에는 주차 정보가 필요합니다')
      }
    } else {
      // 월간 조건은 주차 정보가 null
      supabase.query.is('week_number', null)
    }
    
    if (criteriaError || !criteria || criteria.length === 0) {
      console.error(`장원 조건 조회 실패 (${periodType}):`, criteriaError || '데이터 없음')
      return { status: 'error', reason: '장원 조건 정보 없음' }
    }
    
    // 2. 현재까지의 사용자 장원 기록 조회
    const { data: record, error: recordError } = await supabase
      .from('user_champion_records')
      .select('*')
      .eq('user_id', userId)
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .eq('year', year)
      .eq('month', month)
      .eq('period_type', periodType)
      
    if (periodType === 'weekly' && weekNumber !== null) {
      supabase.query.eq('week_number', weekNumber)
    } else if (periodType === 'monthly') {
      supabase.query.is('week_number', null)
    }
    
    // 3. 기록이 없으면 새로 생성
    if (recordError || !record || record.length === 0) {
      // 장원 기록 없음, 새로 생성
      const initialStatus = isCorrect ? 'in_progress' : 'failed'
      const correctCount = isCorrect ? 1 : 0
      
      // 테스트 모드에서는 과거 주차/월이라도 챔피언 도전 가능
      const isEligible = isTestMode ? true : isCurrentOrFuturePeriod(year, month, weekNumber)
      
      if (!isEligible && !isTestMode) {
        return { 
          status: 'error', 
          reason: '과거 기간에 대한 장원 상태는 업데이트할 수 없습니다' 
        }
      }
      
      const { error: insertError } = await supabase
        .from('user_champion_records')
        .insert({
          user_id: userId,
          school_code: schoolCode,
          grade,
          year,
          month,
          week_number: periodType === 'weekly' ? weekNumber : null,
          period_type: periodType,
          correct_count: correctCount,
          required_count: criteria[0].required_count,
          status: initialStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (insertError) {
        console.error('장원 기록 생성 오류:', insertError)
        return { status: 'error', reason: '기록 생성 실패' }
      }
      
      return { 
        status: initialStatus, 
        correct_count: correctCount,
        required_count: criteria[0].required_count
      }
    }
    
    // 4. 기존 기록 업데이트
    const currentRecord = record[0]
    
    // 이미 실패했거나 성공한 상태라면 테스트 모드가 아닌 이상 업데이트 안함
    if ((currentRecord.status === 'failed' || currentRecord.status === 'champion') && !isTestMode) {
      return { 
        status: currentRecord.status, 
        correct_count: currentRecord.correct_count,
        required_count: currentRecord.required_count,
        message: '이미 상태가 확정되었습니다' 
      }
    }
    
    // 퀴즈 결과에 따라 상태 업데이트
    let newStatus = currentRecord.status
    let newCorrectCount = currentRecord.correct_count
    
    if (isCorrect) {
      // 정답인 경우 정답 수 증가
      newCorrectCount += 1
      
      // 필요한 정답 수를 모두 채웠으면 장원 달성
      if (newCorrectCount >= currentRecord.required_count) {
        newStatus = 'champion'
      } else {
        newStatus = 'in_progress'
      }
    } else {
      // 오답인 경우 즉시 실패 처리
      newStatus = 'failed'
    }
    
    // 레코드 업데이트
    const { error: updateError } = await supabase
      .from('user_champion_records')
      .update({
        correct_count: newCorrectCount,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .eq('year', year)
      .eq('month', month)
      .eq('period_type', periodType)
    
    if (periodType === 'weekly') {
      supabase.query.eq('week_number', weekNumber)
    } else {
      supabase.query.is('week_number', null)
    }
    
    if (updateError) {
      console.error('장원 상태 업데이트 오류:', updateError)
      return { status: 'error', reason: '업데이트 실패' }
    }
    
    // 5. 기존 장원 테이블과의 호환성 유지 (quiz_champion_history 테이블 업데이트)
    if (newStatus === 'champion' || newStatus === 'failed') {
      try {
        await updateLegacyChampionTable(
          supabase, 
          userId, 
          schoolCode, 
          grade, 
          year, 
          month, 
          weekNumber, 
          periodType, 
          newStatus === 'champion'
        )
      } catch (legacyError) {
        console.error('기존 장원 테이블 업데이트 오류:', legacyError)
        // 기존 테이블 업데이트 실패해도 진행
      }
    }
    
    return { 
      status: newStatus, 
      correct_count: newCorrectCount,
      required_count: currentRecord.required_count
    }
  } catch (error) {
    console.error('장원 상태 업데이트 중 오류 발생:', error)
    return { status: 'error', reason: error.message }
  }
}

/**
 * 현재 또는 미래의 기간인지 확인
 */
function isCurrentOrFuturePeriod(year, month, weekNumber) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  
  // 연도가 미래인 경우
  if (year > currentYear) return true
  
  // 연도가 과거인 경우
  if (year < currentYear) return false
  
  // 같은 연도, 월이 미래인 경우
  if (month > currentMonth) return true
  
  // 같은 연도, 월이 과거인 경우
  if (month < currentMonth) return false
  
  // 같은 연도와 월, 주차는 현재 기준으로 계산 필요
  // 간단히 처리하기 위해 같은 월이면 허용
  return true
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
  periodType, 
  isChampion
) {
  try {
    // 기존 테이블은 주간(weekly)이면 week 필드 사용, 월간(monthly)이면 null
    const week = periodType === 'weekly' ? weekNumber : null
    
    // 이미 존재하는 기록 확인
    const { data: existing, error: queryError } = await supabase
      .from('quiz_champion_history')
      .select('*')
      .eq('user_id', userId)
      .eq('school_code', schoolCode)
      .eq('grade', grade)
      .eq('year', year)
      .eq('month', month)
      .eq('period_type', periodType)
    
    if (periodType === 'weekly' && week !== null) {
      supabase.query.eq('week', week)
    } else if (periodType === 'monthly') {
      supabase.query.is('week', null)
    }
    
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
        .eq('period_type', periodType)
        
      if (periodType === 'weekly') {
        supabase.query.eq('week', week)
      } else {
        supabase.query.is('week', null)
      }
      
      if (updateError) {
        throw new Error(`기존 장원 기록 업데이트 실패: ${updateError.message}`)
      }
    } else {
      // 기존 기록 없으면 새로 생성
      // 필요한 추가 정보 조회 (meal_days, correct_days)
      const mealDays = await calculateMealDaysForPeriod(
        supabase, schoolCode, grade, year, month, week, periodType
      )
      
      const correctDays = isChampion ? mealDays : 0 // 챔피언이면 모두 맞춘 것으로 가정
      
      const { error: insertError } = await supabase
        .from('quiz_champion_history')
        .insert({
          user_id: userId,
          school_code: schoolCode,
          grade,
          year,
          month,
          week,
          period_type: periodType,
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
 * 기간별 급식 일수 계산
 */
async function calculateMealDaysForPeriod(
  supabase,
  schoolCode,
  grade,
  year,
  month,
  week,
  periodType
) {
  // 장원 조건 테이블에서 필요한 급식 일수 조회
  const { data: criteria, error } = await supabase
    .from('champion_criteria')
    .select('required_count')
    .eq('school_code', schoolCode)
    .eq('grade', grade)
    .eq('year', year)
    .eq('month', month)
    .eq('period_type', periodType)
  
  if (periodType === 'weekly' && week !== null) {
    supabase.query.eq('week_number', week)
  } else if (periodType === 'monthly') {
    supabase.query.is('week_number', null)
  }
  
  if (error || !criteria || criteria.length === 0) {
    // 조건 정보가 없으면 기본값 반환
    console.warn(`급식 일수 정보가 없어 기본값 사용: ${periodType}`)
    return periodType === 'weekly' ? 5 : 20 // 주간 5일, 월간 20일 기본값
  }
  
  return criteria[0].required_count
}
