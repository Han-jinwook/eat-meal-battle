const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 오늘 날짜 (한국 시간)
function getTodayKST() {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreaTime.toISOString().split('T')[0];
}

// 시뮬레이션 계정 조회
async function getSimulationAccounts() {
  const { data: accounts, error } = await supabaseAdmin
    .from('users')
    .select(`
      id,
      nickname,
      email,
      school_infos (
        school_code,
        school_name,
        grade,
        class_number
      )
    `)
    .like('email', '%@simulation.test')
    .not('school_infos', 'is', null);

  if (error) {
    console.error('[quiz-activity] 시뮬레이션 계정 조회 오류:', error);
    throw new Error('시뮬레이션 계정을 조회할 수 없습니다.');
  }

  return accounts.filter(account => account.school_infos);
}

// 오늘 퀴즈 조회 (단순 버전)
async function getTodayQuizzes() {
  const today = getTodayKST();
  
  const { data: quizzes, error } = await supabaseAdmin
    .from('meal_quizzes')
    .select(`
      id,
      school_code,
      grade,
      meal_id,
      question,
      options,
      correct_answer,
      explanation,
      created_at
    `)
    .eq('meal_date', today);

  if (error) {
    console.error('[quiz-activity] 오늘 퀴즈 조회 오류:', error);
    throw new Error('오늘 퀴즈를 조회할 수 없습니다.');
  }

  return quizzes || [];
}

// 퀴즈 정답률 계산 (학교별 1~2명은 100% 맞추도록 조정)
function calculateQuizCorrectRate(nickname, grade, isTopStudent = false) {
  // 1~2명의 우수 학생은 항상 100% 정답
  if (isTopStudent) {
    return 1.0;
  }
  
  // 닉네임을 시드로 사용하여 일관된 성향 생성
  const seed = nickname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (seed * 9301 + 49297) % 233280;
  const normalizedRandom = random / 233280;
  
  // 기본 정답률 (학년별)
  let baseCorrectRate = 0.6; // 60% 기본
  if (grade <= 6) baseCorrectRate = 0.5;      // 초등학생 50%
  else if (grade <= 9) baseCorrectRate = 0.65; // 중학생 65%
  else baseCorrectRate = 0.75;                 // 고등학생 75%
  
  // 개인 성향 반영
  const personalityTypes = [
    'smart',      // 똑똑한 타입 (+15%)
    'average',    // 평범한 타입 (기본)
    'struggling', // 어려워하는 타입 (-20%)
    'lucky',      // 운이 좋은 타입 (+10%)
    'careless'    // 실수가 많은 타입 (-15%)
  ];
  
  const typeIndex = Math.floor(normalizedRandom * personalityTypes.length);
  const personalityType = personalityTypes[typeIndex];
  
  switch (personalityType) {
    case 'smart':
      baseCorrectRate += 0.15;
      break;
    case 'struggling':
      baseCorrectRate -= 0.2;
      break;
    case 'lucky':
      baseCorrectRate += 0.1;
      break;
    case 'careless':
      baseCorrectRate -= 0.15;
      break;
    default:
      // average - 변화 없음
      break;
  }
  
  // 최종 정답률을 0-1 범위로 제한
  return Math.max(0.1, Math.min(0.9, baseCorrectRate));
}

// 오답 신고 시뮬레이션 (기존 프롬프트 사용)
async function simulateWrongAnswerReport(student, quiz) {
  try {
    console.log(`[quiz-activity] ${student.nickname} 오답 신고 시뮬레이션`);
    
    // 기존 프롬프트와 동일한 설정으로 오답 신고 생성
    const { OpenAI } = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    const reportPrompt = `다음 퀴즈에 대한 오답 신고를 검토해주세요:

문제: ${quiz.question}
선택지: ${quiz.options.join(', ')}
정답: ${quiz.options[quiz.correct_answer]}
해설: ${quiz.explanation}

이 퀴즈의 출제 내용을 종합적으로 검증하여 오답 신고가 타당한지 판단해주세요.

다음 JSON 형식으로 응답해주세요:
{
  "isCorrect": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "검증 결과 설명"
}`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '당신은 교육 전문가이자 출제 검증 전문가입니다. 퀴즈의 출제 내용을 종합적으로 검증하여 학생들에게 올바른 교육 콘텐츠를 제공하는 것이 목표입니다.'
          },
          {
            role: 'user',
            content: reportPrompt
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
    
    // JSON 파싱
    const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanResponse);
    
    // quiz_reports 테이블에 저장
    const { error: reportError } = await supabaseAdmin
      .from('quiz_reports')
      .insert({
        quiz_id: quiz.id,
        reporter_id: student.id,
        report_reason: '오답 의심',
        report_details: result.reasoning,
        ai_verification: {
          isCorrect: result.isCorrect,
          confidence: result.confidence,
          reasoning: result.reasoning
        },
        status: result.isCorrect ? 'resolved' : 'pending',
        created_at: new Date().toISOString()
      });
    
    if (reportError) {
      console.error(`[quiz-activity] 오답 신고 저장 실패:`, reportError);
      return null;
    }
    
    console.log(`[quiz-activity] ${student.nickname} 오답 신고 완료: ${result.isCorrect ? '타당하지 않음' : '타당함'}`);
    return result;
    
  } catch (error) {
    console.error(`[quiz-activity] 오답 신고 시뮬레이션 오류:`, error);
    return null;
  }
}

// 퀴즈 풀이 시뮬레이션
async function simulateQuizSolving(student, quiz, isTopStudent = false) {
  try {
    // 이미 풀었는지 확인
    const { data: existingResult } = await supabaseAdmin
      .from('quiz_results')
      .select('id')
      .eq('user_id', student.id)
      .eq('quiz_id', quiz.id)
      .limit(1);

    if (existingResult && existingResult.length > 0) {
      console.log(`[quiz-activity] ${student.nickname}은 이미 퀴즈 ${quiz.id}를 풀었음`);
      return null;
    }

    // 정답률 계산 (우수 학생은 100% 정답)
    const correctRate = calculateQuizCorrectRate(student.nickname, student.school_infos.grade, isTopStudent);
    const isCorrect = Math.random() < correctRate;
    
    // 정답이면 정답 선택, 오답이면 랜덤 오답 선택
    let selectedOption;
    if (isCorrect) {
      selectedOption = quiz.correct_answer;
    } else {
      // 정답이 아닌 다른 선택지 중에서 랜덤 선택
      const wrongOptions = [];
      for (let i = 0; i < quiz.options.length; i++) {
        if (i !== quiz.correct_answer) {
          wrongOptions.push(i);
        }
      }
      selectedOption = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
    }

    // 퀴즈 결과 저장
    const { error: resultError } = await supabaseAdmin
      .from('quiz_results')
      .insert({
        user_id: student.id,
        quiz_id: quiz.id,
        selected_option: selectedOption,
        is_correct: isCorrect,
        created_at: new Date().toISOString()
      });

    if (resultError) {
      console.error(`[quiz-activity] 퀴즈 결과 저장 실패 (${student.nickname}):`, resultError);
      return null;
    }

    console.log(`[quiz-activity] ${student.nickname}: 퀴즈 ${quiz.id} ${isCorrect ? '정답' : '오답'} (선택: ${selectedOption})`);
    return {
      student_nickname: student.nickname,
      quiz_id: quiz.id,
      selected_option: selectedOption,
      is_correct: isCorrect,
      correct_rate: correctRate
    };

  } catch (error) {
    console.error(`[quiz-activity] 퀴즈 풀이 시뮬레이션 오류 (${student.nickname}):`, error);
    return null;
  }
}

// 하교 후 퀴즈 풀이 시뮬레이션 메인 함수
async function simulateQuizActivity() {
  console.log('[quiz-activity] 하교 후 퀴즈 풀이 시뮬레이션 시작');
  
  try {
    // 1. 시뮬레이션 계정들 조회
    const accounts = await getSimulationAccounts();
    if (accounts.length === 0) {
      throw new Error('시뮬레이션 계정이 없습니다. 먼저 가계정을 생성해주세요.');
    }

    console.log(`[quiz-activity] 시뮬레이션 계정 ${accounts.length}개 발견`);

    // 2. 오늘 퀴즈들 조회
    const todayQuizzes = await getTodayQuizzes();
    if (todayQuizzes.length === 0) {
      throw new Error('오늘 생성된 퀴즈가 없습니다. 먼저 점심시간 활동을 실행해주세요.');
    }

    console.log(`[quiz-activity] 오늘 퀴즈 ${todayQuizzes.length}개 발견`);

    const results = {
      total_students: accounts.length,
      total_quizzes: todayQuizzes.length,
      quiz_attempts: 0,
      correct_answers: 0,
      wrong_answers: 0,
      wrong_reports: 0,
      quiz_results: []
    };

    // 3. 학교/학년별로 우수 학생 선정 (1~2명)
    const topStudentsBySchoolGrade = {};
    
    accounts.forEach(student => {
      const key = `${student.school_infos.school_code}_${student.school_infos.grade}`;
      if (!topStudentsBySchoolGrade[key]) {
        topStudentsBySchoolGrade[key] = [];
      }
      topStudentsBySchoolGrade[key].push(student);
    });
    
    // 각 학교/학년별로 1~2명의 우수 학생 선정
    const topStudents = new Set();
    Object.values(topStudentsBySchoolGrade).forEach(students => {
      const topCount = Math.min(2, Math.max(1, Math.floor(students.length / 3))); // 1~2명
      for (let i = 0; i < topCount; i++) {
        const randomIndex = Math.floor(Math.random() * students.length);
        topStudents.add(students[randomIndex].id);
      }
    });
    
    console.log(`[quiz-activity] 우수 학생 ${topStudents.size}명 선정`);

    // 4. 각 학생이 자신의 학교/학년에 맞는 퀴즈들을 풀기
    for (const student of accounts) {
      // 시간 제약 확인
      if (!canStudentParticipate(student.school_infos.grade, currentTime)) {
        console.log(`[quiz-activity] ${student.nickname}: 현재 시간에 참여 불가`);
        continue;
      }
      
      // 학생의 학교/학년에 맞는 퀴즈 필터링
      const eligibleQuizzes = todayQuizzes.filter(quiz => 
        quiz.school_code === student.school_infos.school_code &&
        quiz.grade === student.school_infos.grade
      );

      if (eligibleQuizzes.length === 0) {
        console.log(`[quiz-activity] ${student.nickname}: 풀 수 있는 퀴즈 없음`);
        continue;
      }

      const isTopStudent = topStudents.has(student.id);
      console.log(`[quiz-activity] ${student.nickname}: ${eligibleQuizzes.length}개 퀴즈 도전 ${isTopStudent ? '(우수학생)' : ''}`);

      // 각 퀴즈에 도전
      for (const quiz of eligibleQuizzes) {
        const quizResult = await simulateQuizSolving(student, quiz, isTopStudent);
        if (quizResult) {
          results.quiz_attempts++;
          if (quizResult.is_correct) {
            results.correct_answers++;
          } else {
            results.wrong_answers++;
          }
          results.quiz_results.push(quizResult);
          
          // 50% 확률로 오답 신고 (틀린 학생 중에서)
          if (!quizResult.is_correct && Math.random() < 0.5) {
            const reportResult = await simulateWrongAnswerReport(student, quiz);
            if (reportResult) {
              results.wrong_reports++;
              results.quiz_results[results.quiz_results.length - 1].wrong_report = reportResult;
            }
          }
        }
      }
    }

    // 4. 통계 계산
    const accuracy = results.quiz_attempts > 0 
      ? Math.round((results.correct_answers / results.quiz_attempts) * 100) 
      : 0;

    console.log('[quiz-activity] 하교 후 퀴즈 풀이 시뮬레이션 완료');
    return {
      success: true,
      message: `하교 후 퀴즈 풀이 시뮬레이션이 완료되었습니다.`,
      results: {
        ...results,
        accuracy_percentage: accuracy
      }
    };

  } catch (error) {
    console.error('[quiz-activity] 하교 후 퀴즈 풀이 시뮬레이션 오류:', error);
    throw error;
  }
}

// Netlify 함수 핸들러
exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    console.log('[quiz-activity] Netlify 함수 시작');
    
    const result = await simulateQuizActivity();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[quiz-activity] Netlify 함수 오류:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || '하교 후 퀴즈 풀이 시뮬레이션 중 오류가 발생했습니다.',
      }),
    };
  }
};
