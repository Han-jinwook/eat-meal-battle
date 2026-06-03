import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

type Props = {
  params: { schoolName: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const schoolName = decodeURIComponent(params.schoolName)
  
  return {
    title: `급식배틀 🍱 ${schoolName} 급식 랭킹 | 뭐먹지?`,
    description: `${schoolName} 급식 평가 & AI 급식퀴즈! 오늘 급식 점수 확인하고 전국 급식 배틀에 참여하세요.`,
    openGraph: {
      title: `급식배틀 🍱 ${schoolName} 급식 랭킹`,
      description: `${schoolName} 급식 평가 & AI 퀴즈 도전! 우리 학교 순위는?`,
      type: 'website',
      siteName: '급식배틀',
      images: [
        {
          url: 'https://whateat.sundreamer.app/og-image.png',
          width: 1200,
          height: 630,
          alt: `${schoolName} 급식배틀`,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `급식배틀 - ${schoolName} 급식 랭킹`,
      description: `${schoolName} 급식 평가 & AI 퀴즈! 전국 급식 배틀 참여하기`,
      images: ['https://whateat.sundreamer.app/og-image.png'],
    },
  }
}

export default async function SchoolPage({ params }: Props) {
  const schoolName = decodeURIComponent(params.schoolName)
  
  try {
    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 학교명으로 school_code 조회
    const { data: school } = await supabase
      .from('schools')
      .select('school_code, school_name')
      .eq('school_name', schoolName)
      .single()

    if (!school) {
      // 학교를 찾을 수 없으면 메인 페이지로 리다이렉트
      redirect('/')
    }

    // 기존 메인 페이지로 리다이렉트 (school_code와 school_name 포함)
    const redirectUrl = `/?school_code=${school.school_code}&school_name=${encodeURIComponent(school.school_name)}`
    redirect(redirectUrl)
    
  } catch (error) {
    console.error('학교 페이지 오류:', error)
    redirect('/')
  }
}

// 정적 생성을 위한 학교 목록 (상위 인기 학교들만)
export async function generateStaticParams() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: schools } = await supabase
      .from('schools')
      .select('school_name')
      .not('school_name', 'is', null)
      .limit(100) // 상위 100개 학교만 정적 생성

    return (schools || []).map(school => ({
      schoolName: encodeURIComponent(school.school_name)
    }))
  } catch (error) {
    console.error('정적 파라미터 생성 오류:', error)
    return []
  }
}
