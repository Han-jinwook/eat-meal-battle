'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';

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
      {userImages.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">내가 업로드한 이미지</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userImages.map((image) => (
              <div key={image.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative h-56 w-full">
                  <Image
                    src={image.image_url}
                    alt="급식 이미지"
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(image.status)} flex items-center justify-center w-8 h-8`}>
                      {getStatusText(image.status)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(image.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  
                  {image.match_score !== undefined && image.match_score !== null && (
                    <div className="text-sm mb-2">
                      <span className="font-semibold">메뉴 일치도:</span> {image.match_score}%
                      {image.status === 'rejected' && (
                        <span className="text-orange-600 ml-1">(매칭실패, 업로드 불가)</span>
                      )}
                    </div>
                  )}
                  
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
                <div className="relative h-56 w-full">
                  <Image
                    src={image.image_url}
                    alt="급식 이미지"
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(image.status)} flex items-center justify-center w-8 h-8`}>
                      {getStatusText(image.status)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(image.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  
                  {image.match_score !== undefined && image.match_score !== null && (
                    <div className="text-sm mt-2">
                      <span className="font-semibold">메뉴 일치도:</span> {image.match_score}%
                      {image.status === 'rejected' && (
                        <span className="text-orange-600 ml-1">(매칭실패, 업로드 불가)</span>
                      )}
                    </div>
                  )}
                  
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
