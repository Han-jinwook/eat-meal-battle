'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import { getSafeImageUrl, handleImageError } from '@/utils/imageUtils';
import ImageWithFallback from '@/components/ImageWithFallback';

interface MealImage {
  id: string;
  meal_id: string;
  image_url: string;
  uploaded_by: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  match_score?: number;
  explanation?: string;
  source?: 'user' | 'ai';
}

interface MealMenu {
  id: string;
  school_code: string;
  office_code: string;
  meal_date: string;
  meal_type: string;
  menu_items: string[];
  kcal: string;
  nutrition_info: Record<string, string>;
  origin_info?: string;
  created_at: string;
}

interface MealImageListProps {
  mealId: string;
  refreshTrigger?: number;
}

export default function MealImageList({ mealId, refreshTrigger = 0 }: MealImageListProps) {
  const supabase = createClient();
  const [images, setImages] = useState<MealImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userImages, setUserImages] = useState<MealImage[]>([]);
  const [sharedImages, setSharedImages] = useState<MealImage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [mealInfo, setMealInfo] = useState<MealMenu | null>(null);
  const [uploaderNames, setUploaderNames] = useState<{[key: string]: string}>({});
  
  // 모달 관련 상태
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  
  // 업로더 닉네임 가져오기
  const fetchUploaderNames = async (images: MealImage[]) => {
    const uniqueUploaders = Array.from(new Set(images
      .filter(img => img.uploaded_by && img.uploaded_by !== 'system')
      .map(img => img.uploaded_by)));
    
    if (uniqueUploaders.length === 0) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', uniqueUploaders);
    
    if (data) {
      const nameMap = data.reduce((acc, profile) => {
        acc[profile.id] = profile.nickname || '사용자';
        return acc;
      }, {} as {[key: string]: string});
      
      setUploaderNames(nameMap);
    }
  };

  // 사용자 정보 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (err) {
        console.error('사용자 정보 로딩 오류:', err);
      }
    };

    fetchUserInfo();
  }, [supabase]);

  // 이미지 목록 가져오기
  const fetchImages = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!mealId) {
        setError('급식 ID가 유효하지 않습니다.');
        setLoading(false);
        return;
      }

      console.log('이미지 조회 시작:', mealId);
      
      // 먼저 approved 이미지가 있는지 확인 - 어떤 사용자든 동일한 이미지를 보기 위해 가장 먼저 조회
      // RLS 정책을 피하기 위해 서비스 로드 키를 사용하는 방법도 고려해볼 수 있음
      const { data: approvedData, error: approvedError } = await supabase
        .from('meal_images')
        .select('*')
        .eq('meal_id', mealId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (approvedError) {
        console.error('승인된 이미지 조회 오류:', approvedError);
        // 오류가 발생해도 계속 진행
      }

      // approved 이미지가 있으면 그것만 표시 (중요: 어떤 사용자든 동일한 이미지 보장)
      if (approvedData && approvedData.length > 0) {
        console.log('승인된 이미지 발견:', approvedData[0].id);
        
        // 이미지 상태 설정
        setImages(approvedData);
        setUserImages([]);
        setSharedImages(approvedData);
        
        // 업로더 닉네임 가져오기
        await fetchUploaderNames(approvedData);
        
        setLoading(false);
        return;
      }
      
      // approved 이미지가 없으면 사용자 이미지 조회 (사용자가 로그인한 경우만)
      if (userId) {
        console.log('승인된 이미지 없음, 사용자 이미지 조회');
        
        const { data: userData, error: userError } = await supabase
          .from('meal_images')
          .select('*')
          .eq('meal_id', mealId)
          .eq('uploaded_by', userId)
          .order('created_at', { ascending: false });
          
        if (userError) {
          console.error('사용자 이미지 조회 오류:', userError);
          setLoading(false);
          return;
        }
        
        if (userData && userData.length > 0) {
          console.log('사용자 이미지 발견:', userData.length);
          setImages(userData);
          setUserImages(userData);
          setSharedImages([]);
          await fetchUploaderNames(userData);
        } else {
          console.log('사용자 이미지 없음');
          setImages([]);
          setUserImages([]);
          setSharedImages([]);
        }
      } else {
        // 로그인하지 않은 사용자는 이미지를 볼 수 없음
        console.log('로그인하지 않은 사용자');
        setImages([]);
        setUserImages([]);
        setSharedImages([]);
      }
      
      // 급식 메뉴 정보 가져오기
      if (mealId) {
        const { data: mealData, error: mealError } = await supabase
          .from('meal_menus')
          .select('*')
          .eq('id', mealId)
          .single();
          
        if (mealError) {
          if (mealError.code !== 'PGRST116') { // 데이터 없음 에러가 아닌 경우에만 로깅
            console.error('급식 메뉴 정보 로딩 오류:', mealError);
          }
        } else {
          setMealInfo(mealData);
        }
      }
    } catch (err) {
      console.error('이미지 목록 로딩 오류:', err);
      setError('이미지를 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 이미지 목록 갱신 트리거
  useEffect(() => {
    if (mealId) {
      fetchImages();
    }
    // refreshTrigger가 변경될 때마다 이미지 목록 다시 로드
  }, [mealId, userId, supabase, refreshTrigger]);

  // 이미지 삭제 처리
  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('이미지를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      // 낙관적 UI 업데이트 - 먼저 화면에서 이미지 제거
      setUserImages(prev => prev.filter(img => img.id !== imageId));
      setImages(prev => prev.filter(img => img.id !== imageId));
      
      // 이미지 삭제 전 확인
      const { data: imageCheck, error: checkError } = await supabase
        .from('meal_images')
        .select('id, image_url, uploaded_by, status')
        .eq('id', imageId)
        .single();
        
      if (checkError) {
        throw new Error('이미지 정보를 확인할 수 없습니다.');
      }
      
      // 존재하지 않거나 다른 사용자의 이미지인 경우
      if (!imageCheck || (userId && imageCheck.uploaded_by !== userId)) {
        throw new Error('삭제할 수 없는 이미지입니다.');
      }
      
      // 이미지 레코드 삭제 - 상태 변경이 아닌 실제 삭제
      const { error: deleteError } = await supabase
        .from('meal_images')
        .delete()
        .eq('id', imageId);
        
      if (deleteError) {
        throw deleteError;
      }
      
      // 스토리지의 이미지 파일도 삭제 시도
      try {
        if (imageCheck.image_url) {
          // URL에서 파일명 추출
          const url = new URL(imageCheck.image_url);
          const pathSegments = url.pathname.split('/');
          // 마지막 세그먼트는 파일명
          const filePath = pathSegments[pathSegments.length - 1];
          
          console.log('삭제할 파일 경로:', filePath);
          
          const { error: storageError } = await supabase.storage
            .from('meal-images')
            .remove([filePath]);
            
          if (storageError) {
            console.error('스토리지 이미지 삭제 오류:', storageError);
          }
        }
      } catch (err) {
        console.error('파일 경로 추출 오류:', err);
        // 스토리지 삭제 실패는 치명적이지 않으므로 계속 진행
      }
      
      alert('이미지가 삭제되었습니다.');
      
      // 변경 내용을 서버에서 다시 불러와 로컬 상태와 일치시킴
      // setTimeout을 사용해 약간의 지연 후 데이터를 새로고침하여 데이터베이스 업데이트가 완료되도록 함
      setTimeout(() => fetchImages(), 300);
    } catch (err) {
      console.error('이미지 삭제 오류:', err);
      alert(`이미지 삭제 실패: ${err.message || '알 수 없는 오류가 발생했습니다.'}`);
      
      // 오류 발생 시 이전 상태로 복원하기 위해 이미지 목록 다시 로드
      fetchImages();
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '사진등록';
      case 'pending': return '검증중';
      case 'rejected': return '매칭실패';
      default: return '-';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // 급식 상세 정보 모달 표시 함수
  const showDetailModal = () => {
    if (!mealInfo) {
      setModalTitle('급식 정보');
      setModalContent('급식 정보가 없습니다.');
      setShowModal(true);
      return;
    }

    setModalTitle('급식 상세 정보');
    // nutrition_info 포맷팅
    let ntrInfo = '';
    if (mealInfo.nutrition_info && Object.keys(mealInfo.nutrition_info).length > 0) {
      ntrInfo = Object.entries(mealInfo.nutrition_info)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n');
    } else {
      ntrInfo = '영양 정보가 없습니다.';
    }

    // 원산지 정보 포맷팅
    const originContent = formatOriginInfo(mealInfo.origin_info || '');

    // 모달 내용 조립
    const modalText =
      `열량: ${mealInfo.kcal}\n` +
      `${ntrInfo}\n\n` +
      `원산지 정보:\n${originContent}`;
    setModalContent(modalText);
    setShowModal(true);
  };
  
  // 원산지 정보 포맷팅 - HTML 태그 처리
  const formatOriginInfo = (originInfo: string) => {
    if (!originInfo || originInfo === 'null' || originInfo === 'undefined') {
      return '원산지 정보가 없습니다.';
    }

    try {
      // <br>, <br/> 등 줄바꿈 태그를 모두 \n으로 변환
      let formattedText = originInfo.replace(/<br\s*\/?>/gi, '\n');
      // HTML 태그 제거
      formattedText = formattedText.replace(/<[^>]*>/g, '');
      // 여러 줄 처리
      const lines = formattedText.split(/\n|\r/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      return lines.join('\n');
    } catch (error) {
      console.error('원산지 정보 포맷팅 오류:', error);
      return originInfo;
    }
  };

  if (loading) {
    return <div className="text-center py-4">이미지 로딩 중...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-600">{error}</div>;
  }

  if (images.length === 0) {
    return <div className="text-center py-4 text-gray-500">아직 업로드된 이미지가 없습니다.</div>;
  }

  return (
    <div className="space-y-6">
      {/* 급식 상세 정보 버튼 - 리스트/카드 바깥에 명확하게 배치 */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={showDetailModal}
          className="px-6 py-3 bg-gradient-to-r from-purple-400 to-blue-500 text-white text-lg font-bold rounded-full shadow-lg hover:from-purple-500 hover:to-blue-600 transition-colors border-4 border-white"
        >
          🍱 급식 상세 정보 보기
        </button>
      </div>
      {/* 모달 (원산지 정보) */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{modalTitle}</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-gray-600 whitespace-pre-line">
              {modalContent}
            </div>
          </div>
        </div>
      )}
      
      {/* 원산지 정보 버튼 - 조건없이 항상 보여주기 */}
      
      {userImages.length > 0 && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userImages.map((image) => (
              <div key={image.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative h-72 w-full">
                  <div className="absolute inset-0">
                    <ImageWithFallback
                      src={image.image_url}
                      alt="급식 이미지"
                      style={{ 
                        objectFit: 'cover',
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(image.status)}`}>
                        {getStatusText(image.status)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">
                        {new Date(image.created_at).toLocaleString('ko-KR')}
                        {image.source === 'ai' ? (
                          <span className="ml-1 text-xs text-gray-500">(AI생성 참고이미지)</span>
                        ) : (
                          image.uploaded_by && uploaderNames[image.uploaded_by] ? (
                            <span className="ml-1 text-xs text-gray-500">(등록자: {uploaderNames[image.uploaded_by]})</span>
                          ) : null
                        )}
                      </span>
                    </div>
                  </div>
                  

                  
                  {image.status === 'rejected' && image.explanation && (
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-semibold">사유:</span> {image.explanation}
                    </div>
                  )}
                  
                  {image.status !== 'approved' && (
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sharedImages.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">다른 사용자의 이미지</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sharedImages.map((image) => (
              <div key={image.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative h-72 w-full">
                  <div className="absolute inset-0">
                    <ImageWithFallback
                      src={image.image_url}
                      alt="급식 이미지"
                      style={{ 
                        objectFit: 'cover',
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(image.status)}`}>
                        {getStatusText(image.status)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">
                        {new Date(image.created_at).toLocaleString('ko-KR')}
                        {image.source === 'ai' ? (
                          <span className="ml-1 text-xs text-gray-500">(AI생성 참고이미지)</span>
                        ) : (
                          image.uploaded_by && uploaderNames[image.uploaded_by] ? (
                            <span className="ml-1 text-xs text-gray-500">(등록자: {uploaderNames[image.uploaded_by]})</span>
                          ) : null
                        )}
                      </span>
                    </div>
                  </div>
                  

                  
                  {image.status === 'rejected' && image.explanation && (
                    <div className="text-sm text-gray-700 mt-2">
                      <span className="font-semibold">사유:</span> {image.explanation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
