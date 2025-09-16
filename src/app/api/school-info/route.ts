import { NextResponse } from 'next/server';

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

// 교육부 API 키
const API_KEY = process.env.NEIS_API_KEY || 'cd3edd777f534caca0100e7c006d4dcd';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolCode = searchParams.get('school_code');
  
  if (!schoolCode) {
    return NextResponse.json(
      { error: '학교 코드를 입력하세요' },
      { status: 400 }
    );
  }

  try {
    // 교육부 API 호출 URL 구성 - 학교 코드로 검색
    const apiUrl = `${NEIS_API_BASE_URL}/schoolInfo`;
    const queryParams = new URLSearchParams({
      KEY: API_KEY,
      Type: 'json',
      pIndex: '1',
      pSize: '1',
      SD_SCHUL_CODE: schoolCode,
    });

    const fullUrl = `${apiUrl}?${queryParams.toString()}`;
    console.log(`School Info API 요청 URL: ${fullUrl}`);

    // API 호출
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      console.error(`API 응답 상태 코드: ${response.status}`);
      throw new Error('교육부 API 호출 실패');
    }

    const data = await response.json();
    console.log('School Info API 응답 데이터:', JSON.stringify(data, null, 2));
    
    // API 응답 구조 확인 및 데이터 추출
    let school = null;
    
    // INFO-200은 검색 결과가 없다는 오류 코드
    if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
      console.log(`학교 코드 "${schoolCode}"에 대한 검색 결과가 없습니다.`);
      return NextResponse.json(
        { error: '해당 학교 코드의 학교를 찾을 수 없습니다' },
        { status: 404 }
      );
    } 
    // NEIS API 응답 구조: { RESULT: { CODE: 'SUCCESS' }, schoolInfo: [{ head: [...] }, { row: [...] }] }
    else if (data.schoolInfo && Array.isArray(data.schoolInfo)) {
      if (data.schoolInfo.length > 1 && data.schoolInfo[1].row && data.schoolInfo[1].row.length > 0) {
        school = data.schoolInfo[1].row[0]; // 첫 번째 결과 반환
      } else {
        console.log('학교 정보를 찾을 수 없습니다. API 응답 구조:', data);
        return NextResponse.json(
          { error: '학교 정보를 찾을 수 없습니다' },
          { status: 404 }
        );
      }
    } else if (data.RESULT && data.RESULT.CODE !== 'SUCCESS') {
      console.error(`API 오류: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE || '알 수 없는 오류'}`);
      return NextResponse.json(
        { error: `API 오류: ${data.RESULT.MESSAGE || '알 수 없는 오류'}` },
        { status: 500 }
      );
    } else {
      console.error('예상치 못한 API 응답 구조:', data);
      return NextResponse.json(
        { error: '예상치 못한 API 응답 구조' },
        { status: 500 }
      );
    }

    return NextResponse.json({ school });
  } catch (error) {
    console.error('학교 정보 API 오류:', error);
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `학교 정보를 가져오는 중 오류가 발생했습니다: ${error.message}` 
      : '학교 정보를 가져오는 중 오류가 발생했습니다';
      
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
