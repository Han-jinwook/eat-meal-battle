const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Champion Calculator import
const { ChampionCalculator } = require('./utils/championCalculator');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 환경변수 검증
if (!supabaseUrl) {
  const errorMsg = 'SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.';
  throw new Error(errorMsg);
}

if (!supabaseServiceKey) {
  const errorMsg = 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.';
  throw new Error(errorMsg);
}

const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 유저 퀴즈 가져오기
async function getUserQuiz(userId, schoolCode, grade, requestedDate) {
  // 유저 학교 정보 확인
  if (!schoolCode || !grade) {
    const { data: userSchool, error: userSchoolError } = await supabaseClient
      .from('school_infos')
      .select('school_code, grade')
      .eq('user_id', userId)
      .single();

    if (userSchoolError) {
      return { error: "사용자의 학교 정보를 찾을 수 없습니다." };
    }
    
    schoolCode = userSchool.school_code;
    grade = userSchool.grade;
  }

  // 날짜 처리
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 한국 시간
  const currentHour = koreaTime.getUTCHours();
  const currentMinutes = koreaTime.getUTCMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinutes;
  
  // 시간 기준 (한국 시간)
  const showQuizTime = 12 * 60 + 30; // 12:30
  const showAnswerTime = 19 * 60;     // 19:00
  
  const quizDate = requestedDate || koreaTime.toISOString().split('T')[0]; // 기본값은 오늘 날짜
  const isToday = !requestedDate || requestedDate === koreaTime.toISOString().split('T')[0];
  
  // 오늘 날짜이고 12:30 이후인지 확인
  // 테스트 모드: 시간 제약 해제 (항상 퀴즈 표시)
  const canShowTodayQuiz = true; // !isToday || currentTimeMinutes >= showQuizTime;
  const canShowAnswer = !isToday || currentTimeMinutes >= showAnswerTime;
  
  // 급식 정보 확인
  const { data: mealData, error: mealError } = await supabaseClient
    .from('meal_menus')
    .select('id, menu_items')
    .eq('school_code', schoolCode)
    .eq('meal_date', quizDate)
    .limit(1);
    
  // 급식 정보가 없는 경우 (기본 에러 체크 및 "급식 정보가 없습니다" 텍스트 포함 여부 확인)
  if (mealError || !mealData || mealData.length === 0 || !mealData[0].menu_items ||
      (Array.isArray(mealData[0].menu_items) && mealData[0].menu_items.includes('급식 정보가 없습니다'))) {
    return {
      noMenu: true,
      message: '급식 정보가 없는 날이어서 급식퀴즈도 쉬어가요'
    };
  }
  
  // 해당 날짜의 퀴즈 조회
  const { data: dateQuiz, error: dateQuizError } = await supabaseClient
    .from('meal_quizzes')
    .select(`
      id,
      question,
      options,
      correct_answer,
      explanation,
      meal_date,
      meal_id,
      report_status,
      meal_menus(menu_items)
    `)
    .eq('school_code', schoolCode)
    .eq('grade', grade)
    .eq('meal_date', quizDate)
    .limit(1)
    .maybeSingle();
    
  if (dateQuizError) {
    return { error: "해당 날짜에 퀴즈를 가져오는 중 오류가 발생했습니다." };
  }

  if (!dateQuiz) {
    // 해당 날짜에 퀴즈가 없음
    return { quiz: null };
  }
  
  // 해당 날짜 퀴즈 찾았음
  return await processQuiz(userId, dateQuiz, canShowAnswer);
}

// 퀴즈 처리 함수 (정답 확인 시간에 따라 정보 제한)
async function processQuiz(userId, quiz, canShowAnswer) {
  // 이미 풀었는지 확인
  const { data: existing, error: existingError } = await supabaseClient
    .from('quiz_results')
    .select('id, is_correct, selected_option')
    .eq('user_id', userId)
    .eq('quiz_id', quiz.id)
    .limit(1);

  // 이미 풀었거나 정답 확인 시간 이후인 경우
  if ((existing && existing.length > 0) || canShowAnswer) {
    return {
      quiz: {
        id: quiz.id,
        question: quiz.question,
        options: quiz.options,
        correct_answer: canShowAnswer ? quiz.correct_answer : undefined, // 7시 이후에만 정답 제공
        explanation: canShowAnswer ? quiz.explanation : undefined,       // 7시 이후에만 해설 제공
        meal_date: quiz.meal_date,
        report_status: quiz.report_status || 'none',
        menu_items: quiz.meal_menus?.menu_items || []
      },
      alreadyAnswered: existing && existing.length > 0,
      isCorrect: existing && existing.length > 0 ? existing[0].is_correct : undefined,
      selectedOption: existing && existing.length > 0 ? existing[0].selected_option : undefined
    };
  }

  // 정답은 반환하지 않음 (정답 확인 시간 이전)
  return {
    quiz: {
      id: quiz.id,
      question: quiz.question,
      options: quiz.options,
      meal_date: quiz.meal_date,
      report_status: quiz.report_status || 'none',
      menu_items: quiz.meal_menus?.menu_items || []
    },
    alreadyAnswered: false
  };
}

// 퀴즈 답변 제출 함수
async function submitQuizAnswer(userId, quizId, selectedOption) {
  console.log('[quiz] submitQuizAnswer 시작:', { userId, quizId, selectedOption });
  
  try {
    // 퀴즈 정보 조회
    console.log('[quiz] 퀴즈 정보 조회 중...', { quizId });
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('meal_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
      
    console.log('[quiz] 퀴즈 조회 결과:', { quiz: quiz ? 'found' : 'not found', quizError });
    if (quizError || !quiz) {
      console.log('[quiz] 퀴즈 조회 실패:', quizError);
      return { error: '퀴즈를 찾을 수 없습니다.' };
    }
    
    // 중복방지는 프론트엔드에서 처리 (UI 차단)
    
    // 정답 확인 (0-based index)
    const isCorrect = selectedOption === quiz.correct_answer;
    console.log('[quiz] 정답 확인:', { selectedOption, correctAnswer: quiz.correct_answer, isCorrect });
    
    // 답변 저장 데이터 준비
    const insertData = {
      user_id: userId,
      quiz_id: quizId,
      selected_option: selectedOption,
      is_correct: isCorrect,
      created_at: new Date().toISOString()
    };
    console.log('[quiz] 저장할 데이터:', insertData);
    
    // 답변 저장
    console.log('[quiz] quiz_results 테이블에 저장 시도...');
    const { data: result, error: saveError } = await supabaseAdmin
      .from('quiz_results')
      .insert(insertData)
      .select()
      .single();
      
    console.log('[quiz] 저장 결과:', { result, saveError });
    if (saveError) {
      console.log('[quiz] 저장 실패 상세:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint
      });
      return { error: '답변 저장에 실패했습니다.' };
    }
    
    // 퀴즈 날짜 기반으로 월, 연도, 주차, 일별 계산
    const quizDate = new Date(quiz.meal_date);
    const month = quizDate.getMonth() + 1; // JavaScript의 월은 0부터 시작하므로 +1
    const year = quizDate.getFullYear();
    
    // ISO 주차 계산 (월요일 기준)
    function getISOWeek(date) {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target) / 604800000);
    }
    
    // 월 내 주차 계산 (1-6) - ISO 기준: 해당 월의 첫 월요일부터 1주차
    function getWeekOfMonth(date) {
      const year = date.getFullYear();
      const month = date.getMonth();
      
      // 해당 월의 첫 월요일 찾기
      let firstMonday = new Date(year, month, 1);
      while (firstMonday.getDay() !== 1) { // 1 = 월요일
        firstMonday.setDate(firstMonday.getDate() + 1);
      }
      
      // 첫 월요일 이전 날짜들은 이전 달의 마지막 주차에 속함
      if (date < firstMonday) {
        // 이전 달의 첫 월요일 찾기
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        let prevFirstMonday = new Date(prevYear, prevMonth, 1);
        while (prevFirstMonday.getDay() !== 1) {
          prevFirstMonday.setDate(prevFirstMonday.getDate() + 1);
        }
        
        const diffTime = date.getTime() - prevFirstMonday.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.min(Math.floor(diffDays / 7) + 1, 5);
      }
      
      const diffTime = date.getTime() - firstMonday.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.min(Math.floor(diffDays / 7) + 1, 5);
    }
    
    // 일별 필드 계산 (day_1 ~ day_31) - 실제 날짜 기준
    function getDayField(date) {
      const dayOfMonth = date.getDate(); // 1~31
      return `day_${dayOfMonth}`;
    }
    
    // 실제 속해야 할 월/년 계산 (ISO 주차 기준)
    function getActualMonthYear(date) {
      const year = date.getFullYear();
      const month = date.getMonth();
      
      // 해당 월의 첫 월요일 찾기
      let firstMonday = new Date(year, month, 1);
      while (firstMonday.getDay() !== 1) {
        firstMonday.setDate(firstMonday.getDate() + 1);
      }
      
      // 첫 월요일 이전이면 이전 달에 속함
      if (date < firstMonday) {
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        return { month: prevMonth + 1, year: prevYear }; // 1-based month
      }
      
      return { month: month + 1, year }; // 1-based month
    }
    
    // 실제 달력 월/년 (기본 레코드용)
    const calendarMonth = month;
    const calendarYear = year;
    
    // ISO 주차 기준 월/년 (주차 업데이트용)
    const actualMonthYear = getActualMonthYear(quizDate);
    const weekOfMonth = getWeekOfMonth(quizDate);
    const dayField = getDayField(quizDate);
    const resultValue = isCorrect ? 'O' : 'X';
    
    console.log('[quiz] 집계 처리:', { 
      calendarMonth, calendarYear,
      isoWeekMonth: actualMonthYear.month, isoWeekYear: actualMonthYear.year,
      quiz_date: quiz.meal_date, 
      weekOfMonth, 
      dayField, 
      resultValue 
    });
    
    // 장원 테이블 업데이트 (없으면 생성) - 달력 월/년 기준
    console.log('[quiz] quiz_champions 업데이트 시작:', {
      userId,
      calendarMonth, calendarYear,
      dayField,
      resultValue,
      isCorrect
    });
    
    const { data: champion, error: championError } = await supabaseAdmin
      .from('quiz_champions')
      .select('id, month_correct, total_count')
      .eq('user_id', userId)
      .eq('month', calendarMonth)
      .eq('year', calendarYear)
      .limit(1);
    
    console.log('[quiz] quiz_champions 조회 결과:', { champion, championError });
    
    if (championError) {
      console.error('[quiz] quiz_champions 조회 오류:', championError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'quiz_champions 조회 실패' })
      };
    }
    
    if (champion && champion.length > 0) {
      // 기존 기록 업데이트 - 달력 월 기본 데이터만
      const currentRecord = champion[0];
      
      const updateData = {
        month_correct: currentRecord.month_correct + (isCorrect ? 1 : 0),
        total_count: currentRecord.total_count + 1,
        [dayField]: resultValue,
        // 주차 카운트는 ISO 주차 별도 처리에서 수행
        updated_at: new Date().toISOString()
      };
      
      console.log('[quiz] 기존 레코드 업데이트:', { currentRecord, updateData });
      
      const { data: updateResult, error: updateError } = await supabaseAdmin
        .from('quiz_champions')
        .update(updateData)
        .eq('id', currentRecord.id)
        .select();
    
      if (updateError) {
        console.error('[quiz] 장원 기록 업데이트 실패:', updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: '장원 기록 업데이트 실패' })
        };
      } else {
        console.log('[quiz] 장원 기록 업데이트 성공:', updateResult);
      }
    } else {
      // 새 기록 생성 - 달력 월 기본 데이터만
      const insertData = {
        user_id: userId,
        month: calendarMonth,
        year: calendarYear,
        month_correct: isCorrect ? 1 : 0,
        total_count: 1,
        [dayField]: resultValue,
        // 주차 카운트는 ISO 주차 별도 처리에서 수행
        created_at: new Date().toISOString()
      };
      
      console.log('[quiz] 새 레코드 생성:', insertData);
      
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('quiz_champions')
        .insert([insertData])
        .select();
    
      if (insertError) {
        console.error('[quiz] 장원 기록 생성 실패:', insertError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: '장원 기록 생성 실패' })
        };
      } else {
        console.log('[quiz] 장원 기록 생성 성공:', insertResult);
      }
    }
    
    // ISO 주차 별도 업데이트 (항상 수행)
    // 달력 월 레코드에는 주차 카운트를 넣지 않고, ISO 주차 레코드에만 주차 카운트 저장
    {
      console.log('[quiz] ISO 주차 별도 업데이트 필요:', {
        calendarMonth, calendarYear,
        isoWeekMonth: actualMonthYear.month, isoWeekYear: actualMonthYear.year,
        weekOfMonth
      });
      
      // ISO 주차 월 레코드 조회/생성
      const { data: isoChampion, error: isoChampionError } = await supabaseAdmin
        .from('quiz_champions')
        .select('id')
        .eq('user_id', userId)
        .eq('month', actualMonthYear.month)
        .eq('year', actualMonthYear.year)
        .limit(1);
      
      if (isoChampionError) {
        console.error('[quiz] ISO 주차 레코드 조회 오류:', isoChampionError);
      } else if (isoChampion && isoChampion.length > 0) {
        // 기존 ISO 주차 레코드 업데이트 - 현재 값 조회 후 증가
        const weekField = `week_${weekOfMonth}_correct`;
        
        // 현재 값 조회
        const { data: currentRecord, error: currentError } = await supabaseAdmin
          .from('quiz_champions')
          .select(weekField)
          .eq('id', isoChampion[0].id)
          .single();
        
        if (currentError) {
          console.error('[quiz] ISO 주차 현재 값 조회 실패:', currentError);
        } else {
          const currentValue = currentRecord[weekField] || 0;
          const newValue = currentValue + (isCorrect ? 1 : 0);
          
          const { data: isoUpdateResult, error: isoUpdateError } = await supabaseAdmin
            .from('quiz_champions')
            .update({
              [weekField]: newValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', isoChampion[0].id)
            .select();
          
          if (isoUpdateError) {
            console.error('[quiz] ISO 주차 레코드 업데이트 실패:', isoUpdateError);
          } else {
            console.log('[quiz] ISO 주차 레코드 업데이트 성공:', { currentValue, newValue, result: isoUpdateResult });
          }
        }
      } else {
        // 새 ISO 주차 레코드 생성
        const weekField = `week_${weekOfMonth}_correct`;
        const isoInsertData = {
          user_id: userId,
          month: actualMonthYear.month,
          year: actualMonthYear.year,
          month_correct: 0, // 기본 집계는 달력 월에서 처리
          total_count: 0,   // 기본 집계는 달력 월에서 처리
          [weekField]: isCorrect ? 1 : 0, // 주차 정답수만 업데이트
          created_at: new Date().toISOString()
        };
        
        const { data: isoInsertResult, error: isoInsertError } = await supabaseAdmin
          .from('quiz_champions')
          .insert([isoInsertData])
          .select();
        
        if (isoInsertError) {
          console.error('[quiz] ISO 주차 레코드 생성 실패:', isoInsertError);
        } else {
          console.log('[quiz] ISO 주차 레코드 생성 성공:', isoInsertResult);
        }
      }
    }
    
    // 장원 상태 체크 및 기록 (ChampionCalculator 호출)
    try {
      console.log('[quiz] 장원 상태 체크 시작:', { userId, schoolCode: quiz.school_code, grade: quiz.grade });
      
      // 사용자 학교 정보 조회 (quiz 테이블에 school_code, grade가 없을 경우)
      let userSchoolCode = quiz.school_code;
      let userGrade = quiz.grade;
      
      if (!userSchoolCode || !userGrade) {
        const { data: userSchool, error: userSchoolError } = await supabaseAdmin
          .from('school_infos')
          .select('school_code, grade')
          .eq('user_id', userId)
          .single();
        
        if (!userSchoolError && userSchool) {
          userSchoolCode = userSchool.school_code;
          userGrade = userSchool.grade;
        }
      }
      
      if (userSchoolCode && userGrade) {
        const championCalculator = new ChampionCalculator(supabaseAdmin);
        await championCalculator.checkChampionStatusOnQuizSubmit(
          userId,
          userSchoolCode,
          userGrade,
          year,
          month,
          weekOfMonth
        );
        console.log('[quiz] 장원 상태 체크 완료');
      } else {
        console.log('[quiz] 사용자 학교 정보 부족으로 장원 체크 건너뜀');
      }
    } catch (championError) {
      console.error('[quiz] 장원 상태 체크 중 오류 (무시하고 계속):', championError);
    }
    
    console.log('[quiz] submitQuizAnswer 성공!');
    return {
      success: true,
      isCorrect: isCorrect,
      correctAnswer: quiz.correct_answer,
      explanation: quiz.explanation,
      selectedOption: selectedOption
    };
    
  } catch (error) {
    console.log('[quiz] submitQuizAnswer 예외 발생:', error);
    return { error: '답변 제출 중 오류가 발생했습니다.' };
  }
}

// 오답 신고 처리 함수
async function submitQuizReport(userId, quizId, reason) {
  console.log('[quiz] submitQuizReport 시작:', { userId, quizId, reason });
  
  try {
    // 퀴즈 정보 조회
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('meal_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
      
    if (quizError || !quiz) {
      console.log('[quiz] 퀴즈 조회 실패:', quizError);
      return { error: '퀴즈를 찾을 수 없습니다.' };
    }
    
    // 이미 신고된 퀴즈인지 확인
    if (quiz.report_status && quiz.report_status !== 'none') {
      return { error: '이미 신고가 접수된 퀴즈입니다.' };
    }
    
    // 사용자가 이미 이 퀴즈를 신고했는지 확인
    const { data: existingReport } = await supabaseAdmin
      .from('quiz_reports')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('reporter_user_id', userId)
      .limit(1);
      
    if (existingReport && existingReport.length > 0) {
      return { error: '이미 신고하신 퀴즈입니다.' };
    }
    
    // 신고 접수 - 먼저 퀴즈 상태를 pending으로 변경
    const { error: statusUpdateError } = await supabaseAdmin
      .from('meal_quizzes')
      .update({ report_status: 'pending' })
      .eq('id', quizId);
      
    if (statusUpdateError) {
      console.error('[quiz] 퀴즈 상태 업데이트 실패:', statusUpdateError);
      return { error: '신고 접수 중 오류가 발생했습니다.' };
    }
    
    // 신고 레코드 생성
    const { data: reportRecord, error: reportError } = await supabaseAdmin
      .from('quiz_reports')
      .insert({
        quiz_id: quizId,
        reporter_user_id: userId,
        report_reason: reason || '오답 가능성 신고',
        status: 'pending'
      })
      .select()
      .single();
      
    if (reportError) {
      console.error('[quiz] 신고 레코드 생성 실패:', reportError);
      // 퀴즈 상태 롤백
      await supabaseAdmin
        .from('meal_quizzes')
        .update({ report_status: 'none' })
        .eq('id', quizId);
      return { error: '신고 접수 중 오류가 발생했습니다.' };
    }
    
    // AI 자동 검증 수행
    console.log('[quiz] AI 검증 시작...');
    try {
      const verificationResult = await verifyQuizWithAI(quiz);
      console.log('[quiz] AI 검증 완료:', verificationResult);
      
      // 검증 결과에 따라 퀴즈 상태 업데이트
      let finalStatus;
      if (verificationResult.isCorrect) {
        finalStatus = 'verified_correct';
      } else {
        finalStatus = 'verified_incorrect';
        // 오답 확정 시 모든 사용자 정답 처리
        await compensateAllUsersForIncorrectQuiz(quizId);
      }
      
      // 퀴즈 상태 업데이트
      await supabaseAdmin
        .from('meal_quizzes')
        .update({ report_status: finalStatus })
        .eq('id', quizId);
      
      // 신고 레코드에 AI 검증 결과 저장
      await supabaseAdmin
        .from('quiz_reports')
        .update({
          status: 'processed',
          ai_verification_result: verificationResult
        })
        .eq('id', reportRecord.id);
        
    } catch (aiError) {
      console.error('[quiz] AI 검증 실패:', aiError);
      // AI 검증 실패 시 보수적으로 정답으로 처리
      await supabaseAdmin
        .from('meal_quizzes')
        .update({ report_status: 'verified_correct' })
        .eq('id', quizId);
    }
    
    console.log('[quiz] submitQuizReport 성공!');
    return {
      success: true,
      message: '신고가 접수되었습니다. AI가 검증 중입니다...',
      reportId: reportRecord.id
    };
    
  } catch (error) {
    console.error('[quiz] submitQuizReport 예외 발생:', error);
    return { error: '신고 처리 중 오류가 발생했습니다.' };
  }
}

// AI를 통한 퀴즈 검증 함수
async function verifyQuizWithAI(quiz) {
  console.log('[quiz] verifyQuizWithAI 시작:', quiz.id);
  
  try {
    const prompt = `
다음 퀴즈의 정답이 올바른지 검증해주세요.

퀴즈 정보:
- 문제: ${quiz.question}
- 선택지: ${JSON.stringify(quiz.options)}
- 정답: ${quiz.correct_answer}번 (${quiz.options[quiz.correct_answer - 1]})
- 해설: ${quiz.explanation}

검증 기준:
1. 정답이 과학적으로 정확한가?
2. 해설이 논리적이고 사실에 기반하는가?
3. 선택지 중에서 정답이 가장 적절한가?
4. 문제에 오해의 소지가 없는가?

다음 JSON 형식으로 응답해주세요:
{
  "isCorrect": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "검증 근거 설명",
  "issues": ["발견된 문제점들"]
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '당신은 교육 전문가이자 사실 검증 전문가입니다. 퀴즈의 정답과 해설을 엄격하게 검증하여 학생들에게 올바른 정보를 제공하는 것이 목표입니다.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('[quiz] AI 응답:', aiResponse);
    
    // JSON 파싱 시도
    try {
      const result = JSON.parse(aiResponse);
      return {
        isCorrect: result.isCorrect,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'AI 검증 완료',
        issues: result.issues || [],
        rawResponse: aiResponse
      };
    } catch (parseError) {
      console.error('[quiz] AI 응답 JSON 파싱 실패:', parseError);
      // 파싱 실패 시 보수적으로 정답으로 처리
      return {
        isCorrect: true,
        confidence: 0.5,
        reasoning: 'AI 응답 파싱 실패로 인한 보수적 판단',
        issues: ['JSON 파싱 실패'],
        rawResponse: aiResponse
      };
    }
    
  } catch (error) {
    console.error('[quiz] AI 검증 예외 발생:', error);
    throw error;
  }
}

// 오답 확정 시 모든 사용자 정답 처리 함수
async function compensateAllUsersForIncorrectQuiz(quizId) {
  console.log('[quiz] compensateAllUsersForIncorrectQuiz 시작:', quizId);
  
  try {
    // 해당 퀴즈를 푼 모든 사용자 조회
    const { data: quizResults, error: resultsError } = await supabaseAdmin
      .from('quiz_results')
      .select('*')
      .eq('quiz_id', quizId);
      
    if (resultsError) {
      console.error('[quiz] 퀴즈 결과 조회 실패:', resultsError);
      return;
    }
    
    if (!quizResults || quizResults.length === 0) {
      console.log('[quiz] 해당 퀴즈를 푼 사용자가 없음');
      return;
    }
    
    console.log(`[quiz] ${quizResults.length}명의 사용자 결과를 정답으로 변경`);
    
    // 모든 결과를 정답으로 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('quiz_results')
      .update({ is_correct: true })
      .eq('quiz_id', quizId);
      
    if (updateError) {
      console.error('[quiz] 퀴즈 결과 업데이트 실패:', updateError);
      return;
    }
    
    // 각 사용자의 장원 통계 재계산
    for (const result of quizResults) {
      if (!result.is_correct) { // 원래 틀렸던 사용자들만 처리
        console.log(`[quiz] 사용자 ${result.user_id} 장원 통계 재계산`);
        
        // 퀴즈 날짜로부터 년월 계산
        const quizDate = new Date(result.created_at);
        const year = quizDate.getFullYear();
        const month = quizDate.getMonth() + 1;
        
        // 사용자 정보 조회
        const { data: userInfo } = await supabaseAdmin
          .from('school_infos')
          .select('school_code, grade')
          .eq('user_id', result.user_id)
          .single();
          
        if (userInfo) {
          // ChampionCalculator 호출하여 통계 재계산
          const ChampionCalculator = require('./champion-calculator');
          await ChampionCalculator.updateChampionStatus(
            result.user_id,
            userInfo.school_code,
            userInfo.grade,
            supabaseAdmin
          );
        }
      }
    }
    
    console.log('[quiz] 모든 사용자 보상 처리 완료');
    
  } catch (error) {
    console.error('[quiz] compensateAllUsersForIncorrectQuiz 예외 발생:', error);
  }
}

// API 핸들러
exports.handler = async function(event, context) {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight response' })
    };
  }

  // 토큰에서 사용자 ID 추출
  let userId;
  try {
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    // JWT 토큰 검증 (Supabase 서비스 역할 키 사용)
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '인증되지 않은 요청입니다.' })
      };
    }
    
    userId = user.id;
  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: '인증 처리 중 오류가 발생했습니다.' })
    };
  }

  // 요청 경로와 메서드에 따라 처리
  const path = event.path.replace('/.netlify/functions/quiz', '');
  const pathSegments = path.split('/').filter(segment => segment);
  const method = event.httpMethod;

  try {
    // 쿼리 파라미터 파싱
    const params = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    // GET /quiz - 사용자의 오늘 퀴즈 가져오기
    if (method === 'GET' && (!pathSegments.length || pathSegments[0] === '')) {
      const result = await getUserQuiz(userId, params.school_code, params.grade, params.date);
      
      return {
        statusCode: result.error ? 404 : 200,
        headers,
        body: JSON.stringify(result)
      };
    }
    
    // POST /quiz - 퀴즈 생성
    if (method === 'POST' && (!pathSegments.length || pathSegments[0] === '')) {
      const { school_code, grade, date } = body;
      
      if (!school_code || !grade || !date) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '학교 코드, 학년, 날짜가 필요합니다.' })
        };
      }
      
      try {
        // 퀴즈 생성 로직을 직접 구현
        // 이미 해당 날짜에 퀴즈가 존재하는지 확인
        const { data: existingQuiz } = await supabaseAdmin
          .from('meal_quizzes')
          .select('id, meal_date')
          .eq('school_code', school_code)
          .eq('grade', grade)
          .eq('meal_date', date)
          .limit(1);
          
        if (existingQuiz && existingQuiz.length > 0) {
          // 기존 퀴즈 조회해서 반환
          const result = await getUserQuiz(userId, school_code, grade, date);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
          };
        }
        
        // 급식 메뉴 정보 조회
        const { data: mealData, error: mealError } = await supabaseAdmin
          .from('meal_menus')
          .select('*')
          .eq('school_code', school_code)
          .eq('meal_date', date)
          .limit(1);
          
        if (mealError || !mealData || mealData.length === 0 || !mealData[0].menu_items ||
            (Array.isArray(mealData[0].menu_items) && mealData[0].menu_items.includes('급식 정보가 없습니다'))) {
          // 급식 정보가 없는 경우
          const message = '급식 정보가 없는 날이어서 급식퀴즈도 쉬어가요';
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              noMenu: true,
              message: message,
              date: date
            })
          };
        }
        
        const meal = mealData[0];
        
        // OpenAI 기반 퀴즈 생성 (최대 3회 재시도)
        const { generateQuizWithAI } = require('./manual-generate-meal-quiz');
        
        let generatedQuiz = null;
        let lastError = null;
        const MAX_RETRIES = 3;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            generatedQuiz = await generateQuizWithAI(meal, grade, userId);
            break; // 성공하면 루프 종료
          } catch (error) {
            console.error(`[quiz] 퀴즈 생성 시도 ${attempt} 실패:`, error.message);
            lastError = error;
            
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기 후 재시도
            }
          }
        }
        
        // 모든 재시도 후에도 실패한 경우
        if (!generatedQuiz) {
          console.error(`[quiz] 모든 시도(${MAX_RETRIES}회) 후 퀴즈 생성 실패`);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: '퀴즈 생성을 실패했습니다. 다시 시도해주세요.',
              details: lastError?.message || '최대 시도 횟수 초과'
            })
          };
        }
        
        // DB에 퀴즈 저장
        const { data: savedQuiz, error: saveError } = await supabaseAdmin
          .from('meal_quizzes')
          .insert({
            school_code: school_code,
            grade: grade,
            meal_date: date,
            meal_id: meal.id,
            question: generatedQuiz.question,
            options: generatedQuiz.options,
            correct_answer: generatedQuiz.correct_answer,
            explanation: generatedQuiz.explanation
          })
          .select()
          .single();

        if (saveError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '퀴즈를 저장하는 중 오류가 발생했습니다.' })
          };
        }
        
        // 생성 후 퀴즈 조회
        const result = await getUserQuiz(userId, school_code, grade, date);
        
        return {
          statusCode: result.error ? 404 : 200,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '퀴즈 생성 중 오류가 발생했습니다: ' + error.message })
        };
      }
    }
    
    // POST /quiz/answer - 퀴즈 답변 제출
    if (method === 'POST' && pathSegments[0] === 'answer') {
      // 디버깅 로그 - 서버가 받은 요청 정보 출력
      console.log('[quiz] POST /quiz/answer 요청 받음');
      console.log('[quiz] 받은 요청 정보:', {
        method,
        path: event.path,
        pathSegments,
        headers: event.headers,
        body: event.body,
        userId
      });
      
      const { quiz_id, selected_option } = body;
      
      // 디버깅 로그 - 파싱된 파라미터 확인
      console.log('[quiz] 파싱된 파라미터:', {
        quiz_id,
        selected_option,
        quiz_id_type: typeof quiz_id,
        selected_option_type: typeof selected_option
      });
      
      if (!quiz_id || selected_option === undefined) {
        // 디버깅 로그 - 파라미터 검증 실패 원인 로그
        console.log('[quiz] 필수 파라미터 누락:', {
          quiz_id_missing: !quiz_id,
          selected_option_missing: selected_option === undefined
        });
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '필수 파라미터가 누락되었습니다.' })
        };
      }
      
      console.log('[quiz] submitQuizAnswer 호출 전 - 파라미터 검증 완료');
      console.log('[quiz] 함수 호출 파라미터:', { userId, quiz_id, selected_option });
      
      let result;
      try {
        console.log('[quiz] submitQuizAnswer 함수 호출 시작...');
        result = await submitQuizAnswer(userId, quiz_id, selected_option);
        console.log('[quiz] submitQuizAnswer 함수 호출 완료, 결과:', result);
      } catch (error) {
        console.error('[quiz] submitQuizAnswer 함수 호출 중 예외 발생:', error);
        console.error('[quiz] 예외 스택:', error.stack);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '퀴즈 답안 제출 중 오류가 발생했습니다.', details: error.message })
        };
      }
      
      return {
        statusCode: result.error ? 400 : 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // POST /quiz/report - 오답 신고
    if (method === 'POST' && pathSegments[0] === 'report') {
      console.log('[quiz] POST /quiz/report 요청 받음');
      
      const { quiz_id, reason } = body;
      
      if (!quiz_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'quiz_id가 필요합니다.' })
        };
      }
      
      try {
        const result = await submitQuizReport(userId, quiz_id, reason);
        return {
          statusCode: result.error ? 400 : 200,
          headers,
          body: JSON.stringify(result)
        };
      } catch (error) {
        console.error('[quiz] 오답 신고 처리 중 예외 발생:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '오답 신고 처리 중 오류가 발생했습니다.', details: error.message })
        };
      }
    }

    // 지원하지 않는 엔드포인트
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: '요청한 엔드포인트를 찾을 수 없습니다.' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류가 발생했습니다.' })
    };
  }
};
