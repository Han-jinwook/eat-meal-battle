// 파일 경로: netlify/functions/upload-meal-image.js
const { createClient } = require('@supabase/supabase-js');
const busboy = require('busboy');
const { v4: uuidv4 } = require('uuid');

// Supabase 환경 변수
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// UUID 형식 검증
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '허용되지 않는 메서드입니다.' })
    };
  }

  // Supabase 클라이언트 초기화 (관리자 권한)
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );

  return new Promise((resolve, reject) => {
    // multipart/form-data 파싱을 위한 busboy 설정
    const bb = busboy({ headers: event.headers });
    
    const fields = {};
    let fileBuffer = null;
    let fileName = '';
    let fileType = '';

    // Busboy 오류 처리기 추가
    bb.on('error', (err) => {
      console.error('Busboy parsing error:', err);
      return resolve({
        statusCode: 400, // 클라이언트 요청 데이터 문제일 가능성이 높으므로 400 사용
        headers,
        body: JSON.stringify({ error: '요청 데이터 파싱 중 오류가 발생했습니다.', details: err.message })
      });
    });
    
    // 필드 파싱
    bb.on('field', (name, val) => {
      fields[name] = val;
    });
    
    // 파일 파싱
    bb.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      
      // 이미지 파일만 허용
      if (!mimeType.startsWith('image/')) {
        return resolve({
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: '이미지 파일만 업로드할 수 있습니다.' })
        });
      }
      
      fileName = filename;
      fileType = mimeType;
      
      const chunks = [];
      
      file.on('data', (data) => {
        chunks.push(data);
      });
      
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });
    
    // 파싱 완료 이벤트
    bb.on('finish', async () => {
      try {
        // 필수 필드 확인
        const { meal_id, school_code, meal_date, meal_type, user_id } = fields;
        
        console.log('요청 데이터:', { 
          mealId: meal_id, 
          schoolCode: school_code,
          mealDate: meal_date,
          mealType: meal_type,
          fileName,
          fileSize: fileBuffer ? fileBuffer.length : 0,
          userId: user_id
        });
        
        // 파일 및 사용자 ID 필수 체크
        if (!fileBuffer || !user_id) {
          return resolve({
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '파일과 사용자 정보는 필수입니다.' })
          });
        }

        // meal_id가 유효한 UUID인지 확인
        let finalMealId = null;
        if (meal_id && meal_id !== 'undefined') {
          if (uuidRegex.test(meal_id)) {
            // DB에 실제로 존재하는지 확인
            const { data: mealExists, error: mealCheckError } = await supabase
              .from('meal_menus')
              .select('id')
              .eq('id', meal_id)
              .single();
            
            if (mealCheckError) {
              console.log('meal_id 확인 중 오류:', mealCheckError);
            }
            
            // 존재하는 경우만 meal_id 설정
            if (mealExists) {
              finalMealId = meal_id;
            } else {
              console.log('DB에 없는 meal_id:', meal_id);
            }
          } else {
            console.log('유효하지 않은 UUID 형식:', meal_id);
          }
        }
        
        // 파일 확장자 추출
        const fileExt = fileName.split('.').pop();
        
        // 저장할 파일명 생성 (고유한 이름으로)
        const timestamp = Date.now();
        const storageFileName = `${school_code}_${meal_date.replace(/-/g, '')}_${timestamp}.${fileExt}`;
        
        // Supabase Storage에 이미지 업로드
        const { data: storageData, error: storageError } = await supabase.storage
          .from('meal-images')
          .upload(storageFileName, fileBuffer, {
            contentType: fileType,
            upsert: false
          });
        
        if (storageError) {
          console.error('이미지 저장 오류:', storageError);
          return resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '이미지 저장 중 오류가 발생했습니다.' })
          });
        }
        
        // 이미지 URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('meal-images')
          .getPublicUrl(storageFileName);
        
        // DB에 이미지 정보 저장
        const { data: imageRecord, error: dbError } = await supabase
          .from('meal_images')
          .insert([{
            meal_id: finalMealId,  // 검증된 meal_id 또는 null
            image_url: publicUrl,
            uploaded_by: user_id,
            status: 'pending',
            is_shared: false
          }])
          .select()
          .single();
        
        if (dbError) {
          console.error('이미지 정보 저장 오류:', dbError);
          return resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '이미지 정보 저장 중 오류가 발생했습니다: ' + dbError.message })
          });
        }
        
        console.log('이미지 업로드 성공:', imageRecord);
        
        return resolve({
          statusCode: 200,
          headers,
          body: JSON.stringify(imageRecord)
        });
      } catch (error) {
        console.error('서버 오류:', error);
        return resolve({
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '서버 내부 오류가 발생했습니다.' })
        });
      }
    });
    
    // 요청 본문을 busboy로 파이프
    const encoding = event.isBase64Encoded ? 'base64' : 'utf8';
    const buffer = Buffer.from(event.body, encoding);
    bb.end(buffer);
  });
};
