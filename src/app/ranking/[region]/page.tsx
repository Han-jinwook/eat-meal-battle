import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: { region: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const region = decodeURIComponent(params.region)
  
  return {
    title: `급식배틀 🏆 ${region} 지역 급식 랭킹 | 뭐먹지?`,
    description: `${region} 지역 학교 급식 평가 순위! AI 급식퀴즈와 함께하는 전국 급식 배틀에서 우리 지역 순위를 확인하세요.`,
    openGraph: {
      title: `급식배틀 🏆 ${region} 지역 급식 랭킹`,
      description: `${region} 지역 급식 평가 순위 & AI 퀴즈! 우리 지역이 전국 몇 위?`,
      type: 'website',
      siteName: '급식배틀',
      images: [
        {
          url: 'https://whateat.sundreamer.app/og-image.png',
          width: 1200,
          height: 630,
          alt: `${region} 지역 급식배틀 랭킹`,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `급식배틀 - ${region} 지역 랭킹`,
      description: `${region} 지역 급식 평가 순위! AI 퀴즈와 함께하는 급식 배틀`,
      images: ['https://whateat.sundreamer.app/og-image.png'],
    },
  }
}

export default async function RegionRankingPage({ params }: Props) {
  const region = decodeURIComponent(params.region)
  
  // 현재는 메인 페이지의 배틀 섹션으로 리다이렉트
  // 추후 지역별 랭킹 전용 페이지 구현 시 여기서 처리
  redirect('/battle')
}
