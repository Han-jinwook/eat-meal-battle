"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface QuizRelation {
  id: string;
  quiz_owner_id: string;
  viewer_id: string;
  created_at: string;
  owner_info?: {
    nickname: string;
  };
  viewer_info?: {
    nickname: string;
  };
  viewer_count?: number;
}

interface QuizDropdownProps {
  userId?: string;
  className?: string;
  onOpenAllQuizModal?: () => void;
}

const QuizDropdown: React.FC<QuizDropdownProps> = ({ userId: propUserId, className = '', onOpenAllQuizModal }) => {
  // 현재 로그인된 사용자 ID 상태
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null);
  const [isOpen, setIsOpen] = useState(false);
  const [mySharedQuizzes, setMySharedQuizzes] = useState<QuizRelation[]>([]);
  const [myViewingQuizzes, setMyViewingQuizzes] = useState<QuizRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


  // 현재 로그인된 사용자 ID 가져오기
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!currentUserId) { // userId prop이 없거나 빈 문자열이면 현재 로그인된 사용자 ID 가져오기
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            console.log('🔑 현재 로그인된 사용자 ID 가져옴:', user.id);
            setCurrentUserId(user.id);
          }
        } catch (error) {
          console.error('🚫 현재 사용자 ID 조회 오류:', error);
        }
      }
    };
    
    fetchCurrentUser();
  }, []);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 퀴즈 관계 데이터 로드
  const loadQuizRelations = async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    console.log('🔍 퀴즈 관계 데이터 로드 시작:', currentUserId);

    try {
      // 내가 공유한 퀴즈 (다른 사람들이 내 퀴즈를 보는 경우) - 개별 관람자 정보 포함
      const { data: sharedData, error: sharedError } = await supabase
        .from('quiz_viewers')
        .select(`
          id,
          quiz_owner_id,
          viewer_id,
          created_at
        `)
        .eq('quiz_owner_id', currentUserId);

      if (sharedError) {
        console.error('공유 퀴즈 로드 오류:', sharedError);
        setMySharedQuizzes([]);
      } else if (sharedData && sharedData.length > 0) {
        // 관람자들의 정보 가져오기
        const viewerIds = [...new Set(sharedData.map(item => item.viewer_id))];
        
        const { data: viewersData, error: viewersError } = await supabase
          .from('users')
          .select('id, nickname')
          .in('id', viewerIds);

        if (viewersError) {
          console.error('관람자 정보 로드 오류:', viewersError);
        }

        // 각 관람자별로 개별 항목 생성
        const sharedQuizzes = sharedData.map(item => {
          const viewerUser = viewersData?.find(u => u.id === item.viewer_id);

          return {
            ...item,
            viewer_info: {
              nickname: viewerUser?.nickname || '익명'
            }
          };
        });

        setMySharedQuizzes(sharedQuizzes);
        console.log('📤 내가 공유한 퀴즈:', sharedQuizzes);
      } else {
        setMySharedQuizzes([]);
      }

      // 내가 관람 중인 퀴즈 (내가 다른 사람의 퀴즈를 보는 경우)
      const { data: viewingData, error: viewingError } = await supabase
        .from('quiz_viewers')
        .select(`
          id,
          quiz_owner_id,
          viewer_id,
          created_at
        `)
        .eq('viewer_id', currentUserId);

      if (viewingError) {
        console.error('관람 퀴즈 로드 오류:', viewingError);
        setMyViewingQuizzes([]);
      } else if (viewingData && viewingData.length > 0) {
        // 각 퀴즈 소유자의 정보 가져오기
        const ownerIds = [...new Set(viewingData.map(item => item.quiz_owner_id))];
        
        const { data: ownersData, error: ownersError } = await supabase
          .from('users')
          .select('id, nickname')
          .in('id', ownerIds);

        if (ownersError) {
          console.error('소유자 정보 로드 오류:', ownersError);
        }

        // 데이터 병합
        const viewingQuizzes = viewingData.map(item => {
          const ownerUser = ownersData?.find(u => u.id === item.quiz_owner_id);

          return {
            ...item,
            owner_info: {
              nickname: ownerUser?.nickname || '익명'
            }
          };
        });

        setMyViewingQuizzes(viewingQuizzes);
        console.log('👀 내가 관람 중인 퀴즈:', viewingQuizzes);
      } else {
        setMyViewingQuizzes([]);
      }

    } catch (error) {
      console.error('퀴즈 관계 로드 오류:', error);
      toast.error('퀴즈 관계 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };


  // 공유한 퀴즈에서 특정 관람자 제거
  const removeSharedViewer = async (relationId: string, viewerNickname: string) => {
    try {
      const { error } = await supabase
        .from('quiz_viewers')
        .delete()
        .eq('id', relationId);

      if (error) {
        console.error('공유 관람자 제거 오류:', error);
        toast.error('관람자 제거에 실패했습니다.');
        return;
      }

      toast.success(`${viewerNickname}님의 퀴즈 관람을 차단했습니다.`);
      loadQuizRelations(); // 데이터 새로고침
    } catch (error) {
      console.error('공유 관람자 제거 오류:', error);
      toast.error('관람자 제거에 실패했습니다.');
    }
  };

  // 드롭다운 토글
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // currentUserId가 변경되면 구독 데이터 로드
  useEffect(() => {
    if (currentUserId) {
      loadQuizRelations();
    }
  }, [currentUserId]);
  
  // 드롭다운 열리면 데이터 새로고침
  useEffect(() => {
    if (isOpen && currentUserId) {
      loadQuizRelations();
    }
  }, [isOpen]);

  // 전체 퀴즈 개수 계산
  const totalQuizCount = mySharedQuizzes.length + myViewingQuizzes.length;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button 
        className="flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-gray-300 rounded-md hover:bg-white transition-colors text-sm font-medium shadow-sm"
        onClick={toggleDropdown}
      >
        <span className="text-purple-600">📚</span>
        <span>구독퀴즈</span>
        {totalQuizCount > 0 && (
          <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {totalQuizCount}
          </span>
        )}
        <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            
            {loading ? (
              <div className="text-center py-6">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-purple-400 border-r-transparent"></div>
                <p className="text-sm text-gray-500 mt-2">로딩 중...</p>
              </div>
            ) : (
              <>
                {/* 내가 관람 중인 퀴즈 (우선 표시) */}
                {myViewingQuizzes.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      👀 내가 구독중인 퀴즈 ({myViewingQuizzes.length})
                    </h4>
                    <div className="space-y-2">
                      {myViewingQuizzes.map((quiz) => (
                        <div key={quiz.id} className="bg-green-50 rounded-lg p-3">
                          <div className="flex items-center">
                            <div className="flex-1">
                              <button
                                onClick={() => {
                                  const currentUrl = new URL(window.location.href);
                                  const dateParam = currentUrl.searchParams.get('date');
                                  const queryParams = new URLSearchParams();
                                  
                                  if (dateParam) {
                                    queryParams.set('date', dateParam);
                                  }
                                  
                                  queryParams.set('viewing', quiz.quiz_owner_id);
                                  if (quiz.owner_info?.nickname) {
                                    queryParams.set('owner_nickname', quiz.owner_info.nickname);
                                  }
                                  
                                  router.push(`/quiz?${queryParams.toString()}`);
                                  setIsOpen(false);
                                }}
                                className="text-sm font-medium text-green-800 hover:text-green-900 hover:underline cursor-pointer bg-transparent border-none p-0"
                              >
                                {quiz.owner_info?.nickname}님의 퀴즈
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 내가 공유한 퀴즈 */}
                {mySharedQuizzes.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      🔗 내 퀴즈 구독자 ({mySharedQuizzes.length})
                    </h4>
                    <div className="space-y-2">
                      {mySharedQuizzes.map((quiz) => (
                        <div key={quiz.id} className="bg-blue-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-800">
                                {quiz.viewer_info?.nickname}님이 구독중
                              </p>
                            </div>
                            <button
                              onClick={() => removeSharedViewer(quiz.id, quiz.viewer_info?.nickname || '익명')}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 빈 상태 - 구독퀴즈 없을 때 */}
                {mySharedQuizzes.length === 0 && myViewingQuizzes.length === 0 && (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-3">🔔</div>
                    <p className="text-sm text-gray-600 font-medium mb-2">아직 구독중인 퀴즈가 없습니다</p>
                    <p className="text-xs text-gray-500">자녀나/친구에게 퀴즈 공유 링크를 받아 클릭하면<br/>자동으로 퀴즈구독되어 자유롭게 관람할 수 있습니다.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizDropdown;
