import { NextResponse } from 'next/server';

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

// 교육부 API 키
const API_KEY = process.env.NEIS_API_KEY || '';

// API 키 확인
console.log(`NEIS API KEY 사용 여부: ${API_KEY ? '설정됨' : '설정되지 않음'}`);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  
  if (!keyword) {
    return NextResponse.json(
      { error: '검색어를 입력하세요' },
      { status: 400 }
    );
  }

  try {
    // 교육부 API 호출 URL 구성
    const apiUrl = `${NEIS_API_BASE_URL}/schoolInfo`;
    const queryParams = new URLSearchParams({
      KEY: API_KEY,
      Type: 'json',
      pIndex: '1',
      pSize: '10',
      SCHUL_NM: keyword,
    });

    const fullUrl = `${apiUrl}?${queryParams.toString()}`;
    console.log(`API 요청 URL: ${fullUrl}`);

    // API 호출
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      console.error(`API 응답 상태 코드: ${response.status}`);
      throw new Error('교육부 API 호출 실패');
    }

    const data = await response.json();
    console.log('API 응답 데이터:', JSON.stringify(data, null, 2));
    
    // API 응답 구조 확인 및 데이터 추출
    let schools = [];
    
    // NEIS API 응답 구조는 다음과 같음:
    // { RESULT: { CODE: 'SUCCESS' }, schoolInfo: [{ head: [...] }, { row: [...] }] }
    if (data.schoolInfo && Array.isArray(data.schoolInfo)) {
      // 응답에 schoolInfo가 있고 배열인 경우
      if (data.schoolInfo.length > 1 && data.schoolInfo[1].row) {
        schools = data.schoolInfo[1].row;
      } else if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
        // 검색 결과가 없는 경우
        console.log('검색 결과가 없습니다');
      } else {
        console.log('학교 정보를 찾을 수 없습니다. API 응답 구조:', data);
      }
    } else if (data.RESULT && data.RESULT.CODE !== 'SUCCESS') {
      // API 오류 응답인 경우
      console.error(`API 오류: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE || '알 수 없는 오류'}`);
    } else {
      console.error('예상치 못한 API 응답 구조:', data);
    }

    return NextResponse.json({ schools });
  } catch (error) {
    console.error('학교 검색 API 오류:', error);
    // 개발 환경에서는 오류 상세 정보 포함
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `학교 정보를 가져오는 중 오류가 발생했습니다: ${error.message}` 
      : '학교 정보를 가져오는 중 오류가 발생했습니다';
      
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
