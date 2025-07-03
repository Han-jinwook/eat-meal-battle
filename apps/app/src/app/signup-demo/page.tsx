'use client';

import React, { useState } from 'react';

export default function SignupDemoPage() {
  const [requiredConsent, setRequiredConsent] = useState(false);
  const [optionalConsent, setOptionalConsent] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">회원가입</h1>
          <p className="text-gray-600">WhatEat? 서비스 이용을 위해 개인정보 수집에 동의해주세요</p>
        </div>

        {/* 개인정보 수집 및 이용 동의 */}
        <div className="space-y-4">
          {/* 필수 항목 */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="required"
                checked={requiredConsent}
                onChange={(e) => setRequiredConsent(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="required" className="block text-sm font-medium text-gray-900">
                  <span className="text-red-600 font-bold">[필수]</span> 개인정보 수집 및 이용 동의
                </label>
                <div className="mt-2 text-sm text-gray-700">
                  <p className="font-medium mb-2">수집하는 개인정보 항목:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>별명(닉네임)</strong> - 서비스 이용 및 회원 관리</li>
                    <li><strong>이메일 주소</strong> - 회원 가입 및 로그인</li>
                    <li><strong>프로필 이미지</strong> - 서비스 이용 및 회원 식별</li>
                  </ul>
                  <p className="mt-2 text-xs text-gray-600">
                    보유기간: 회원 탈퇴 시까지
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 선택 항목 */}
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="optional"
                checked={optionalConsent}
                onChange={(e) => setOptionalConsent(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="optional" className="block text-sm font-medium text-gray-900">
                  <span className="text-blue-600 font-bold">[선택]</span> 학생 서비스 이용을 위한 개인정보 수집 동의
                </label>
                <div className="mt-2 text-sm text-gray-700">
                  <p className="font-medium mb-2">수집하는 개인정보 항목:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>출생년도</strong> - 학생 연령대 확인</li>
                    <li><strong>생일(생년월일)</strong> - 학생 연령대 확인</li>
                    <li><strong>학교 정보(학교명, 학년, 반)</strong> - 학생 전용 서비스 제공</li>
                  </ul>
                  <p className="mt-2 text-xs text-blue-700 font-medium">
                    ✓ 학생 연령대 확인을 통한 학생 전용 콘텐츠 및 서비스 제공
                  </p>
                  <p className="mt-1 text-xs text-blue-700 font-medium">
                    ✓ 학교/학년/반 설정 권한 부여
                  </p>
                  <p className="mt-2 text-xs text-gray-600">
                    보유기간: 회원 탈퇴 시까지<br/>
                    * 동의하지 않아도 서비스 이용 가능 (학생 전용 기능 제외)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 개인정보처리방침 링크 */}
          <div className="text-center text-sm text-gray-600">
            <a href="/privacy-policy" className="text-blue-600 underline">
              개인정보처리방침 전문 보기
            </a>
          </div>

          {/* 가입 버튼 */}
          <button
            disabled={!requiredConsent}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              requiredConsent
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {requiredConsent ? '회원가입 계속하기' : '필수 동의 항목을 선택해주세요'}
          </button>

          {/* 하단 안내 */}
          <div className="text-center text-xs text-gray-500 mt-4">
            <p>선택 항목에 동의하지 않아도 서비스 이용이 가능합니다.</p>
            <p>학생 전용 서비스는 선택 항목 동의 시에만 이용 가능합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
