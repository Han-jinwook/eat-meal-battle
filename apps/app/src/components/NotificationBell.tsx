'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

/**
 * 사용자 알림을 표시하는 벨 아이콘 및 드롭다운 컴포넌트
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 알림 데이터 가져오기
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) return;
        
        // 최신 알림 10개 가져오기 - notification_recipients와 notifications 테이블 조인
        const { data, error } = await supabase
          .from('notification_recipients')
          .select(`
            id,
            notification_id,
            is_read,
            read_at,
            created_at,
            notification:notification_id (id, title, message, related_type, related_id, sender_id, school_code, created_at)
          `)
          .eq('recipient_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (error) {
          console.error('알림 조회 오류:', error);
          return;
        }
        
        // 데이터 형식 변환 - 중첩된 notification 객체를 평들화
        const formattedData = data?.map(item => ({
          id: item.id,
          notification_id: item.notification_id,
          is_read: item.is_read,
          read_at: item.read_at,
          created_at: item.created_at,
          ...item.notification
        })) || [];
        
        setNotifications(formattedData);
        
        // 읽지 않은 알림 개수 계산
        const unread = formattedData.filter(notification => !notification.is_read) || [];
        setUnreadCount(unread.length);
      } catch (error) {
        console.error('알림 데이터 로딩 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchNotifications();
    
    // 실시간 구독 설정
    const setupSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      // notification_recipients 테이블 변경 구독
      const subscription = supabase
        .channel('notifications-changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_recipients',
          filter: `recipient_id=eq.${session.user.id}`,
        }, (payload) => {
          // 새 알림을 받았을 때, 알림 정보를 가져와서 추가
          const fetchNewNotification = async () => {
            try {
              const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('id', payload.new.notification_id)
                .single();
                
              if (error || !data) return;
              
              const newNotificationItem = {
                id: payload.new.id,
                notification_id: payload.new.notification_id,
                is_read: false,
                created_at: payload.new.created_at,
                ...data
              };
              
              setNotifications(current => [newNotificationItem, ...current].slice(0, 10));
              setUnreadCount(current => current + 1);
            } catch (error) {
              console.error('새 알림 조회 오류:', error);
            }
          };
          
          fetchNewNotification();
        })
        .subscribe();
      
      return () => {
        subscription.unsubscribe();
      };
    };
    
    const unsubscribe = setupSubscription();
    return () => {
      if (unsubscribe) {
        unsubscribe.then(unsub => {
          if (typeof unsub === 'function') unsub();
        });
      }
    };
  }, [supabase]);
  
  // 알림 읽음 처리
  const markAsRead = async (notificationId: string) => {
    try {
      console.log('알림 읽음 처리 시도:', { notificationId });
      
      // 알림 찾기
      const notificationToUpdate = notifications.find(n => n.notification_id === notificationId);
      
      if (!notificationToUpdate) {
        console.warn('읽음 처리할 알림을 찾을 수 없습니다.');
        return;
      }
      
      // notification_recipients 테이블의 실제 ID 사용 (이것이 핵심임)
      const recipientId = notificationToUpdate.id;
      
      console.log('실제 사용할 수신자 레코드 ID:', {
        recipientId,
        notificationId: notificationToUpdate.notification_id
      });
      
      // 먼저 로컬 상태 업데이트 (사용자 경험 개선을 위해 즉시 반영)
      setNotifications(current => 
        current.map(n => 
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
      
      // 읽지 않은 알림 카운트 감소
      setUnreadCount(current => Math.max(0, current - 1));
      
      // 세션 액세스 토큰 추출
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      // API 호출 - notification_recipients 테이블의 id 값 전달
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers,
        body: JSON.stringify({ notificationId: recipientId })
      });

      const result = await response.json();
      console.log('알림 읽음 처리 API 응답:', result);

      if (!response.ok) {
        console.warn('API 호출 실패지만 UI는 업데이트됨');
      }
    } catch (error) {
      console.error('알림 상태 업데이트 오류:', error);
      
      // 오류가 발생해도 UI는 업데이트된 상태 유지 (사용자 경험 개선)
    }
  };
  
  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      // 세션 액세스 토큰 포함하여 파라미터 없이 호출 (모든 알림 읽음)
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers,
        body: JSON.stringify({}) // notificationId 없이 호출
      });
      
      if (!response.ok) {
        throw new Error('모든 알림 읽음 처리 실패');
      }
      
      // 로컬 상태 업데이트
      setNotifications(current => 
        current.map(n => ({ ...n, is_read: true }))
      );
      
      // 읽지 않은 알림 카운트 초기화
      setUnreadCount(0);
    } catch (error) {
      console.error('알림 일괄 업데이트 오류:', error);
    }
  };
  
  // 알림 날짜 형식 변환
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // 초 단위 차이
    
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };
  
  // 알림 유형에 따른 아이콘 반환
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'meal_image':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'comment':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* 알림 벨 아이콘 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        aria-label="알림"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* 읽지 않은 알림 배지 */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center transform translate-x-1/2 -translate-y-1/4">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* 알림 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-md shadow-lg z-50 overflow-hidden">
          <div className="border-b px-4 py-2 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900">알림</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                모두 읽음 표시
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <svg className="animate-spin h-5 w-5 text-gray-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                알림을 불러오는 중...
              </div>
            ) : notifications.length > 0 ? (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b ${!notification.is_read ? 'bg-blue-50' : 'bg-white'} hover:bg-gray-50`}
                >
                  <div className="flex">
                    <div className="flex-shrink-0 mr-3">
                      {getNotificationIcon(notification.related_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={`/?notification=${notification.related_id}`}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead(notification.notification_id);
                          }
                          setIsOpen(false);
                        }}
                        className="block"
                      >
                        <p className={`text-sm ${!notification.is_read ? 'font-medium' : 'font-normal'} text-gray-900`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(notification.created_at)}
                        </p>
                      </Link>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.notification_id)}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                        aria-label="읽음 표시"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">
                새로운 알림이 없습니다.
              </div>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-2 bg-gray-50 text-center border-t">
              <Link
                href="/notifications"
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={() => setIsOpen(false)}
              >
                모든 알림 보기
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
