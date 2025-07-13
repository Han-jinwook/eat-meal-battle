/**
 * ChampionCriteriaService
 * 장원 조건(급식일수) 관련 서비스 클래스
 */

import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다');
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * 장원 조건(급식일수) 관리 서비스 클래스
 */
export class ChampionCriteriaService {
  private supabase = getSupabaseClient();
  
  /**
   * 특정 주차의 장원 조건(급식일수)을 조회합니다
   * @param schoolCode - 학교 코드
   * @param grade - 학년 (현재 테이블에서 사용하지 않음)
   * @param year - 년도
   * @param month - 월 (1-12)
   * @param weekNumber - 주차 (1-6)
   * @returns 해당 주차의 급식일수 (0: 데이터 없음)
   */
  async getWeeklyCriteria(schoolCode: string, grade: number, year: number, month: number, weekNumber: number): Promise<number> {
    try {
      // 주차 유효성 검사
      if (weekNumber < 1 || weekNumber > 6) {
        console.error('유효하지 않은 주차:', weekNumber);
        return 0;
      }
      
      // 테이블 필드명에 맞게 수정 (언더스코어 포함)
      const weekField = `week_${weekNumber}_days`;
      
      const { data, error } = await this.supabase
        .from('champion_criteria')
        .select(weekField)
        .eq('school_code', schoolCode)
        .eq('year', year)
        .eq('month', month)
        .single();
      
      if (error) {
        console.error('주간 장원 조건 조회 실패:', error);
        return 0;
      }
      
      return data?.[weekField] || 0;
    } catch (error) {
      console.error('주간 장원 조건 조회 중 오류:', error);
      return 0;
    }
  }
  
  /**
   * 월간 장원 조건(급식일수)을 조회합니다
   * @param schoolCode - 학교 코드
   * @param grade - 학년 (현재 테이블에서 사용하지 않음)
   * @param year - 년도
   * @param month - 월 (1-12)
   * @returns 해당 월의 급식일수 (0: 데이터 없음)
   */
  async getMonthlyCriteria(schoolCode: string, grade: number, year: number, month: number): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('champion_criteria')
        .select('month_total')
        .eq('school_code', schoolCode)
        .eq('year', year)
        .eq('month', month)
        .single();
      
      if (error) {
        console.error('월간 장원 조건 조회 실패:', error);
        return 0;
      }
      
      return data?.month_total || 0;
    } catch (error) {
      console.error('월간 장원 조건 조회 중 오류:', error);
      return 0;
    }
  }
  
  /**
   * 유저의 장원 상태를 검사하고 기록합니다
   * @param userId - 사용자 ID
   * @param schoolCode - 학교 코드
   * @param grade - 학년
   * @param year - 년도
   * @param month - 월 (1-12)
   * @param weekNumber - 주차 (1-6, 없으면 월간 체크)
   * @returns 장원 여부
   */
  async checkAndUpdateChampionStatus(userId: string, schoolCode: string, grade: number, year: number, month: number, weekNumber?: number): Promise<boolean> {
    try {
      let isChampion = false;
      
      // 주간 또는 월간 장원 체크
      if (weekNumber) {
        // 주간 장원 체크
        // 1. 장원 조건 조회
        const requiredCount = await this.getWeeklyCriteria(schoolCode, grade, year, month, weekNumber);
        
        // 2. 사용자 정답수 조회
        const { data: userData, error: userError } = await this.supabase
          .from('quiz_champions')
          .select(`week_${weekNumber}_correct`)
          .eq('user_id', userId)
          .eq('year', year)
          .eq('month', month)
          .single();
        
        if (!userError && userData) {
          const correctCount = userData[`week_${weekNumber}_correct`] || 0;
          
          // 장원 조건 달성 여부 (정답수 = 급식일수)
          isChampion = (requiredCount > 0 && correctCount === requiredCount);
        }
        
        // 3. 장원 기록 저장
        await this.updateUserChampionRecord(userId, schoolCode, grade, year, month, weekNumber, isChampion);
        
        // 4. 학교별 장원 기록 저장
        if (isChampion) {
          await this.updateSchoolChampion(userId, schoolCode, grade, year, month, weekNumber, 'weekly');
        }
      } else {
        // 월간 장원 체크
        // 1. 장원 조건 조회
        const requiredCount = await this.getMonthlyCriteria(schoolCode, grade, year, month);
        
        // 2. 사용자 정답수 조회 - 주차별 필드를 합산하여 사용
        const { data: userData, error: userError } = await this.supabase
          .from('quiz_champions')
          .select('week_1_correct, week_2_correct, week_3_correct, week_4_correct, week_5_correct, week_6_correct')
          .eq('user_id', userId)
          .eq('year', year)
          .eq('month', month)
          .single();
        
        if (!userError && userData) {
          // 모든 주차의 정답수를 합산
          const correctCount = [
            userData.week_1_correct || 0,
            userData.week_2_correct || 0,
            userData.week_3_correct || 0,
            userData.week_4_correct || 0,
            userData.week_5_correct || 0,
            userData.week_6_correct || 0
          ].reduce((sum, count) => sum + count, 0);
          
          // 장원 조건 달성 여부 (정답수 = 급식일수)
          isChampion = (requiredCount > 0 && correctCount === requiredCount);
        }
        
        // 3. 장원 기록 저장
        await this.updateUserChampionRecord(userId, schoolCode, grade, year, month, undefined, isChampion);
        
        // 4. 학교별 장원 기록 저장
        if (isChampion) {
          await this.updateSchoolChampion(userId, schoolCode, grade, year, month, undefined, 'monthly');
        }
      }
      
      return isChampion;
    } catch (error) {
      console.error('장원 상태 검사 중 오류:', error);
      return false;
    }
  }
  
  /**
   * 사용자의 장원 기록을 업데이트합니다
   * @private
   */
  private async updateUserChampionRecord(
    userId: string, 
    schoolCode: string, 
    grade: number, 
    year: number, 
    month: number, 
    weekNumber?: number,
    isChampion: boolean = false
  ): Promise<boolean> {
    try {
      // 해당 사용자의 장원 기록 확인
      const { data, error } = await this.supabase
        .from('user_champion_records')
        .select('id')
        .eq('user_id', userId)
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .single();
      
      const updateData: any = {};
      
      // 주간 또는 월간 필드 설정
      if (weekNumber) {
        updateData[`week_${weekNumber}_champion`] = isChampion;
      } else {
        updateData.month_champion = isChampion;
      }
      
      if (error && error.code !== 'PGRST116') { // PGRST116: 결과 없음
        console.error('장원 기록 조회 실패:', error);
        return false;
      }
      
      if (data) {
        // 기존 레코드 업데이트
        const { error: updateError } = await this.supabase
          .from('user_champion_records')
          .update(updateData)
          .eq('id', data.id);
        
        if (updateError) {
          console.error('장원 기록 업데이트 실패:', updateError);
          return false;
        }
      } else {
        // 새 레코드 삽입
        const insertData = {
          user_id: userId,
          school_code: schoolCode,
          grade: grade,
          year: year,
          month: month,
          ...updateData
        };
        
        const { error: insertError } = await this.supabase
          .from('user_champion_records')
          .insert(insertData);
        
        if (insertError) {
          console.error('장원 기록 삽입 실패:', insertError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('장원 기록 저장 중 오류:', error);
      return false;
    }
  }
  
  /**
   * 학교/학년별 장원 정보를 업데이트합니다
   * @private
   */
  private async updateSchoolChampion(
    userId: string, 
    schoolCode: string, 
    grade: number, 
    year: number, 
    month: number, 
    weekNumber?: number,
    periodType: 'weekly' | 'monthly' = 'weekly'
  ): Promise<boolean> {
    try {
      // 장원 기록 확인
      const { data, error } = await this.supabase
        .from('school_champions')
        .select('id')
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .eq('period_type', periodType)
        .eq('week', weekNumber || null)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116: 결과 없음
        console.error('학교별 장원 기록 조회 실패:', error);
        return false;
      }
      
      if (data) {
        // 기존 레코드 업데이트
        const { error: updateError } = await this.supabase
          .from('school_champions')
          .update({ champion_user_id: userId })
          .eq('id', data.id);
        
        if (updateError) {
          console.error('학교별 장원 기록 업데이트 실패:', updateError);
          return false;
        }
      } else {
        // 새 레코드 삽입
        const { error: insertError } = await this.supabase
          .from('school_champions')
          .insert({
            school_code: schoolCode,
            grade: grade,
            year: year,
            month: month,
            week: weekNumber || null,
            period_type: periodType,
            champion_user_id: userId
          });
        
        if (insertError) {
          console.error('학교별 장원 기록 삽입 실패:', insertError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('학교별 장원 기록 저장 중 오류:', error);
      return false;
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
    try {
      const { data, error } = await this.supabase
        .from('user_champion_records')
        .select('*')
        .eq('user_id', userId)
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .single();
      
      if (error) {
        console.error('사용자 장원 기록 조회 실패:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('사용자 장원 기록 조회 중 오류:', error);
      return null;
    }
  }
}
