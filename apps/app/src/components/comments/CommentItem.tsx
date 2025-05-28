'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
  schoolCode?: string; // 학교 코드 추가
}

export default function CommentItem({ comment, onCommentChange, schoolCode }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>(comment.content);
  const [showReplies, setShowReplies] = useState<boolean>(false);
  const [isReplyFormVisible, setIsReplyFormVisible] = useState<boolean>(false);
  // 좋아요 상태와 개수를 로컬 상태로 관리
  const [isLiked, setIsLiked] = useState<boolean>(comment.user_has_liked);
  const [likesCount, setLikesCount] = useState<number>(comment.likes_count);
  const [isLikeLoading, setIsLikeLoading] = useState<boolean>(false);
  // 답글 관련 상태
  const [replies, setReplies] = useState<CommentReply[]>([]);
  const [repliesCount, setRepliesCount] = useState<number>(comment.replies_count);
  const [repliesLoading, setRepliesLoading] = useState<boolean>(false);

  const { user, userSchool } = useUserSchool();
  const supabase = createClientComponentClient();

  // 현재 사용자가 해당 학교 학생인지 확인
  const isStudentOfSchool = userSchool && schoolCode && userSchool.school_code === schoolCode;

  const isAuthor = user && user.id === comment.user_id;

  // 날짜 포맷팅
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
        .single();
        
      setIsLiked(!error && !!data);
    } catch (err) {
      console.error('좋아요 여부 확인 오류:', err);
    }
  };
  
  // 좋아요 토글 처리 함수
  const handleLikeToggle = async () => {
    if (!user || !user.id || isLikeLoading) return;
    
    setIsLikeLoading(true);
    
    try {
      // 낙관적 UI 업데이트
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setLikesCount(prevCount => newIsLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
      
      if (newIsLiked) {
        // 좋아요 추가
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: comment.id,
            user_id: user.id
          });
          
        if (error) {
          console.error('좋아요 추가 오류:', error);
          // 오류 발생 시 UI 롤백
          setIsLiked(false);
          setLikesCount(prevCount => Math.max(0, prevCount - 1));
        }
      } else {
        // 좋아요 취소
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment.id)
          .eq('user_id', user.id);
          
        if (error) {
          console.error('좋아요 취소 오류:', error);
          // 오류 발생 시 UI 롤백
          setIsLiked(true);
          setLikesCount(prevCount => prevCount + 1);
        }
      }
      
      // 백그라운드에서 최신 좋아요 개수 가져오기
      fetchLikesCount();
    } catch (err) {
      console.error('좋아요 처리 중 오류:', err);
    } finally {
      setIsLikeLoading(false);
    }
  };
  
  // 댓글 좋아요에 대한 실시간 구독 설정
  useEffect(() => {
    if (!comment.id) return;

    // 좋아요 변경 구독 (모든 이벤트 구독)
    const likesChannel = supabase
      .channel(`comment-likes-all-${comment.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE 모두 구독
          schema: 'public',
          table: 'comment_likes'
        },
        (payload) => {
          console.log('댓글 좋아요 변경:', payload);
          
          // DELETE 이벤트 처리
          if (payload.eventType === 'DELETE') {
            const oldData = payload.old as Record<string, any>;
            if (oldData && oldData.comment_id === comment.id) {
              // 내가 좋아요를 취소한 경우 이미 UI가 업데이트되었으므로 패스
              if (user && oldData.user_id === user.id) return;
              
              // 다른 사용자의 좋아요 취소는 리얼타임 업데이트 기능 비활성화
              // 사용자가 페이지를 새로고침할 때만 변경사항이 반영됨
            }
          }
          // INSERT 이벤트 처리
          else if (payload.eventType === 'INSERT') {
            const newData = payload.new as Record<string, any>;
            if (newData && newData.comment_id === comment.id) {
              // 내가 좋아요를 누른 경우 이미 UI가 업데이트되었으므로 패스
              if (user && newData.user_id === user.id) return;
              
              // 다른 사용자가 좋아요를 누른 경우
              fetchLikesCount();
              // 내가 좋아요를 눌렀는지 다시 확인
              if (user) {
                checkUserLiked();
              }
            }
          }
        }
      )
      .subscribe();

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(likesChannel);
    };
  }, [comment.id, user]);

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

  // 답글 불러오기
  const loadReplies = async () => {
    if (!comment.id || repliesLoading) return;

    try {
      setRepliesLoading(true);

      // 답글 목록 가져오기
      const { data: repliesData, error: repliesError } = await supabase
        .from('comment_replies')
        .select('id, content, created_at, user_id, comment_id')
        .eq('comment_id', comment.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (repliesError) throw repliesError;

      // 사용자 정보 별도 가져오기
      let usersData = [];
      if (repliesData && repliesData.length > 0) {
        const userIds = repliesData.map(reply => reply.user_id);
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, nickname, profile_image')
          .in('id', userIds);

        if (usersError) {
          console.error('사용자 정보 가져오기 오류:', usersError);
        } else {
          usersData = users || [];
        }
      }

      // 각 답글별 좋아요 수 가져오기
      const replyIds = repliesData.map(reply => reply.id);

      // 좋아요 수 계산
      let likesCountMap: Record<string, number> = {};

      if (replyIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
          .from('reply_likes')
          .select('reply_id')
          .in('reply_id', replyIds);

        if (likesError) throw likesError;

        likesCountMap = likesData.reduce((acc, item) => {
          acc[item.reply_id] = (acc[item.reply_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      // 각 답글별 사용자의 좋아요 여부 확인
      let userLikesMap: Record<string, boolean> = {};

      if (user && user.id && replyIds.length > 0) {
        const { data: userLikesData, error: userLikesError } = await supabase
          .from('reply_likes')
          .select('reply_id')
          .in('reply_id', replyIds)
          .eq('user_id', user.id);

        if (userLikesError) throw userLikesError;

        userLikesMap = (userLikesData || []).reduce((acc, item) => {
          acc[item.reply_id] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      // 데이터 가공
      const processedReplies: CommentReply[] = repliesData.map(reply => {
        // 가져온 사용자 데이터에서 해당 사용자 찾기
        const userData = usersData.find(user => user.id === reply.user_id) || null;

        return {
          id: reply.id,
          content: reply.content,
          created_at: reply.created_at,
          user_id: reply.user_id,
          comment_id: reply.comment_id,
          user: {
            id: userData?.id || reply.user_id || '',
            email: userData?.email || '',
            user_metadata: {
              name: userData?.nickname || '',
              avatar_url: userData?.profile_image || ''
            }
          },
          likes_count: likesCountMap[reply.id] || 0,
          user_has_liked: !!userLikesMap[reply.id]
        };
      });

      setReplies(processedReplies);
      setRepliesCount(processedReplies.length);
    } catch (err) {
      console.error('답글 불러오기 오류:', err);
    } finally {
      setRepliesLoading(false);
    }
  };

  // 답글 추가 함수
  const handleAddReply = async (content: string): Promise<boolean> => {
    if (!user || !user.id || !comment.id || !content.trim()) return false;

    try {
      const { error } = await supabase
        .from('comment_replies')
        .insert({
          comment_id: comment.id,
          user_id: user.id,
          content: content.trim()
        });

      if (error) throw error;

      // 답글 목록 새로고침
      await loadReplies();
      setRepliesCount(prev => prev + 1);
      onCommentChange(); // 댓글 목록 새로고침 (답글 수 업데이트를 위해)
      return true;
    } catch (err) {
      console.error('답글 추가 중 오류:', err);
      return false;
    }
  };

  // 답글 변경 처리 (삭제, 수정, 좋아요 등)
  const handleReplyChange = () => {
    loadReplies();
  };
  
  // 댓글 및 답글 개수 가져오기
  const fetchCount = async () => {
    if (!comment.id) return;
    
    try {
      const { data, error } = await supabase
        .from('comment_replies')
        .select('id')
        .eq('comment_id', comment.id)
        .eq('is_deleted', false);
        
      if (!error && data) {
        setRepliesCount(data.length);
      }
    } catch (err) {
      console.error('답글 개수 가져오기 오류:', err);
    }
  };

// 초기 답글 수 설정
useEffect(() => {
  setRepliesCount(comment.replies_count);
  setIsLiked(comment.user_has_liked);
  setLikesCount(comment.likes_count);
  
  // 초기 로드 시 좋아요 상태 확인
  if (user && user.id) {
    checkUserLiked();
    fetchLikesCount();
  }
}, [comment.replies_count, comment.user_has_liked, comment.likes_count, user]);

// 실시간 답글 업데이트를 위한 구독 설정
useEffect(() => {
  if (!comment.id) return;

  // 답글 추가 구독
  const repliesInsertChannel = supabase
    .channel(`replies-insert-${comment.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comment_replies',
        filter: `comment_id=eq.${comment.id}`
      },
      (payload) => {
        console.log('답글 추가:', payload);
        // 답글 추가 시 개수 가져오기
        fetchCount();
        
        // 답글 추가 시, 화면에 표시된 답글이 있다면 답글 목록 갱신
        if (showReplies) {
          loadReplies();
        }
      }
    )
    .subscribe();
    
  // 답글 삭제 구독 - DELETE 이벤트에서는 filter를 사용하지 않음
  const repliesDeleteChannel = supabase
    .channel(`replies-delete-${comment.id}`)
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'comment_replies'
        // DELETE 이벤트에서는 이미 레코드가 삭제되었으므로 filter를 사용하지 않음
      },
      (payload) => {
        console.log('답글 삭제:', payload);
        const oldData = payload.old as Record<string, any>;
        
        // 삭제된 답글이 현재 댓글의 답글인지 확인
        if (oldData && oldData.comment_id === comment.id) {
          // 답글 삭제 시 리얼타임 업데이트 기능 비활성화
          // 사용자가 페이지를 새로고침할 때만 변경사항이 반영됨
        }
      }
    )
    .subscribe();
    
  // 답글 업데이트 구독
  const repliesUpdateChannel = supabase
    .channel(`replies-update-${comment.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'comment_replies',
        filter: `comment_id=eq.${comment.id}`
      },
      (payload) => {
        console.log('답글 업데이트:', payload);
        // 답글 업데이트 시 개수 가져오기
        fetchCount();
        
        // 답글 업데이트 시, 화면에 표시된 답글이 있다면 답글 목록 갱신
        if (showReplies) {
          loadReplies();
        }
      }
    )
    .subscribe();
    
  const replyLikesChannel = supabase
    .channel(`reply-likes-for-comment-${comment.id}`)
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reply_likes'
      },
      (payload) => {
        const newData = payload.new as Record<string, any>;
        const oldData = payload.old as Record<string, any>;
        const replyId = newData?.reply_id || oldData?.reply_id;
        
        if (showReplies && replyId && replies.some(r => r.id === replyId)) {
          console.log('답글 좋아요 변경:', payload);
          loadReplies(); // 표시된 답글에 대한 좋아요 변경이 있을 때 새로고침
        }
      }
    )
    .subscribe();

    


    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(repliesInsertChannel);
      supabase.removeChannel(repliesDeleteChannel);
      supabase.removeChannel(repliesUpdateChannel);
      supabase.removeChannel(replyLikesChannel);
    };
  }, [comment.id, showReplies, replies, user]);

  // 수정/삭제 메뉴 토글
  const [showMenu, setShowMenu] = useState<boolean>(false);
  
  // 클릭 이벤트 처리 - 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.comment-menu')) {
        setShowMenu(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex flex-col">
        {/* 사용자 정보 및 날짜 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {comment.user?.user_metadata?.avatar_url ? (
                <img
                  src={comment.user.user_metadata.avatar_url}
                  alt="프로필"
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-xs">
                    {comment.user?.user_metadata?.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>
            <div className="ml-2">
              <span className="text-xs text-gray-700">
                {comment.user?.user_metadata?.name || '익명'}
              </span>
              <span className="ml-2 text-xs text-gray-400">{formattedDate}</span>
            </div>
          </div>
          
          {/* 점 3개 아이콘 - 자기가 쓴 글에만 표시 */}
          {isAuthor && !isEditing && (
            <div className="relative comment-menu">
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
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900"
              >
                취소
              </button>
              <button
                onClick={handleEdit}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm font-medium text-gray-800 whitespace-pre-wrap break-words">{comment.content}</p>
        )}

        {/* 좋아요 및 답글 버튼 - 유튜브 스타일 */}
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

            {/* 답글 버튼 - 답글이 있을 때만 표시 */}
            {repliesCount > 0 ? (
              <button
                onClick={() => {
                  if (!showReplies && replies.length === 0) {
                    loadReplies();
                  }
                  setShowReplies(!showReplies);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                <span>답글 {repliesCount}개&gt;</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!showReplies && replies.length === 0) {
                    loadReplies();
                  }
                  setShowReplies(!showReplies);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center opacity-0 hover:opacity-50"
              >
                <span>답글 &gt;</span>
              </button>
            )}

            {user && isStudentOfSchool && (
              <button
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
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
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M3,17.25 L3,21 L6.75,21 L17.81,9.94 L14.06,6.19 L3,17.25 Z M21.41,6.34 L17.66,2.59 C17.2706655,2.20798298 16.6593396,2.20857968 16.27,2.59 L13.13,5.73 L16.88,9.48 L20.02,6.34 C20.4,5.96 20.4,5.34 20.02,4.96 L21.41,6.34 Z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 답글 섹션 */}
        {showReplies && (
          <div className="mt-1 ml-5 pl-3 relative">
            {/* 유튜브 스타일 라인 - SVG 사용 */}
            <div className="absolute left-0 top-0 h-full" style={{ width: '16px' }}>
              <svg width="16" height="100%" className="overflow-visible">
                <path 
                  d="M1,0 L1,calc(100% - 8) Q1,calc(100% - 0) 9,calc(100% - 0)" 
                  stroke="#e5e7eb" 
                  strokeWidth="1.5" 
                  fill="none" 
                />
              </svg>
            </div>
            {/* 답글 작성 폼 */}
            {isReplyFormVisible && user && isStudentOfSchool && (
              <ReplyForm onSubmit={handleAddReply} />
            )}
            
            {/* 답글 목록 */}
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
            ) : (
              <p className="text-sm text-gray-500 py-2">아직 답글이 없습니다. 첫 답글을 남겨보세요!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
