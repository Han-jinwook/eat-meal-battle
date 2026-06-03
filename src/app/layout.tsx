import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import SupabaseProvider from '@/lib/supabase/supabase-provider';
import { HubProvider, HubNotifier } from '@/services/merlin-hub-sdk/react';
import { GlobalLoginModal } from '@/components/c-global-login-modal';


import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import StructuredData from '@/components/StructuredData';
import { SchoolModeProvider } from '@/hooks/useSchoolMode';
import WhatEatTimer from '@/components/whateat/WhatEatTimer';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "급식배틀 - 전국 학교 급식 랭킹 & AI 급식퀴즈",
  description: "전국 학교 급식 평가와 AI 학습형 급식퀴즈! 오늘 급식으로 배우는 교과 연계형 퀴즈와 전국 급식 순위 경쟁. 지금 참여하고 우리학교 랭킹 올려보세요!",
  keywords: "급식, 학교 급식, 급식 평가, 급식 랭킹, 급식 퀴즈, AI 급식퀴즈, 교과 연계 퀴즈, 학습 퀴즈, 급식배틀, 뭐먹지",
  alternates: {
    canonical: "https://whateat.sundreamer.app",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "급식배틀",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "급식배틀",
    title: "급식배틀 🍱 급식평가 + AI 급식퀴즈 도전",
    description: "오늘 급식 → 교과 연계 AI 퀴즈! 수학 · 영어 · 과학 · 사회 학습과 급식 랭킹까지!",
    url: "https://whateat.sundreamer.app",
    images: [
      {
        url: "https://whateat.sundreamer.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "급식배틀 - 전국 학교 급식 랭킹",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "급식배틀 - AI 급식퀴즈 & 급식 랭킹",
    description: "오늘 급식으로 교과 연계 AI 퀴즈 도전! 수학·영어·과학·사회 학습과 전국 급식 랭킹 경쟁까지!",
    images: ["https://whateat.sundreamer.app/og-image.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Google Site Verification */}
        <meta name="google-site-verification" content="1SubKBLpvpoVZ4U63uD6crpSMHPxk1z-nnDwZWcxcXk" />
        
        {/* Naver Site Verification - 등록 후 content 값 업데이트 필요 */}
        <meta name="naver-site-verification" content="NAVER_VERIFICATION_CODE_HERE" />
        
        <meta name="theme-color" content="#4F46E5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="뭐먹지?" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <HubProvider appId="WhatEat">
          <SupabaseProvider session={null}>
            <SchoolModeProvider>
              <ServiceWorkerRegistration />
              <StructuredData type="organization" />
              <StructuredData type="website" />
              {children}

              <Toaster />
              <WhatEatTimer />
            </SchoolModeProvider>
          </SupabaseProvider>
          {/* 허브 표준: 최상위에 단 1회만 배치 */}
          <GlobalLoginModal />
          <HubNotifier />
        </HubProvider>
      </body>
    </html>
  );
}
