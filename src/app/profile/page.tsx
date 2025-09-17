'use client'

import dynamic from 'next/dynamic'
import ErrorBoundary from '@/components/ErrorBoundary'

// ProfileClient를 클라이언트 사이드에서만 로드하여 Hydration 오류 방지
const ProfileClient = dynamic(() => import('@/components/ProfileClient'), {
  ssr: false,
  // 로딩 중에 보여줄 스켈레톤 UI
  loading: () => (
    <div className="flex min-h-screen flex-col p-4">
      <div className="mx-auto w-full max-w-md">
        <div className="h-6 w-20 animate-pulse rounded bg-gray-200"></div>
      </div>
    </div>
  ),
})

export default function ProfilePage() {
  return (
    <ErrorBoundary>
      <ProfileClient />
    </ErrorBoundary>
  )
}
