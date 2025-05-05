'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';

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
  const [uploadStage, setUploadStage] = useState<'ready' | 'uploading' | 'analyzing' | 'complete' | 'error'>('ready'); // 업로드 단계
  const [progressPercent, setProgressPercent] = useState(0); // 진행률 표시용
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
      setError('이미지 파일만 업로드할 수 없습니다.');
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
    
    setUploadStage('ready');
    setProgressPercent(0);
    
    console.log('파일 로드 완료, 상태:', {
      file: !!file,
      previewSet: !!e.target?.files?.[0],
      uploading: false,
      verifying: false,
      isButtonReady: false,
      imageStatus: 'processing',
      uploadStage: 'ready',
      progressPercent: 0
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
    setUploadStage('uploading');
    setProgressPercent(20);
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
        setUploadStage('analyzing');
        setProgressPercent(60);
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
        
        setUploadStage('complete');
        setProgressPercent(100);
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
      setUploadStage('error');
      setProgressPercent(0);
      
      if (onUploadError) {
        onUploadError(error.message || '이미지 업로드 중 오류가 발생했습니다.');
      }
    } finally {
      setUploading(false);
    }
  };

// ...

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* 진행 상태 표시기 */}
          {preview && !uploadedImage && uploadStage !== 'ready' && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${uploadStage === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <div className={`${uploadStage === 'uploading' || uploadStage === 'analyzing' || uploadStage === 'complete' ? 'text-blue-600 font-medium' : ''}`}>업로드</div>
                <div className={`${uploadStage === 'analyzing' || uploadStage === 'complete' ? 'text-blue-600 font-medium' : ''}`}>AI 분석</div>
                <div className={`${uploadStage === 'complete' ? 'text-blue-600 font-medium' : ''}`}>완료</div>
              </div>
            </div>
          )}

          {verificationResult && (
            <div className="mb-4">
              {getVerificationStatusText()}
            </div>
          )}

          <div className="flex justify-end">
            <button

// ...
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
                  업로드 중...
                </span>
              ) : verifying ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  검증 중...
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
          </div>
        </>
      )}
    </div>
  );
}
