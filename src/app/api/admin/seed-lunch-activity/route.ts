import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: Netlify 함수를 호출하여 실제 점심 활동 생성 로직 실행
  console.log('점심시간 활동 생성 요청 수신');
  return NextResponse.json({ message: '점심시간 활동 생성이 시작되었습니다. 몇 분 정도 소요됩니다.' });
}
