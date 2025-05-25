'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface SchoolRatingProps {
  schoolCode: string;
  className?: string;
}

export default function SchoolRating({ schoolCode, className = '' }: SchoolRatingProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [schoolName, setSchoolName] = useState<string>('');
  const supabase = createClient();

  useEffect(() => {
    async function fetchSchoolRating() {
      if (!schoolCode) return;

      // 학교 정보 가져오기
      const { data: schoolData } = await supabase
        .from('schools')
        .select('school_name')
        .eq('school_code', schoolCode)
        .single();

      if (schoolData) {
        setSchoolName(schoolData.school_name);
      }

      // 별점 정보 가져오기
      const { data: ratingData, error } = await supabase
        .from('school_ratings')
        .select('rating')
        .eq('school_code', schoolCode);

      if (error) {
        console.error('별점 데이터를 가져오는 중 오류 발생:', error);
        return;
      }

      if (ratingData && ratingData.length > 0) {
        // 평균 별점 계산
        const sum = ratingData.reduce((acc, curr) => acc + curr.rating, 0);
        const average = sum / ratingData.length;
        
        setRating(parseFloat(average.toFixed(1)));
        setRatingCount(ratingData.length);
      }
    }

    fetchSchoolRating();
  }, [schoolCode, supabase]);

  // 별점에 따른 별 아이콘 생성 (SVG 사용)
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    // 꽉 찬 별
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={`full-${i}`} className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }

    // 반 별 - 고유한 ID 사용
    if (hasHalfStar) {
      // 학교 코드를 사용하여 고유한 gradient ID 생성
      const gradientId = `half-gradient-${schoolCode}`;
      stars.push(
        <svg key="half" className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <path fill={`url(#${gradientId})`} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }

    // 빈 별
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300 fill-current" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }

    return stars;
  };

  if (!rating) return null;

  return (
    <div className={`flex items-center justify-between py-1.5 px-1 ${className} bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg`}>
      <div className="flex items-center">
        <div className="bg-indigo-100 rounded-full p-1 mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
          </svg>
        </div>
        <span className="font-medium text-sm text-gray-700">전교생 평균</span>
        <span className="ml-2 text-lg font-bold text-indigo-700">{rating}</span>
        <div className="flex text-lg ml-1 items-center">
          {renderStars(rating)}
        </div>
      </div>
      <div className="text-sm bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
        {ratingCount}명 참여
      </div>
    </div>
  );
}
