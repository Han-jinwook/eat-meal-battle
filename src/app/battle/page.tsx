import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import BattleClient from './BattleClient';

type Props = {
  searchParams: { school_code?: string; date?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const schoolCode = searchParams.school_code;
  const date = searchParams.date || new Date().toISOString().split('T')[0];
  
  if (!schoolCode) {
    return {
      title: '🍽️ 급식 메뉴배틀 🥇',
      description: '우리학교 인기 메뉴 순위를 확인해보세요! 오늘/이번달 최고의 메뉴는?',
    };
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // 학교 정보 조회 (중복 학교 대비)
    const { data: schoolList } = await supabase
      .from('school_infos')
      .select('school_name')
      .eq('school_code', schoolCode)
      .limit(1);
    
    const schoolData = schoolList?.[0];
    const schoolName = schoolData?.school_name || '학교';
    const shareUrl = `https://lunbat.com/battle?date=${date}&school_code=${schoolCode}`;
    
    return {
      title: `🍽️ ${schoolName} ${date} 메뉴배틀 결과! 🥇`,
      description: `우리학교 인기 메뉴 순위를 확인해보세요! 오늘/이번달 최고의 메뉴는?`,
      openGraph: {
        title: `🍽️ ${schoolName} ${date} 메뉴배틀 결과! 🥇`,
        description: `우리학교 인기 메뉴 순위를 확인해보세요! 오늘/이번달 최고의 메뉴는?`,
        type: 'website',
        url: shareUrl,
        siteName: '뭐먹지?',
      },
      twitter: {
        card: 'summary',
        title: `🍽️ ${schoolName} ${date} 메뉴배틀 결과! 🥇`,
        description: `우리학교 인기 메뉴 순위를 확인해보세요!`,
      },
    };
  } catch (error) {
    console.error('메타데이터 생성 오류:', error);
    return {
      title: '🍽️ 급식 메뉴배틀 🥇',
      description: '우리학교 인기 메뉴 순위를 확인해보세요!',
    };
  }
}

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

export default function BattlePage() {
  return <BattleClient />;
}
