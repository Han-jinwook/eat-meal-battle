'use client'

// 2025-09-17 - ProfileClient.tsx가 자체 로딩 상태를 관리하므로
// 이 페이지에서는 별도의 로딩 상태 관리를 제거합니다.
import ProfileClient from '@/components/ProfileClient';

export default function ProfilePage() {
  // ProfileClient 컴포넌트에서 자체적으로 로딩 상태를 관리하므로
  // 여기서는 직접 컴포넌트를 반환합니다.
  return <ProfileClient />;
}
