import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('가계정 생성 요청 수신');
    
    // Netlify 함수 호출
    const netlifyFunctionUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/.netlify/functions/seed-accounts`;
    
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
        error: data.error || '가계정 생성에 실패했습니다.' 
      }, { status: 500 });
    }

    console.log('가계정 생성 성공:', data);
    return NextResponse.json(data);

  } catch (error) {
    console.error('가계정 생성 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
