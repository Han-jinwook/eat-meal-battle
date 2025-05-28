'use client';

import { useState, useRef, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface CommentFormProps {
  onSubmit: (content: string) => Promise<boolean>;
  placeholder?: string;
  buttonText?: string;
}

export default function CommentForm({ 
  onSubmit, 
  placeholder = '댓글 추가...', 
  buttonText = '댓글'
}: CommentFormProps) {
  const [content, setContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState<string>('?');
  const supabase = createClientComponentClient();
  
  // 사용자 정보 가져오기
  useEffect(() => {
    const getUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserAvatar(session.user.user_metadata?.avatar_url || null);
          setUserInitial((session.user.email?.charAt(0) || '?').toUpperCase());
        }
      } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
      }
    };
    
    getUserProfile();
  }, [supabase]);
  
  // 텍스트 영역 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);
  
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
  
  const handleCancel = () => {
    setContent('');
    setIsFocused(false);
    if (textareaRef.current) {
      textareaRef.current.blur();
      textareaRef.current.style.height = "auto";
    }
  };
  
  return (
    <div className="flex items-start gap-3">
      {/* 프로필 이미지 */}
      <div className="flex-shrink-0 w-8 h-8 overflow-hidden rounded-full">
        {userAvatar ? (
          <img 
            src={userAvatar} 
            alt="프로필" 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-avatar.png';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
            {userInitial}
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
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            className="w-full p-2 focus:outline-none resize-none overflow-hidden min-h-[36px]"
            rows={1}
          />
        </div>
        
        {/* 버튼 영역 - 포커스 시에만 표시 */}
        {isFocused && (
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={`px-3 py-1.5 text-sm font-medium rounded-full ${
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
