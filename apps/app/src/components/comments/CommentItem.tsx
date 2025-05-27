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
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment.id)
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
          .from('comment_likes')
          .insert({
            comment_id: comment.id,
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
      onCommentChange();
    } catch (err) {
      console.error('좋아요 처리 중 오류:', err);
    } finally {
      setIsLikeLoading(false);
    }
  };

  // 초기 답글 수 설정
  useEffect(() => {
    setRepliesCount(comment.replies_count);
  }, [comment.replies_count]);

  // 답글 실시간 업데이트 설정
  useEffect(() => {
    if (!comment.id) return;

    // 답글 변경 구독
    const repliesChannel = supabase
      .channel(`replies-${comment.id}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'replies',
          filter: `comment_id=eq.${comment.id}`
        },
        (payload) => {
          console.log('답글 변경:', payload);
          if (showReplies) {
            loadReplies(); // 표시된 답글이 있을 때만 새로고침
          } else {
            // 답글이 표시되지 않을 때는 개수만 업데이트
            const fetchCount = async () => {
              const { count } = await supabase
                .from('comment_replies')
                .select('id', { count: 'exact' })
                .eq('comment_id', comment.id)
                .eq('is_deleted', false);

              setRepliesCount(count || 0);
            };

            fetchCount();
          }
          onCommentChange(); // 댓글 목록 새로고침 (답글 수 업데이트를 위해)
        }
      )
      .subscribe();

    // 답글 좋아요 변경 구독
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
      supabase.removeChannel(repliesChannel);
      supabase.removeChannel(replyLikesChannel);
    };
  }, [comment.id, showReplies, replies]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-start">
        {/* 프로필 이미지 */}
        <div className="flex-shrink-0 mr-3">
          {comment.user?.user_metadata?.avatar_url ? (
            <img
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

          {/* 좋아요 및 답글 버튼 - 유튜브 스타일 */}
          <div className="mt-3 flex items-center space-x-4">
            <LikeButton
              count={likesCount}
              isLiked={isLiked}
              onToggle={user && isStudentOfSchool ? handleLikeToggle : () => {
                alert('해당 학교 학생만 좋아요를 할 수 있습니다.');
              }}
              disabled={isLikeLoading}
            />

            <button
              onClick={() => {
                if (!showReplies && replies.length === 0) {
                  loadReplies();
                }
                setShowReplies(!showReplies);
              }}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center px-2 py-1 rounded-md"
            >
              <span className="mr-1">답글{repliesCount > 0 ? repliesCount : ''}</span>
              <span className="ml-1">💬</span>
            </button>

            {user && isStudentOfSchool && (
              <button
                className="text-sm text-blue-500 hover:text-blue-700 ml-3 px-2 py-1 rounded-md flex items-center"
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
                <span>✏️</span>
              </button>
            )}
          </div>

          {/* 답글 섹션 */}
          {showReplies && (
            <div className="mt-3 ml-5 border-l border-gray-200 pl-3">
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
    </div>
  );
}
