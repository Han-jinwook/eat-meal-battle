'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import CommentForm from './CommentForm';
import { User } from '@supabase/supabase-js';
import { Comment } from './types';
import useUserSchool from '../../hooks/useUserSchool';
import { useSchoolMode } from '../../hooks/useSchoolMode';
import { isWithinAllowedTime, getTimeConstraintMessage } from '../../utils/timeConstraints';

// 순환 참조를 피하기 위해 동적 임포트 대신 타입 단언을 사용
import CommentItem from './CommentItem';

interface CommentSectionProps {
  mealId: string;
  className?: string;
  schoolCode?: string; // 학교 코드 추가
  mealDate: string; // 시간 제약을 위한 급식 날짜
}

export default function CommentSection({ mealId, className = '', schoolCode, mealDate }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // useUserSchool 후크을 통해 사용자 정보 가져오기
  const { user, userSchool } = useUserSchool();
  
  // 학교 모드 및 권한 관리
  const schoolMode = useSchoolMode(userSchool);
  
  // 댓글 작성 권한 확인 (이미지 승인에 종속)
  const [canComment, setCanComment] = useState<boolean>(false);
  
  const supabase = createClient();
  
  const PAGE_SIZE = 10;

  // 댓글 권한 확인 (시간 제약 + 기본 권한)
  useEffect(() => {
    const checkCommentPermission = () => {
      // 1. 기본 권한 체크
      const hasBasicPermission = schoolMode.canPerformAction('canComment');
      if (!hasBasicPermission) {
        setCanComment(false);
        return;
      }
      
      // 2. 시간 제약 체크
      const timeAllowed = isWithinAllowedTime(mealDate);
      setCanComment(timeAllowed);
    };
    
    checkCommentPermission();
  }, [mealDate, schoolMode]);

  // 댓글 로드 함수
  const loadComments = async (reset = false) => {
    if (!mealId) return;
    
    if (mealId === 'sample-school-meal-id') {
      const dummySchoolComments: Comment[] = [
        {
          id: 'sample-comment-1',
          content: '눈꽃치즈돈까스 진짜 맛있어요! 치즈가 폭포처럼 흘러내려요 🍛',
          created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          user_id: 'mock-user-1',
          user: {
            id: 'mock-user-1',
            email: 'student1@school.edu',
            user_metadata: {
              name: '급식조아',
              avatar_url: ''
            }
          },
          likes_count: 5,
          user_has_liked: false,
          replies_count: 0
        },
        {
          id: 'sample-comment-2',
          content: '츄러스 갓 튀겨서 나온 것처럼 바삭바삭하고 달콤해요! 🥨 망고에이드랑 꿀조합임',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          user_id: 'mock-user-2',
          user: {
            id: 'mock-user-2',
            email: 'student2@school.edu',
            user_metadata: {
              name: '초코쿠키',
              avatar_url: ''
            }
          },
          likes_count: 3,
          user_has_liked: false,
          replies_count: 0
        }
      ];
      setComments(dummySchoolComments);
      setLoading(false);
      setHasMore(false);
      return;
    }
    
    try {
      setLoading(true);
      const currentPage = reset ? 0 : page;
      
      // 댓글 목록 가져오기 - 조인 방식 오류 해결을 위해 별도 쿼리로 변경
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('meal_id', mealId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
      
      // 사용자 정보 별도 가져오기
      let usersData = [];
      if (commentsData && commentsData.length > 0) {
        const userIds = commentsData.map(comment => comment.user_id);
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
      
      if (commentsError) throw commentsError;
      
      // 각 댓글별 좋아요 수 가져오기
      const commentIds = commentsData.map(comment => comment.id);
      
      // 좋아요 수 계산을 위한 대체 쿼리 (group 대신 개별 카운트)
      let likesCountMap: Record<string, number> = {};
      
      if (commentIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds);
          
        if (likesError) throw likesError;
        
        // 수동으로 각 댓글의 좋아요 수 계산
        likesCountMap = likesData.reduce((acc, item) => {
          acc[item.comment_id] = (acc[item.comment_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
      
      // 각 댓글별 사용자의 좋아요 여부 확인
      let userLikesMap: Record<string, boolean> = {};
      
      if (user && user.id && commentIds.length > 0) {
        const { data: userLikesData, error: userLikesError } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', user.id);
          
        if (userLikesError) throw userLikesError;
        
        userLikesMap = (userLikesData || []).reduce((acc, item) => {
          acc[item.comment_id] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }
      
      // 각 댓글별 답글 수 가져오기
      let repliesCountMap: Record<string, number> = {};
      
      if (commentIds.length > 0) {
        const { data: repliesData, error: repliesError } = await supabase
          .from('comment_replies')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('is_deleted', false);
          
        if (repliesError) throw repliesError;
        
        // 수동으로 각 댓글의 답글 수 계산
        repliesCountMap = repliesData.reduce((acc, item) => {
          acc[item.comment_id] = (acc[item.comment_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
      
      // 데이터 가공 - 별도 사용자 데이터를 매핑
      const processedComments: Comment[] = commentsData.map(comment => {
        // 가져온 사용자 데이터에서 해당 사용자 찾기
        const userData = usersData.find(user => user.id === comment.user_id) || null;
        
        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          user_id: comment.user_id,
          user: {
            id: userData?.id || comment.user_id || '',
            email: userData?.email || '',
            user_metadata: {
              name: userData?.nickname || '',
              avatar_url: userData?.profile_image || ''
            }
          },
          likes_count: likesCountMap[comment.id] || 0,
          user_has_liked: !!userLikesMap[comment.id],
          replies_count: repliesCountMap[comment.id] || 0
        };
      });
      
      if (reset) {
        setComments(processedComments);
      } else {
        setComments(prev => [...prev, ...processedComments]);
      }
      
      setHasMore(processedComments.length === PAGE_SIZE);
      setPage(reset ? 1 : currentPage + 1);
    } catch (err) {
      console.error('댓글 로드 중 오류:', err);
      setError('댓글을 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 초기 로드
  useEffect(() => {
    if (mealId) {
      loadComments(true);
    }
  }, [mealId]);
  
  // 실시간 업데이트 설정
  useEffect(() => {
    if (!mealId) return;
    
    // 댓글 추가 구독
    const commentsInsertChannel = supabase
      .channel(`comments-insert-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `meal_id=eq.${mealId}`
        }, 
        (payload) => {
          console.log('댓글 추가:', payload);
          loadComments(true);
        }
      )
      .subscribe();
      
    // 댓글 삭제 구독 - DELETE 이벤트에서는 filter를 사용하지 않음
    const commentsDeleteChannel = supabase
      .channel(`comments-delete-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments'
          // DELETE 이벤트에서는 이미 레코드가 삭제되었으므로 filter를 사용하지 않음
        }, 
        (payload) => {
          console.log('댓글 삭제:', payload);
          const oldData = payload.old as Record<string, any>;
          // 삭제된 댓글이 현재 meal의 댓글인지 확인
          if (oldData && oldData.meal_id === mealId) {
            loadComments(true);
          }
        }
      )
      .subscribe();
      
    // 댓글 수정 구독
    const commentsUpdateChannel = supabase
      .channel(`comments-update-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `meal_id=eq.${mealId}`
        }, 
        (payload) => {
          console.log('댓글 수정:', payload);
          loadComments(true);
        }
      )
      .subscribe();
      
    // 좋아요 추가 구독 - 필터링 개선
    const likesInsertChannel = supabase
      .channel(`comment-likes-insert-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_likes'
        }, 
        async (payload) => {
          console.log('댓글 좋아요 추가:', payload);
          // 🔥 현재 meal의 댓글에 대한 좋아요인지 확인
          if (payload.new && typeof payload.new === 'object' && 'comment_id' in payload.new) {
            const commentId = payload.new.comment_id;
            const userId = payload.new.user_id;
            
            // 해당 댓글이 현재 meal의 댓글인지 확인
            const { data: commentData } = await supabase
              .from('comments')
              .select('meal_id')
              .eq('id', commentId)
              .single();
              
            if (commentData && commentData.meal_id === mealId) {
              // 현재 댓글 목록에서 해당 댓글 찾기
              setComments(prevComments => {
                return prevComments.map(comment => {
                  if (comment.id === commentId) {
                    // 좋아요 수 증가 및 현재 사용자가 좋아요 눌렀음을 표시
                    return {
                      ...comment,
                      likes_count: comment.likes_count + 1,
                      user_has_liked: user?.id === userId ? true : comment.user_has_liked
                    };
                  }
                  return comment;
                });
              });
            }
          }
        }
      )
      .subscribe();
      
    // 좋아요 삭제 구독 - 필터링 개선
    const likesDeleteChannel = supabase
      .channel(`comment-likes-delete-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comment_likes'
        }, 
        async (payload) => {
          console.log('댓글 좋아요 삭제:', payload);
          const oldData = payload.old as Record<string, any>;
          if (oldData && oldData.comment_id) {
            const commentId = oldData.comment_id;
            const userId = oldData.user_id;
            
            // 🔥 해당 댓글이 현재 meal의 댓글인지 확인
            const { data: commentData } = await supabase
              .from('comments')
              .select('meal_id')
              .eq('id', commentId)
              .single();
              
            if (commentData && commentData.meal_id === mealId) {
              // 현재 댓글 목록에서 해당 댓글 찾기
              setComments(prevComments => {
                return prevComments.map(comment => {
                  if (comment.id === commentId) {
                    // 좋아요 수 감소 및 현재 사용자가 좋아요 취소했음을 표시
                    return {
                      ...comment,
                      likes_count: Math.max(0, comment.likes_count - 1), // 음수가 되지 않도록 방지
                      user_has_liked: user?.id === userId ? false : comment.user_has_liked
                    };
                  }
                  return comment;
                });
              });
            }
          }
        }
      )
      .subscribe();
      
    // 🔥 답글 추가 구독 (중첩답글 수정 후 누락된 부분)
    const repliesInsertChannel = supabase
      .channel(`comment-replies-insert-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_replies'
        }, 
        async (payload) => {
          console.log('답글 추가:', payload);
          // 답글이 추가된 댓글이 현재 meal의 댓글인지 확인
          if (payload.new && typeof payload.new === 'object' && 'comment_id' in payload.new) {
            const commentId = payload.new.comment_id;
            
            // 해당 댓글이 현재 meal의 댓글인지 확인
            const { data: commentData } = await supabase
              .from('comments')
              .select('meal_id')
              .eq('id', commentId)
              .single();
              
            if (commentData && commentData.meal_id === mealId) {
              // 답글 수 업데이트를 위해 전체 댓글 다시 로드
              loadComments(true);
            }
          }
        }
      )
      .subscribe();
      
    // 🔥 답글 삭제 구독
    const repliesDeleteChannel = supabase
      .channel(`comment-replies-delete-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comment_replies'
        }, 
        async (payload) => {
          console.log('답글 삭제:', payload);
          const oldData = payload.old as Record<string, any>;
          
          if (oldData && oldData.comment_id) {
            // 해당 댓글이 현재 meal의 댓글인지 확인
            const { data: commentData } = await supabase
              .from('comments')
              .select('meal_id')
              .eq('id', oldData.comment_id)
              .single();
              
            if (commentData && commentData.meal_id === mealId) {
              // 답글 수 업데이트를 위해 전체 댓글 다시 로드
              loadComments(true);
            }
          }
        }
      )
      .subscribe();

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(commentsInsertChannel);
      supabase.removeChannel(commentsDeleteChannel);
      supabase.removeChannel(commentsUpdateChannel);
      supabase.removeChannel(likesInsertChannel);
      supabase.removeChannel(likesDeleteChannel);
      supabase.removeChannel(repliesInsertChannel);
      supabase.removeChannel(repliesDeleteChannel);
    };
  }, [mealId]);

  // 댓글 추가 함수 - CommentForm에서 사용
  const addComment = async (content: string): Promise<boolean> => {
    if (!mealId || !content.trim()) return false;
    
    if (mealId === 'sample-school-meal-id') {
      const newComment: Comment = {
        id: `comment-virtual-${Date.now()}`,
        content: content.trim(),
        created_at: new Date().toISOString(),
        user_id: user?.id || 'mock-current-user',
        user: {
          id: user?.id || 'mock-current-user',
          email: user?.email || 'guest@example.com',
          user_metadata: {
            name: userSchool?.nickname || '나',
            avatar_url: ''
          }
        },
        likes_count: 0,
        user_has_liked: false,
        replies_count: 0
      };
      setComments(prev => [newComment, ...prev]);
      localStorage.setItem('whateat_school_commented_once', 'true');
      window.dispatchEvent(new CustomEvent('whateat_school_commented'));
      return true;
    }
    
    if (!user || !user.id || !content.trim()) return false;
    
    try {
      console.log('댓글 추가 시도:', { mealId, userId: user.id, content: content.trim() });
      
      const { error } = await supabase
        .from('comments')
        .insert({
          meal_id: mealId,
          user_id: user.id,
          content: content.trim()
        });
        
      if (error) {
        console.error('댓글 추가 SQL 오류:', error);
        throw error;
      }
      
      console.log('댓글 추가 성공, 새로고침 시도');
      // 데이터를 수동으로 다시 불러옴
      await loadComments(true);
      
      // 실시간 구독으로 새 댓글이 자동으로 로드되지만, 추가 보호를 위해 수동 로드도 실행
      return true;
    } catch (err) {
      console.error('댓글 추가 중 오류:', err);
      setError('댓글을 추가하는 중 문제가 발생했습니다.');
      return false;
    }
  };
  
  return (
    <div className={`mt-4 ${className}`}>
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:!text-white">댓글</h3>
      
      {loading ? (
        <p className="text-gray-500 mb-4">로딩 중...</p>
      ) : user && canComment ? (
        <CommentForm onSubmit={addComment} />
      ) : !user ? (
        <p className="text-gray-500 mb-4">댓글을 작성하려면 로그인하세요.</p>
      ) : null}
      
      <div className="mt-4 space-y-4">
        {comments.length > 0 ? (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onCommentChange={() => loadComments(true)}
              schoolCode={schoolCode}
            />
          ))
        ) : loading ? (
          <p className="text-gray-500">댓글을 불러오는 중...</p>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">아직 댓글이 없습니다.</p>
            {canComment ? (
              <p className="text-gray-400 text-sm">첫 댓글을 남겨보세요!</p>
            ) : (
              <p className="text-gray-400 text-sm">이 학교 학생들의 댓글을 기다려보세요.</p>
            )}
          </div>
        )}
      </div>
      
      {hasMore && (
        <button 
          className="w-full py-2 mt-4 text-sm text-gray-600 hover:text-gray-900"
          onClick={() => loadComments()}
          disabled={loading}
        >
          {loading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
      
      {error && (
        <p className="text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}
