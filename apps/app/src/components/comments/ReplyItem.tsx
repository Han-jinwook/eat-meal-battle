'use client';

import { useState } from 'react';
import { CommentReply } from './types';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import useUserSchool from '@/hooks/useUserSchool';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import LikeButton from './LikeButton';

interface ReplyItemProps {
  reply: CommentReply;
  onReplyChange: () => void;
  schoolCode?: string;
}

export default function ReplyItem({ reply, onReplyChange, schoolCode }: ReplyItemProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>(reply.content);
  const [isLiked, setIsLiked] = useState<boolean>(reply.user_has_liked);
  const [likesCount, setLikesCount] = useState<number>(reply.likes_count);
  const [isLikeLoading, setIsLikeLoading] = useState<boolean>(false);
  
  const { user, userSchool } = useUserSchool();
  const supabase = createClientComponentClient();
  
  // 현재 사용자가 해당 학교 학생인지 확인
  const isStudentOfSchool = userSchool && schoolCode && userSchool.school_code === schoolCode;
  
  const isAuthor = user && user.id === reply.user_id;
  
  // 날짜 포맷팅
  const formattedDate = formatDistanceToNow(new Date(reply.created_at), {
    addSuffix: true,
    locale: ko
  });
  
  // 답글 수정 제출
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editContent.trim() || !user || !isAuthor) return;
    
    try {
      const { error } = await supabase
        .from('replies')
        .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
        .eq('id', reply.id);
        
      if (error) throw error;
      
      setIsEditing(false);
      onReplyChange();
    } catch (err) {
      console.error('답글 수정 중 오류:', err);
    }
  };
  
  // 답글 삭제
  const handleDelete = async () => {
    if (!user || !isAuthor) return;
    
    if (!window.confirm('정말로 이 답글을 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase
        .from('replies')
        .delete()
        .eq('id', reply.id);
        
      if (error) throw error;
      
      onReplyChange();
    } catch (err) {
      console.error('답글 삭제 중 오류:', err);
    }
  };
  
  // 좋아요 토글 처리
  const handleLikeToggle = async () => {
    if (!user || !user.id || isLikeLoading) return;
    
    setIsLikeLoading(true);
    
    try {
      // 낙관적 UI 업데이트 - 즉시 UI 변경
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setLikesCount(prevCount => newIsLiked ? prevCount + 1 : prevCount - 1);
      
      if (isLiked) {
        // 좋아요 취소
        const { error } = await supabase
          .from('reply_likes')
          .delete()
          .eq('reply_id', reply.id)
          .eq('user_id', user.id);
          
        if (error) {
          // 에러 발생 시 UI 롤백
          setIsLiked(!newIsLiked);
          setLikesCount(prevCount => !newIsLiked ? prevCount + 1 : prevCount - 1);
          throw error;
        }
      } else {
        // 좋아요 추가
        const { error } = await supabase
          .from('reply_likes')
          .insert({
            reply_id: reply.id,
            user_id: user.id
          });
          
        if (error) {
          // 에러 발생 시 UI 롤백
          setIsLiked(!newIsLiked);
          setLikesCount(prevCount => !newIsLiked ? prevCount + 1 : prevCount - 1);
          throw error;
        }
      }
      
      // 백그라운드에서 전체 데이터 새로고침
      onReplyChange();
    } catch (err) {
      console.error('좋아요 처리 중 오류:', err);
    } finally {
      setIsLikeLoading(false);
    }
  };
  
  return (
    <div className="py-2 pl-8 border-l border-gray-200">
      {isEditing ? (
        // 수정 폼
        <form onSubmit={handleEditSubmit} className="mt-2">
          <input
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            autoFocus
          />
          <div className="mt-2 flex space-x-2">
            <button
              type="submit"
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditContent(reply.content);
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start">
            <div className="mr-2">
              {reply.user.user_metadata?.avatar_url ? (
                <img
                  src={reply.user.user_metadata.avatar_url}
                  alt="프로필"
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xs text-gray-500">
                    {reply.user.user_metadata?.name?.[0] || reply.user.email[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center">
                <span className="font-medium text-sm">
                  {reply.user.user_metadata?.name || reply.user.email?.split('@')[0] || '사용자'}
                </span>
                <span className="ml-2 text-xs text-gray-500">{formattedDate}</span>
              </div>
              <p className="mt-1 text-sm break-words">{reply.content}</p>
              
              {/* 좋아요 버튼 */}
              <div className="mt-2 flex items-center space-x-4">
                <LikeButton 
                  count={likesCount} 
                  isLiked={isLiked}
                  onToggle={user && isStudentOfSchool ? handleLikeToggle : () => {
                    alert('해당 학교 학생만 좋아요를 할 수 있습니다.');
                  }}
                  disabled={isLikeLoading}
                />
              </div>
            </div>
          </div>
          
          {/* 수정/삭제 버튼 (작성자에게만 표시) */}
          {isAuthor && (
            <div className="mt-2 flex space-x-2 ml-8">
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                className="text-xs text-gray-500 hover:text-red-500"
              >
                삭제
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
