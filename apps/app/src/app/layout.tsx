import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';
import SupabaseProvider from '@/lib/supabase/supabase-provider';
import FirebaseMessagingWrapper from '@/components/firebase/FirebaseMessagingWrapper';
import MainHeader from '@/components/MainHeader';
import Footer from '@/components/Footer';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "급식 배틀 - 학교 급식 평가 및 경쟁 서비스",
  description: "학생들이 매일 급식을 평가·경쟁하며 올바른 식습관을 형성하도록 돕는 서비스입니다.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="theme-color" content="#4F46E5" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider>
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
          <FirebaseMessagingWrapper />
          <Toaster />
          <Footer />
        </SupabaseProvider>
      </body>
    </html>
  );
}
