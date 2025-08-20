"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface QuizRelation {
  id: string;
  quiz_owner_id: string;
  viewer_id: string;
  created_at: string;
  owner_info?: {
    nickname: string;
    school_name: string;
    grade?: number;
    class?: number;
  };
  viewer_info?: {
    nickname: string;
    school_name: string;
    grade?: number;
    class?: number;
  };
  viewer_count?: number;
}

interface QuizDropdownProps {
  userId: string;
  className?: string;
}

const QuizDropdown: React.FC<QuizDropdownProps> = ({ userId, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mySharedQuizzes, setMySharedQuizzes] = useState<QuizRelation[]>([]);
  const [myViewingQuizzes, setMyViewingQuizzes] = useState<QuizRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
    if (!userId) return;
    
    setLoading(true);
    console.log('🔍 퀴즈 관계 데이터 로드 시작:', userId);

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
        .eq('quiz_owner_id', userId);

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

        const { data: viewerSchoolsData, error: viewerSchoolsError } = await supabase
          .from('school_infos')
          .select('user_id, school_name, grade, class')
          .in('user_id', viewerIds);

        if (viewersError || viewerSchoolsError) {
          console.error('관람자 정보 로드 오류:', viewersError, viewerSchoolsError);
        }

        // 각 관람자별로 개별 항목 생성
        const sharedQuizzes = sharedData.map(item => {
          const viewerUser = viewersData?.find(u => u.id === item.viewer_id);
          const viewerSchool = viewerSchoolsData?.find(s => s.user_id === item.viewer_id);

          return {
            ...item,
            viewer_info: {
              nickname: viewerUser?.nickname || '익명',
              school_name: viewerSchool?.school_name || '알 수 없음',
              grade: viewerSchool?.grade,
              class: viewerSchool?.class
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
        .eq('viewer_id', userId);

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

        const { data: schoolsData, error: schoolsError } = await supabase
          .from('school_infos')
          .select('user_id, school_name, grade, class')
          .in('user_id', ownerIds);

        if (ownersError || schoolsError) {
          console.error('소유자 정보 로드 오류:', ownersError, schoolsError);
        }

        // 데이터 병합
        const viewingQuizzes = viewingData.map(item => {
          const ownerUser = ownersData?.find(u => u.id === item.quiz_owner_id);
          const ownerSchool = schoolsData?.find(s => s.user_id === item.quiz_owner_id);

          return {
            ...item,
            owner_info: {
              nickname: ownerUser?.nickname || '익명',
              school_name: ownerSchool?.school_name || '알 수 없음',
              grade: ownerSchool?.grade,
              class: ownerSchool?.class
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
    if (!isOpen) {
      loadQuizRelations();
    }
    setIsOpen(!isOpen);
  };

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
                              <p className="text-sm font-medium text-green-800">
                                {quiz.owner_info?.nickname}님의 퀴즈
                              </p>
                              <p className="text-xs text-green-600">
                                {quiz.owner_info?.school_name}
                                {quiz.owner_info?.grade && ` ${quiz.owner_info.grade}학년`}
                                {quiz.owner_info?.class && ` ${quiz.owner_info.class}반`}
                              </p>
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
                                {quiz.viewer_info?.nickname}님이 관람중
                              </p>
                              <p className="text-xs text-blue-600">
                                {quiz.viewer_info?.school_name}
                                {quiz.viewer_info?.grade && ` ${quiz.viewer_info.grade}학년`}
                                {quiz.viewer_info?.class && ` ${quiz.viewer_info.class}반`}
                              </p>
                            </div>
                            <button
                              onClick={() => removeSharedViewer(quiz.id, quiz.viewer_info?.nickname || '익명')}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            >
                              제거
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 빈 상태 */}
                {mySharedQuizzes.length === 0 && myViewingQuizzes.length === 0 && (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-2">📚</div>
                    <p className="text-sm text-gray-500 mb-2">아직 공유하거나 관람 중인 퀴즈가 없어요</p>
                    <p className="text-xs text-gray-400">퀴즈를 공유하거나 초대 링크를 받아보세요!</p>
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
