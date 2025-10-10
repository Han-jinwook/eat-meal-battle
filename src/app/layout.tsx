import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';
import SupabaseProvider from '@/lib/supabase/supabase-provider';

import MainHeader from '@/components/MainHeader';
import Footer from '@/components/Footer';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { SchoolModeProvider } from '@/hooks/useSchoolMode';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "뭐먹지? - 학교 급식 평가 및 경쟁 서비스",
  description: "학생들이 매일 급식을 평가·경쟁하며 올바른 식습관을 형성하도록 돕는 서비스입니다.",
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
    title: "🍽️ 우리학교 급식 메뉴배틀! 🥇",
    description: "우리학교 인기 메뉴 순위를 확인해보세요! 오늘/이번달 최고의 메뉴는?",
    url: "https://lunbat.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "🍽️ 우리학교 급식 메뉴배틀! 🥇",
    description: "우리학교 인기 메뉴 순위를 확인해보세요!",
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
        <SupabaseProvider>
          <SchoolModeProvider>
            <ServiceWorkerRegistration />
            <Suspense fallback={
              <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
                <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
                  <div className="text-lg sm:text-xl font-bold text-gray-900">뭐먹지?</div>
                  <div className="flex gap-3 sm:gap-6">
                    <div className="w-12 h-6 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-12 h-6 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-12 h-6 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-12 h-6 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
              </header>
            }>
              <MainHeader />
            </Suspense>
            {children}

            <Toaster />
            <Footer />
          </SchoolModeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
