// 테스트용: compensateAllUsersForIncorrectQuiz 함수 직접 실행
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function compensateAllUsersForIncorrectQuiz(quizId) {
  console.log('[quiz] compensateAllUsersForIncorrectQuiz 시작:', quizId);
  
  try {
    // all_quiz_attempts 테이블 업데이트 (모든퀴즈용)
    const { error: allQuizUpdateError } = await supabaseAdmin
      .from('all_quiz_attempts')
      .update({ is_correct: true })
      .eq('quiz_id', quizId);
      
    if (allQuizUpdateError) {
      console.error('[quiz] all_quiz_attempts 업데이트 실패:', allQuizUpdateError);
    } else {
      console.log('[quiz] all_quiz_attempts 업데이트 성공');
    }
    
  } catch (error) {
    console.error('[quiz] compensateAllUsersForIncorrectQuiz 예외 발생:', error);
  }
}

// 실행
compensateAllUsersForIncorrectQuiz('0661c118-6c72-478a-9e50-12eb1572fee3');
