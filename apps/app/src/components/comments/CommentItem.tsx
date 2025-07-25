'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Comment, CommentReply } from './types';
import useUserSchool from '@/hooks/useUserSchool';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import LikeButton from './LikeButton';
import ReplyForm from './ReplyForm';
import ReplyItem from './ReplyItem';

interface CommentItemProps {
  comment: Comment;
  onCommentChange: () => void;
  schoolCode?: string;
}

export default function CommentItem({ comment, onCommentChange, schoolCode }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>(comment.content);
  const [showReplies, setShowReplies] = useState<boolean>(false);
  const [isReplyFormVisible, setIsReplyFormVisible] = useState<boolean>(false);
  const [isLiked, setIsLiked] = useState<boolean>(comment.user_has_liked);
  const [likesCount, setLikesCount] = useState<number>(comment.likes_count);
  const [isLikeLoading, setIsLikeLoading] = useState<boolean>(false);
  const [replies, setReplies] = useState<CommentReply[]>([]);
  const [repliesCount, setRepliesCount] = useState<number>(comment.replies_count);
  const [repliesLoading, setRepliesLoading] = useState<boolean>(false);

  const { user, userSchool } = useUserSchool();
  const supabase = createClient();

  const isStudentOfSchool = userSchool && schoolCode && userSchool.school_code === schoolCode;
  const isAuthor = user && user.id === comment.user_id;

  const formattedDate = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: ko
  });
  
  // 실시간으로 좋아요 개수를 가져오는 함수
  const fetchLikesCount = async () => {
    try {
      const { count, error } = await supabase
        .from('comment_likes')
        .select('*', { count: 'exact', head: true })
        .eq('comment_id', comment.id);
        
      if (error) throw error;
      setLikesCount(count || 0);
    } catch (err) {
      console.error('댓글 좋아요 개수 가져오기 오류:', err);
    }
  };
  
  // 현재 사용자의 좋아요 여부 확인 함수
  const checkUserLiked = async () => {
    if (!user || !user.id) return;
    
    try {
      const { data, error } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', comment.id)
        .eq('user_id', user.id)
        .maybeSingle();
        
      setIsLiked(!error && !!data);
    } catch (err) {
      console.debug('좋아요 여부 확인 중 오류 무시:', err);
      setIsLiked(false);
    }
  };
  
  // 좋아요 토글 처리 함수
  const handleLikeToggle = async () => {
    if (!user || !user.id || isLikeLoading) return;
    
    setIsLikeLoading(true);
    
    try {
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setLikesCount(prevCount => newIsLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
      
      if (newIsLiked) {
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: comment.id,
            user_id: user.id
          });
          
        if (error) {
          console.error('좋아요 추가 오류:', error);
          setIsLiked(false);
          setLikesCount(prevCount => Math.max(0, prevCount - 1));
        }
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment.id)
          .eq('user_id', user.id);
          
        if (error) {
          console.error('좋아요 취소 오류:', error);
          setIsLiked(true);
          setLikesCount(prevCount => prevCount + 1);
        }
      }
      
      fetchLikesCount();
    } catch (err) {
      console.error('좋아요 처리 중 오류:', err);
    } finally {
      setIsLikeLoading(false);
    }
  };

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

  // 댓글 삭제
  const handleDelete = async () => {
    if (!user || !isAuthor) return;

    if (!window.confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', comment.id);

      if (error) throw error;

      onCommentChange();
    } catch (err) {
      console.error('댓글 삭제 중 오류:', err);
    }
  };

  // 답글 불러오기 (단순화된 버전)
  const loadReplies = async () => {
    setRepliesLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('comment_replies')
        .select('id, content, created_at, user_id, comment_id, reply_to_user_id')
        .eq('comment_id', comment.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      
      if (data) {
        // 사용자 정보와 좋아요 정보 추가
        const repliesWithExtras = await Promise.all(
          data.map(async (reply) => {
            try {
              // 답글 작성자 정보 가져오기
              let replyUser = null;
              try {
                const { data: userData } = await supabase
                  .from('users')
                  .select('id, email, nickname, profile_image')
                  .eq('id', reply.user_id)
                  .single();
                  
                if (userData) {
                  replyUser = {
                    id: userData.id,
                    email: userData.email,
                    user_metadata: {
                      name: userData.nickname || userData.email?.split('@')[0] || '사용자',
                      avatar_url: userData.profile_image
                    }
                  };
                }
              } catch (userError) {
                console.log('답글 작성자 정보 가져오기 오류:', userError);
              }
              
              // reply_to_user 정보 가져오기 (중청 답글용)
              let replyToUser = null;
              if (reply.reply_to_user_id) {
                try {
                  const { data: replyToUserData } = await supabase
                    .from('users')
                    .select('id, email, nickname, profile_image')
                    .eq('id', reply.reply_to_user_id)
                    .single();
                    
                  if (replyToUserData) {
                    replyToUser = {
                      id: replyToUserData.id,
                      email: replyToUserData.email,
                      user_metadata: {
                        name: replyToUserData.nickname || replyToUserData.email?.split('@')[0] || '사용자',
                        avatar_url: replyToUserData.profile_image
                      }
                    };
                  }
                } catch (replyToUserError) {
                  console.log('reply_to_user 정보 가져오기 오류:', replyToUserError);
                }
              }
              
              // 좋아요 개수 가져오기
              const { count: likesCount } = await supabase
                .from('reply_likes')
                .select('*', { count: 'exact', head: true })
                .eq('reply_id', reply.id);
                
              // 현재 사용자의 좋아요 여부
              let isLiked = false;
              if (user && user.id) {
                const { data: userLike } = await supabase
                  .from('reply_likes')
                  .select('id')
                  .eq('reply_id', reply.id)
                  .eq('user_id', user.id)
                  .maybeSingle();
                  
                isLiked = !!userLike;
              }
              
              return {
                ...reply,
                user: replyUser,
                reply_to_user: replyToUser,
                likes_count: likesCount || 0,
                user_has_liked: isLiked
              };
            } catch (error) {
              console.log('답글 처리 중 오류:', error);
              // 오류 발생 시 기본값으로 반환
              return {
                ...reply,
                user: null,
                reply_to_user: null,
                likes_count: 0,
                user_has_liked: false
              };
            }
          })
        );
        
        setReplies(repliesWithExtras);
        setRepliesCount(repliesWithExtras.length);
      }
    } catch (err) {
      console.error('답글 불러오기 오류:', err);
    } finally {
      setRepliesLoading(false);
    }
  };

  // 답글 추가 함수
  const handleAddReply = async (content: string): Promise<boolean> => {
    if (!user || !content.trim()) return false;
    
    try {
      const { error } = await supabase
        .from('comment_replies')
        .insert({
          comment_id: comment.id,
          user_id: user.id,
          content: content.trim(),
          // 1차 답글이므로 reply_to_user_id를 지정하지 않음
        });
        
      if (error) throw error;
      
      // 답글 목록 새로고침
      await loadReplies();
      // 답글 작성 폼 숨기기
      setIsReplyFormVisible(false);
      return true;
    } catch (err) {
      console.error('답글 추가 오류:', err);
      return false;
    }
  };

  // 답글 변경 처리
  const handleReplyChange = () => {
    loadReplies();
  };

  return (
    <div className="bg-white dark:bg-white p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-300" style={{ color: '#111827' }}>
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {comment.user?.user_metadata?.name?.charAt(0) || 
           comment.user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {comment.user?.user_metadata?.name || 
                 comment.user?.email?.split('@')[0] || '익명'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</span>
            </div>
            
            {isAuthor && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
              >
                수정
              </button>
            )}
          </div>
          
          {isEditing ? (
            <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }} className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm"
                rows={3}
                style={{ color: '#111827' }}
              />
              <div className="flex space-x-2 mt-2">
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="mt-1 text-sm text-gray-900 dark:text-gray-100 break-words whitespace-pre-wrap">
                {comment.content}
              </div>
              
              <div className="mt-2 flex items-center">
                <div className="flex items-center space-x-4">
                  <LikeButton
                    count={likesCount}
                    isLiked={isLiked}
                    onToggle={user && isStudentOfSchool ? handleLikeToggle : () => {
                      alert('해당 학교 학생만 좋아요를 할 수 있습니다.');
                    }}
                    disabled={isLikeLoading}
                  />

                  {repliesCount > 0 ? (
                    <button
                      onClick={() => {
                        if (!showReplies && replies.length === 0) {
                          loadReplies();
                        }
                        setShowReplies(!showReplies);
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 flex items-center"
                    >
                      <span>답글 {repliesCount}개 &gt;</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!showReplies && replies.length === 0) {
                          loadReplies();
                        }
                        setShowReplies(!showReplies);
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 flex items-center opacity-0 hover:opacity-50"
                    >
                      <span>답글 &gt;</span>
                    </button>
                  )}

                  {user && isStudentOfSchool && (
                    <button
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                      onClick={() => {
                        setIsReplyFormVisible(!isReplyFormVisible);
                        if (!showReplies) {
                          setShowReplies(true);
                          if (replies.length === 0) {
                            loadReplies();
                          }
                        }
                      }}
                      title="답글 작성"
                    >
                      <span className="text-xs">답글</span>
                    </button>
                  )}
                </div>
              </div>

              {showReplies && (
                <div className="mt-1 ml-5 pl-3 relative">
                  <div className="absolute left-0 top-0 h-full" style={{ width: '16px' }}>
                    <svg width="16" height="100%" className="overflow-visible">
                      <path 
                        d="M1,0 L1,100% Q1,100% 9,100%" 
                        stroke="#e5e7eb" 
                        strokeWidth="1.5" 
                        fill="none" 
                      />
                    </svg>
                  </div>
                  
                  {isReplyFormVisible && user && isStudentOfSchool && (
                    <ReplyForm onSubmit={handleAddReply} />
                  )}
                  
                  {repliesLoading ? (
                    <p className="text-sm text-gray-500 py-2">답글을 불러오는 중...</p>
                  ) : replies.length > 0 ? (
                    <div className="space-y-2 my-2">
                      {replies.map(reply => (
                        <ReplyItem 
                          key={reply.id}
                          reply={reply}
                          onReplyChange={handleReplyChange}
                          schoolCode={schoolCode}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
