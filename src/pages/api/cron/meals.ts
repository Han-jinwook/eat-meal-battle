import { NextApiRequest, NextApiResponse } from 'next';

/**
 * 스케줄러(Cron Job)에서 호출하는 API 엔드포인트 
 * 매일 오전 10시에 자동으로 호출되어 급식 정보를 갱신함
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않는 메소드입니다' });
  }
  
  try {
    // 요청 검증 (외부 스케줄러에서 호출할 경우 보안을 위해)
    const apiKey = req.query.api_key as string;
    
    // API 키 검증 (간단한 검증)
    const validApiKey = process.env.CRON_API_KEY || '';
    if (!validApiKey || apiKey !== validApiKey) {
      return res.status(401).json({ error: '유효하지 않은 API 키입니다' });
    }
    
    // 내부 급식 메뉴 API 호출 (POST 메서드로 호출)
    const baseUrl = process.env.NETLIFY_URL || req.headers.origin || 'https://lunbat.com';
    const response = await fetch(`${baseUrl}/api/meals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
