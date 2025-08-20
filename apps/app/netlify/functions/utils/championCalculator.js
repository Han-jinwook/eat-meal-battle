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
      
      // school_champions 테이블도 자동 업데이트
      await this.updateSchoolChampions(userId, year, month, weekNumber);
      
      return true;
    } catch (error) {
      console.error('장원 기록 저장 오류:', error);
      return false;
    }
  }

  /**
   * school_champions 테이블 자동 업데이트
   */
  async updateSchoolChampions(userId, year, month, weekNumber = null) {
    try {
      console.log(`Updating school champions for ${userId}, ${year}-${month}, week: ${weekNumber}`);
      
      // 1. 유저 정보 가져오기
      const { data: userInfo, error: userError } = await this.supabase
        .from('school_infos')
        .select('school_code, grade, class_number')
        .eq('user_id', userId)
        .single();
        
      if (userError || !userInfo) {
        console.error('Error fetching user school info:', userError);
        return false;
      }
      
      const { school_code, grade, class_number } = userInfo;
      if (class_number < 1 || class_number > 15) {
        console.error(`Invalid class number: ${class_number}`);
        return false;
      }
      
      // 2. 해당 학교/학년/반의 장원 수 집계
      let whereClause = {
        school_code,
        grade,
        year,
        month
      };
      
      let championField;
      if (weekNumber !== null) {
        championField = `week_${weekNumber}_champion`;
      } else {
        championField = 'month_champion';
      }
      
      // user_champion_records와 school_infos 조인하여 해당 반의 장원 수 계산
      const { data: championData, error: championError } = await this.supabase
        .from('user_champion_records')
        .select(`
          *,
          school_infos!inner(class_number)
        `)
        .eq('school_code', school_code)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .eq(championField, true)
        .eq('school_infos.class_number', class_number);
        
      if (championError) {
        console.error('Error counting champions:', championError);
        return false;
      }
      
      const championCount = championData?.length || 0;
      
      // 3. school_champions 테이블에서 기존 데이터 조회
      const { data: existingData, error: existingError } = await this.supabase
        .from('school_champions')
        .select('*')
        .eq('school_code', school_code)
        .eq('grade', grade)
        .eq('year', year)
        .eq('month', month)
        .eq('week_number', weekNumber)
        .single();
        
      // 4. 업데이트할 데이터 준비
      const classField = `class_${class_number}`;
      let updatePayload = {};
      updatePayload[classField] = championCount;
      
      // 학년 총합 계산
      let gradeTotal = championCount;
      if (existingData) {
        // 기존 데이터가 있으면 다른 반들의 합계 계산
        for (let i = 1; i <= 15; i++) {
          if (i !== class_number) {
            const fieldName = `class_${i}`;
            gradeTotal += (existingData[fieldName] || 0);
          }
        }
      }
      updatePayload.grade_total = gradeTotal;
      
      // 5. UPSERT 수행
      const upsertData = {
        school_code,
        grade,
        year,
        month,
        week_number: weekNumber,
        ...updatePayload
      };
      
      const { error: upsertError } = await this.supabase
        .from('school_champions')
        .upsert(upsertData, {
          onConflict: 'school_code,year,month,week_number,grade'
        });
        
      if (upsertError) {
        console.error('Error updating school champions:', upsertError);
        return false;
      }
      
      console.log(`Successfully updated school champions for ${school_code}, grade ${grade}, class ${class_number}, ${year}-${month}, week ${weekNumber}`);
      return true;
      
    } catch (err) {
      console.error('Unexpected error in updateSchoolChampions:', err);
      return false;
    }
  }
}

// 싱글톤 인스턴스
const championCalculator = new ChampionCalculator();

module.exports = { ChampionCalculator, championCalculator };
