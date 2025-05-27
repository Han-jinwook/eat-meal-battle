'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CommentForm from './CommentForm';
import { User } from '@supabase/supabase-js';
import { Comment } from './types';
import useUserSchool from '@/hooks/useUserSchool';

// 순환 참조를 피하기 위해 동적 임포트 대신 타입 단언을 사용
import CommentItem from './CommentItem';

interface CommentSectionProps {
  mealId: string;
  className?: string;
  schoolCode?: string; // 학교 코드 추가
}

export default function CommentSection({ mealId, className = '', schoolCode }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // useUserSchool 후크을 통해 사용자 정보 가져오기
  const { user, userSchool } = useUserSchool();
  
  // 현재 사용자가 해당 학교 학생인지 확인
  const isStudentOfSchool = userSchool && schoolCode && userSchool.school_code === schoolCode;
  const supabase = createClientComponentClient();
  
  const PAGE_SIZE = 10;

  // 댓글 로드 함수
  const loadComments = async (reset = false) => {
    if (!mealId) return;
    
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
      
    // 댓글 삭제 구독
    const commentsDeleteChannel = supabase
      .channel(`comments-delete-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `meal_id=eq.${mealId}`
        }, 
        (payload) => {
          console.log('댓글 삭제:', payload);
          loadComments(true);
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
      
    // 좋아요 추가 구독
    const likesInsertChannel = supabase
      .channel(`comment-likes-insert-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comment_likes'
        }, 
        (payload) => {
          console.log('댓글 좋아요 추가:', payload);
          loadComments(true);
        }
      )
      .subscribe();
      
    // 좋아요 삭제 구독
    const likesDeleteChannel = supabase
      .channel(`comment-likes-delete-${mealId}`)
      .on('postgres_changes', 
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comment_likes'
        }, 
        (payload) => {
          console.log('댓글 좋아요 삭제:', payload);
          loadComments(true);
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
    };
  }, [mealId]);

  // 댓글 추가 함수 - CommentForm에서 사용
  const addComment = async (content: string): Promise<boolean> => {
    if (!user || !user.id || !mealId || !content.trim()) return false;
    
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
      <h3 className="text-lg font-bold mb-4">댓글</h3>
      
      {loading ? (
        <p className="text-gray-500 mb-4">로딩 중...</p>
      ) : user && isStudentOfSchool ? (
        <CommentForm onSubmit={addComment} />
      ) : user && !isStudentOfSchool ? (
        <p className="text-gray-500 mb-4">해당 학교 학생만 댓글을 작성할 수 있습니다.</p>
      ) : (
        <p className="text-gray-500 mb-4">댓글을 작성하려면 로그인하세요.</p>
      )}
      
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
          <p className="text-gray-500">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
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
