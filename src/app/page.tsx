import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import MealWrapper from './client-wrapper';

type Props = {
  searchParams: { school_code?: string; date?: string; school_name?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  console.log('🎯 급식 페이지 generateMetadata 실행! searchParams:', searchParams);
  
  const schoolCode = searchParams.school_code;
  const date = searchParams.date || new Date().toISOString().split('T')[0];
  const schoolNameParam = searchParams.school_name; // URL 파라미터의 학교명
  
  console.log('📊 파라미터:', { schoolCode, date, schoolNameParam });
  
  if (!schoolCode) {
    console.log('❌ school_code 없음, 기본 메타데이터 반환');
    return {
      title: '급식배틀 - 전국 학교 급식 랭킹 & AI 급식퀴즈',
      description: '전국 학교 급식 평가와 AI 학습형 급식퀴즈! 오늘 급식으로 배우는 교과 연계형 퀴즈와 전국 급식 순위 경쟁. 지금 참여하고 우리학교 랭킹 올려보세요!',
    };
  }

  try {
    // URL 파라미터에 학교명이 있으면 우선 사용, 없으면 DB 조회
    let schoolName = schoolNameParam;
    
    if (!schoolName) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // 학교 정보 조회 (사용자별 테이블에서 DISTINCT 조회)
      const { data: schoolList } = await supabase
        .from('school_infos')
        .select('school_name')
        .eq('school_code', schoolCode)
        .limit(1);
      
      const schoolData = schoolList?.[0];
      schoolName = schoolData?.school_name || '학교';
    }
    const shareUrl = `https://lunbat.com/?date=${date}&school_code=${schoolCode}`;
    
    console.log('✅ 학교 조회 성공:', { schoolName, shareUrl });
    
    return {
      title: `급식배틀 🍱 ${schoolName} ${date} 급식 랭킹`,
      description: `${schoolName} 급식 평가 & 랭킹 확인! 오늘 급식 점수는? 전국 학교 급식 배틀에 참여하고 우리 학교 순위를 올려보세요!`,
      openGraph: {
        title: `급식배틀 🍱 ${schoolName} ${date} 급식 랭킹`,
        description: `${schoolName} 급식 평가 & 랭킹! 오늘 급식 점수 확인하고 전국 급식 배틀에 참여하세요.`,
        type: 'website',
        url: shareUrl,
        siteName: '급식배틀',
        images: [
          {
            url: 'https://lunbat.com/og-image.png',
            width: 1200,
            height: 630,
            alt: `${schoolName} 급식배틀`,
          }
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `급식배틀 - ${schoolName} 급식 랭킹`,
        description: `${schoolName} 급식 평가 & 랭킹! 전국 급식 배틀 참여하고 우리 학교 순위 올리기`,
        images: ['https://lunbat.com/og-image.png'],
      },
    };
  } catch (error) {
    console.error('❌ 메타데이터 생성 오류:', error);
    console.error('❌ 에러 상세:', error instanceof Error ? error.message : String(error));
    return {
      title: '급식배틀 - 전국 학교 급식 랭킹 & AI 급식퀴즈',
      description: '전국 학교 급식 평가와 AI 학습형 급식퀴즈! 오늘 급식으로 배우는 교과 연계형 퀴즈와 전국 급식 순위 경쟁. 지금 참여하고 우리학교 랭킹 올려보세요!',
    };
  }
}

// 동적 렌더링 강제 (모든 요청마다 서버에서 실행)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export default function MealPage() {
  console.log('🏁 MealPage 컴포넌트 렌더링 시작!');
  return <MealWrapper />;
}
