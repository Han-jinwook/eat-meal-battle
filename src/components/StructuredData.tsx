'use client'

import { useEffect } from 'react'

interface StructuredDataProps {
  type?: 'organization' | 'website' | 'breadcrumb'
  data?: any
}

export default function StructuredData({ type = 'organization', data }: StructuredDataProps) {
  useEffect(() => {
    // 기본 Organization 스키마
    const organizationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "급식배틀",
      "alternateName": "뭐먹지?",
      "url": "https://whateat.sundreamer.app",
      "logo": "https://whateat.sundreamer.app/icons/icon-512x512.png",
      "description": "전국 학교 급식 평가와 AI 학습형 급식퀴즈 플랫폼",
      "foundingDate": "2024",
      "sameAs": [
        "https://whateat.sundreamer.app"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "availableLanguage": "Korean"
      }
    }

    // 기본 WebSite 스키마
    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "급식배틀",
      "alternateName": "뭐먹지?",
      "url": "https://whateat.sundreamer.app",
      "description": "전국 학교 급식 평가와 AI 학습형 급식퀴즈! 오늘 급식으로 배우는 교과 연계형 퀴즈와 전국 급식 순위 경쟁.",
      "inLanguage": "ko-KR",
      "publisher": {
        "@type": "Organization",
        "name": "급식배틀",
        "logo": "https://whateat.sundreamer.app/icons/icon-512x512.png"
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://whateat.sundreamer.app/?school_name={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }

    let schema = organizationSchema

    if (type === 'website') {
      schema = websiteSchema
    } else if (type === 'breadcrumb' && data) {
      schema = data
    }

    // 기존 스키마 제거 (중복 방지)
    const existingScript = document.querySelector(`script[data-schema="${type}"]`)
    if (existingScript) {
      existingScript.remove()
    }

    // 새 스키마 추가
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-schema', type)
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)

    // 컴포넌트 언마운트 시 정리
    return () => {
      const scriptToRemove = document.querySelector(`script[data-schema="${type}"]`)
      if (scriptToRemove) {
        scriptToRemove.remove()
      }
    }
  }, [type, data])

  return null // 렌더링할 UI 없음
}
