'use client';

import { useState, useRef, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import useUserSchool from '@/hooks/useUserSchool';

interface ReplyFormProps {
  onSubmit: (content: string) => Promise<boolean>;
  autoFocus?: boolean;
  placeholder?: string;
  buttonText?: string;
}

export default function ReplyForm({ 
  onSubmit, 
  autoFocus = true, 
  placeholder = '답글 추가...', 
  buttonText = '답글'
}: ReplyFormProps) {
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

  // 텍스트 영역 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
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
    
    try {
      setIsSubmitting(true);
      const success = await onSubmit(content);
      
      if (success) {
        setContent('');
        setIsFocused(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
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
      textareaRef.current.blur();
      textareaRef.current.style.height = "auto";
    }
  };
  
  return (
    <div className="flex items-start gap-2 mt-2">
      {/* 프로필 이미지 */}
      <div className="flex-shrink-0 w-6 h-6 overflow-hidden rounded-full">
        {userProfile.avatarUrl ? (
          <img 
            src={userProfile.avatarUrl} 
            alt="프로필" 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-avatar.png';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
            {userProfile.name?.[0] || userProfile.email?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      
      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="flex-grow">
        <div className={`border-b ${isFocused ? 'border-black' : 'border-gray-300'} transition-all duration-200`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            className="w-full p-2 focus:outline-none resize-none overflow-hidden min-h-[36px] text-sm"
            rows={1}
          />
        </div>
        
        {/* 버튼 영역 - 포커스 시에만 표시 */}
        {isFocused && (
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                !content.trim() || isSubmitting
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? '게시 중...' : buttonText}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
