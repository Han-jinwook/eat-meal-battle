'use client'

import { useEffect, useState } from 'react';
import ProfileClient from '@/components/ProfileClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ProfileLoading() {
  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
        </div>
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse"></div>
          </div>
          <div className="text-center space-y-2">
            <div className="h-6 bg-gray-200 rounded w-24 mx-auto animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-40 mx-auto animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <ProfileLoading />;
  }

  return <ProfileClient />;
}
