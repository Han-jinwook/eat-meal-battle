/**
 * 주장원/월장원 계산 시스템 (Functions용 JavaScript 버전)
 * 
 * 핵심 원칙:
 * - champion_criteria.week_N_days === quiz_champions.week_N_correct 일치 시 주장원
 * - champion_criteria.month_total === quiz_champions.month_correct 일치 시 월장원
 * - 결과는 user_champion_records 테이블에 저장
 */

const { createClient } = require('@supabase/supabase-js');

class ChampionCalculator {
  constructor(externalClient = null) {
    this.supabaseClient = externalClient;
  }
  
  getSupabaseClient() {
    if (this.supabaseClient) {
      console.log('DEBUG', '외부에서 전달받은 Supabase 클라이언트 사용');
      return this.supabaseClient;
    }
    
    console.log('DEBUG', '서버 환경에서 Supabase 클라이언트 호출 - 직접 클라이언트 생성');
    // 서버 환경에서 직접 Supabase 클라이언트 생성
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  
  get supabase() {
    return this.getSupabaseClient();
  }

  /**
   * 실시간 장원 체크 (퀴즈 정답 시 호출)
   */
  async checkChampionStatusOnQuizSubmit(
    userId,
    schoolCode,
    grade,
    year,
    month,
    currentWeekNumber
  ) {
    try {
      console.log('실시간 장원 체크:', { userId, schoolCode, grade, year, month, currentWeekNumber });
      
      // 해당 주차만 체크
      await this.checkWeeklyChampion(userId, schoolCode, grade, year, month, currentWeekNumber);
      
      // 월장원 체크
      await this.checkMonthlyChampion(userId, schoolCode, grade, year, month);
      
    } catch (error) {
      console.error('실시간 장원 체크 오류:', error);
    }
  }

  /**
   * 주장원 체크
   */
  async checkWeeklyChampion(
    userId,
    schoolCode,
    grade,
    year,
    month,
    weekNumber
  ) {
    try {
      // 1. champion_criteria에서 해당 주차 급식일수 조회
      const { data: criteriaData, error: criteriaError } = await this.supabase
        .from('champion_criteria')
        .select('week_1_days, week_2_days, week_3_days, week_4_days, week_5_days')
        .eq('school_code', schoolCode)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (criteriaError || !criteriaData) {
        console.log('급식일수 데이터 없음:', { schoolCode, year, month, weekNumber });
        return false;
      }

      const requiredDays = criteriaData[`week_${weekNumber}_days`];
      if (!requiredDays || requiredDays === 0) {
        console.log('해당 주차 급식일수 0일:', { weekNumber, requiredDays });
        return false;
      }

      // 2. quiz_champions에서 해당 유저 정답수 조회
      const { data: quizData, error: quizError } = await this.supabase
        .from('quiz_champions')
        .select('week_1_correct, week_2_correct, week_3_correct, week_4_correct, week_5_correct')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (quizError || !quizData) {
        console.log('퀴즈 데이터 없음:', { userId, year, month });
        return false;
      }

      const correctCount = quizData[`week_${weekNumber}_correct`] || 0;

      // 3. 급식일수 === 정답수 비교
      const isChampion = requiredDays === correctCount;

      console.log('주장원 체크 결과:', {
        userId,
        weekNumber,
        requiredDays,
        correctCount,
        isChampion
      });

      // 4. 장원이면 user_champion_records에 저장
      if (isChampion) {
        await this.updateUserChampionRecord(
          userId,
          schoolCode,
          grade,
          year,
          month,
          weekNumber,
          'weekly'
        );
      }

      return isChampion;
    } catch (error) {
      console.error('주장원 체크 오류:', error);
      return false;
    }
  }

  /**
   * 월장원 체크
   */
  async checkMonthlyChampion(
    userId,
    schoolCode,
    grade,
    year,
    month
  ) {
    try {
      // 1. champion_criteria에서 해당 월 급식일수 조회
      const { data: criteriaData, error: criteriaError } = await this.supabase
        .from('champion_criteria')
        .select('month_total')
        .eq('school_code', schoolCode)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (criteriaError || !criteriaData) {
        console.log('월별 급식일수 데이터 없음:', { schoolCode, year, month });
        return false;
      }

      const requiredDays = criteriaData.month_total;
      if (!requiredDays || requiredDays === 0) {
        console.log('해당 월 급식일수 0일:', { month, requiredDays });
        return false;
      }

      // 2. quiz_champions에서 해당 유저 월별 정답수 조회
      const { data: quizData, error: quizError } = await this.supabase
        .from('quiz_champions')
        .select('month_correct')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (quizError || !quizData) {
        console.log('월별 퀴즈 데이터 없음:', { userId, year, month });
        return false;
      }

      const correctCount = quizData.month_correct || 0;

      // 3. 급식일수 === 정답수 비교
      const isChampion = requiredDays === correctCount;

      console.log('월장원 체크 결과:', {
        userId,
        month,
        requiredDays,
        correctCount,
        isChampion
      });

      // 4. 장원이면 user_champion_records에 저장
      if (isChampion) {
        await this.updateUserChampionRecord(
          userId,
          schoolCode,
          grade,
          year,
          month,
          undefined,
          'monthly'
        );
      }

      return isChampion;
    } catch (error) {
      console.error('월장원 체크 오류:', error);
      return false;
    }
  }

  /**
   * user_champion_records 테이블 업데이트
   */
  async updateUserChampionRecord(
    userId,
    schoolCode,
    grade,
    year,
    month,
    weekNumber,
    periodType = 'weekly'
  ) {
    try {
      // 기존 레코드 조회
      const { data: existingData, error: selectError } = await this.supabase
        .from('user_champion_records')
        .select('*')
        .eq('user_id', userId)
        .eq('school_code', schoolCode)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .single();

      let updateData = {};

      if (periodType === 'weekly' && weekNumber) {
        updateData[`week_${weekNumber}_champion`] = true;
      } else if (periodType === 'monthly') {
        updateData['month_champion'] = true;
      }

      if (existingData) {
        // 기존 레코드 업데이트
        const { error: updateError } = await this.supabase
          .from('user_champion_records')
          .update(updateData)
          .eq('id', existingData.id);

        if (updateError) {
          console.error('장원 기록 업데이트 실패:', updateError);
          return false;
        }
      } else {
        // 새 레코드 생성
        const insertData = {
          user_id: userId,
          school_code: schoolCode,
          grade: grade,
          year: year,
          month: month,
          week_1_champion: false,
          week_2_champion: false,
          week_3_champion: false,
          week_4_champion: false,
          week_5_champion: false,
          month_champion: false,
          ...updateData
        };

        const { error: insertError } = await this.supabase
          .from('user_champion_records')
          .insert(insertData);

        if (insertError) {
          console.error('장원 기록 생성 실패:', insertError);
          return false;
        }
      }

      console.log('장원 기록 저장 성공:', { userId, periodType, weekNumber });
      return true;
    } catch (error) {
      console.error('장원 기록 저장 오류:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스
const championCalculator = new ChampionCalculator();

module.exports = { ChampionCalculator, championCalculator };
