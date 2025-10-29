import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export const maxDuration = 30; // 함수 실행 최대 시간 30초로 설정 (중요 함수 타임아웃 방지)

export async function GET(request: NextRequest) {
  console.info('🚀 OAuth 콜백 라우트 시작 (확장된 타임아웃)')
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error_code = requestUrl.searchParams.get('error_code')
  const error_description = requestUrl.searchParams.get('error_description')
  
  // 전체 URL 로깅
  console.info('🔗 OAuth 콜백 전체 URL:', request.url)
  
  // 공유URL 파라미터 추출 - 다양한 방식으로 시도
  const shareUrl = requestUrl.searchParams.get('next') || 
                   requestUrl.searchParams.get('redirect_to') || 
                   requestUrl.searchParams.get('return_to') ||
                   requestUrl.searchParams.get('redirectTo') ||
                   requestUrl.searchParams.get('state')
  
  console.info('🔍 OAuth 콜백 파라미터 디버깅:', {
    next: requestUrl.searchParams.get('next'),
    redirect_to: requestUrl.searchParams.get('redirect_to'),
    return_to: requestUrl.searchParams.get('return_to'),
  })
  
  // URL에서 공유 파라미터 추출 (state 파라미터에서)
  let shareSchoolCode = requestUrl.searchParams.get('share_school_code')
  let shareType = requestUrl.searchParams.get('share_type')
  
  // OAuth state에서 공유 파라미터 추출 시도
  let viewingUserId = null
  let ownerNickname = null
  let ownerSchoolName = null
  
  const stateParam = requestUrl.searchParams.get('state')
  if (stateParam) {
    try {
      const stateData = JSON.parse(atob(stateParam))
      shareSchoolCode = stateData.share_school_code || shareSchoolCode
      shareType = stateData.share_type || shareType
      viewingUserId = stateData.viewing
      ownerNickname = stateData.owner_nickname
      ownerSchoolName = stateData.school_name
      console.log('📋 OAuth state에서 추출한 파라미터:', stateData)
    } catch (error) {
      console.log('⚠️ OAuth state 파싱 실패:', error)
    }
  }
  
  console.log('🔗 OAuth 콜백 전체 URL:', requestUrl.toString())
  console.log('📋 OAuth 콜백 파라미터들:', {
    code: requestUrl.searchParams.get('code'),
    state: requestUrl.searchParams.get('state'),
    share_school_code: shareSchoolCode,
    share_type: shareType,
    all_params: Object.fromEntries(requestUrl.searchParams.entries())
  })
  
  let redirectUrl = '/'

  // OAuth 오류 처리
  if (error_code) {
    console.error('❌ OAuth 오류 발생:', { 
      error_code, 
      error_description,
      full_url: request.url,
      all_params: Object.fromEntries(requestUrl.searchParams.entries())
    })
    
    if (error_code === 'flow_state_not_found') {
      console.error('🔄 Flow state not found - OAuth 세션이 만료되었거나 손실됨')
      return NextResponse.redirect(new URL('/login?error=session_expired&error_detail=flow_state_not_found', request.url))
    }
    
    if (error_code === 'access_denied') {
      console.error('🚫 사용자가 OAuth 인증을 거부함')
      return NextResponse.redirect(new URL('/login?error=access_denied&error_detail=user_cancelled', request.url))
    }
    
    console.error('🔍 알 수 없는 OAuth 오류:', error_code)
    return NextResponse.redirect(new URL(`/login?error=oauth_error&error_detail=${error_code}`, request.url))
  }

  try {
    if (code) {
      console.info('🔑 OAuth 코드 수신됨, 세션 교환 시작')

      // createClient는 동기 함수로 복원됨
      const supabase = createClient()

      // 인증 코드로 세션 교환
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      // 인증 성공 시 프로필 이미지 URL이 HTTP로 시작하는지 검사하고 수정
      // avatar_url뿐만 아니라 profile_image도 함께 검사 (추가 안정성)
      if (data?.session?.user?.user_metadata?.avatar_url) {
        const avatarUrl = data.session.user.user_metadata.avatar_url;
        if (avatarUrl.startsWith('http://')) {
          console.log('프로필 이미지 URL을 HTTPS로 변환합니다:', avatarUrl);
          
          // 사용자 메타데이터 업데이트
          const httpsAvatarUrl = avatarUrl.replace('http://', 'https://');
          const { error: updateError } = await supabase.auth.updateUser({
            data: { 
              avatar_url: httpsAvatarUrl 
            }
          });
          
          if (updateError) {
            console.error('프로필 URL 업데이트 실패:', updateError);
          } else {
            console.log('URL이 업데이트되었습니다:', httpsAvatarUrl);
          }
        }
      }
      
      // 세션 추가 유효성 검증
      if (!data.session || !data.session.user) {
        console.error('💥 심각: 세션 교환 성공했으나 세션 객체가 없음');
        throw new Error('세션 생성 실패');
      }

      if (error) {
        console.error('Session exchange error:', error.message)
        return NextResponse.redirect(new URL('/login?error=auth', request.url))
      }

      if (data.session) {
        console.log('Session successfully created')
        
        // 세션 안정성을 위한 추가 검증 및 지연 (최대 3회 재시도)
        try {
          // 세션이 제대로 설정되었는지 재확인
          let sessionValid = false;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!sessionValid && retryCount < maxRetries) {
            const { data: sessionCheck } = await supabase.auth.getSession()
            
            if (sessionCheck.session) {
              sessionValid = true;
              console.log(`✅ 세션 검증 성공 (시도: ${retryCount + 1}/${maxRetries})`)
            } else {
              retryCount++;
              console.warn(`⚠️ 세션 재확인 실패, 재시도 ${retryCount}/${maxRetries}...`)
              // 점진적으로 대기 시간 증가
              await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
            }
          }
          
          if (!sessionValid) {
            throw new Error(`세션 설정 실패 (${maxRetries}회 시도 후)`)
          }
          
          console.log('✅ 세션 검증 및 안정화 완료')
        } catch (sessionError) {
          console.error('❌ 세션 검증 오류:', sessionError)
          return NextResponse.redirect(new URL('/login?error=session_failed', request.url))
        }
        
        // OAuth에서 받은 생년월일 정보 처리
        const userMetadata = data.session.user.user_metadata;
        const rawProviderData = data.session.user.identities?.[0]?.identity_data;
        
        console.info('🔍 OAuth 콜백 실행됨 - 사용자 ID:', data.session.user.id);
        console.info('🔍 OAuth 디버깅 - User metadata:', JSON.stringify(userMetadata, null, 2));
        console.info('🔍 OAuth 디버깅 - Provider data:', rawProviderData);
        console.info('🔍 OAuth 디버깅 - Provider:', data.session.user.app_metadata?.provider);
        console.info('🔍 OAuth 디버깅 - birthyear 확인:', rawProviderData?.birthyear);
        console.info('🔍 OAuth 디버깅 - birthday 확인:', rawProviderData?.birthday);
        console.info('🔍 OAuth 디버깅 - birthdate 확인:', rawProviderData?.birthdate);
        console.info('🔍 모든 데이터 키:', Object.keys(rawProviderData || {}));
        
        // 추가 디버깅: 모든 필드 값 출력
        console.info('🔍 카카오 데이터 전체 값:', JSON.stringify(rawProviderData, null, 2));
        
        // birth 관련 모든 키 검색
        const birthKeys = Object.keys(rawProviderData || {}).filter(key => 
          key.toLowerCase().includes('birth') || key.toLowerCase().includes('age') || key.toLowerCase().includes('year')
        );
        console.info('🔍 birth/age/year 관련 키들:', birthKeys);
        
        // Provider 확인
        const provider = data.session.user.app_metadata?.provider;
        console.info('🔍 Provider 확인:', provider);
        
        // 카카오 사용자 정보 API 직접 호출 (생년 정보 획득)
        let kakaoUserInfo = null;
        if (provider === 'kakao' && data.session.provider_token) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

          try {
            console.info('🔍 카카오 사용자 정보 API 호출 시작 (5초 타임아웃 설정)...');
            
            let accessToken = data.session.provider_token;
            
            const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              signal: controller.signal // AbortController 적용
            });
            
            clearTimeout(timeoutId); // 성공 시 타임아웃 해제

            if (kakaoResponse.ok) {
              kakaoUserInfo = await kakaoResponse.json();
              console.info('✅ 카카오 사용자 정보 API 응답:', JSON.stringify(kakaoUserInfo, null, 2));
            } else {
              const errorText = await kakaoResponse.text();
              console.error('❌ 카카오 사용자 정보 API 오류:', {
                status: kakaoResponse.status,
                statusText: kakaoResponse.statusText,
                errorBody: errorText
              });
            }
          } catch (apiError: any) {
            clearTimeout(timeoutId); // 에러 시에도 타임아웃 해제
            if (apiError.name === 'AbortError') {
              console.error('❌ 카카오 API 호출 시간 초과 (5초)');
            } else {
              console.error('❌ 카카오 API 호출 실패:', apiError);
            }
            // API 호출이 실패해도 로그인 흐름은 계속 진행
            kakaoUserInfo = null;
          }
        } else if (provider === 'kakao') {
          console.info('⚠️ provider_token이 없어서 카카오 API 호출 불가');
        }
        
        // 생년월일 정보가 있는 경우 처리
        let birthDate = null;
        
        if (provider === 'kakao') {
          console.info('🔍 카카오 생년월일 데이터 디버깅 시작');
          console.info('🔍 카카오 API 응답 데이터:', {
            hasKakaoUserInfo: !!kakaoUserInfo,
            kakaoAccount: kakaoUserInfo?.kakao_account,
            birthyear: kakaoUserInfo?.kakao_account?.birthyear,
            birthday: kakaoUserInfo?.kakao_account?.birthday,
            rawProviderBirthyear: rawProviderData?.birthyear
          });
          
          // 카카오에서 생년월일 정보 추출 (API 응답 우선, 없으면 기본 데이터 확인)
          if (kakaoUserInfo?.kakao_account?.birthday && kakaoUserInfo?.kakao_account?.birthyear) {
            const kakaoYear = kakaoUserInfo.kakao_account.birthyear;
            const kakaoBirthday = kakaoUserInfo.kakao_account.birthday; // MMDD 형식
            const month = kakaoBirthday.substring(0, 2);
            const day = kakaoBirthday.substring(2, 4);
            birthDate = `${kakaoYear}-${month}-${day}`;
            console.info('✅ 카카오 API에서 생년월일 정보 받음:', { 
              year: kakaoYear, 
              birthday: kakaoBirthday, 
              month, 
              day, 
              formatted: birthDate 
            });
          } else if (kakaoUserInfo?.kakao_account?.birthyear) {
            const kakaoYear = kakaoUserInfo.kakao_account.birthyear;
            birthDate = `${kakaoYear}-01-01`; // 생년만 있으면 1월 1일로 설정
            console.info('✅ 카카오 API에서 생년만 받음:', { year: kakaoYear, formatted: birthDate });
          } else if (rawProviderData?.birthyear) {
            const kakaoYear = rawProviderData.birthyear;
            birthDate = `${kakaoYear}-01-01`; // 생년만 있으면 1월 1일로 설정
            console.info('✅ 카카오 기본 데이터에서 생년 정보 받음:', { year: kakaoYear, formatted: birthDate });
          } else {
            console.warn('⚠️ 카카오에서 생년월일 정보를 찾을 수 없음');
          }
        } else if (provider === 'google') {
          console.info('🔍 구글 OAuth 생일 데이터 디버깅 시작');
          console.info('🔍 구글 rawProviderData 전체:', JSON.stringify(rawProviderData, null, 2));
          console.info('🔍 구글 userMetadata 전체:', JSON.stringify(userMetadata, null, 2));
          
          // 구글에서 생년월일 정보 추출 시도
          console.info('🔍 토큰 정보:', {
            hasProviderToken: !!data.session.provider_token,
            hasProviderRefreshToken: !!data.session.provider_refresh_token,
            tokenLength: data.session.provider_token?.length || 0
          });
          
          // 먼저 기본 OAuth 데이터에서 생년월일 찾기
          if (rawProviderData?.birthday) {
            birthDate = rawProviderData.birthday;
            console.info('✅ 구글 기본 데이터에서 생일 정보 발견:', birthDate);
          }
          
          // People API 호출 (토큰이 있는 경우에만)
          if (!birthDate && data.session.provider_token) {
            try {
              console.info('🔍 구글 People API 호출 시작...');
              
              // 토큰 유효성 먼저 확인
              const tokenCheckResponse = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + data.session.provider_token);
              
              if (tokenCheckResponse.ok) {
                const tokenInfo = await tokenCheckResponse.json();
                console.info('✅ 토큰 유효성 확인:', {
                  scope: tokenInfo.scope,
                  expires_in: tokenInfo.expires_in
                });
                
                // 생년월일 스코프가 있는지 확인
                if (tokenInfo.scope && tokenInfo.scope.includes('user.birthday.read')) {
                  const googleResponse = await fetch('https://people.googleapis.com/v1/people/me?personFields=birthdays', {
                    headers: {
                      'Authorization': `Bearer ${data.session.provider_token}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (googleResponse.ok) {
                    const googleUserInfo = await googleResponse.json();
                    console.info('✅ 구글 People API 응답:', JSON.stringify(googleUserInfo, null, 2));
                    
                    // 생일 데이터 추출
                    console.info('🔍 구글 People API 생일 데이터 분석:', {
                      hasBirthdays: !!googleUserInfo?.birthdays,
                      birthdaysLength: googleUserInfo?.birthdays?.length || 0,
                      birthdays: googleUserInfo?.birthdays
                    });
                    
                    if (googleUserInfo?.birthdays && googleUserInfo.birthdays.length > 0) {
                      for (const birthday of googleUserInfo.birthdays) {
                        console.info('🔍 생일 항목 분석:', {
                          hasDate: !!birthday?.date,
                          year: birthday?.date?.year,
                          month: birthday?.date?.month,
                          day: birthday?.date?.day,
                          metadata: birthday?.metadata
                        });
                        
                        if (birthday?.date?.year && birthday?.date?.month && birthday?.date?.day) {
                          const year = birthday.date.year;
                          const month = String(birthday.date.month).padStart(2, '0');
                          const day = String(birthday.date.day).padStart(2, '0');
                          birthDate = `${year}-${month}-${day}`;
                          console.info('✅ 구글 People API에서 생일 데이터 발견:', { year, month, day, formatted: birthDate });
                          break;
                        }
                      }
                    } else {
                      console.warn('⚠️ 구글 People API에서 생일 데이터를 찾을 수 없음');
                    }
                    
                    if (!birthDate) {
                      console.warn('⚠️ 구글 People API 응답에 생일 데이터 없음');
                    }
                  } else {
                    const errorText = await googleResponse.text();
                    console.error('❌ 구글 People API 오류:', {
                      status: googleResponse.status,
                      statusText: googleResponse.statusText,
                      errorBody: errorText
                    });
                  }
                } else {
                  console.warn('⚠️ 토큰에 생년월일 스코프가 없음:', tokenInfo.scope);
                }
              } else {
                console.error('❌ 토큰 유효성 확인 실패:', tokenCheckResponse.status);
              }
            } catch (apiError) {
              console.error('❌ 구글 API 호출 실패:', apiError);
            }
          } else if (!data.session.provider_token) {
            console.info('⚠️ provider_token이 없어서 구글 People API 호출 불가');
          }
          
          // 기존 방식도 시도 (fallback)
          if (!birthDate) {
            const allKeys = [
              ...Object.keys(rawProviderData || {}),
              ...Object.keys(userMetadata || {})
            ];
            const birthRelatedKeys = allKeys.filter(key => 
              key.toLowerCase().includes('birth') || 
              key.toLowerCase().includes('date') ||
              key.toLowerCase().includes('age') ||
              key.toLowerCase().includes('year')
            );
            console.info('🔍 구글 birth/date/age/year 관련 키들:', birthRelatedKeys);
            
            const possibleBirthFields = [
              rawProviderData?.birthdate,
              rawProviderData?.birthday, 
              rawProviderData?.date_of_birth,
              rawProviderData?.birth_date,
              userMetadata?.birthdate,
              userMetadata?.birthday,
              userMetadata?.birth_date,
              userMetadata?.date_of_birth
            ];
            
            console.info('🔍 구글 생일 필드 후보들:', possibleBirthFields);
            
            for (const field of possibleBirthFields) {
              if (field) {
                birthDate = field;
                console.info('✅ 구글에서 생일 데이터 발견:', { field, birthDate });
                break;
              }
            }
            
            if (!birthDate) {
              console.warn('⚠️ 구글 OAuth에서 생일 데이터를 찾을 수 없음');
            }
          }
        }
        
        // 생년월일이 있으면 나이 계산 및 학생 여부 판단
        if (birthDate) {
          try {
            const today = new Date();
            const birth = new Date(birthDate);
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
              age--;
            }
            
            // 🚧 테스트 중: 나이 제한 임시 확장 (출시 전 만 6-19세로 변경 예정)
            const isStudent = age >= 6 && age <= 19; // 출시: 만 6-19세 (초등입학전~고3)
            
            console.info(`✅ 나이 계산 결과: ${age}세, 학생 여부: ${isStudent}`);
            
            // users 테이블 업데이트
            console.info('🔄 DB 업데이트 시작:', {
              birth_date: birthDate,
              is_student: isStudent,
              user_id: data.session.user.id
            });
            
            // DB 업데이트 (birth_date, is_student)
            const updateData: any = {
              birth_date: birthDate,
              is_student: isStudent
            };
            
            const { error: updateError } = await supabase
              .from('users')
              .update(updateData)
              .eq('id', data.session.user.id);
            
            // 사용자 정보 업데이트 로그 (콘솔 로그만 사용)
            console.info('✅ 사용자 정보 업데이트 완료:', {
              user_id: data.session.user.id,
              action: 'UPDATE_USER_INFO',
              data: updateData,
              timestamp: new Date().toISOString()
            });
            
            if (updateError) {
              console.error('❌ 사용자 정보 업데이트 실패:', updateError);
            } else {
              console.info('✅ 사용자 정보 DB 업데이트 완료!');
            }
          } catch (ageError) {
            console.error('나이 계산 오류:', ageError);
          }
        } else {
          console.info('❌ 생년월일 정보 없음 - is_student를 null로 유지');
          console.info('🔍 birthDate:', birthDate);
        }
        
        // 🔄 나이 우선 원칙 기반 7가지 분기 로직 구현
        console.info('🔍 나이 우선 원칙 기반 정밀 로그인 플로우 시작');
        
        // 공유URL 분석
        let shareUrlSchoolCode = null;
        let shareUrlSchoolName = null;
        let isBattleShare = false;
        
        // OAuth 콜백 URL에서 직접 공유 파라미터 추출
        shareUrlSchoolCode = requestUrl.searchParams.get('share_school_code');
        const shareType = requestUrl.searchParams.get('share_type');
        isBattleShare = shareType === 'battle';
        
        // 항상 shareUrl도 확인 (중요: 배틀 감지 강화)
        if (shareUrl) {
          try {
            const shareUrlObj = new URL(shareUrl, request.url);
            
            // school_code가 없는 경우에만 URL에서 추출
            if (!shareUrlSchoolCode) {
              shareUrlSchoolCode = shareUrlObj.searchParams.get('school_code');
            }
            
            // 항상 URL 경로에서 배틀 여부 확인 (중요)
            if (!isBattleShare) {
              isBattleShare = shareUrlObj.pathname.includes('/battle');
              console.info('🏆 URL 경로에서 배틀 감지:', { isBattleShare, path: shareUrlObj.pathname });
            }
          } catch (e) {
            console.warn('⚠️ 공유URL 파싱 오류:', e);
          }
        }
        
        console.info('🔗 공유URL 분석 결과:', { shareUrlSchoolCode, shareType, isBattleShare, shareUrl });
        
        if (isBattleShare) {
          console.info('🏆 배틀 원본 URL 감지됨!', { 
            shareType,
            urlPath: shareUrl ? new URL(shareUrl, request.url).pathname : null,
            hasShareSchoolCode: !!shareUrlSchoolCode
          });
        }
        
        // 1단계: 나이 및 학생 여부 확인 (나이 우선 원칙)
        let userAge = null;
        let isStudentAge = false;
        let isNewUser = false;
        
        if (birthDate) {
          const today = new Date();
          const birth = new Date(birthDate);
          userAge = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            userAge--;
          }
          
          isStudentAge = userAge >= 6 && userAge <= 19; // 출시: 만 6-19세
          console.info(`📅 나이 계산 결과: ${userAge}세, 학생나이 여부: ${isStudentAge}`);
        } else {
          console.info('📅 생년월일 정보 없음 - 비학생나이로 처리');
        }
        
        // 신규 가입 여부 확인 (최근 5분 이내 가입)
        const userCreatedAt = new Date(data.session.user.created_at || new Date());
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        isNewUser = userCreatedAt > fiveMinutesAgo;
        console.info(`👤 사용자 유형: ${isNewUser ? '신규' : '기존'} 회원 (가입일: ${userCreatedAt.toISOString()})`);
        
        // 2단계: 학교등록 상태 확인
        const { data: schoolInfo, error: schoolInfoError } = await supabase
          .from('school_infos')
          .select('school_code, school_name')
          .eq('user_id', data.session.user.id)
          .maybeSingle();
        
        const hasSchoolRegistration = !schoolInfoError && schoolInfo;
        console.info(`🏫 학교등록 상태: ${hasSchoolRegistration ? '등록됨' : '미등록'}`);
        if (hasSchoolRegistration) {
          console.info(`📚 등록된 학교: ${schoolInfo.school_name} (${schoolInfo.school_code})`);
        }
        
        // 3단계: 관심학교 상태 확인 (학교 미등록 + 비학생나이인 경우만)
        let hasInterestSchool = false;
        let interestSchoolInfo = null;
        
        // 나이 우선 원칙: 학생나이면 관심학교 확인 생략
        if (!hasSchoolRegistration && !isStudentAge) {
          const { data: interestSchools, error: interestError } = await supabase
            .from('interest_schools')
            .select('school_code, school_name')
            .eq('user_id', data.session.user.id)
            .order('created_at', { ascending: true })
            .limit(1);
          
          if (!interestError && interestSchools && interestSchools.length > 0) {
            hasInterestSchool = true;
            interestSchoolInfo = interestSchools[0];
            console.info(`🎯 등록된 관심학교: ${interestSchoolInfo.school_name} (${interestSchoolInfo.school_code})`);
          } else {
            console.info('🎯 관심학교 미등록');
          }
        } else if (isStudentAge) {
          console.info('🎯 학생나이 → 관심학교 확인 생략 (나이 우선 원칙)');
        }
        
        // 4단계: 단순화된 3가지 케이스 적용
        console.info('🔀 단순화된 3가지 케이스 적용 시작');
        console.info(`📊 현재 상태: ${isNewUser ? '신규' : '기존'}회원, 학교등록: ${hasSchoolRegistration ? 'O' : 'X'}, 학생나이: ${isStudentAge ? 'O' : 'X'}, 관심학교: ${hasInterestSchool ? 'O' : 'X'}`);
        
        if (viewingUserId) {
          // 케이스 1: 퀴즈 공유 (학생/비학생 상관없이 퀴즈구독 자동등록 + 관람모드)
          console.info('✅ 케이스 1: 퀴즈 공유 → 퀴즈구독 자동등록 + 관람모드');
          
          const quizParams = new URLSearchParams();
          quizParams.set('viewing', viewingUserId);
          if (ownerNickname) quizParams.set('owner_nickname', ownerNickname);
          if (ownerSchoolName) quizParams.set('school_name', ownerSchoolName);
          
          redirectUrl = `/quiz?${quizParams.toString()}`;
          
        } else if (shareUrlSchoolCode) {
          // 케이스 2,3: 급식/배틀 공유
          if (hasSchoolRegistration && shareUrlSchoolCode === schoolInfo.school_code) {
            // 케이스 2: 자기학교 급식/배틀 공유 → 해당 페이지로 바로 이동
            console.info('✅ 케이스 2: 자기학교 급식/배틀 공유 → 해당 페이지로 바로 이동');
            
            if (isBattleShare) {
              redirectUrl = shareUrl || `/battle?school_code=${shareUrlSchoolCode}`;
            } else {
              redirectUrl = shareUrl || `/?school_code=${shareUrlSchoolCode}`;
            }
            
          } else {
            // 케이스 3: 타학교/비학생 급식/배틀 공유 → 관심학교등록창 (관심모드)
            console.info('✅ 케이스 3: 타학교/비학생 급식/배틀 공유 → 관심학교등록창 (관심모드)');
            
            if (isBattleShare) {
              redirectUrl = `/battle?show_interest_modal=true&share_school_code=${shareUrlSchoolCode}`;
            } else {
              redirectUrl = `/?show_interest_modal=true&share_school_code=${shareUrlSchoolCode}`;
            }
          }
          
        } else {
          // 일반 공유 또는 기본 케이스 → 기존 로직 유지 (학생은 학교등록, 비학생은 관심학교등록)
          console.info('✅ 일반 케이스: 기존 로직 유지');
          
          if (isStudentAge && !hasSchoolRegistration) {
            // 학생나이 + 학교 미등록 → 학교등록 페이지 (공유 타입에 따라 리다이렉트 URL 설정)
            if (isBattleShare && shareUrlSchoolCode) {
              redirectUrl = `/school-search?share_school_code=${shareUrlSchoolCode}&share_type=battle`;
            } else if (shareUrlSchoolCode) {
              redirectUrl = `/school-search?share_school_code=${shareUrlSchoolCode}&share_type=meal`;
            } else {
              redirectUrl = '/school-search';
            }
          } else if (!isStudentAge && !hasSchoolRegistration && !hasInterestSchool) {
            // 비학생나이 + 학교 미등록 + 관심학교 미등록 → 관심학교등록창
            redirectUrl = '/?show_interest_modal=true';
          } else {
            // 기타 → 홈페이지
            redirectUrl = shareUrl || '/';
          }
        }
        
        console.info(`🎯 최종 리다이렉트 URL: ${redirectUrl}`);
        
      }
    } else {
      console.error('No auth code received')
    }

    // 리다이렉트 전 세션 검증 및 안정화
    console.log('🔄 세션 검증 및 안정화 시작...')
    
    // 세션 검증을 위한 새로운 supabase 클라이언트 생성
    const verificationSupabase = createClient()
    
    let sessionVerified = false
    let verificationAttempts = 0
    const maxVerificationAttempts = 7
    
    while (!sessionVerified && verificationAttempts < maxVerificationAttempts) {
      verificationAttempts++
      console.log(`🔍 세션 검증 시도 ${verificationAttempts}/${maxVerificationAttempts}`)
      
      try {
        const { data: { session: currentSession }, error: sessionError } = await verificationSupabase.auth.getSession()
        
        if (sessionError) {
          console.warn(`⚠️ 세션 검증 ${verificationAttempts}번째 시도 오류:`, sessionError)
        } else if (currentSession && currentSession.user) {
          console.log(`✅ 세션 검증 성공! (시도 ${verificationAttempts}/${maxVerificationAttempts})`)
          console.log(`👤 검증된 사용자 ID: ${currentSession.user.id}`)
          sessionVerified = true
          break
        } else {
          console.log(`❌ 세션 없음 (시도 ${verificationAttempts}/${maxVerificationAttempts})`)
        }
        
        if (!sessionVerified && verificationAttempts < maxVerificationAttempts) {
          // 다음 시도 전 대기
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (verificationError) {
        console.error(`❌ 세션 검증 ${verificationAttempts}번째 시도 예외:`, verificationError)
      }
    }
    
    if (!sessionVerified) {
      console.warn('🚨 세션 검증에 최종 실패했지만, 로그인 흐름을 강제로 계속 진행합니다.');
      // console.error('❌ 세션 검증 실패 - 로그인 페이지로 리다이렉트')
      // return NextResponse.redirect(new URL('/login?error=session_verification_failed', request.url))
    }
    
    console.log('✅ 세션 검증 완료, 최종 대기 중...')
    await new Promise(resolve => setTimeout(resolve, 1000)) // 최종 안정화 대기
    
    console.log('Redirecting to:', redirectUrl)
    const response = NextResponse.redirect(new URL(redirectUrl, request.url))
    
    // 쿠키 설정 강화 (SameSite, Secure 등)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch (error) {
    console.error('Unexpected error in auth callback:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
