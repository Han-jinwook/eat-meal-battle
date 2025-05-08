import { NextRequest, NextResponse } from 'next/server';

/**
 * 이미지 프록시 API 라우트
 * Supabase나 외부 이미지 URL을 서버 측에서 요청하여 404 오류를 방지
 */
export async function GET(request: NextRequest) {
  // URL 파라미터에서 이미지 URL 가져오기
  const { searchParams } = new URL(request.url);
  let imageUrl = searchParams.get('url');
  
  // URL이 없으면 400 에러 반환
  if (!imageUrl) {
    return new NextResponse('Image URL is required', { status: 400 });
  }
  
  try {
    // URL이 인코딩되어 있을 수 있으므로 디코딩
    imageUrl = decodeURIComponent(imageUrl);
    
    // 이미지 요청
    const imageRes = await fetch(imageUrl, {
      headers: {
        // 브라우저처럼 보이게 User-Agent 설정
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // 응답이 성공적이지 않으면 오류 반환
    if (!imageRes.ok) {
      console.error(`이미지 프록시 오류: ${imageRes.status} - ${imageUrl}`);
      return new NextResponse('Image not found', { status: 404 });
    }
    
    // 이미지 데이터 및 콘텐츠 타입 가져오기
    const imageData = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get('Content-Type') || 'image/jpeg';
    
    // 응답 반환
    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600' // 1시간 캐싱
      }
    });
  } catch (error) {
    console.error('이미지 프록시 오류:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
