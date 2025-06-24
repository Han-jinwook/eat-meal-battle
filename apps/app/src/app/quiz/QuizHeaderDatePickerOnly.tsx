"use client";

import React, { useState, useEffect } from 'react';
import useUserSchool from '@/hooks/useUserSchool';
import { formatDisplayDate, getCurrentDate } from '@/utils/DateUtils';

export default function QuizHeaderDatePickerOnly() {
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    setSelectedDate(getCurrentDate());
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        {userLoading ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 py-1">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ) : userSchool ? (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {userSchool.school_name}
              </h2>
              <p className="text-sm text-gray-600">
                {userSchool.grade}학년 {userSchool.class_number}반
              </p>
            </div>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="sr-only"
                id="date-picker"
              />
              <button
                onClick={() => document.getElementById('date-picker')?.click()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {(() => {
                  if (selectedDate) {
                    const date = new Date(selectedDate);
                    const month = date.getMonth() + 1;
                    const day = date.getDate();
                    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                    const weekday = weekdays[date.getDay()];
                    return (
                      <>
                        <div className="flex flex-col items-center mr-1">
                          <span className="text-xs text-gray-500">
                            {month}월 {day}일
                          </span>
                          <span className="text-xs font-semibold text-blue-600">
                            {weekday}
                          </span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    );
                  }
                  return selectedDate;
                })()}
              </button>
            </div>
          </div>
        ) : userError ? (
          <div className="text-red-600 text-center py-2">
            <p>학교 정보를 불러올 수 없습니다</p>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="mb-2">학교 정보가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
