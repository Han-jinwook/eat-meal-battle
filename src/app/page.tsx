import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import WhatEatApp from '@/components/whateat/WhatEatApp';

type Props = {
  searchParams: Promise<{ school_code?: string; date?: string; school_name?: string }> | { school_code?: string; date?: string; school_name?: string }
}

const resolveSearchParams = async (
  searchParams: Props['searchParams']
): Promise<{ school_code?: string; date?: string; school_name?: string }> => {
  return await Promise.resolve(searchParams);
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  
  const schoolCode = resolvedSearchParams.school_code;
  const date = resolvedSearchParams.date || new Date().toISOString().split('T')[0];
  const schoolNameParam = resolvedSearchParams.school_name; // URL 파라미터의 학교명
  
  console.log('📊 파라미터:', { schoolCode, date, schoolNameParam });
  
  if (!schoolCode) {
    console.log('❌ school_code 없음, 기본 메타데이터 반환');
    return {
      title: '뭐먹지? 나만의 맛집 서랍장',
      description: '나와 가족을 위한 식생활 기록 플랫폼. 기억하고 싶은 맛과 다시 가고 싶은 곳, 아이들의 학교 급식까지 \'뭐먹지?\' 하나로 간편하게 기록하고 관리하세요.',
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
    const shareUrl = `https://whateat.sundreamer.app/?date=${date}&school_code=${schoolCode}`;
    
    console.log('✅ 학교 조회 성공:', { schoolName, shareUrl });
    
    return {
      title: `뭐먹지? 🍱 ${schoolName} ${date} 급식 랭킹`,
      description: `${schoolName} 급식 평가 & 랭킹 확인! 오늘 급식 점수는? 전국 학교 급식 배틀에 참여하고 우리 학교 순위를 올려보세요!`,
      openGraph: {
        title: `뭐먹지? 🍱 ${schoolName} ${date} 급식 랭킹`,
        description: `${schoolName} 급식 평가 & 랭킹! 오늘 급식 점수 확인하고 전국 급식 배틀에 참여하세요.`,
        type: 'website',
        url: shareUrl,
        siteName: '뭐먹지?',
        images: [
          {
            url: 'https://whateat.sundreamer.app/og-image.png',
            width: 1200,
            height: 630,
            alt: `${schoolName} 뭐먹지?`,
          }
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `뭐먹지? - ${schoolName} 급식 랭킹`,
        description: `${schoolName} 급식 평가 & 랭킹! 전국 급식 배틀 참여하고 우리 학교 순위 올리기`,
        images: ['https://whateat.sundreamer.app/og-image.png'],
      },
    };
  } catch (error) {
    console.error('❌ 메타데이터 생성 오류:', error);
    console.error('❌ 에러 상세:', error instanceof Error ? error.message : String(error));
    return {
      title: '뭐먹지? 나만의 맛집 서랍장',
      description: '나와 가족을 위한 식생활 기록 플랫폼. 기억하고 싶은 맛과 다시 가고 싶은 곳, 아이들의 학교 급식까지 \'뭐먹지?\' 하나로 간편하게 기록하고 관리하세요.',
    };
  }
}

// 동적 렌더링 강제 (모든 요청마다 서버에서 실행)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export default async function MealPage() {
  return <WhatEatApp />;
}
