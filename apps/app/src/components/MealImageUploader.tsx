'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import { format, isFuture } from 'date-fns';
import { getSafeImageUrl, handleImageError } from '@/utils/imageUtils';
import ImageWithFallback from '@/components/ImageWithFallback';

interface MealImageUploaderProps {
  mealId: string;
  schoolCode: string;
  mealDate: string;
  mealType: string;
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
}

export default function MealImageUploader({
  mealId,
  schoolCode,
  mealDate,
  mealType,
  onUploadSuccess,
  onUploadError
}: MealImageUploaderProps) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isButtonReady, setIsButtonReady] = useState(false);
  const [imageStatus, setImageStatus] = useState('none'); // 이미지 상태 추적용
  const [showAiGenButton, setShowAiGenButton] = useState(true); // 테스트를 위해 항상 true로 설정
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 사용자 정보 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    
    fetchUserInfo();
  }, [supabase]);

  // AI 이미지 생성 버튼 표시 여부 확인 - 테스트를 위해 주석 처리
  /*useEffect(() => {
    const checkIfAiImageNeeded = async () => {
      if (!mealId) return;

      // 당일 날짜인지 확인 (오늘 날짜와 급식 날짜 비교)
      const today = new Date().toISOString().split('T')[0];
      
      // 1. 메뉴 존재 여부를 HEAD 로 먼저 확인해 404 네트워크 오류 방지
      const {
        count: mealCount,
        error: mealHeadError
      } = await supabase
        .from('meals')
        .select('id', { head: true, count: 'exact' })
        .eq('id', mealId);

      if (mealHeadError) {
        if (mealHeadError.code === '42P01') {
          console.debug('meals 테이블이 없습니다. AI 버튼 숨김');
        } else {
          console.debug(`급식 ID(${mealId}) 존재 여부 확인 중 예상된 오류 (아마도 삭제된 급식):`, mealHeadError.message);
        }
        setShowAiGenButton(false);
        return;
      }

      if (!mealCount) {
        // 해당 급식이 없음
        setShowAiGenButton(false);
        return;
      }

      // 2. 실제 급식 날짜 조회 (존재할 때만)
      const { data: mealData, error: mealFetchError } = await supabase
        .from('meals')
        .select('meal_date')
        .eq('id', mealId)
        .single();

      if (mealFetchError) {
        // PGRST116 = no rows found, 42P01 = relation does not exist (테이블 없음)
        if (mealFetchError.code === 'PGRST116' || mealFetchError.code === '42P01') {
          console.debug('급식 날짜 조회 결과 없음/테이블 없음:', mealFetchError.code);
        } else {
          console.error('급식 날짜 조회 오류:', mealFetchError);
        }
        // 데이터 없거나 스키마 없음이면 AI 버튼 숨기고 종료
        setShowAiGenButton(false);
        return;
      }
      
      // 3. 급식 날짜가 오늘이 아니면 버튼 숨김
      if (!mealData || mealData.meal_date !== today) {
        console.log('AI 이미지 생성 버튼 숨김: 당일 날짜가 아님', {
          today,
          mealDate: mealData.meal_date
        });
        setShowAiGenButton(false);
        return;
      }
      
      // 2. 시간 조건 확인 (12:30 이후)
      const now = new Date();
      const isAfterLunchTime = now.getHours() > 12 || (now.getHours() === 12 && now.getMinutes() >= 30);
      
      if (!isAfterLunchTime) {
        console.log('AI 이미지 생성 버튼 숨김: 12:30 이전');
        setShowAiGenButton(false);
        return;
      }
      
      // 3. 현재 급식의 이미지 여부 확인
      const { data: images } = await supabase
        .from('meal_images')
        .select('id, is_shared, match_score')
        .eq('meal_id', mealId);
        
      // 4. 버튼 표시 조건:
      // - 이미지가 없거나
      // - 이미지는 있지만 모두 is_shared=false인 경우
      const shouldShow = !images || images.length === 0 || !images.some(img => img.is_shared);
      
      console.log('AI 이미지 생성 버튼 표시 여부:', {
        mealId,
        today,
        mealDate: mealData.meal_date,
        isAfterLunchTime,
        imagesCount: images?.length || 0,
        hasSharedImages: images?.some(img => img.is_shared),
        shouldShow
      });
      
      setShowAiGenButton(shouldShow);
    };
    
    if (mealId) {
      checkIfAiImageNeeded();
    }
  }, [mealId, supabase]);*/
  
  // 테스트를 위해 항상 AI 이미지 생성 버튼 표시
  useEffect(() => {
    console.log('테스트 모드: AI 이미지 생성 버튼 항상 표시');
    setShowAiGenButton(true);
  }, []);

  // AI 이미지 생성 처리 함수 (버튼용)
  const handleAiImageGeneration = async () => {
    try {
      console.log('AI 이미지 생성 버튼 클릭!');
      
      // 업로드 상태와 검증 상태를 모두 초기화
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // AI 이미지 생성용 상태만 설정
      setUploading(false); // 업로드 상태를 false로 유지
      setError(null);
      setVerifying(false);
      setImageStatus('generating');
      
      // 1. 메뉴 정보 가져오기 - meal_menus 테이블에서 조회
      console.log('메뉴 정보 조회 시도:', { schoolCode, mealDate, mealType });
      
      // meal_menus 테이블 구조에 맞게 수정: school_code, meal_date, meal_type으로 조회
      const { data: mealMenuData, error: mealMenuError } = await supabase
        .from('meal_menus')
        .select('id, menu_items, meal_date, meal_type, school_code')
        .eq('school_code', schoolCode)
        .eq('meal_date', mealDate)
        .eq('meal_type', mealType)
        .single();
        
      if (mealMenuError) {
        console.error('메뉴 정보 조회 오류:', mealMenuError);
        throw new Error('메뉴 정보를 찾을 수 없습니다.');
      }
      
      if (!mealMenuData || !mealMenuData.menu_items || mealMenuData.menu_items.length === 0) {
        console.error('메뉴 정보가 없습니다:', mealMenuData);
        throw new Error('급식 메뉴 정보가 없습니다.');
      }
      
      console.log('메뉴 정보 조회 성공:', { 
        menuItems: mealMenuData.menu_items,
        menuCount: mealMenuData.menu_items.length,
        mealDate: mealMenuData.meal_date,
        mealType: mealMenuData.meal_type,
        schoolCode: mealMenuData.school_code
      });
      
      // 2. OpenAI API 호출하여 이미지 생성
      // 테스트를 위해 항상 Netlify 함수 사용
      const apiUrl = '/.netlify/functions/generate-meal-image';
      
      console.log('AI 이미지 생성 API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          menu_items: mealMenuData.menu_items,
          meal_id: mealId,
          school_code: mealMenuData.school_code || schoolCode,
          meal_date: mealMenuData.meal_date || mealDate,
          meal_type: mealMenuData.meal_type || mealType
        }),
      });
      
      // 응답 텍스트를 먼저 가져와서 안전하게 처리
      const responseText = await response.text();
      let result;
      
      try {
        // JSON으로 파싱 시도
        result = JSON.parse(responseText);
        console.log('AI 이미지 생성 API 응답:', result);
      } catch (e) {
        console.error('AI 이미지 생성 API 응답 파싱 오류:', e, responseText);
        throw new Error('응답 처리 중 오류가 발생했습니다.');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'AI 이미지 생성에 실패했습니다.');
      }
      
      // 3. 생성된 이미지 정보로 상태 업데이트
      console.log('AI 이미지 생성 성공:', result.image);
      
      // 이미지 정보 업데이트 - 검증 과정 생략
      setUploadedImage(result.image);
      
      // 검증 결과를 직접 설정하여 검증 과정 생략
      setVerificationResult({
        isMatch: true,
        matchScore: 1.0, // 100% 일치
        explanation: 'AI가 생성한 이미지입니다. 메뉴에 맞게 자동 생성되었습니다.'
      });
      
      // 이미지 상태 완료로 설정
      setImageStatus('complete');
      
      // 4. 버튼 숨기기
      setShowAiGenButton(false);
      
      // 5. 성공 콜백 호출
      if (onUploadSuccess) {
        onUploadSuccess();
      }

      setImageStatus('complete');
      
    } catch (error: any) {
      console.error('AI 이미지 생성 오류:', error);
      setError(error.message || 'AI 이미지 생성 중 오류가 발생했습니다.');
      setImageStatus('error');
      
      // 오류 콜백
      if (onUploadError) {
        onUploadError(error.message || 'AI 이미지 생성 중 오류가 발생했습니다.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('파일 선택됨:', { 
      fileName: file.name, 
      fileSize: file.size, 
      mealId: mealId || 'undefined',
      fileType: file.type
    });

    // 파일 유효성 검사
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 버튼 비활성화 - 파일 선택 즉시 시작
    setIsButtonReady(false);
    setImageStatus('processing');
    
    // 6초 타이머 시작 (파일 선택 즉시)
    console.log('버튼 타이머 시작');
    setTimeout(() => {
      setIsButtonReady(true);
      console.log('버튼 활성화 타이머 완료');
    }, 6000);
    
    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    setError(null);
    setVerificationResult(null);
    // 이전 상태 리셋
    setUploading(false);
    setVerifying(false);
    
    console.log('파일 로드 완료, 상태:', {
      file: !!file,
      previewSet: !!e.target?.files?.[0],
      uploading: false,
      verifying: false,
      isButtonReady: false,
      imageStatus: 'processing'
    });
  };

  const verifyImage = async (imageId: string) => {
    try {
      setVerifying(true);
      
      // 환경에 따라 다른 API 엔드포인트 사용
      const isLocalhost = /^(localhost|127\.|\/api)/.test(window.location.hostname);
      const apiUrl = isLocalhost 
        ? '/api/meal-images/verify'
        : '/.netlify/functions/verify-meal-image';
      
      console.log('검증 API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageId }),
      });
      
      // 응답 텍스트를 먼저 가져와서 안전하게 처리
      const responseText = await response.text();
      let result;
      
      try {
        // JSON으로 파싱 시도
        result = JSON.parse(responseText);
        console.log('검증 API 응답:', result);
      } catch (e) {
        console.error('검증 API 응답 파싱 오류:', e, responseText);
        if (response.ok) {
          throw new Error('응답 파싱 오류: 올바른 JSON 응답이 아닙니다');
        } else {
          throw new Error(`검증 API 오류: ${response.status} ${response.statusText}`);
        }
      }
      
      if (!response.ok) {
        throw new Error(result?.error || '이미지 검증 중 오류가 발생했습니다.');
      }
      
      setVerificationResult(result);
      return result;
    } catch (e: any) {
      console.error('이미지 검증 오류:', e);
      setError(e.message || '이미지 검증 중 오류가 발생했습니다.');
      throw e;
    } finally {
      setVerifying(false);
    }
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      setError('업로드할 이미지를 선택해주세요.');
      return;
    }

    console.log('업로드 시도:', {
      fileName: fileInputRef.current.files[0].name,
      fileSize: fileInputRef.current.files[0].size,
      mealId: mealId || 'undefined',
      preview: !!preview
    });

    setUploading(true);
    setError(null);
    setVerificationResult(null);
    let uploadedImageId = '';

    try {
      const file = fileInputRef.current.files[0];
      
      // 1. 사용자 정보 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      // 2. FormData 생성 - 서버 사이드에서 모든 처리를 하도록 변경
      const formData = new FormData();
      formData.append('file', file);
      formData.append('meal_id', mealId);
      formData.append('school_code', schoolCode);
      formData.append('meal_date', mealDate);
      formData.append('meal_type', mealType);
      formData.append('user_id', user.id);
      
      console.log('서버 사이드 업로드 시도...', {
        meal_id: mealId,
        school_code: schoolCode,
        meal_date: mealDate,
        meal_type: mealType,
        file_name: file.name,
        file_size: file.size
      });
      
      // 3. 서버 사이드 API로 이미지 업로드 및 저장 한번에 처리
      // 환경에 따라 다른 API 엔드포인트 사용
      const isLocalhost = /^(localhost|127\.|\/api)/.test(window.location.hostname);
      const apiUrl = isLocalhost 
        ? '/api/meal-images/upload'
        : '/.netlify/functions/upload-meal-image';
      
      console.log('업로드 API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData
      });
      
      // 4. 응답 처리
      if (!response.ok) {
        // 응답 텍스트를 먼저 확인하여 안전하게 처리
        const responseText = await response.text();
        let errorMessage = `서버 오류: ${response.status} ${response.statusText}`;
        
        try {
          // JSON으로 파싱 시도
          if (responseText.trim().startsWith('{')) {
            const errorData = JSON.parse(responseText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (e) {
          console.error('응답 파싱 오류:', e);
          // HTML 응답이나 다른 형식일 경우 기본 오류 메시지 사용
        }
        
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      // 성공 응답도 안전하게 파싱
      let data;
      try {
        const responseText = await response.text();
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('성공 응답 파싱 오류:', e);
        setError('응답 데이터 파싱 중 오류가 발생했습니다');
        throw new Error('응답 데이터 파싱 오류');
      }
      console.log('업로드 성공:', data);
      uploadedImageId = data.id;
      
      // 5. 이미지 검증 API 호출
      try {
        const verificationResult = await verifyImage(uploadedImageId);
        console.log('검증 결과:', verificationResult);
        
        // 업로드된 이미지 정보 가져오기
        const { data: imageData } = await supabase
          .from('meal_images')
          .select('*')
          .eq('id', uploadedImageId)
          .single();
          
        if (imageData) {
          setUploadedImage(imageData);
        }
        
        // 성공 콜백 호출
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } catch (verifyError) {
        console.error('검증 오류:', verifyError);
        
        // 업로드된 이미지 정보 가져오기
        try {
          const { data: imageData } = await supabase
            .from('meal_images')
            .select('*')
            .eq('id', uploadedImageId)
            .single();
            
          if (imageData) {
            setUploadedImage(imageData);
          }
        } catch (err) {
          console.error('이미지 정보 조회 오류:', err);
        }
        
        // 이미지 업로드는 성공했으므로 콜백은 호출
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
      
      // 입력 필드 및 미리보기 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPreview(null);
      
    } catch (error: any) {
      console.error('이미지 업로드 오류:', error);
      setError(error.message || '이미지 업로드 중 오류가 발생했습니다.');
      
      if (onUploadError) {
        onUploadError(error.message || '이미지 업로드 중 오류가 발생했습니다.');
      }
    } finally {
      setUploading(false);
    }
  };

  const getVerificationStatusText = () => {
    if (!verificationResult) return null;
    
    const { isMatch, matchScore, explanation } = verificationResult;
    const score = Math.round((matchScore || 0) * 100);
    
    if (isMatch) {
      return (
        <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
          <p className="font-semibold">사진등록 성공! (일치도: {score}%)</p>
          <p>이미지가 메뉴와 일치하여 등록되었습니다.</p>
          {explanation && (
            <p className="text-xs mt-2 border-t border-green-200 pt-2">
              <span className="font-semibold">분석 결과:</span> {explanation}
            </p>
          )}
        </div>
      );
    } else {
      return (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          <div className="flex items-center">
            <span className="text-orange-600 text-xl mr-2">✗</span>
            <div>
              <p className="font-semibold">매칭실패 (일치도: {score}%)</p>
              <p>이미지가 메뉴와 충분히 일치하지 않습니다.</p>
            </div>
          </div>
          {explanation && (
            <p className="text-xs mt-2 border-t border-gray-200 pt-2">
              <span className="font-semibold">사유:</span> {explanation}
            </p>
          )}
        </div>
      );
    }
  };

  // 이미지 삭제 처리 함수
  const handleDeleteImage = async () => {
    if (!uploadedImage) return;
    
    try {
      // 이미지 삭제 전 확인
      const { data: imageData } = await supabase
        .from('meal_images')
        .select('*')
        .eq('id', uploadedImage.id)
        .single();

      if (!imageData) {
        throw new Error('이미지를 찾을 수 없습니다.');
      }

      // 공유된 이미지는 삭제 불가
      if (imageData.is_shared || imageData.status === 'approved') {
        setError('승인되거나 공유된 이미지는 삭제할 수 없습니다.');
        return;
      }

      // DB에서 이미지 레코드 삭제
      const { error: deleteError } = await supabase
        .from('meal_images')
        .delete()
        .eq('id', uploadedImage.id);

      if (deleteError) {
        throw deleteError;
      }

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
      
      // 상태 초기화
      setUploadedImage(null);
      setVerificationResult(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // 성공 콜백 호출
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      console.error('이미지 삭제 오류:', err);
      setError(err.message || '이미지 삭제 중 오류가 발생했습니다.');
    }
  };

// ...

  // 상태에 따른 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // 상태 텍스트 반환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '사진등록';
      case 'pending': return '검증중';
      case 'rejected': return '매칭실패';
      default: return '-';
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6 max-w-xl mx-auto">
      <h3 className="text-lg font-semibold mb-3">급식 사진 업로드</h3>
      
      {/* 업로드된 이미지가 있으면 표시 */}
      {uploadedImage ? (
        <div className="mb-6">
          <h4 className="text-md font-semibold mb-2">내가 업로드한 이미지</h4>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div className="relative h-72 w-full">
              <ImageWithFallback
                src={uploadedImage.image_url}
                alt="급식 이미지"
                style={{
                  objectFit: 'cover', 
                  position: 'absolute',
                  width: '100%',
                  height: '100%'
                }}
              />
            </div>
            <div className="p-3">
              <div className="flex justify-end items-center mb-2">
                <span className="text-xs text-gray-500">
                  {new Date(uploadedImage.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              
              {uploadedImage.match_score !== undefined && uploadedImage.match_score !== null && (
                <div className="text-sm mb-2">
                  <span className="font-semibold">메뉴 일치도:</span> {uploadedImage.match_score}% 
                  {uploadedImage.status === 'rejected' && (
                    <span className="text-orange-600 ml-1">(매칭실패, 업로드 불가)</span>
                  )}
                </div>
              )}
              
              {uploadedImage.status === 'rejected' && uploadedImage.explanation && (
                <div className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">사유:</span> {uploadedImage.explanation}
                </div>
              )}
              
              {!uploadedImage.is_shared && uploadedImage.status !== 'approved' && (
                <button
                  onClick={handleDeleteImage}
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              오늘의 급식 사진을 공유해보세요!
            </label>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>

          {preview && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">미리보기:</p>
              <div className="relative w-full h-64 bg-gray-100 rounded-md overflow-hidden">
                <ImageWithFallback
                  src={preview}
                  alt="업로드 이미지 미리보기"
                  style={{
                    objectFit: 'contain', 
                    position: 'absolute',
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>

            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {verificationResult && (
            <div className="mb-4">
              {getVerificationStatusText()}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              disabled={uploading || verifying || !preview || !isButtonReady}
              onClick={() => {
                console.log('업로드 버튼 클릭, 상태:', {
                  uploading,
                  verifying,
                  preview: !!preview,
                  isDisabled: uploading || verifying || !preview
                });
                handleUpload();
              }}
              className={`px-4 py-2 rounded-md text-white ${
                uploading || verifying || !preview || !isButtonReady
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {uploading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI 분석 중...
                </span>
              ) : verifying ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI 분석 중...
                </span>
              ) : !isButtonReady && preview ? (
                <span className="flex items-center">
                  <svg className="animate-pulse -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI 분석 준비 중...
                </span>
              ) : (
                '업로드 및 AI 검증'
              )}
            </button>
            
            {showAiGenButton && (
              <button
                onClick={handleAiImageGeneration}
                disabled={imageStatus === 'generating'}
                className={`px-4 py-2 rounded-md text-white ${imageStatus === 'generating' ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} flex items-center`}
              >
                {imageStatus === 'generating' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    AI 이미지 생성 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI 이미지 생성
                  </>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
