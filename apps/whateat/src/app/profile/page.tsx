'use client';

import Profile from '@/components/Profile';

export default function ProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">내 프로필</h1>
      <Profile />
    </div>
  );
}
