import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import SupabaseProvider from '@/lib/supabase/supabase-provider';
import FirebaseMessagingWrapper from '@/components/firebase/FirebaseMessagingWrapper';

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
          {children}
          <FirebaseMessagingWrapper />
          <Toaster />
        </SupabaseProvider>
      </body>
    </html>
  );
}
