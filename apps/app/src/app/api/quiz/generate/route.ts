import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { schoolCode, grade, date } = body;

    if (!schoolCode || !grade || !date) {
      return NextResponse.json({ error: 'schoolCode, grade, date가 필요합니다.' }, { status: 400 });
    }

    // 이미 해당 날짜에 퀴즈가 있는지 확인
    const { data: existingQuiz, error: existingError } = await supabase
      .from('meal_quizzes')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('grade', parseInt(grade))
      .eq('meal_date', date)
      .limit(1);

    if (existingQuiz && existingQuiz.length > 0) {
      return NextResponse.json({ error: '해당 날짜에 이미 퀴즈가 존재합니다.' }, { status: 400 });
    }

    // 해당 날짜의 급식 메뉴 가져오기
    const { data: mealMenu, error: mealError } = await supabase
      .from('meal_menus')
      .select('id, menu_items')
      .eq('school_code', schoolCode)
      .eq('grade', parseInt(grade))
      .eq('meal_date', date)
      .single();

    if (mealError || !mealMenu) {
      return NextResponse.json({ error: '해당 날짜의 급식 메뉴를 찾을 수 없습니다.' }, { status: 404 });
    }

    // OpenAI API를 통해 퀴즈 생성
    const openaiResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/.netlify/functions/manual-generate-meal-quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        schoolCode,
        grade: parseInt(grade),
        date,
        menuItems: mealMenu.menu_items
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API Error:', errorText);
      return NextResponse.json({ error: '퀴즈 생성에 실패했습니다.' }, { status: 500 });
    }

    const quizData = await openaiResponse.json();

    // 생성된 퀴즈를 데이터베이스에 저장
    const { data: savedQuiz, error: saveError } = await supabase
      .from('meal_quizzes')
      .insert({
        school_code: schoolCode,
        grade: parseInt(grade),
        meal_date: date,
        meal_id: mealMenu.id,
        question: quizData.question,
        options: quizData.options,
        correct_answer: quizData.correct_answer,
        explanation: quizData.explanation
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save Quiz Error:', saveError);
      return NextResponse.json({ error: '퀴즈 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      quiz: {
        id: savedQuiz.id,
        question: savedQuiz.question,
        options: savedQuiz.options,
        meal_date: savedQuiz.meal_date,
        menu_items: mealMenu.menu_items
      }
    });

  } catch (error) {
    console.error('Quiz Generate API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
