import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import MealWrapper from './client-wrapper';

type Props = {
  searchParams: { school_code?: string; date?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  console.log('🎯 급식 페이지 generateMetadata 실행! searchParams:', searchParams);
  
  const schoolCode = searchParams.school_code;
  const date = searchParams.date || new Date().toISOString().split('T')[0];
  
  console.log('📊 파라미터:', { schoolCode, date });
  
  if (!schoolCode) {
    console.log('❌ school_code 없음, 기본 메타데이터 반환');
    return {
      title: '📋 뭐먹지? - 학교 급식 평가 서비스',
      description: '메뉴별 맛 평가로 메뉴별 배틀 & 학교별 배틀 함께 해봐요!',
    };
  }

  try {
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
    const schoolName = schoolData?.school_name || '학교';
    const shareUrl = `https://lunbat.com/?date=${date}&school_code=${schoolCode}`;
    
    console.log('✅ 학교 조회 성공:', { schoolName, shareUrl });
    
    return {
      title: `📋 ${schoolName} ${date} 오늘의 급식 평가! 👀`,
      description: `메뉴별 맛 평가로 메뉴별 배틀 & 학교별 배틀 함께 해봐요!`,
      openGraph: {
        title: `📋 ${schoolName} ${date} 오늘의 급식 평가! 👀`,
        description: `메뉴별 맛 평가로 메뉴별 배틀 & 학교별 배틀 함께 해봐요!`,
        type: 'website',
        url: shareUrl,
        siteName: '뭐먹지?',
      },
      twitter: {
        card: 'summary',
        title: `📋 ${schoolName} ${date} 오늘의 급식 평가! 👀`,
        description: `메뉴별 맛 평가로 메뉴별 배틀 & 학교별 배틀 함께 해봐요!`,
      },
    };
  } catch (error) {
    console.error('❌ 메타데이터 생성 오류:', error);
    console.error('❌ 에러 상세:', error instanceof Error ? error.message : String(error));
    return {
      title: '📋 뭐먹지? - 학교 급식 평가 서비스',
      description: '메뉴별 맛 평가로 메뉴별 배틀 & 학교별 배틀 함께 해봐요!',
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
