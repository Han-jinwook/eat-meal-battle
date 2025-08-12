"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

interface BirthConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export default function BirthConsentModal({ isOpen, onClose, onSuccess, userId }: BirthConsentModalProps) {
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDate) {
      setError('생년월일을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 나이 계산
      const today = new Date();
      const birth = new Date(birthDate);
      const age = today.getFullYear() - birth.getFullYear() - 
        (today.getMonth() < birth.getMonth() || 
         (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0);

      // 학생 여부 판단 (테스트용: 6-39세, 출시 전 6-19세로 변경)
      const isStudent = age >= 6 && age <= 39;

      if (!isStudent) {
        setError('죄송합니다. 현재 서비스는 학생 대상으로만 제공됩니다.');
        return;
      }

      // DB 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update({
          birth_date: birthDate,
          birth_date_consent: true
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // 성공 시 학교 검색 페이지로 이동
      onSuccess();
      onClose();
      window.location.href = '/school-search';

    } catch (error: any) {
      setError(error.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            학교 설정을 위한 추가 동의
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            학교 설정을 위해 생년월일 정보가 필요합니다.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            • 학생 대상 서비스 제공을 위한 연령 확인<br/>
            • 제공된 정보는 안전하게 보관됩니다
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              생년월일
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? '처리 중...' : '동의하고 계속'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
