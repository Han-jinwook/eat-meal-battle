import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// 퀴즈 가져오기 API
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolCode = searchParams.get('school_code');
    const grade = searchParams.get('grade');
    const date = searchParams.get('date');

    if (!schoolCode || !grade) {
      return NextResponse.json({ error: 'school_code와 grade가 필요합니다.' }, { status: 400 });
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
    
    const quizDate = date || koreaTime.toISOString().split('T')[0]; // 기본값은 오늘 날짜
    const isToday = !date || date === koreaTime.toISOString().split('T')[0];
    
    // 오늘 날짜이고 12:30 이후인지 확인
    const canShowTodayQuiz = !isToday || currentTimeMinutes >= showQuizTime;
    const canShowAnswer = !isToday || currentTimeMinutes >= showAnswerTime;

    let quiz = null;

    if (canShowTodayQuiz) {
      // 12:30 이후면 해당 날짜 퀴즈 가져오기 시도
      const { data: todayQuiz, error: todayQuizError } = await supabase
        .from('meal_quizzes')
        .select(`
          id,
          question,
          options,
          correct_answer,
          explanation,
          meal_date,
          meal_id,
          meal_menus(menu_items)
        `)
        .eq('school_code', schoolCode)
        .eq('grade', parseInt(grade))
        .eq('meal_date', quizDate)
        .limit(1)
        .maybeSingle();

      if (!todayQuizError && todayQuiz) {
        quiz = todayQuiz;
      }
    }

    // 오늘 퀴즈가 없거나 12:30 이전이면 가장 최근 퀴즈 가져오기
    if (!quiz) {
      const { data: latestQuiz, error: latestQuizError } = await supabase
        .from('meal_quizzes')
        .select(`
          id,
          question,
          options,
          correct_answer,
          explanation,
          meal_date,
          meal_id,
          meal_menus(menu_items)
        `)
        .eq('school_code', schoolCode)
        .eq('grade', parseInt(grade))
        .order('meal_date', { ascending: false })
        .limit(1)
        .single();

      if (latestQuizError) {
        return NextResponse.json({ error: "퀴즈가 존재하지 않습니다." }, { status: 404 });
      }
      
      quiz = latestQuiz;
    }

    // 이미 풀었는지 확인
    const { data: existing, error: existingError } = await supabase
      .from('quiz_results')
      .select('id, is_correct, selected_option')
      .eq('user_id', user.id)
      .eq('quiz_id', quiz.id)
      .limit(1);

    // 이미 풀었거나 정답 확인 시간 이후인 경우
    if ((existing && existing.length > 0) || canShowAnswer) {
      return NextResponse.json({
        quiz: {
          id: quiz.id,
          question: quiz.question,
          options: quiz.options,
          correct_answer: canShowAnswer ? quiz.correct_answer : undefined, // 7시 이후에만 정답 제공
          explanation: canShowAnswer ? quiz.explanation : undefined,       // 7시 이후에만 해설 제공
          meal_date: quiz.meal_date,
          menu_items: quiz.meal_menus?.menu_items || []
        },
        alreadyAnswered: existing && existing.length > 0,
        isCorrect: existing && existing.length > 0 ? existing[0].is_correct : undefined,
        selectedOption: existing && existing.length > 0 ? existing[0].selected_option : undefined
      });
    }

    // 정답은 반환하지 않음 (정답 확인 시간 이전)
    return NextResponse.json({
      quiz: {
        id: quiz.id,
        question: quiz.question,
        options: quiz.options,
        meal_date: quiz.meal_date,
        menu_items: quiz.meal_menus?.menu_items || []
      },
      alreadyAnswered: false
    });

  } catch (error) {
    console.error('Quiz API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// 퀴즈 답안 제출 API
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quizId, selectedOption } = body;

    if (!quizId || selectedOption === undefined) {
      return NextResponse.json({ error: 'quizId와 selectedOption이 필요합니다.' }, { status: 400 });
    }

    // 퀴즈 정보 가져오기
    const { data: quiz, error: quizError } = await supabase
      .from('meal_quizzes')
      .select('correct_answer, school_code, grade, explanation')
      .eq('id', quizId)
      .single();

    if (quizError) {
      return NextResponse.json({ error: "퀴즈를 찾을 수 없습니다." }, { status: 404 });
    }

    // 이미 제출했는지 확인
    const { data: existing, error: existingError } = await supabase
      .from('quiz_results')
      .select('id')
      .eq('user_id', user.id)
      .eq('quiz_id', quizId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "이미 제출한 퀴즈입니다." }, { status: 400 });
    }

    // 정답 확인
    const isCorrect = quiz.correct_answer === selectedOption;
    const answerTime = new Date().toISOString();

    // 결과 저장
    const { error: insertError } = await supabase
      .from('quiz_results')
      .insert({
        user_id: user.id,
        quiz_id: quizId,
        selected_option: selectedOption,
        is_correct: isCorrect,
        answer_time: answerTime
      });

    if (insertError) {
      console.error('Insert Error:', insertError);
      return NextResponse.json({ error: "답안 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      isCorrect,
      correctAnswer: quiz.correct_answer,
      explanation: quiz.explanation
    });

  } catch (error) {
    console.error('Quiz Submit API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
