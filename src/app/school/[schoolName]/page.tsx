import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

type Props = {
  params: { schoolName: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const schoolName = decodeURIComponent(params.schoolName)
  
  return {
    title: `뭐먹지? 🍱 ${schoolName} 급식 랭킹`,
    description: `${schoolName} 급식 평가 순위! 오늘 급식 점수를 확인하고 나와 가족을 위한 똑똑한 식생활 기록 서랍장 '뭐먹지?'를 시작해보세요.`,
    openGraph: {
      title: `뭐먹지? 🍱 ${schoolName} 급식 랭킹`,
      description: `${schoolName} 급식 평가 확인! 우리 학교 급식 순위는 몇 위?`,
      type: 'website',
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
      description: `${schoolName} 급식 평가 순위! 우리 학교 급식 순위 확인하기`,
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
