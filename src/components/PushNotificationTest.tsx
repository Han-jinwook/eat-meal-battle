'use client';

import { useState } from 'react';
import { sendPushNotification } from '@/lib/pushNotifications';
import useUserSchool from '@/hooks/useUserSchool';

export default function PushNotificationTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const { userSchool } = useUserSchool();

  const testPushNotification = async () => {
    if (!userSchool) {
      setResult('사용자 학교 정보가 없습니다.');
      return;
    }

    setIsLoading(true);
    setResult('');

    try {
      const response = await sendPushNotification({
        title: '🔔 테스트 알림',
        body: '푸시 알림이 정상적으로 작동합니다!',
        schoolCode: userSchool.school_code,
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      });

      setResult(`✅ 성공: ${response.results.successCount}개 발송, ${response.results.failureCount}개 실패`);
    } catch (error) {
      console.error('테스트 실패:', error);
      setResult(`❌ 실패: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-medium mb-3">푸시 알림 테스트</h3>
      
      <button
        onClick={testPushNotification}
        disabled={isLoading || !userSchool}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '발송 중...' : '테스트 알림 발송'}
      </button>

      {result && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
          {result}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        현재 학교: {userSchool?.school_name || '없음'}
      </div>
    </div>
  );
}
