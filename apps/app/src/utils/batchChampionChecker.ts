/**
 * 6, 7월 장원유무 일괄 체크 시스템
 * 
 * 사용자님 요청: 현재 실적으로 6, 7월 장원 상태를 일괄 계산
 */

import { createClient } from '@/lib/supabase'
import { createClient as createServerClient } from '@/lib/supabase-server'

export class BatchChampionChecker {
  private getSupabaseClient() {
    if (typeof window === 'undefined') {
      try {
        return createServerClient()
      } catch (error) {
        console.log('서버 클라이언트 생성 실패, 기본 클라이언트 사용:', error)
        return createClient()
      }
    }
    return createClient()
  }
  
  private get supabase() {
    return this.getSupabaseClient()
  }

  /**
   * 6, 7월 전체 사용자 장원 상태 일괄 체크
   */
  async checkAllUsersChampionStatus(
    schoolCode?: string,
    grade?: number
  ): Promise<{
    june: { processed: number; champions: number },
    july: { processed: number; champions: number }
  }> {
    console.log('=== 6, 7월 장원 일괄 체크 시작 ===')
    
    const results = {
      june: { processed: 0, champions: 0 },
      july: { processed: 0, champions: 0 }
    }

    try {
      // 6월 체크
      console.log('📅 6월 장원 체크 시작...')
      const juneResult = await this.checkMonthChampions(2024, 6, schoolCode, grade)
      results.june = juneResult
      
      // 7월 체크
      console.log('📅 7월 장원 체크 시작...')
      const julyResult = await this.checkMonthChampions(2024, 7, schoolCode, grade)
      results.july = julyResult

      console.log('=== 일괄 체크 완료 ===')
      console.log('6월 결과:', results.june)
      console.log('7월 결과:', results.july)
      
      return results
    } catch (error) {
      console.error('일괄 체크 오류:', error)
      throw error
    }
  }

  /**
   * 특정 월의 모든 사용자 장원 체크
   */
  private async checkMonthChampions(
    year: number,
    month: number,
    schoolCode?: string,
    grade?: number
  ): Promise<{ processed: number; champions: number }> {
    try {
      // 해당 월의 모든 quiz_champions 데이터 조회
      let query = this.supabase
        .from('quiz_champions')
        .select('user_id, school_code, grade, week_1_correct, week_2_correct, week_3_correct, week_4_correct, week_5_correct, month_correct')
        .eq('year', year)
        .eq('month', month)

      if (schoolCode) {
        query = query.eq('school_code', schoolCode)
      }
      if (grade) {
        query = query.eq('grade', grade)
      }

      const { data: quizData, error: quizError } = await query

      if (quizError) {
        console.error('퀴즈 데이터 조회 실패:', quizError)
        return { processed: 0, champions: 0 }
      }

      if (!quizData || quizData.length === 0) {
        console.log(`${year}년 ${month}월 퀴즈 데이터 없음`)
        return { processed: 0, champions: 0 }
      }

      console.log(`${year}년 ${month}월 처리 대상: ${quizData.length}명`)

      let championCount = 0

      // 각 사용자별로 장원 체크
      for (const user of quizData) {
        const userChampionCount = await this.checkSingleUserChampions(
          user.user_id,
          user.school_code,
          user.grade,
          year,
          month,
          user
        )
        championCount += userChampionCount
      }

      return {
        processed: quizData.length,
        champions: championCount
      }
    } catch (error) {
      console.error(`${year}년 ${month}월 장원 체크 오류:`, error)
      return { processed: 0, champions: 0 }
    }
  }

  /**
   * 단일 사용자의 주장원/월장원 체크
   */
  private async checkSingleUserChampions(
    userId: string,
    schoolCode: string,
    grade: number,
    year: number,
    month: number,
    quizData: any
  ): Promise<number> {
    try {
      // champion_criteria 조회
      const { data: criteriaData, error: criteriaError } = await this.supabase
        .from('champion_criteria')
        .select('week_1_days, week_2_days, week_3_days, week_4_days, week_5_days, month_total')
        .eq('school_code', schoolCode)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (criteriaError || !criteriaData) {
        console.log(`급식일수 데이터 없음: ${schoolCode} ${year}-${month}`)
        return 0
      }

      let championCount = 0
      const championStatus = {
        week_1_champion: false,
        week_2_champion: false,
        week_3_champion: false,
        week_4_champion: false,
        week_5_champion: false,
        month_champion: false
      }

      // 주장원 체크 (1-5주차)
      for (let week = 1; week <= 5; week++) {
        const requiredDays = criteriaData[`week_${week}_days`]
        const correctCount = quizData[`week_${week}_correct`] || 0

        if (requiredDays > 0 && requiredDays === correctCount) {
          championStatus[`week_${week}_champion`] = true
          championCount++
          console.log(`✅ 주장원: ${userId} ${year}-${month} ${week}주차 (${correctCount}/${requiredDays})`)
        }
      }

      // 월장원 체크
      const monthRequiredDays = criteriaData.month_total
      const monthCorrectCount = quizData.month_correct || 0

      if (monthRequiredDays > 0 && monthRequiredDays === monthCorrectCount) {
        championStatus.month_champion = true
        championCount++
        console.log(`🏆 월장원: ${userId} ${year}-${month} (${monthCorrectCount}/${monthRequiredDays})`)
      }

      // user_champion_records에 저장
      if (championCount > 0) {
        await this.saveChampionRecord(
          userId,
          schoolCode,
          grade,
          year,
          month,
          championStatus
        )
      }

      return championCount
    } catch (error) {
      console.error(`사용자 ${userId} 장원 체크 오류:`, error)
      return 0
    }
  }

  /**
   * 장원 기록 저장
   */
  private async saveChampionRecord(
    userId: string,
    schoolCode: string,
    grade: number,
    year: number,
    month: number,
    championStatus: any
  ): Promise<void> {
    try {
      // 기존 레코드 확인
      const { data: existingData, error: selectError } = await this.supabase
        .from('user_champion_records')
        .select('id')
        .eq('user_id', userId)
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .single()

      if (existingData) {
        // 기존 레코드 업데이트
        const { error: updateError } = await this.supabase
          .from('user_champion_records')
          .update(championStatus)
          .eq('id', existingData.id)

        if (updateError) {
          console.error('장원 기록 업데이트 실패:', updateError)
        }
      } else {
        // 새 레코드 생성
        const insertData = {
          user_id: userId,
          school_code: schoolCode,
          grade: grade,
          year: year,
          month: month,
          ...championStatus
        }

        const { error: insertError } = await this.supabase
          .from('user_champion_records')
          .insert(insertData)

        if (insertError) {
          console.error('장원 기록 생성 실패:', insertError)
        }
      }
    } catch (error) {
      console.error('장원 기록 저장 오류:', error)
    }
  }

  /**
   * 특정 학교/학년의 장원 현황 조회
   */
  async getChampionSummary(
    schoolCode: string,
    grade: number,
    year: number,
    month: number
  ): Promise<{
    totalUsers: number
    weeklyChampions: { [key: string]: number }
    monthlyChampions: number
  }> {
    try {
      const { data, error } = await this.supabase
        .from('user_champion_records')
        .select('week_1_champion, week_2_champion, week_3_champion, week_4_champion, week_5_champion, month_champion')
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)

      if (error || !data) {
        return {
          totalUsers: 0,
          weeklyChampions: {},
          monthlyChampions: 0
        }
      }

      const summary = {
        totalUsers: data.length,
        weeklyChampions: {
          week_1: data.filter(d => d.week_1_champion).length,
          week_2: data.filter(d => d.week_2_champion).length,
          week_3: data.filter(d => d.week_3_champion).length,
          week_4: data.filter(d => d.week_4_champion).length,
          week_5: data.filter(d => d.week_5_champion).length,
        },
        monthlyChampions: data.filter(d => d.month_champion).length
      }

      return summary
    } catch (error) {
      console.error('장원 현황 조회 오류:', error)
      return {
        totalUsers: 0,
        weeklyChampions: {},
        monthlyChampions: 0
      }
    }
  }
}

// 싱글톤 인스턴스
export const batchChampionChecker = new BatchChampionChecker()
