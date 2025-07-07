// Netlify Function for schools API
const fetch = require('node-fetch');

// 교육부 NEIS Open API 주소
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

// 교육부 API 키
const API_KEY = process.env.NEIS_API_KEY || 'cd3edd777f534caca0100e7c006d4dcd';

exports.handler = async (event) => {
  // 쿼리 파라미터에서 keyword 추출
  const { keyword } = event.queryStringParameters || {};
  
  if (!keyword) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: '검색어를 입력하세요' })
    };
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
      return {
        statusCode: 500,
        body: JSON.stringify({ error: '교육부 API 호출 실패' })
      };
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // CORS 허용
      },
      body: JSON.stringify({ schools })
    };
  } catch (error) {
    console.error('학교 검색 API 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '학교 정보를 가져오는 중 오류가 발생했습니다', 
        details: error.message 
      })
    };
  }
};
