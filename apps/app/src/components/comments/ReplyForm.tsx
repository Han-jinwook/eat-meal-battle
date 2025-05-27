'use client';

import { useState } from 'react';

interface ReplyFormProps {
  onSubmit: (content: string) => Promise<boolean>;
  autoFocus?: boolean;
}

export default function ReplyForm({ onSubmit, autoFocus = true }: ReplyFormProps) {
  const [content, setContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="flex">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="답글을 입력하세요..."
          className="flex-grow p-2 border border-gray-300 rounded-l text-sm"
          autoFocus={autoFocus}
        />
        <button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className={`px-3 py-2 rounded-r text-white text-sm ${
            !content.trim() || isSubmitting
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isSubmitting ? '처리 중...' : '답글'}
        </button>
      </div>
    </form>
  );
}
