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
  is_shared: boolean;
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

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };

    fetchUserInfo();
  }, [supabase]);

  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
      setError(null);

      try {
        // 해당 급식에 대한 모든 이미지 가져오기
        const { data, error } = await supabase
          .from('meal_images')
          .select('*')
          .eq('meal_id', mealId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setImages(data || []);

        // 사용자 이미지와 공유 이미지 분리
        if (userId) {
          const userImgs = data?.filter(img => img.uploaded_by === userId) || [];
          const sharedImgs = data?.filter(img => img.is_shared && img.uploaded_by !== userId) || [];
          
          setUserImages(userImgs);
          setSharedImages(sharedImgs);
        }
        
        // 업로더 닉네임 가져오기
        fetchUploaderNames(data || []);
        
        // 급식 메뉴 정보 가져오기
        const { data: mealData, error: mealError } = await supabase
          .from('meal_menus')
          .select('*')
          .eq('id', mealId)
          .single();
          
        if (mealError) {
          console.error('급식 메뉴 정보 로딩 오류:', mealError);
        } else {
          console.log('가져온 급식 메뉴 정보:', mealData); // 가져온 데이터 출력
          console.log('원산지 정보 데이터:', mealData.origin_info); // 원산지 정보 확인
          setMealInfo(mealData);
        }
      } catch (err: any) {
        console.error('이미지 로딩 오류:', err);
        setError('이미지를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (mealId) {
      fetchImages();
    }
  }, [mealId, refreshTrigger, supabase, userId]);

  const handleDeleteImage = async (imageId: string) => {
    try {
      // 이미지 삭제 전 확인
      const { data: imageData } = await supabase
        .from('meal_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (!imageData) {
        throw new Error('이미지를 찾을 수 없습니다.');
      }

      // 공유된 이미지는 삭제 불가
      if (imageData.is_shared || imageData.status === 'approved') {
        throw new Error('승인되거나 공유된 이미지는 삭제할 수 없습니다.');
      }

      // DB에서 이미지 레코드 삭제
      const { error: deleteError } = await supabase
        .from('meal_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) {
        throw deleteError;
      }

      // 이미지 목록 업데이트
      setUserImages(userImages.filter(img => img.id !== imageId));
      setImages(images.filter(img => img.id !== imageId));

      // 스토리지의 이미지 삭제 시도
      try {
        // URL에서 파일명 추출
        const url = new URL(imageData.image_url);
        const pathSegments = url.pathname.split('/');
        // 마지막 세그먼트는 파일명
        const fileName = pathSegments[pathSegments.length - 1];
        // Storage 버킷에 직접 저장된 파일
        const filePath = fileName;
        
        console.log('삭제할 파일 경로:', filePath);
        
        const { error: storageError } = await supabase.storage
          .from('meal-images')
          .remove([filePath]);
          
        if (storageError) {
          console.error('스토리지 이미지 삭제 오류:', storageError);
        }
      } catch (err) {
        console.error('파일 경로 추출 오류:', err);
      }
    } catch (err) {
      console.error('이미지 삭제 오류:', err);
      alert(err.message || '이미지 삭제 중 오류가 발생했습니다.');
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
          <h3 className="text-lg font-semibold mb-3">내가 업로드한 이미지</h3>
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
                  
                  {!image.is_shared && image.status !== 'approved' && (
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
