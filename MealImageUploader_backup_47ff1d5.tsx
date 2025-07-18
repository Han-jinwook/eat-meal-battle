'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
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
  const [imageStatus, setImageStatus] = useState('none'); // ?대?吏 ?곹깭 異붿쟻??  const [showAiGenButton, setShowAiGenButton] = useState(true); // ?뚯뒪?몃? ?꾪빐 ??긽 true濡??ㅼ젙
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ?ъ슜???뺣낫 媛?몄삤湲?  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    
    fetchUserInfo();
  }, [supabase]);

  // AI ?대?吏 ?앹꽦 踰꾪듉 ?쒖떆 ?щ? ?뺤씤 - ?뚯뒪?몃? ?꾪빐 二쇱꽍 泥섎━
  /*useEffect(() => {
    const checkIfAiImageNeeded = async () => {
      if (!mealId) return;

      // ?뱀씪 ?좎쭨?몄? ?뺤씤 (?ㅻ뒛 ?좎쭨? 湲됱떇 ?좎쭨 鍮꾧탳)
      const today = new Date().toISOString().split('T')[0];
      
      // 1. 硫붾돱 議댁옱 ?щ?瑜?HEAD 濡?癒쇱? ?뺤씤??404 ?ㅽ듃?뚰겕 ?ㅻ쪟 諛⑹?
      const {
        count: mealCount,
        error: mealHeadError
      } = await supabase
        .from('meals')
        .select('id', { head: true, count: 'exact' })
        .eq('id', mealId);

      if (mealHeadError) {
        if (mealHeadError.code === '42P01') {
          console.debug('meals ?뚯씠釉붿씠 ?놁뒿?덈떎. AI 踰꾪듉 ?④?');
        } else {
          console.debug(`湲됱떇 ID(${mealId}) 議댁옱 ?щ? ?뺤씤 以??덉긽???ㅻ쪟 (?꾨쭏????젣??湲됱떇):`, mealHeadError.message);
        }
        setShowAiGenButton(false);
        return;
      }

      if (!mealCount) {
        // ?대떦 湲됱떇???놁쓬
        setShowAiGenButton(false);
        return;
      }

      // 2. ?ㅼ젣 湲됱떇 ?좎쭨 議고쉶 (議댁옱???뚮쭔)
      const { data: mealData, error: mealFetchError } = await supabase
        .from('meals')
        .select('meal_date')
        .eq('id', mealId)
        .single();

      if (mealFetchError) {
        // PGRST116 = no rows found, 42P01 = relation does not exist (?뚯씠釉??놁쓬)
        if (mealFetchError.code === 'PGRST116' || mealFetchError.code === '42P01') {
          console.debug('湲됱떇 ?좎쭨 議고쉶 寃곌낵 ?놁쓬/?뚯씠釉??놁쓬:', mealFetchError.code);
        } else {
          console.error('湲됱떇 ?좎쭨 議고쉶 ?ㅻ쪟:', mealFetchError);
        }
        // ?곗씠???녾굅???ㅽ궎留??놁쓬?대㈃ AI 踰꾪듉 ?④린怨?醫낅즺
        setShowAiGenButton(false);
        return;
      }
      
      // 3. 湲됱떇 ?좎쭨媛 ?ㅻ뒛???꾨땲硫?踰꾪듉 ?④?
      if (!mealData || mealData.meal_date !== today) {
        console.log('AI ?대?吏 ?앹꽦 踰꾪듉 ?④?: ?뱀씪 ?좎쭨媛 ?꾨떂', {
          today,
          mealDate: mealData.meal_date
        });
        setShowAiGenButton(false);
        return;
      }
      
      // 2. ?쒓컙 議곌굔 ?뺤씤 (12:30 ?댄썑)
      const now = new Date();
      const isAfterLunchTime = now.getHours() > 12 || (now.getHours() === 12 && now.getMinutes() >= 30);
      
      if (!isAfterLunchTime) {
        console.log('AI ?대?吏 ?앹꽦 踰꾪듉 ?④?: 12:30 ?댁쟾');
        setShowAiGenButton(false);
        return;
      }
      
      // 3. ?꾩옱 湲됱떇???대?吏 ?щ? ?뺤씤
      const { data: images } = await supabase
        .from('meal_images')
        .select('id, status, match_score')
        .eq('meal_id', mealId);
        
      // 4. 踰꾪듉 ?쒖떆 議곌굔:
      // - ?대?吏媛 ?녾굅??      // - ?대?吏???덉?留?紐⑤몢 ?뱀씤?섏? ?딆? 寃쎌슦
      const shouldShow = !images || images.length === 0 || !images.some(img => img.status === 'approved');
      
      console.log('AI ?대?吏 ?앹꽦 踰꾪듉 ?쒖떆 ?щ?:', {
        mealId,
        today,
        mealDate: mealData.meal_date,
        isAfterLunchTime,
        imagesCount: images?.length || 0,
        hasApprovedImages: images?.some(img => img.status === 'approved'),
        shouldShow
      });
      
      setShowAiGenButton(shouldShow);
    };
    
    if (mealId) {
      checkIfAiImageNeeded();
    }
  }, [mealId, supabase]);*/
  
  // ?뚯뒪?몃? ?꾪빐 ??긽 AI ?대?吏 ?앹꽦 踰꾪듉 ?쒖떆
  useEffect(() => {
    console.log('?뚯뒪??紐⑤뱶: AI ?대?吏 ?앹꽦 踰꾪듉 ??긽 ?쒖떆');
    setShowAiGenButton(true);
  }, []);
  
  // ?뱀씤???대?吏 媛?몄삤???⑥닔 (?ъ궗?⑹쓣 ?꾪빐 ?⑥닔濡?遺꾨━)
  const fetchApprovedImage = useCallback(async () => {
    if (!mealId) return;
    
    console.log('?뱀씤???대?吏 議고쉶:', mealId);
    const { data, error } = await supabase
      .from('meal_images')
      .select('*')
      .eq('meal_id', mealId)
      .eq('status', 'approved')
      .single();
      
    if (error) {
      if (error.code !== 'PGRST116') { // PGRST116 = 寃곌낵 ?놁쓬 ?ㅻ쪟???뺤긽?곸씤 ?곹깭
        console.debug('湲곗〈 ?뱀씤 ?대?吏 議고쉶 ?ㅻ쪟:', error);
      }
      return;
    }
    
    if (data) {
      console.log('?뱀씤???대?吏 諛쒓껄:', data.id);
      
      // ?낅줈?쒗븳 ?ъ슜???뺣낫 媛?몄삤湲?(?덈뒗 寃쎌슦)
      if (data.uploaded_by) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('nickname')
          .eq('id', data.uploaded_by)
          .single();
          
        if (!userError && userData) {
          // ?ъ슜???됰꽕???뺣낫 異붽?
          data.uploader_nickname = userData.nickname;
        }
      }
      
      setUploadedImage(data);
      // ?대? ?대?吏媛 ?덉쑝硫??낅줈??AI ?앹꽦 踰꾪듉? ?④퉩?덈떎
      setShowAiGenButton(false);
    }
  }, [mealId, supabase]);

  // 而댄룷?뚰듃 留덉슫?????뱀씤???대?吏 ?먮룞 濡쒕뱶
  useEffect(() => {
    fetchApprovedImage();
  }, [fetchApprovedImage]);
  
  // ?ㅼ떆媛??대?吏 ?낅뜲?댄듃瑜??꾪븳 Supabase 援щ룆 ?ㅼ젙
  useEffect(() => {
    if (!mealId) return;
    
    console.log('?ㅼ떆媛??대?吏 援щ룆 ?ㅼ젙:', mealId);
    
    // ?꾩옱 meal_id?????meal_images ?뚯씠釉붿쓽 蹂寃쎌궗??媛먯?
    const channel = supabase
      .channel(`meal-images-${mealId}`)
      .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'meal_images', 
            filter: `meal_id=eq.${mealId}` 
          }, 
          (payload) => {
            console.log('?대?吏 ?ㅼ떆媛??낅뜲?댄듃 ?섏떊:', payload);
            
            // ?덈줈???대?吏媛 ?뱀씤?섏뿀嫄곕굹 ?곹깭媛 蹂寃쎈맂 寃쎌슦?먮쭔 ?낅뜲?댄듃
            if (payload.new && (payload.new.status === 'approved' || 
                (payload.old && payload.old.status !== 'approved' && payload.new.status === 'approved'))) {
              console.log('?뱀씤???대?吏 蹂寃?媛먯?, ?대?吏 ?ㅼ떆 媛?몄삤湲?);
              fetchApprovedImage();
            }
          }
      )
      .subscribe();
    
    // 而댄룷?뚰듃 ?몃쭏?댄듃 ??援щ룆 ?댁젣
    return () => {
      console.log('?대?吏 ?ㅼ떆媛?援щ룆 ?댁젣:', mealId);
      supabase.removeChannel(channel);
    };
  }, [mealId, supabase, fetchApprovedImage]);

  // AI ?대?吏 ?앹꽦 泥섎━ ?⑥닔 (踰꾪듉??
  const handleAiImageGeneration = async () => {
    try {
      console.log('AI ?대?吏 ?앹꽦 踰꾪듉 ?대┃!');
      
      // ?낅줈???곹깭? 寃利??곹깭瑜?紐⑤몢 珥덇린??      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // AI ?대?吏 ?앹꽦???곹깭留??ㅼ젙
      setUploading(false); // ?낅줈???곹깭瑜?false濡??좎?
      setError(null);
      setVerifying(false);
      setImageStatus('generating');
      
      // 1. 硫붾돱 ?뺣낫 媛?몄삤湲?- meal_menus ?뚯씠釉붿뿉??議고쉶
      console.log('硫붾돱 ?뺣낫 議고쉶 ?쒕룄:', { schoolCode, mealDate, mealType });
      
      // meal_menus ?뚯씠釉?援ъ“??留욊쾶 ?섏젙: school_code, meal_date, meal_type?쇰줈 議고쉶
      const { data: mealMenuData, error: mealMenuError } = await supabase
        .from('meal_menus')
        .select('id, menu_items, meal_date, meal_type, school_code')
        .eq('school_code', schoolCode)
        .eq('meal_date', mealDate)
        .eq('meal_type', mealType)
        .single();
        
      if (mealMenuError) {
        console.error('硫붾돱 ?뺣낫 議고쉶 ?ㅻ쪟:', mealMenuError);
        throw new Error('硫붾돱 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.');
      }
      
      if (!mealMenuData || !mealMenuData.menu_items || mealMenuData.menu_items.length === 0) {
        console.error('硫붾돱 ?뺣낫媛 ?놁뒿?덈떎:', mealMenuData);
        throw new Error('湲됱떇 硫붾돱 ?뺣낫媛 ?놁뒿?덈떎.');
      }
      
      console.log('硫붾돱 ?뺣낫 議고쉶 ?깃났:', { 
        menuItems: mealMenuData.menu_items,
        menuCount: mealMenuData.menu_items.length,
        mealDate: mealMenuData.meal_date,
        mealType: mealMenuData.meal_type,
        schoolCode: mealMenuData.school_code
      });
      
      // 2. OpenAI API ?몄텧?섏뿬 ?대?吏 ?앹꽦
      // ?뚯뒪?몃? ?꾪빐 ??긽 Netlify ?⑥닔 ?ъ슜
      const apiUrl = '/.netlify/functions/generate-meal-image';
      
      console.log('AI ?대?吏 ?앹꽦 API ?붿껌 URL:', apiUrl);
      
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
          meal_type: mealMenuData.meal_type || mealType,
          user_id: userId // ?꾩옱 濡쒓렇?몃맂 ?ъ슜??ID 異붽?
        }),
      });
      
      // ?묐떟 ?곹깭 肄붾뱶 ?뺤씤
      console.log('AI ?대?吏 ?앹꽦 API ?묐떟 ?곹깭 肄붾뱶:', response.status, response.statusText);
      
      // ?묐떟 ?띿뒪?몃? 癒쇱? 媛?몄????덉쟾?섍쾶 泥섎━
      const responseText = await response.text();
      console.log('AI ?대?吏 ?앹꽦 API ?묐떟 ?띿뒪??泥섏쓬 200??:', responseText.substring(0, 200));
      
      let result;
      
      try {
        // JSON?쇰줈 ?뚯떛 ?쒕룄
        result = JSON.parse(responseText);
        console.log('AI ?대?吏 ?앹꽦 API ?묐떟 ?뚯떛 寃곌낵:', result);
      } catch (e) {
        console.error('AI ?대?吏 ?앹꽦 API ?묐떟 ?뚯떛 ?ㅻ쪟:', e);
        console.error('?뚯떛 ?ㅻ쪟 諛쒖깮???묐떟??泥섏쓬 遺遺?', responseText.substring(0, 50));
        throw new Error(`?묐떟 泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?곹깭 肄붾뱶: ${response.status}`);
      }
      
      if (!result.success) {
        throw new Error(result.error || 'AI ?대?吏 ?앹꽦???ㅽ뙣?덉뒿?덈떎.');
      }
      
      // 3. ?앹꽦???대?吏 ?뺣낫濡??곹깭 ?낅뜲?댄듃
      console.log('AI ?대?吏 ?앹꽦 ?깃났:', result.image);
      
      // ?대?吏 ?뺣낫???ъ슜??蹂꾨챸 ?뺣낫 異붽?
      if (result.image && result.image.uploaded_by) {
        try {
          // ?ъ슜???뺣낫 議고쉶
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('nickname, profile_image')
            .eq('id', result.image.uploaded_by)
            .single();
            
          if (!userError && userData) {
            console.log('AI ?대?吏 ?앹꽦 - ?ъ슜???뺣낫 議고쉶 ?깃났:', userData);
            // ?ъ슜??蹂꾨챸 ?뺣낫 異붽?
            result.image.uploader_nickname = userData.nickname;
            result.image.users = { 
              nickname: userData.nickname, 
              profile_image: userData.profile_image 
            };
          } else {
            console.error('AI ?대?吏 ?앹꽦 - ?ъ슜???뺣낫 議고쉶 ?ㅻ쪟:', userError);
          }
        } catch (e) {
          console.error('AI ?대?吏 ?앹꽦 - ?ъ슜???뺣낫 議고쉶 ?덉쇅:', e);
        }
      }
      
      // ?대?吏 ?뺣낫 ?낅뜲?댄듃 - 寃利?怨쇱젙 ?앸왂
      setUploadedImage(result.image);
      
      // 寃利?寃곌낵瑜?吏곸젒 ?ㅼ젙?섏뿬 寃利?怨쇱젙 ?앸왂
      setVerificationResult({
        isMatch: true,
        matchScore: 1.0, // 100% ?쇱튂
        explanation: 'AI媛 ?앹꽦???대?吏?낅땲?? 硫붾돱??留욊쾶 ?먮룞 ?앹꽦?섏뿀?듬땲??'
      });
      
      // ?대?吏 ?곹깭 ?꾨즺濡??ㅼ젙
      setImageStatus('complete');
      
      // ?깃났 肄쒕갚 ?몄텧 - 吏???쒓컙 異붽?
      console.log('?깍툘 ?대?吏 ?낅줈????肄쒕갚 ?몄텧 ?湲?以?..');
      setTimeout(() => {
        console.log('?깍툘 肄쒕갚 ?몄텧 ??대㉧ ?꾨즺, onUploadSuccess ?몄텧');
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }, 4000); // 4珥?吏??
      const errorMessage = error ? (typeof error === 'object' && error.message ? error.message : 'AI ?대?吏 ?앹꽦 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.') : 'AI ?대?吏 ?앹꽦 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.';
      setError(errorMessage);
      setImageStatus('error');
      
      // ?ㅻ쪟 肄쒕갚
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

    console.log('?뚯씪 ?좏깮??', { 
      fileName: file.name, 
      fileSize: file.size, 
      mealId: mealId || 'undefined',
      fileType: file.type
    });

    // ?뚯씪 ?좏슚??寃??    if (!file.type.startsWith('image/')) {
      setError('?대?吏 ?뚯씪留??낅줈?쒗븷 ???덉뒿?덈떎.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('?뚯씪 ?ш린??5MB ?댄븯?ъ빞 ?⑸땲??');
      return;
    }

    // 踰꾪듉 鍮꾪솢?깊솕 - ?뚯씪 ?좏깮 利됱떆 ?쒖옉
    setIsButtonReady(false);
    setImageStatus('processing');
    
    // 6珥???대㉧ ?쒖옉 (?뚯씪 ?좏깮 利됱떆)
    console.log('踰꾪듉 ??대㉧ ?쒖옉');
    setTimeout(() => {
      setIsButtonReady(true);
      console.log('踰꾪듉 ?쒖꽦????대㉧ ?꾨즺');
    }, 6000);
    
    // 誘몃━蹂닿린 ?앹꽦
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    setError(null);
    setVerificationResult(null);
    // ?댁쟾 ?곹깭 由ъ뀑
    setUploading(false);
    setVerifying(false);
    
    console.log('?뚯씪 濡쒕뱶 ?꾨즺, ?곹깭:', {
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
      
      // ?섍꼍???곕씪 ?ㅻⅨ API ?붾뱶?ъ씤???ъ슜
      const isLocalhost = /^(localhost|127\.|\/api)/.test(window.location.hostname);
      const apiUrl = isLocalhost 
        ? '/api/meal-images/verify'
        : '/.netlify/functions/verify-meal-image';
      
      console.log('寃利?API ?붿껌 URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageId }),
      });
      
      // ?묐떟 ?띿뒪?몃? 癒쇱? 媛?몄????덉쟾?섍쾶 泥섎━
      const responseText = await response.text();
      let result;
      
      try {
        // JSON?쇰줈 ?뚯떛 ?쒕룄
        result = JSON.parse(responseText);
        console.log('寃利?API ?묐떟:', result);
      } catch (e) {
        console.error('寃利?API ?묐떟 ?뚯떛 ?ㅻ쪟:', e, responseText);
        if (response.ok) {
          throw new Error('?묐떟 ?뚯떛 ?ㅻ쪟: ?щ컮瑜?JSON ?묐떟???꾨떃?덈떎');
        } else {
          throw new Error(`寃利?API ?ㅻ쪟: ${response.status} ${response.statusText}`);
        }
      }
      
      if (!response.ok) {
        throw new Error(result?.error || '?대?吏 寃利?以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
      }
      
      setVerificationResult(result);
      return result;
    } catch (e: any) {
      console.error('?대?吏 寃利??ㅻ쪟:', e);
      setError(e.message || '?대?吏 寃利?以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
      throw e;
    } finally {
      setVerifying(false);
    }
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      setError('?낅줈?쒗븷 ?대?吏瑜??좏깮?댁＜?몄슂.');
      return;
    }

    console.log('?낅줈???쒕룄:', {
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
      
      // 1. ?ъ슜???뺣낫 ?뺤씤
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('濡쒓렇?몄씠 ?꾩슂?⑸땲??');
      }

      // 2. FormData ?앹꽦 - ?쒕쾭 ?ъ씠?쒖뿉??紐⑤뱺 泥섎━瑜??섎룄濡?蹂寃?      const formData = new FormData();
      formData.append('file', file);
      formData.append('meal_id', mealId);
      formData.append('school_code', schoolCode);
      formData.append('meal_date', mealDate);
      formData.append('meal_type', mealType);
      formData.append('user_id', user.id);
      
      console.log('?쒕쾭 ?ъ씠???낅줈???쒕룄...', {
        meal_id: mealId,
        school_code: schoolCode,
        meal_date: mealDate,
        meal_type: mealType,
        file_name: file.name,
        file_size: file.size
      });
      
      // 3. ?쒕쾭 ?ъ씠??API濡??대?吏 ?낅줈??諛?????쒕쾲??泥섎━
      // ?섍꼍???곕씪 ?ㅻⅨ API ?붾뱶?ъ씤???ъ슜
      const isLocalhost = /^(localhost|127\.|\/api)/.test(window.location.hostname);
      const apiUrl = isLocalhost 
        ? '/api/meal-images/upload'
        : '/.netlify/functions/upload-meal-image';
      
      console.log('?낅줈??API ?붿껌 URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData
      });
      
      // 4. ?묐떟 泥섎━
      if (!response.ok) {
        // ?묐떟 ?띿뒪?몃? 癒쇱? ?뺤씤?섏뿬 ?덉쟾?섍쾶 泥섎━
        const responseText = await response.text();
        let errorMessage = `?쒕쾭 ?ㅻ쪟: ${response.status} ${response.statusText}`;
        
        try {
          // JSON?쇰줈 ?뚯떛 ?쒕룄
          if (responseText.trim().startsWith('{')) {
            const errorData = JSON.parse(responseText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (e) {
          console.error('?묐떟 ?뚯떛 ?ㅻ쪟:', e);
          // HTML ?묐떟?대굹 ?ㅻⅨ ?뺤떇??寃쎌슦 湲곕낯 ?ㅻ쪟 硫붿떆吏 ?ъ슜
        }
        
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      // ?깃났 ?묐떟???덉쟾?섍쾶 ?뚯떛
      let data;
      try {
        const responseText = await response.text();
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('?깃났 ?묐떟 ?뚯떛 ?ㅻ쪟:', e);
        setError('?묐떟 ?곗씠???뚯떛 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎');
        throw new Error('?묐떟 ?곗씠???뚯떛 ?ㅻ쪟');
      }
      console.log('?낅줈???깃났:', data);
      uploadedImageId = data.id;
      
      // 5. ?대?吏 寃利?API ?몄텧
      try {
        const verificationResult = await verifyImage(uploadedImageId);
        console.log('寃利?寃곌낵:', verificationResult);
        
        // ?낅줈?쒕맂 ?대?吏 ?뺣낫 媛?몄삤湲?(?ъ슜???뺣낫 ?ы븿)
        // ?대?吏 ?뺣낫 議고쉶
        const { data: imageData } = await supabase
          .from('meal_images')
          .select('*')
          .eq('id', uploadedImageId)
          .single();
          
        if (imageData) {
          // ?ъ슜???뺣낫 蹂꾨룄 議고쉶
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
              console.error('?ъ슜???뺣낫 議고쉶 ?ㅻ쪟:', userError);
            }
          }
          
          // ?ъ슜??蹂꾨챸 異붽? 諛?寃利?寃곌낵 諛섏쁺
          const updatedImageData = {
            ...imageData,
            uploader_nickname: uploaderNickname,
            status: verificationResult.isMatch ? 'approved' : 'rejected',
            match_score: verificationResult.matchScore || 0,
            explanation: verificationResult.explanation || null
          };
          setUploadedImage(updatedImageData);
        }
        
        // ?깃났 肄쒕갚 ?몄텧 - 吏???쒓컙 異붽?
        console.log('?깍툘 ?대?吏 ?낅줈????肄쒕갚 ?몄텧 ?湲?以?..');
        setTimeout(() => {
          console.log('?깍툘 肄쒕갚 ?몄텧 ??대㉧ ?꾨즺, onUploadSuccess ?몄텧');
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        }, 2000); // 2珥?吏?곗쑝濡?利앷?
      } catch (verifyError) {
        console.error('寃利??ㅻ쪟:', verifyError);
        
        // ?낅줈?쒕맂 ?대?吏 ?뺣낫 媛?몄삤湲?(?ъ슜???뺣낫 ?ы븿)
        try {
          const { data: imageData } = await supabase
            .from('meal_images')
            .select('*')
            .eq('id', uploadedImageId)
            .single();
            
          if (imageData) {
            // ?ъ슜???뺣낫 蹂꾨룄 議고쉶
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
                console.error('?ъ슜???뺣낫 議고쉶 ?ㅻ쪟:', userError);
              }
            }
            
            // ?ъ슜??蹂꾨챸 異붽? 諛?寃利??ㅽ뙣 ?곹깭 諛섏쁺
            const updatedImageData = {
              ...imageData,
              uploader_nickname: uploaderNickname,
              status: 'rejected',
              explanation: '?대?吏 寃利?以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'
            };
            setUploadedImage(updatedImageData);
          }
        } catch (err) {
          console.error('?대?吏 ?뺣낫 議고쉶 ?ㅻ쪟:', err);
        }
        
        // ?대?吏 ?낅줈?쒕뒗 ?깃났?덉쑝誘濡?肄쒕갚? ?몄텧
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
      
      // ?낅젰 ?꾨뱶 諛?誘몃━蹂닿린 珥덇린??      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPreview(null);
      
    } catch (error: any) {
      console.error('?대?吏 ?낅줈???ㅻ쪟:', error);
      setError(error.message || '?대?吏 ?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
      
      if (onUploadError) {
        onUploadError(error.message || '?대?吏 ?낅줈??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
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
          <p className="font-semibold">?ъ쭊?깅줉 ?깃났! (?쇱튂?? {score}%)</p>
          <p>?대?吏媛 硫붾돱? ?쇱튂?섏뿬 ?깅줉?섏뿀?듬땲??</p>
          {explanation && (
            <p className="text-xs mt-2 border-t border-green-200 pt-2">
              <span className="font-semibold">遺꾩꽍 寃곌낵:</span> {explanation}
            </p>
          )}
        </div>
      );
    } else {
      return (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          <div className="flex items-center">
            <span className="text-orange-600 text-xl mr-2">??/span>
            <div>
              <p className="font-semibold">留ㅼ묶?ㅽ뙣 (?쇱튂?? {score}%)</p>
              <p>?대?吏媛 硫붾돱? 異⑸텇???쇱튂?섏? ?딆뒿?덈떎.</p>
            </div>
          </div>
          {explanation && (
            <p className="text-xs mt-2 border-t border-gray-200 pt-2">
              <span className="font-semibold">?ъ쑀:</span> {explanation}
            </p>
          )}
        </div>
      );
    }
  };

  // ?대?吏 ??젣 泥섎━ ?⑥닔
  const handleDeleteImage = async () => {
    if (!uploadedImage) return;
    
    try {
      // ?대?吏 ??젣 ???뺤씤
      const { data: imageData } = await supabase
        .from('meal_images')
        .select('*')
        .eq('id', uploadedImage.id)
        .single();

      if (!imageData) {
        throw new Error('?대?吏瑜?李얠쓣 ???놁뒿?덈떎.');
      }

      // 怨듭쑀???대?吏????젣 遺덇?
      if (imageData.status === 'approved') {
        setError('?뱀씤?섍굅??怨듭쑀???대?吏????젣?????놁뒿?덈떎.');
        return;
      }

      // DB?먯꽌 ?대?吏 ?덉퐫????젣
      const { error: deleteError } = await supabase
        .from('meal_images')
        .delete()
        .eq('id', uploadedImage.id);

      if (deleteError) {
        throw deleteError;
      }

      // ?ㅽ넗由ъ????대?吏 ??젣 ?쒕룄
      try {
        // URL?먯꽌 ?뚯씪紐?異붿텧
        const url = new URL(imageData.image_url);
        const pathSegments = url.pathname.split('/');
        // 留덉?留??멸렇癒쇳듃???뚯씪紐?        const fileName = pathSegments[pathSegments.length - 1];
        // Storage 踰꾪궥??吏곸젒 ??λ맂 ?뚯씪
        const filePath = fileName;
        
        console.log('??젣???뚯씪 寃쎈줈:', filePath);
        
        const { error: storageError } = await supabase.storage
          .from('meal-images')
          .remove([filePath]);
          
        if (storageError) {
          console.error('?ㅽ넗由ъ? ?대?吏 ??젣 ?ㅻ쪟:', storageError);
        }
      } catch (err) {
        console.error('?뚯씪 寃쎈줈 異붿텧 ?ㅻ쪟:', err);
      }
      
      // ?곹깭 珥덇린??      setUploadedImage(null);
      setVerificationResult(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // ?깃났 肄쒕갚 ?몄텧
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      console.error('?대?吏 ??젣 ?ㅻ쪟:', err);
      setError(err.message || '?대?吏 ??젣 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
    }
  };

// ...

  // ?곹깭???곕Ⅸ ?됱긽 諛섑솚
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // ?곹깭 ?띿뒪??諛섑솚
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '?ъ쭊?깅줉';
      case 'pending': return '寃利앹쨷';
      case 'rejected': return '留ㅼ묶?ㅽ뙣';
      default: return '-';
    }
  };
  
  return (
    <div className="p-0 mb-0 max-w-xl mx-auto">
      
      {/* ?낅줈?쒕맂 ?대?吏媛 ?덉쑝硫??쒖떆 */}
      {uploadedImage ? (
        <div>
          <div className="overflow-hidden rounded-lg">
            <div className="relative w-full h-auto">
              <ImageWithFallback
                src={uploadedImage.image_url}
                alt="湲됱떇 ?대?吏"
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
  <span className="text-xs text-gray-500 text-right">AI濡??앹꽦???대?吏 ({uploadedImage.uploader_nickname})</span>
)}
{uploadedImage.source === 'user_ai' && !uploadedImage.uploader_nickname && (
  <span className="text-xs text-gray-500 text-right">AI濡??앹꽦???대?吏</span>
)}
{uploadedImage.source === 'auto_ai' && (
  <span className="text-xs text-gray-500 text-right">AI濡??앹꽦???대?吏</span>
)}
{uploadedImage.source === 'user' && uploadedImage.uploader_nickname && (
  <span className="text-xs text-gray-500 text-right">({uploadedImage.uploader_nickname})</span>
)}
              </div>
              
              {uploadedImage.status === 'rejected' && (
                <div className="text-sm mb-2">
                  {uploadedImage.status === 'rejected' && (
                    <span className="text-orange-600 ml-1">(留ㅼ묶?ㅽ뙣, ?낅줈??遺덇?)</span>
                  )}
                </div>
              )}
              
              {uploadedImage.status === 'rejected' && uploadedImage.explanation && (
                <div className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">?ъ쑀:</span> {uploadedImage.explanation}
                </div>
              )}
              
              {uploadedImage.status !== 'approved' && (
                <button
                  onClick={handleDeleteImage}
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  ??젣
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ?ㅻ뒛??湲됱떇 ?ъ쭊??怨듭쑀?대낫?몄슂!
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
              <p className="text-sm font-medium text-gray-700 mb-2">誘몃━蹂닿린:</p>
              <div className="relative w-full h-64 bg-gray-100 rounded-md overflow-hidden">
                <ImageWithFallback
                  src={preview}
                  alt="?낅줈???대?吏 誘몃━蹂닿린"
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
                console.log('?낅줈??踰꾪듉 ?대┃, ?곹깭:', {
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
                  AI 遺꾩꽍 以?..
                </span>
              ) : verifying ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI 遺꾩꽍 以?..
                </span>
              ) : !isButtonReady && preview ? (
                <span className="flex items-center">
                  <svg className="animate-pulse -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI 遺꾩꽍 以鍮?以?..
                </span>
              ) : (
                '?낅줈??諛?AI 寃利?
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
                    AI ?대?吏 ?앹꽦 以?..
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI ?대?吏 ?앹꽦
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
