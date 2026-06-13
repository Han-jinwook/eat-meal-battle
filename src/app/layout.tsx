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
import { WhatEatResponsiveWing } from '@/components/WhatEatResponsiveWing';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "뭐먹지? 나만의 맛집 서랍장",
  description: "나와 가족을 위한 식생활 기록 플랫폼. 기억하고 싶은 맛과 다시 가고 싶은 곳, 아이들의 학교 급식까지 '뭐먹지?' 하나로 간편하게 기록하고 관리하세요.",
  keywords: "뭐먹지, 맛집 서랍, 식사 기록, 급식 평가, 급식 퀴즈, AI 급식퀴즈, 맛톡, 맛집 일지, 식사 일기",
  alternates: {
    canonical: "https://whateat.sundreamer.app",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "뭐먹지?",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "뭐먹지?",
    title: "뭐먹지? 나만의 맛집 서랍장 🍱 식사 기록 & 학교 급식",
    description: "기억하고 싶은 맛, 다시 가고 싶은 곳. 나와 가족을 위한 똑똑한 식생활 기록 서랍장!",
    url: "https://whateat.sundreamer.app",
    images: [
      {
        url: "https://whateat.sundreamer.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "뭐먹지? 나만의 맛집 서랍장",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "뭐먹지? 나만의 맛집 서랍장",
    description: "나와 가족을 위한 똑똑한 식생활 기록 서랍장! 맛집 기록부터 아이들 학교 급식까지 한 번에 관리하세요.",
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
          <WhatEatResponsiveWing />
        </HubProvider>
      </body>
    </html>
  );
}
