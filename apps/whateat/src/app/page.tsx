'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [foodRecommendation, setFoodRecommendation] = useState<string | null>(null);

  const foodOptions = [
    '비빔밥', '불고기', '김치찌개', '된장찌개', '짜장면', 
    '짬뽕', '냉면', '삼겹살', '떡볶이', '치킨', '피자'
  ];

  const getRandomFood = () => {
    const randomIndex = Math.floor(Math.random() * foodOptions.length);
    setFoodRecommendation(foodOptions[randomIndex]);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <section className="text-center">
        <h1 className="text-4xl font-bold mb-8">오늘 뭐 먹을까?</h1>
        <p className="text-xl mb-12">식사 고민 끝! 메뉴 추천받고 식단 관리하기</p>
        
        <div className="flex flex-col items-center justify-center mb-12">
          <button
            onClick={getRandomFood}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg mb-6 transition duration-200"
          >
            메뉴 추천받기
          </button>
          
          {foodRecommendation && (
            <div className="mt-8 p-6 bg-white rounded-xl shadow-md">
              <p className="text-2xl font-semibold mb-2">오늘의 추천 메뉴</p>
              <p className="text-3xl font-bold text-blue-600">{foodRecommendation}</p>
            </div>
          )}
        </div>
        
        <div className="mt-10">
          <Link
            href="/meals"
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg mr-4 transition duration-200"
          >
            내 식단 관리
          </Link>
          <Link
            href="/"
            className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            eat-meal-battle로 이동
          </Link>
        </div>
      </section>
    </div>
  );
}
