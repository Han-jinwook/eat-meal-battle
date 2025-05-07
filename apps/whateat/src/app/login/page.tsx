'use client';

import LoginForm from '@/components/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">WhatEat</h1>
          <p className="mt-2 text-gray-600">오늘의 메뉴를 추천받고 식단을 관리하세요</p>
        </div>

        <LoginForm />

        <div className="mt-6 text-center text-sm">
          <p className="text-gray-600">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="text-blue-600 hover:underline">
              회원가입
            </Link>
          </p>
          <p className="mt-2 text-gray-600">
            <Link href="/" className="text-blue-600 hover:underline">
              홈으로 돌아가기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
