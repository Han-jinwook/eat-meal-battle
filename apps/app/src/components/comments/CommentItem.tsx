'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useUser } from '@supabase/auth-helpers-react';
import { Comment } from './types';
import LikeButton from './LikeButton';
import Image from 'next/image';
import { User } from '@supabase/supabase-js';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CommentItemProps {
  comment: Comment;
  onCommentChange: () => void;
}

export default function CommentItem({ comment, onCommentChange }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>(comment.content);
  const [showReplies, setShowReplies] = useState<boolean>(false);
  const user = useUser();
  const supabase = createClientComponentClient();
  
  const isAuthor = user && user.id === comment.user_id;
  
  // 날짜 포맷팅
  const formattedDate = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: ko
  });
  
  // 댓글 수정
  const handleEdit = async () => {
    if (!isAuthor || !editContent.trim()) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
        .eq('id', comment.id);
        
      if (error) throw error;
      
      setIsEditing(false);
      onCommentChange();
    } catch (err) {
      console.error('댓글 수정 중 오류:', err);
    }
  };
  
  // 댓글 삭제 (소프트 삭제)
  const handleDelete = async () => {
    if (!isAuthor) return;
    
    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .update({ is_deleted: true })
        .eq('id', comment.id);
        
      if (error) throw error;
      
      onCommentChange();
    } catch (err) {
      console.error('댓글 삭제 중 오류:', err);
    }
  };
  
  // 좋아요 토글 처리
  const handleLikeToggle = async () => {
    if (!user || !user.id) return;
    
    try {
      if (comment.user_has_liked) {
        // 좋아요 취소
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
      } else {
        // 좋아요 추가
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: comment.id,
            user_id: user.id
          });
          
        if (error) throw error;
      }
      
      onCommentChange(); // 댓글 목록 새로고침
    } catch (err) {
      console.error('좋아요 처리 중 오류:', err);
    }
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-start">
        {/* 프로필 이미지 */}
        <div className="flex-shrink-0 mr-3">
          {comment.user?.user_metadata?.avatar_url ? (
            <Image
              src={comment.user.user_metadata.avatar_url}
              alt={comment.user?.user_metadata?.name || '사용자'}
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-sm">
                {(comment.user?.user_metadata?.name || comment.user?.email || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex-1">
          {/* 사용자 정보 및 날짜 */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-gray-900">
                {comment.user?.user_metadata?.name || comment.user?.email || '알 수 없는 사용자'}
              </span>
              <span className="ml-2 text-xs text-gray-500">{formattedDate}</span>
            </div>
            
            {/* 수정/삭제 버튼 (작성자만 표시) */}
            {isAuthor && (
              <div className="flex space-x-2">
                {!isEditing && (
                  <>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      수정
                    </button>
                    <button 
                      onClick={handleDelete}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* 댓글 내용 */}
          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <div className="mt-2 flex justify-end space-x-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  취소
                </button>
                <button 
                  onClick={handleEdit}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-gray-800">{comment.content}</p>
          )}
          
          {/* 좋아요 및 답글 버튼 */}
          <div className="mt-3 flex items-center space-x-4">
            <LikeButton 
              count={comment.likes_count} 
              isLiked={comment.user_has_liked}
              onToggle={handleLikeToggle}
            />
            
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <span className="mr-1">💬</span>
              {comment.replies_count > 0 
                ? `답글 ${comment.replies_count}개`
                : '답글 달기'
              }
            </button>
          </div>
          
          {/* 답글 섹션 - 추후 구현 */}
          {showReplies && (
            <div className="mt-3 pl-4 border-l-2 border-gray-200">
              <p className="text-sm text-gray-500">답글 기능은 곧 추가될 예정입니다!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
