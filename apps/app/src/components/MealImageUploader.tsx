'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import { getSafeImageUrl, handleImageError } from '@/utils/imageUtils';
import ImageWithFallback from '@/components/ImageWithFallback';

interface MealImageUploaderProps {
  schoolCode: string;
  mealDate: string;
  mealType: string;
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
}

export default function MealImageUploader({
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
  const [showAiGenButton, setShowAiGenButton] = useState(false); // 기본값은 비활성화
  const [canUploadImage, setCanUploadImage] = useState(false); // 파일선택 버튼 활성화 조건
  const [mealId, setMealId] = useState<string | null>(null); // 급식 ID 상태 추가
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

  // AI 이미지 생성 버튼 표시 여부 확인
  useEffect(() => {
    const checkIfAiImageNeeded = async () => {
    if (!schoolCode || !mealDate) {
      console.log('schoolCode 또는 mealDate가 없음, 버튼들 비활성화');
      setShowAiGenButton(false);
      setCanUploadImage(false);
      return;
    }
    
    console.log('AI 버튼 조건 확인:', { schoolCode, mealDate });

    // 현재 날짜와 mealDate 비교 (한국 시간 기준)
    const now = new Date();
    // 한국 시간대로 변환
    const koreaTimeString = now.toLocaleString('en-CA', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const [dateStr, timeStr] = koreaTimeString.split(', ');
    const today = dateStr; // YYYY-MM-DD 형식
    const [hourStr, minuteStr] = timeStr.split(':');
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    
    console.log('날짜 비교:', {
      utcNow: now.toISOString(),
      koreaTimeString,
      today,
      mealDate,
      isToday: today === mealDate,
      hour,
      minute
    });
    
    // mealDate가 오늘이 아니면 AI 버튼 비활성화
    if (mealDate !== today) {
      console.log('버튼들 비활성화: 오늘 날짜가 아님');
      setShowAiGenButton(false);
      setCanUploadImage(false);
      return;
    }
    
    let currentMealId = null;
    let isPastAiCutoffTime = false;
    
    try {
      // 1. mealDate + 학교 코드로 급식 정보 조회
      const { data: mealData, error: mealFetchError } = await supabase
        .from('meal_menus')
        .select('id, meal_date, menu_items')
        .eq('meal_date', mealDate)
        .eq('school_code', schoolCode)
        .maybeSingle(); // 0개 또는 1개만 허용
  
        console.log('급식 정보 조회 결과:', { 
          today, 
          schoolCode, 
          mealData, 
          error: mealFetchError 
        });
  
        if (mealFetchError) {
          console.error('급식 정보 조회 오류:', mealFetchError);
          setShowAiGenButton(false);
          setCanUploadImage(false);
          return;
        }
  
        if (!mealData) {
          console.log('오늘 날짜의 해당 학교 급식 정보가 없음 - 버튼들 비활성화');
          setShowAiGenButton(false);
          setCanUploadImage(false);
          return;
        }
        
        // 2. 급식 데이터에서 mealId 획득 및 상태 설정
        currentMealId = mealData.id;
        setMealId(currentMealId); // mealId 상태 설정
        console.log('획득한 mealId:', currentMealId);
        
        // 급식 정보 유효성 찴크
        const hasValidMeal = Array.isArray(mealData.menu_items) && 
                            mealData.menu_items.length > 0 &&
                            // "급식 정보가 없습니다" 메시지가 없는 경우
                            !mealData.menu_items.some(item => 
                              typeof item === 'string' && item.includes('급식 정보가 없습니다')
                            );
        
        console.log('급식 정보 상세:', {
          menu_items: mealData.menu_items,
          menu_items_count: Array.isArray(mealData.menu_items) ? mealData.menu_items.length : 0,
          hasValidMeal
        });
        
        if (!hasValidMeal) {
          console.log('버튼들 비활성화: 급식 정보가 없거나 메뉴가 비어있음');
          setShowAiGenButton(false);
          setCanUploadImage(false);
          return;
        }
        
        // hasValidMeal 체크는 위에서 이미 완료됨
        
        // 3. 시간 조건 확인 (12:00 이후, 한국 시간 기준)
        const isPastCutoffTime = hour >= 12;
        
        console.log('시간 조건 확인:', {
          hour,
          minute,
          isPastCutoffTime
        });
        
        // 파일선택 버튼은 12:00 이후부터 활성화
        setCanUploadImage(isPastCutoffTime);
        
        // AI 이미지 생성 버튼은 12:30 이후부터 활성화
        isPastAiCutoffTime = hour > 12 || (hour === 12 && minute >= 30);
        if (!isPastAiCutoffTime) {
          console.log('AI 이미지 생성 버튼 비활성화: 12:30 이전');
          setShowAiGenButton(false);
          return;
        }
      } catch (e) {
        console.error('급식 정보 조회 중 예외 발생:', e);
        setShowAiGenButton(false);
        setCanUploadImage(false);
        return;
      }
      
      // AI 이미지 생성 버튼 활성화 (승인된 이미지 조건 제거)
      console.log('AI 이미지 생성 버튼 활성화:', {
        isPastAiCutoffTime,
        조건: '당일 + 급식정보 + 12:30 이후'
      });
      
      setShowAiGenButton(isPastAiCutoffTime);
    };
    
    if (schoolCode && mealDate) {
      checkIfAiImageNeeded();
    }
  }, [schoolCode, mealDate, supabase]);
  
  // mealDate 변경 시 상태 초기화
  useEffect(() => {
    console.log('mealDate 변경됨, 상태 초기화:', mealDate);
    // 이전 날짜의 미리보기나 AI 생성 이미지 제거
    setPreview(null);
    setImageStatus('idle');
    setIsButtonReady(false);
    setError(null);
    setVerificationResult(null);
    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [mealDate]);
  
  // 이미지 업로드 후 AI 이미지 생성 버튼 비활성화
  useEffect(() => {
    if (uploadedImage) {
      console.log('이미지 업로드 완료: AI 이미지 생성 버튼 비활성화');
      setShowAiGenButton(false);
    }
  }, [uploadedImage]);
  
  // 승인된 이미지 가져오는 함수 (재사용을 위해 함수로 분리)
  const fetchApprovedImage = useCallback(async () => {
    if (!mealDate || !schoolCode) {
      console.log('mealDate 또는 schoolCode가 없음, 승인된 이미지 조회 건너뜀');
      return;
    }
    
    console.log('승인된 이미지 조회 시작:', { mealDate, schoolCode });
    
    // 1. mealDate + 학교 코드로 급식 찾기
    const { data: mealData, error: mealError } = await supabase
      .from('meal_menus')
      .select('id')
      .eq('meal_date', mealDate)
      .eq('school_code', schoolCode)
      .maybeSingle();
      
    if (mealError || !mealData) {
      console.log('오늘 날짜의 급식 정보가 없음:', mealError);
      return;
    }
    
    const currentMealId = mealData.id;
    console.log('승인된 이미지 조회 - mealId:', currentMealId);
    
    // 2. 그 mealId로 승인된 이미지 조회
    const { data, error } = await supabase
      .from('meal_images')
      .select('*')
      .eq('meal_id', currentMealId)
      .eq('status', 'approved')
      .maybeSingle(); // 0개 또는 1개만 허용, 2개 이상이면 오류 발생
      
    if (error) {
      if (error.code !== 'PGRST116') { // PGRST116 = 결과 없음 오류는 정상적인 상태
        console.debug('기존 승인 이미지 조회 오류:', error);
      }
      return;
    }
    
    if (data) {
      console.log('승인된 이미지 발견:', data.id);
      
      // 업로드한 사용자 정보 가져오기 (있는 경우)
      if (data.uploaded_by) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('nickname')
          .eq('id', data.uploaded_by)
          .single();
          
        if (!userError && userData) {
          console.log('AI 이미지 생성 - 사용자 정보 조회 성공:', userData);
          // 사용자 별명 정보 추가
          data.uploader_nickname = userData.nickname;
        }
      }
      
      setUploadedImage(data);
      // 이미 이미지가 있으면 업로드/AI 생성 버튼은 숨깁니다
      setShowAiGenButton(false);
    }
  }, [mealDate, schoolCode, supabase]);

  // 컴포넌트 마운트 시 승인된 이미지 자동 로드
  useEffect(() => {
    fetchApprovedImage();
  }, [fetchApprovedImage]);
  
  // 실시간 이미지 업데이트를 위한 Supabase 구독 설정
  useEffect(() => {
    if (!schoolCode) return;
    
    console.log('실시간 이미지 구독 설정:', schoolCode);
    
    // meal_images 테이블의 변경사항 감지
    const channel = supabase
      .channel(`meal-images-${schoolCode}`)
      .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'meal_images'
          }, 
          (payload) => {
            console.log('이미지 실시간 업데이트 수신:', payload);
            
            // 새로운 이미지가 승인되었거나 상태가 변경된 경우에만 업데이트
            if (payload.new && (payload.new.status === 'approved' || 
                (payload.old && payload.old.status !== 'approved' && payload.new.status === 'approved'))) {
              console.log('승인된 이미지 변경 감지, 이미지 다시 가져오기');
              fetchApprovedImage();
            }
          }
      )
      .subscribe();
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log('이미지 실시간 구독 해제:', schoolCode);
      supabase.removeChannel(channel);
    };
  }, [schoolCode, supabase, fetchApprovedImage]);

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
          meal_id: mealId || mealMenuData.id, // mealId 상태 또는 조회된 데이터 ID 사용
          school_code: mealMenuData.school_code || schoolCode,
          meal_date: mealMenuData.meal_date || mealDate,
          meal_type: mealMenuData.meal_type || mealType,
          user_id: userId // 현재 로그인된 사용자 ID 추가
        }),
      });
      
      // 응답 상태 코드 확인
      console.log('AI 이미지 생성 API 응답 상태 코드:', response.status, response.statusText);
      
      // 응답 텍스트를 먼저 가져와서 안전하게 처리
      const responseText = await response.text();
      console.log('AI 이미지 생성 API 응답 텍스트(처음 200자):', responseText.substring(0, 200));
      
      let result;
      
      try {
        // JSON으로 파싱 시도
        result = JSON.parse(responseText);
        console.log('AI 이미지 생성 API 응답 파싱 결과:', result);
      } catch (e) {
        console.error('AI 이미지 생성 API 응답 파싱 오류:', e);
        console.error('파싱 오류 발생한 응답의 처음 부분:', responseText.substring(0, 50));
        throw new Error(`응답 처리 중 오류가 발생했습니다. 상태 코드: ${response.status}`);
      }
      
      if (!result.success) {
        throw new Error(result.error || 'AI 이미지 생성에 실패했습니다.');
      }
      
      // 3. 생성된 이미지 정보로 상태 업데이트
      console.log('AI 이미지 생성 성공:', result.image);
      
      // 이미지 정보에 사용자 별명 정보 추가
      if (result.image && result.image.uploaded_by) {
        try {
          // 사용자 정보 조회
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('nickname, profile_image')
            .eq('id', result.image.uploaded_by)
            .single();
            
          if (!userError && userData) {
            console.log('AI 이미지 생성 - 사용자 정보 조회 성공:', userData);
            // 사용자 별명 정보 추가
            result.image.uploader_nickname = userData.nickname;
            result.image.users = { 
              nickname: userData.nickname, 
              profile_image: userData.profile_image 
            };
          }
        } catch (e) {
          console.error('AI 이미지 생성 - 사용자 정보 조회 예외:', e);
        }
      }
      
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
      
      // 성공 콜백 호출 - 지연 시간 추가
      console.log('⏱️ 이미지 업로드 후 콜백 호출 대기 중...');
      setTimeout(() => {
        console.log('⏱️ 콜백 호출 타이머 완료, onUploadSuccess 호출');
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }, 4000); // 4초 지연

      const errorMessage = error ? (typeof error === 'object' && error.message ? error.message : 'AI 이미지 생성 중 오류가 발생했습니다.') : 'AI 이미지 생성 중 오류가 발생했습니다.';
      setError(errorMessage);
      setImageStatus('error');
      
      // 오류 콜백
      if (onUploadError) {
        onUploadError(errorMessage);
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

    // 6초 타이머로 버튼 활성화 (원본 로직)
    setIsButtonReady(false);
    setImageStatus('processing');
    
    setTimeout(() => {
      setIsButtonReady(true);
      setImageStatus('ready');
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

      // 2. mealId가 null인 경우 직접 조회
      let finalMealId = mealId;
      if (!finalMealId) {
        console.log('mealId가 null이므로 직접 조회 시작');
        const { data: mealData, error: mealError } = await supabase
          .from('meal_menus')
          .select('id')
          .eq('meal_date', mealDate)
          .eq('school_code', schoolCode)
          .eq('meal_type', mealType)
          .maybeSingle();
          
        if (mealError) {
          console.error('급식 정보 조회 오류:', mealError);
          throw new Error('급식 정보를 찾을 수 없습니다.');
        }
        
        if (!mealData) {
          throw new Error('해당 날짜와 학교의 급식 정보가 없습니다.');
        }
        
        finalMealId = mealData.id;
        setMealId(finalMealId); // 상태도 업데이트
        console.log('조회된 mealId:', finalMealId);
      }

      // 3. FormData 생성 - 서버 사이드에서 모든 처리를 하도록 변경
      const formData = new FormData();
      formData.append('file', file);
      formData.append('meal_id', finalMealId);
      formData.append('school_code', schoolCode);
      formData.append('meal_date', mealDate);
      formData.append('meal_type', mealType);
      formData.append('user_id', user.id);
      
      console.log('서버 사이드 업로드 시도...', {
        meal_id: finalMealId,
        school_code: schoolCode,
        meal_date: mealDate,
        meal_type: mealType,
        file_name: file.name,
        file_size: file.size
      });
      
      // 4. 서버 사이드 API로 이미지 업로드 및 저장 한번에 처리
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
      
      // 5. 응답 처리
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
        
        // 업로드된 이미지 정보 가져오기 (사용자 정보 포함)
        // 이미지 정보 조회
        const { data: imageData } = await supabase
          .from('meal_images')
          .select('*')
          .eq('id', uploadedImageId)
          .single();
          
        if (imageData) {
          // 사용자 정보 별도 조회
          let uploaderNickname = null;
          if (imageData.uploaded_by) {
            try {
              const { data: userData } = await supabase
                .from('users')
                .select('nickname')
                .eq('id', imageData.uploaded_by)
                .single();
              uploaderNickname = userData?.nickname || null;
            } catch (userError) {
              console.error('사용자 정보 조회 오류:', userError);
            }
          }
          
          // 사용자 별명 추가 및 검증 결과 반영
          const updatedImageData = {
            ...imageData,
            uploader_nickname: uploaderNickname,
            status: verificationResult.isMatch ? 'approved' : 'rejected',
            match_score: verificationResult.matchScore || 0,
            explanation: verificationResult.explanation || null
          };
          setUploadedImage(updatedImageData);
          
          // 검증 실패 시 전역 플래그 설정 - 날짜 이동 차단
          if (!verificationResult.isMatch) {
            if (typeof window !== 'undefined') {
              (window as any).hasRejectedImage = true;
              (window as any).rejectedImageId = uploadedImageId;
              console.log('🚫 검증 실패로 네비게이션 차단 플래그 설정:', uploadedImageId);
            }
          }
        }
        
        // 성공 콜백 호출 - 지연 시간 추가
        console.log('⏱️ 이미지 업로드 후 콜백 호출 대기 중...');
        setTimeout(() => {
          console.log('⏱️ 콜백 호출 타이머 완료, onUploadSuccess 호출');
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        }, 2000); // 2초 지연으로 증가
      } catch (verifyError) {
        console.error('검증 오류:', verifyError);
        
        // 업로드된 이미지 정보 가져오기 (사용자 정보 포함)
        try {
          const { data: imageData } = await supabase
            .from('meal_images')
            .select('*')
            .eq('id', uploadedImageId)
            .single();
            
          if (imageData) {
            // 사용자 정보 별도 조회
            let uploaderNickname = null;
            if (imageData.uploaded_by) {
              try {
                const { data: userData } = await supabase
                  .from('users')
                  .select('nickname')
                  .eq('id', imageData.uploaded_by)
                  .single();
                uploaderNickname = userData?.nickname || null;
              } catch (userError) {
                console.error('사용자 정보 조회 오류:', userError);
              }
            }
            
            // 사용자 별명 추가 및 검증 실패 상태 반영
            const updatedImageData = {
              ...imageData,
              uploader_nickname: uploaderNickname,
              status: 'rejected',
              explanation: '이미지 검증 중 오류가 발생했습니다.'
            };
            setUploadedImage(updatedImageData);
            
            // 전역 플래그 설정 - 날짜 이동 차단
            if (typeof window !== 'undefined') {
              (window as any).hasRejectedImage = true;
              (window as any).rejectedImageId = uploadedImageId;
            }
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
      if (imageData.status === 'approved') {
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
      
      // 전역 플래그 해제 - 날짜 이동 차단 해제
      if (typeof window !== 'undefined') {
        (window as any).hasRejectedImage = false;
        (window as any).rejectedImageId = null;
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
    <div className="p-0 mb-0 max-w-xl mx-auto">
      
      {/* 업로드된 이미지가 있으면 표시 */}
      {uploadedImage ? (
        <div>
          <div className="overflow-hidden rounded-lg">
            <div className="relative w-full h-auto">
              <ImageWithFallback
                src={uploadedImage.image_url}
                alt="급식 이미지"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '80vh',
                  display: 'block'
                }}
              />
            </div>
            <div className="px-0 py-1 text-xs">
              <div className="flex justify-end items-center">
                {uploadedImage.source === 'user_ai' && uploadedImage.uploader_nickname && (
  <span className="text-xs text-gray-500 text-right">AI로 생성한 이미지 ({uploadedImage.uploader_nickname})</span>
)}
{uploadedImage.source === 'user_ai' && !uploadedImage.uploader_nickname && (
  <span className="text-xs text-gray-500 text-right">AI로 생성한 이미지</span>
)}
{uploadedImage.source === 'auto_ai' && (
  <span className="text-xs text-gray-500 text-right">AI로 생성한 이미지</span>
)}
{uploadedImage.source === 'user' && uploadedImage.uploader_nickname && (
  <span className="text-xs text-gray-500 text-right">({uploadedImage.uploader_nickname})</span>
)}
              </div>
              
              {uploadedImage.status === 'rejected' && (
                <div className="text-sm mb-2">
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
              
              {uploadedImage.status !== 'approved' && (
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
              className="hidden"
              disabled={!canUploadImage}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!canUploadImage}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                canUploadImage 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={!canUploadImage ? '당일 급식 메뉴에 대해서만 12시 이후 업로드 가능합니다.' : ''}
            >
              파일 선택
            </button>
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
            
            <button
                onClick={handleAiImageGeneration}
                disabled={!showAiGenButton || imageStatus === 'generating'}
                className={`px-4 py-2 rounded-md text-white ${!showAiGenButton || imageStatus === 'generating' ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} flex items-center`}
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
          </div>
        </>
      )}
    </div>
  );
}
