/**
 * 개선된 주/월장원 통계 계산 시스템
 * 
 * 변경사항:
 * - ChampionCriteriaService 통합
 * - 신규 테이블 구조 지원 (champion_criteria, user_champion_records, school_champions)
 * - 기존 로직 호환성 유지
 */

import { createClient } from '@/lib/supabase'
import { ChampionCriteriaService } from './championCriteriaService'
import { ChampionStatistics, WeekInfo } from './championCalculator'

export class EnhancedChampionCalculator {
  private supabase = createClient()
  private criteriaService = new ChampionCriteriaService()

  /**
   * ISO 기준 주차 계산 (월요일이 속한 달 기준)
   */
  getWeekInfo(date: Date): WeekInfo {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    // 해당 월의 첫 번째 월요일 찾기
    const firstOfMonth = new Date(year, month, 1)
    const firstMonday = new Date(firstOfMonth)
    const dayOfWeek = firstOfMonth.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    firstMonday.setDate(1 + daysToMonday)

    // 주차 계산
    const timeDiff = date.getTime() - firstMonday.getTime()
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    const week_number = Math.floor(daysDiff / 7) + 1

    // 해당 주의 시작일/종료일 (월-일)
    const start_date = new Date(firstMonday)
    start_date.setDate(firstMonday.getDate() + (week_number - 1) * 7)
    
    const end_date = new Date(start_date)
    end_date.setDate(start_date.getDate() + 6)

    return {
      year,
      month: month + 1, // 1-based month
      week_number,
      start_date,
      end_date
    }
  }

  /**
   * 특정 기간의 급식 제공 일수 계산
   */
  async calculateMealDays(
    schoolCode: string,
    grade: number,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const { data, error } = await this.supabase
        .from('meals')
        .select('date')
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .gte('date', startDateStr)
        .lte('date', endDateStr)

      if (error) {
        console.error('급식일수 계산 오류:', error)
        return 0
      }

      return data?.length || 0
    } catch (error) {
      console.error('급식일수 계산 예외:', error)
      return 0
    }
  }

  /**
   * 특정 기간의 퀴즈 결과 조회
   */
  async getQuizResults(
    userId: string,
    schoolCode: string,
    grade: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total_quiz_days: number
    correct_count: number
    accuracy_rate: number
    avg_answer_time: number
  }> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const { data, error } = await this.supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', userId)
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .gte('date', startDateStr)
        .lte('date', endDateStr)

      if (error) {
        console.error('퀴즈 결과 조회 오류:', error)
        return { total_quiz_days: 0, correct_count: 0, accuracy_rate: 0, avg_answer_time: 0 }
      }

      const results = data || []
      const correct_count = results.filter(r => r.is_correct).length
      const total_quiz_days = results.length
      const accuracy_rate = total_quiz_days > 0 ? (correct_count / total_quiz_days) * 100 : 0
      
      const totalAnswerTime = results.reduce((total, r) => total + (r.answer_time || 0), 0)
      const avg_answer_time = total_quiz_days > 0 ? totalAnswerTime / total_quiz_days : 0

      return { total_quiz_days, correct_count, accuracy_rate, avg_answer_time }
    } catch (error) {
      console.error('퀴즈 결과 조회 예외:', error)
      return { total_quiz_days: 0, correct_count: 0, accuracy_rate: 0, avg_answer_time: 0 }
    }
  }

  /**
   * 주장원 통계 계산 (특정 주차)
   * - 기존 호환성 유지
   * - 새 테이블 구조에도 저장
   */
  async calculateWeeklyStatistics(
    userId: string,
    schoolCode: string,
    grade: number,
    year: number,
    month: number,
    weekNumber: number
  ): Promise<ChampionStatistics | null> {
    try {
      // 주차 정보 계산
      const weekInfo = this.getWeekInfoByWeekNumber(year, month - 1, weekNumber)
      if (!weekInfo) {
        console.error(`유효하지 않은 주차 정보: ${year}년 ${month}월 ${weekNumber}주차`)
        return null
      }

      // 1. 기존 방식으로 통계 계산 (호환성 유지)
      const total_meal_days = await this.calculateMealDays(
        schoolCode, 
        grade, 
        weekInfo.start_date, 
        weekInfo.end_date
      )
      
      const quizResults = await this.getQuizResults(
        userId, 
        schoolCode, 
        grade, 
        weekInfo.start_date, 
        weekInfo.end_date
      )

      // 2. 신규 방식: 장원 조건 테이블에서 요구 정답수 조회
      const requiredCount = await this.criteriaService.getWeeklyCriteria(
        schoolCode,
        grade,
        year,
        month,
        weekNumber
      )

      // 장원 판별 (기존 로직 유지: 급식일수 = 정답수)
      let is_champion = total_meal_days > 0 && quizResults.correct_count === total_meal_days
      
      // 신규 로직: 만약 장원 조건 테이블에 데이터가 있으면 그것을 우선 사용
      if (requiredCount > 0) {
        is_champion = quizResults.correct_count === requiredCount
      }

      // 3. 신규 테이블 업데이트
      // 3-1. 유저의 주간 정답수 업데이트
      await this.criteriaService.updateUserWeeklyCorrect(
        userId,
        schoolCode,
        grade,
        year,
        month,
        weekNumber,
        quizResults.correct_count
      )
      
      // 3-2. 장원 상태 업데이트
      if (is_champion) {
        await this.criteriaService.checkAndUpdateChampionStatus(
          userId,
          schoolCode,
          grade,
          year,
          month,
          weekNumber
        )
      }

      // 4. 기존 형식으로 반환 (호환성 유지)
      return {
        user_id: userId,
        school_code: schoolCode,
        grade,
        year,
        month,
        week_number: weekNumber,
        period_type: 'weekly',
        total_meal_days: requiredCount > 0 ? requiredCount : total_meal_days,
        total_count: quizResults.total_quiz_days,
        correct_count: quizResults.correct_count,
        accuracy_rate: quizResults.accuracy_rate,
        avg_answer_time: quizResults.avg_answer_time,
        is_champion,
        determined_at: is_champion ? new Date() : undefined
      }
    } catch (error) {
      console.error('주장원 통계 계산 오류:', error)
      return null
    }
  }

  /**
   * 월장원 통계 계산
   * - 기존 호환성 유지
   * - 새 테이블 구조에도 저장
   */
  async calculateMonthlyStatistics(
    userId: string,
    schoolCode: string,
    grade: number,
    year: number,
    month: number
  ): Promise<ChampionStatistics | null> {
    try {
      // 1. 기존 방식으로 통계 계산 (호환성 유지)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      const total_meal_days = await this.calculateMealDays(
        schoolCode, 
        grade, 
        startDate, 
        endDate
      )
      
      const quizResults = await this.getQuizResults(
        userId, 
        schoolCode, 
        grade, 
        startDate, 
        endDate
      )

      // 2. 신규 방식: 장원 조건 테이블에서 요구 정답수 조회
      const requiredCount = await this.criteriaService.getMonthlyCriteria(
        schoolCode,
        grade,
        year,
        month
      )

      // 장원 판별 (기존 로직 유지: 급식일수 = 정답수)
      let is_champion = total_meal_days > 0 && quizResults.correct_count === total_meal_days
      
      // 신규 로직: 만약 장원 조건 테이블에 데이터가 있으면 그것을 우선 사용
      if (requiredCount > 0) {
        is_champion = quizResults.correct_count === requiredCount
      }

      // 3. 신규 테이블 업데이트
      // 3-1. 장원 상태 업데이트 (월간은 week_number 없음)
      if (is_champion) {
        await this.criteriaService.checkAndUpdateChampionStatus(
          userId,
          schoolCode,
          grade,
          year,
          month
        )
      }

      // 4. 기존 형식으로 반환 (호환성 유지)
      return {
        user_id: userId,
        school_code: schoolCode,
        grade,
        year,
        month,
        period_type: 'monthly',
        total_meal_days: requiredCount > 0 ? requiredCount : total_meal_days,
        total_count: quizResults.total_quiz_days,
        correct_count: quizResults.correct_count,
        accuracy_rate: quizResults.accuracy_rate,
        avg_answer_time: quizResults.avg_answer_time,
        is_champion,
        determined_at: is_champion ? new Date() : undefined
      }
    } catch (error) {
      console.error('월장원 통계 계산 오류:', error)
      return null
    }
  }

  /**
   * 주차 번호로 주차 정보 계산
   */
  private getWeekInfoByWeekNumber(year: number, month: number, weekNumber: number): WeekInfo | null {
    try {
      // 유효성 검사
      if (weekNumber <= 0) {
        console.error('유효하지 않은 주차 번호:', weekNumber)
        return null
      }

      if (month < 0 || month > 11) {
        console.error('유효하지 않은 월 (0-11 범위를 벗어남):', month)
        return null
      }

      // 해당 월의 첫 번째 날짜
      const firstOfMonth = new Date(year, month, 1)
      
      // 해당 월의 첫 번째 월요일 찾기
      const firstMonday = new Date(firstOfMonth)
      const dayOfWeek = firstOfMonth.getDay()
      const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
      firstMonday.setDate(1 + daysToMonday)

      // 요청된 주차의 시작일
      const start_date = new Date(firstMonday)
      start_date.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
      
      // 요청된 주차의 시작일이 다음 달로 넘어가면 null 반환
      if (start_date.getMonth() !== month) {
        console.error(`주차 번호 ${weekNumber}는 ${year}년 ${month+1}월에 존재하지 않음`)
        return null
      }
      
      // 요청된 주차의 종료일
      const end_date = new Date(start_date)
      end_date.setDate(start_date.getDate() + 6)

      return {
        year,
        month: month + 1, // 1-based month 반환
        week_number: weekNumber,
        start_date,
        end_date
      }
    } catch (error) {
      console.error('주차 정보 계산 오류:', error)
      return null
    }
  }

  /**
   * 통계 저장 (기존 quiz_champion_history 테이블 호환용)
   */
  async saveStatistics(stats: ChampionStatistics): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('quiz_champion_history')
        .upsert([{
          user_id: stats.user_id,
          school_code: stats.school_code,
          grade: stats.grade,
          year: stats.year,
          month: stats.month,
          week_number: stats.week_number,
          period_type: stats.period_type,
          total_meal_days: stats.total_meal_days,
          total_count: stats.total_count,
          correct_count: stats.correct_count,
          accuracy_rate: stats.accuracy_rate,
          avg_answer_time: stats.avg_answer_time,
          is_champion: stats.is_champion,
          determined_at: stats.determined_at?.toISOString(),
          is_current: true
        }], {
          onConflict: 'user_id,school_code,grade,year,month,week_number,period_type'
        })

      if (error) {
        console.error('통계 저장 오류:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('통계 저장 예외:', error)
      return false
    }
  }
  
  /**
   * 사용자의 주간/월간 장원 기록을 조회합니다
   * @param userId - 사용자 ID
   * @param schoolCode - 학교 코드
   * @param grade - 학년
   * @param year - 년도
   * @param month - 월 (1-12)
   * @returns 사용자의 장원 기록
   */
  async getUserChampionRecords(userId: string, schoolCode: string, grade: number, year: number, month: number) {
    return this.criteriaService.getUserChampionRecords(userId, schoolCode, grade, year, month);
  }
}

// 싱글톤 인스턴스
export const enhancedChampionCalculator = new EnhancedChampionCalculator()
