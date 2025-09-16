import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  
  if (!year || !month) {
    return NextResponse.json({ error: 'year와 month 파라미터가 필요합니다' }, { status: 400 });
  }
  
  try {
    // 한국천문연구원 특일정보 API 호출
    const apiUrl = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
    const serviceKey = process.env.KOREA_HOLIDAY_API_KEY;
    
    if (!serviceKey) {
      console.error('KOREA_HOLIDAY_API_KEY 환경변수가 설정되지 않았습니다');
      return NextResponse.json({ holidays: [] });
    }
    
    const params = new URLSearchParams({
      solYear: year,
      solMonth: month,
      _type: 'json',
      ServiceKey: serviceKey,
      numOfRows: '50' // 한 달에 공휴일이 많을 수 있으므로 충분히 설정
    });
    
    const response = await fetch(`${apiUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }
    
    const data = await response.json();
    
    // API 응답 구조 확인 및 데이터 추출
    let holidays = [];
    
    if (data.response?.body?.items) {
      const items = data.response.body.items;
      
      if (typeof items === 'string' || !items.item) {
        // 공휴일이 없는 경우
        holidays = [];
      } else if (Array.isArray(items.item)) {
        // 공휴일이 여러 개인 경우
        holidays = items.item.filter((item: any) => item.isHoliday === 'Y');
      } else {
        // 공휴일이 하나인 경우
        holidays = items.item.isHoliday === 'Y' ? [items.item] : [];
      }
    }
    
    return NextResponse.json({ holidays });
    
  } catch (error) {
    console.error('공휴일 API 호출 오류:', error);
    // 에러 발생 시 빈 배열 반환 (fallback 로직이 프론트엔드에서 처리됨)
    return NextResponse.json({ holidays: [] });
  }
}
