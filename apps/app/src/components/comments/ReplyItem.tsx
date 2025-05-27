'use client';

import { useState, useEffect } from 'react';
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
  const [showMenu, setShowMenu] = useState<boolean>(false);
  
  // 클릭 이벤트 처리 - 외부 클릭 시 메뉴 닫기
  // 실시간 좋아요 업데이트를 위한 구독 설정
  useEffect(() => {
    if (!reply.id) return;

    // 좋아요 추가 구독
    const likesInsertChannel = supabase
      .channel(`reply-likes-insert-${reply.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reply_likes',
          filter: `reply_id=eq.${reply.id}`
        },
        (payload) => {
          console.log('답글 좋아요 추가:', payload);
          fetchLikesCount();
        }
      )
      .subscribe();
      
    // 좋아요 삭제 구독 - DELETE 이벤트에서는 filter를 사용하지 않음
    const likesDeleteChannel = supabase
      .channel(`reply-likes-delete-${reply.id}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'reply_likes'
          // DELETE 이벤트에서는 이미 레코드가 삭제되었으므로 filter를 사용하지 않음
        },
        (payload) => {
          console.log('답글 좋아요 삭제:', payload);
          const oldData = payload.old as Record<string, any>;
          // 삭제된 좋아요가 현재 답글의 좋아요인지 확인
          if (oldData && oldData.reply_id === reply.id) {
            fetchLikesCount();
          }
        }
      )
      .subscribe();

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(likesInsertChannel);
      supabase.removeChannel(likesDeleteChannel);
    };
  }, [reply.id]);
  
  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.reply-menu')) {
        setShowMenu(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
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
        .from('comment_replies')
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
        .from('comment_replies')
        .delete()
        .eq('id', reply.id);
        
      if (error) throw error;
      
      onReplyChange();
    } catch (err) {
      console.error('답글 삭제 중 오류:', err);
    }
  };
  
  // 실시간으로 좋아요 개수를 가져오는 함수
  const fetchLikesCount = async () => {
    try {
      const { count, error } = await supabase
        .from('reply_likes')
        .select('*', { count: 'exact', head: true })
        .eq('reply_id', reply.id);
        
      if (error) throw error;
      
      // 현재 사용자의 좋아요 여부 확인
      if (user && user.id) {
        const { data, error: likeError } = await supabase
          .from('reply_likes')
          .select('id')
          .eq('reply_id', reply.id)
          .eq('user_id', user.id)
          .single();
          
        if (!likeError && data) {
          setIsLiked(true);
        } else {
          setIsLiked(false);
        }
      }
      
      setLikesCount(count || 0);
    } catch (err) {
      console.error('답글 좋아요 개수 가져오기 오류:', err);
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
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xs text-gray-500">
                    {reply.user.user_metadata?.name?.[0] || reply.user.email[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-700">
                    {reply.user.user_metadata?.name || reply.user.email?.split('@')[0] || '사용자'}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">{formattedDate}</span>
                </div>
                
                {/* 점 3개 아이콘 - 자기가 쓴 글에만 표시 */}
                {isAuthor && !isEditing && (
                  <div className="relative reply-menu">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                      }}
                      className="text-gray-500 hover:text-gray-700 p-1"
                    >
                      <span className="text-xl leading-none">⋮</span>
                    </button>
                    
                    {/* 수정/삭제 드롭다운 메뉴 */}
                    {showMenu && (
                      <div className="absolute right-0 top-6 bg-white shadow-md rounded-md py-1 z-10 w-20">
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 text-gray-700"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => {
                            handleDelete();
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 text-red-500"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm font-medium break-words">{reply.content}</p>
              
              {/* 좋아요 버튼 */}
              <div className="mt-1 flex items-center">
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
        </>
      )}
    </div>
  );
}
