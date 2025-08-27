import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const school_code = searchParams.get('school_code');
    const grade = searchParams.get('grade');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '10');

    console.log('🔍 모든 퀴즈 조회 요청:', { school_code, grade, date, limit });

    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 퀴즈 조회 쿼리 구성 (meal_id 포함)
    let query = supabase
      .from('meal_quizzes')
      .select('*, meal_id')
      .order('created_at', { ascending: false });

    // 필터 적용
    if (school_code) {
      query = query.eq('school_code', school_code);
    }
    if (grade) {
      query = query.eq('grade', parseInt(grade));
    }
    if (date) {
      query = query.eq('meal_date', date);
    }

    // 제한 적용
    query = query.limit(limit);

    const { data: quizzes, error } = await query;

    if (error) {
      console.error('퀴즈 조회 오류:', error);
      return NextResponse.json({ error: '퀴즈 조회에 실패했습니다.' }, { status: 500 });
    }

    // 각 퀴즈에 대한 사용자 답변 정보 조회
    const quizzesWithUserAnswers = await Promise.all(
      (quizzes || []).map(async (quiz) => {
        // 사용자의 기존 답변 조회
        const { data: userAnswer } = await supabase
          .from('all_quiz_attempts')
          .select('selected_option, is_correct, attempted_at')
          .eq('user_id', user.id)
          .eq('quiz_id', quiz.id)
          .single();

        return {
          ...quiz,
          user_answer: userAnswer || null
        };
      })
    );

    console.log('✅ 퀴즈 조회 성공:', quizzesWithUserAnswers?.length, '개');

    return NextResponse.json({ 
      success: true, 
      quizzes: quizzesWithUserAnswers || [],
      count: quizzesWithUserAnswers?.length || 0
    });

  } catch (err) {
    console.error('모든 퀴즈 조회 API 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quiz_id, selected_option, answer_time, school_code, grade } = body;

    console.log('📝 모든 퀴즈 답안 제출:', { quiz_id, selected_option, answer_time, school_code, grade });

    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 퀴즈 정보 조회
    const { data: quiz, error: quizError } = await supabase
      .from('meal_quizzes')
      .select('*')
      .eq('id', quiz_id)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: '퀴즈를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 중복 제출 확인
    const { data: existingAttempt, error: duplicateError } = await supabase
      .from('all_quiz_attempts')
      .select('id')
      .eq('user_id', user.id)
      .eq('quiz_id', quiz_id)
      .single();

    if (existingAttempt) {
      return NextResponse.json({ error: '이미 답변한 퀴즈입니다.' }, { status: 400 });
    }

    // 정답 확인
    const is_correct = quiz.correct_answer === selected_option;

    // 답안 기록 저장
    const { error: attemptError } = await supabase
      .from('all_quiz_attempts')
      .insert({
        user_id: user.id,
        quiz_id,
        selected_option,
        is_correct,
        answer_time,
        school_code,
        grade: parseInt(grade)
      });

    if (attemptError) {
      console.error('답안 기록 저장 오류:', attemptError);
      return NextResponse.json({ error: '답안 저장에 실패했습니다.' }, { status: 500 });
    }

    // 일일 통계 업데이트
    const today = new Date().toISOString().split('T')[0];
    
    const { data: dailyStats, error: statsSelectError } = await supabase
      .from('all_quiz_daily_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (statsSelectError && statsSelectError.code !== 'PGRST116') {
      console.error('일일 통계 조회 오류:', statsSelectError);
    }

    if (dailyStats) {
      // 기존 통계 업데이트
      const newTotalAttempts = dailyStats.total_attempts + 1;
      const newCorrectAnswers = dailyStats.correct_answers + (is_correct ? 1 : 0);
      const newAccuracyRate = (newCorrectAnswers / newTotalAttempts) * 100;

      const { error: statsUpdateError } = await supabase
        .from('all_quiz_daily_stats')
        .update({
          total_attempts: newTotalAttempts,
          correct_answers: newCorrectAnswers,
          accuracy_rate: newAccuracyRate,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('date', today);

      if (statsUpdateError) {
        console.error('일일 통계 업데이트 오류:', statsUpdateError);
      }
    } else {
      // 새 통계 생성
      const { error: statsInsertError } = await supabase
        .from('all_quiz_daily_stats')
        .insert({
          user_id: user.id,
          date: today,
          total_attempts: 1,
          correct_answers: is_correct ? 1 : 0,
          accuracy_rate: is_correct ? 100 : 0
        });

      if (statsInsertError) {
        console.error('일일 통계 생성 오류:', statsInsertError);
      }
    }

    console.log('✅ 모든 퀴즈 답안 제출 완료:', { is_correct, quiz_id });

    return NextResponse.json({
      success: true,
      isCorrect: is_correct,
      correctAnswer: quiz.correct_answer,
      explanation: quiz.explanation
    });

  } catch (err) {
    console.error('모든 퀴즈 답안 제출 API 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
