// 수정 날짜: 2025-04-29 - API 경로 404 문제 해결 시도
// 이 파일은 '/api/cron/meals' 경로에 대한 처리를 담당합니다.
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * 스케줄러(Cron Job)에서 호출하는 API 엔드포인트 
 * 매일 오전 10시에 자동으로 호출되어 급식 정보를 갱신함
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 라우트가 제대로 인식되는지 확인하기 위한 로그
  console.log('API 경로 /api/cron/meals 호출됨');
  console.log('요청 메서드:', req.method);
  console.log('요청 쿼리:', req.query);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않는 메소드입니다' });
  }
  
  try {
    // 요청 검증 (외부 스케줄러에서 호출할 경우 보안을 위해)
    const apiKey = req.query.api_key as string;
    console.log('받은 API 키:', apiKey ? '***' + apiKey.substring(apiKey.length - 4) : '없음');
    
    // API 키 검증 (간단한 검증)
    const validApiKey = process.env.CRON_API_KEY || '';
    if (!validApiKey) {
      console.log('경고: 환경 변수 CRON_API_KEY가 설정되지 않았습니다');
    }
    
    if (!validApiKey || apiKey !== validApiKey) {
      console.log('API 키 인증 실패');
      return res.status(401).json({ 
        error: '유효하지 않은 API 키입니다',
        message: '올바른 API 키를 제공하세요 (GitHub Actions 워크플로우의 CRON_API_KEY 시크릿 확인)'
      });
    }
    
    // 내부 급식 메뉴 API 호출 (POST 메서드로 호출)
    const baseUrl = process.env.NETLIFY_URL || req.headers.origin || 'https://lunbat.com';
    console.log('급식 API 호출 URL:', `${baseUrl}/api/meals`);
    
    // 오늘 날짜 가져오기
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // POST 요청 보내기 - 스케줄러에서 호출하는 것임을 명시
    const response = await fetch(`${baseUrl}/api/meals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scheduler': 'true',
        'X-API-Key': validApiKey
      },
      body: JSON.stringify({
        date: dateStr,
        force_update: true,
        source: 'scheduler'
      })
    });
    
    const result = await response.json();
    
    // 결과 로그 기록
    console.log('급식 정보 업데이트 결과:', result);
    
    // 응답 반환
    return res.status(200).json({
      success: true,
      message: '급식 정보 업데이트 완료',
      result
    });
  } catch (error: unknown) {
    console.error('급식 스케줄러 오류:', error);
    
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    
    return res.status(500).json({ 
      success: false,
      error: `급식 스케줄러 처리 중 오류가 발생했습니다: ${errorMessage}` 
    });
  }
}
