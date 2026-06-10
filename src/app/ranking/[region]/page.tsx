import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = {
  params: { region: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const region = decodeURIComponent(params.region)
  
  return {
    title: `뭐먹지? 🏆 ${region} 지역 급식 랭킹`,
    description: `${region} 지역 학교 급식 평가 순위! '뭐먹지?'에서 우리 지역 급식 순위를 확인하고 맛집 서랍장을 관리해보세요.`,
    openGraph: {
      title: `뭐먹지? 🏆 ${region} 지역 급식 랭킹`,
      description: `${region} 지역 급식 평가 순위! 우리 지역 급식 순위는 몇 위?`,
      type: 'website',
      siteName: '뭐먹지?',
      images: [
        {
          url: 'https://whateat.sundreamer.app/og-image.png',
          width: 1200,
          height: 630,
          alt: `${region} 지역 뭐먹지? 급식 랭킹`,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `뭐먹지? - ${region} 지역 급식 랭킹`,
      description: `${region} 지역 급식 평가 순위! 우리 지역 급식 순위 확인하기`,
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
