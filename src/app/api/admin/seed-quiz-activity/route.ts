import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST() {
  try {
    console.log('하교 후 퀴즈 풀이 요청 수신');
    
    // 현재 호스트 자동 감지 (Netlify 전용)
    const headersList = headers();
    const host = headersList.get('host');
    const netlifyFunctionUrl = `https://${host}/.netlify/functions/seed-quiz-activity`;
    
    const response = await fetch(netlifyFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Netlify 함수 호출 실패:', data);
      return NextResponse.json({ 
        error: data.error || '하교 후 퀴즈 풀이에 실패했습니다.' 
      }, { status: 500 });
    }

    console.log('하교 후 퀴즈 풀이 성공:', data);
    return NextResponse.json(data);

  } catch (error) {
    console.error('하교 후 퀴즈 풀이 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
