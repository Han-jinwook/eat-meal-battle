import { Suspense } from 'react';
import { Metadata } from 'next';
import QuizWrapper from './client-wrapper';
import { createClient } from '@supabase/supabase-js';

// 동적 렌더링 강제 (메타데이터를 요청마다 생성)
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: { viewing?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const viewingUserId = searchParams.viewing;
  
  if (!viewingUserId) {
    return {
      title: '뭐먹지? - 학교 급식 퀴즈 서비스',
      description: '학생들의 매일 급식 퀴즈 결과를 확인하세요',
    };
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // 공유한 사용자 정보 조회
    const { data: userData } = await supabase
      .from('users')
      .select('nickname')
      .eq('id', viewingUserId)
      .single();
    
    // 학교 정보 조회
    const { data: schoolData } = await supabase
      .from('school_infos')
      .select('school_name, grade, class_number')
      .eq('user_id', viewingUserId)
      .single();
    
    const nickname = userData?.nickname || '학생';
    const schoolName = schoolData?.school_name || '학교';
    const gradeClass = schoolData?.grade && schoolData?.class_number 
      ? `${schoolData.grade}학년 ${schoolData.class_number}반 ` 
      : '';
    
    const shareUrl = `https://lunbat.com/quiz?viewing=${viewingUserId}`;
    
    return {
      title: `📚 ${nickname}님의 급식퀴즈 초대! 🎯`,
      description: `${schoolName} ${gradeClass}${nickname}님이 급식퀴즈 결과를 공유했어요!`,
      openGraph: {
        title: `📚 ${nickname}님의 급식퀴즈 초대! 🎯`,
        description: `${schoolName} ${gradeClass}${nickname}님이 급식퀴즈 결과를 공유했어요!`,
        type: 'website',
        url: shareUrl,
        siteName: '뭐먹지?',
      },
      twitter: {
        card: 'summary',
        title: `📚 ${nickname}님의 급식퀴즈 초대! 🎯`,
        description: `${schoolName} ${gradeClass}${nickname}님이 급식퀴즈 결과를 공유했어요!`,
      },
    };
  } catch (error) {
    console.error('메타데이터 생성 오류:', error);
    return {
      title: '뭐먹지? - 학교 급식 퀴즈 서비스',
      description: '학생들의 매일 급식 퀴즈 결과를 확인하세요',
    };
  }
}

export default function QuizPage() {

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        }>
          <QuizWrapper />
        </Suspense>
      </div>
    </main>
  );
}
