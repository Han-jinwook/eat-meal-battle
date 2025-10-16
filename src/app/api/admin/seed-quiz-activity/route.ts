import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: Netlify 함수를 호출하여 실제 퀴즈 풀이 로직 실행
  console.log('하교 후 퀴즈 풀이 요청 수신');
  return NextResponse.json({ message: '하교 후 퀴즈 풀이 작업이 시작되었습니다.' });
}
