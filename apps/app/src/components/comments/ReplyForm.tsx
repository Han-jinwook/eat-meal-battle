'use client';

import { useState, useRef, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import useUserSchool from '@/hooks/useUserSchool';

interface ReplyFormProps {
  onSubmit: (content: string) => Promise<boolean>;
  autoFocus?: boolean;
}

export default function ReplyForm({ onSubmit, autoFocus = true }: ReplyFormProps) {
  const [content, setContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useUserSchool();
  const supabase = createClientComponentClient();
  
  // 사용자 프로필 정보
  const [userProfile, setUserProfile] = useState<{
    avatarUrl?: string;
    name?: string;
    email?: string;
  }>({});
  
  // 사용자 프로필 정보 가져오기
  useEffect(() => {
    if (user) {
      setUserProfile({
        avatarUrl: user.user_metadata?.avatar_url,
        name: user.user_metadata?.name,
        email: user.email
      });
    }
  }, [user]);

  // 텍스트 에어리어 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);
  
  // 자동 포커스 설정
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      setIsFocused(true);
    }
  }, [autoFocus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const result = await onSubmit(content);
      if (result) {
        setContent(''); // 성공 시 입력 필드 초기화
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter 또는 Cmd+Enter로 제출
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleCancel = () => {
    setContent('');
    setIsFocused(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <div className="flex items-start gap-2 w-full">
        {/* 프로필 이미지/아바타 */}
        <div className="flex-shrink-0 w-6 h-6">
          {userProfile.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt="프로필"
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-xs text-gray-600">
                {userProfile.name?.[0] || userProfile.email?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
        
        {/* 입력 필드 컨테이너 */}
        <div className="flex-grow relative">
          {/* 입력 필드 */}
          <div className={`border rounded-md transition-all ${isFocused ? 'border-blue-400 shadow-sm' : 'border-gray-300'}`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              placeholder="답글을 입력하세요..."
              className="w-full p-2 focus:outline-none resize-none overflow-hidden min-h-[36px] text-sm whitespace-pre-wrap"
              rows={1}
            />
            
            {/* 버튼 영역 - 포커스 상태일 때만 표시 */}
            {isFocused && (
              <div className="flex justify-end p-1 bg-white border-t border-gray-100">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!content.trim() || isSubmitting}
                    className={`px-3 py-1 rounded text-white text-sm ${
                      !content.trim() || isSubmitting
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}>
                    {isSubmitting ? '처리 중...' : '답글'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
