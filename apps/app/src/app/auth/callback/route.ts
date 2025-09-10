import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.info('🚀 OAuth 콜백 라우트 시작')
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
  const stateParam = requestUrl.searchParams.get('state')
  if (stateParam && !shareSchoolCode) {
    try {
      const stateData = JSON.parse(atob(stateParam))
      shareSchoolCode = stateData.share_school_code
      shareType = stateData.share_type
      console.log('📋 OAuth state에서 추출한 공유 파라미터:', stateData)
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
    console.error('❌ OAuth 오류 발생:', { error_code, error_description })
    
    if (error_code === 'flow_state_not_found') {
      console.error('🔄 Flow state not found - OAuth 세션이 만료되었거나 손실됨')
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url))
    }
    
    return NextResponse.redirect(new URL('/login?error=oauth_error', request.url))
  }

  try {
    if (code) {
      console.info('🔑 OAuth 코드 수신됨, 세션 교환 시작')

      // createClient는 동기 함수로 복원됨
      const supabase = createClient()

      // 인증 코드로 세션 교환
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      // 인증 성공 시 프로필 이미지 URL이 HTTP로 시작하는지 검사하고 수정
      if (data?.session?.user?.user_metadata?.avatar_url) {
        const avatarUrl = data.session.user.user_metadata.avatar_url;
        if (avatarUrl.startsWith('http://')) {
          console.log('프로필 이미지 URL을 HTTPS로 변환합니다:', avatarUrl);
          
          // 사용자 메타데이터 업데이트
          const httpsAvatarUrl = avatarUrl.replace('http://', 'https://');
          await supabase.auth.updateUser({
            data: { 
              avatar_url: httpsAvatarUrl 
            }
          });
          
          console.log('URL이 업데이트되었습니다:', httpsAvatarUrl);
        }
      }

      if (error) {
        console.error('Session exchange error:', error.message)
        return NextResponse.redirect(new URL('/login?error=auth', request.url))
      }

      if (data.session) {
        console.log('Session successfully created')
        
        // 세션 안정성을 위한 추가 검증 및 지연
        try {
          // 세션이 제대로 설정되었는지 재확인
          const { data: sessionCheck } = await supabase.auth.getSession()
          if (!sessionCheck.session) {
            console.warn('⚠️ 세션 재확인 실패, 재시도...')
            // 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 500))
            const { data: retrySession } = await supabase.auth.getSession()
            if (!retrySession.session) {
              throw new Error('세션 설정 실패')
            }
            console.log('✅ 세션 재시도 성공')
          }
          console.log('✅ 세션 검증 완료')
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
          try {
            console.info('🔍 카카오 사용자 정보 API 호출 시작...');
            
            // 토큰 길이 확인 및 처리
            let accessToken = data.session.provider_token;
            console.info('🔍 원본 토큰 길이:', accessToken.length);
            console.info('🔍 토큰 앞부분:', accessToken.substring(0, 20) + '...');
            
            // 토큰이 너무 길면 앞부분만 사용 (카카오 토큰은 보통 43자리)
            if (accessToken.length > 100) {
              console.warn('⚠️ 토큰이 너무 길어서 잘라서 사용합니다.');
              // 일반적으로 카카오 액세스 토큰은 43자리이므로 처음 50자리만 사용
              accessToken = accessToken.substring(0, 50);
            }
            
            const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
            
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
          } catch (apiError) {
            console.error('❌ 카카오 API 호출 실패:', apiError);
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
            const isStudent = age >= 6 && age <= 39; // 테스트: 만 6-39세 | 출시: 만 6-19세 (초등입학전~고3)
            
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
            
            // 사용자 정보 업데이트 후 로그 남기기
            console.info('✅ 사용자 정보 업데이트 후 로그 남기기');
            const logData = {
              user_id: data.session.user.id,
              action: 'UPDATE_USER_INFO',
              data: updateData
            };
            const { error: logError } = await supabase
              .from('logs')
              .insert([logData]);
            if (logError) {
              console.error('❌ 로그 남기기 오류:', logError);
            } else {
              console.info('✅ 로그 남기기 완료!');
            }
            
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
        
        // 정밀 로그인 플로우 구현 - 공유URL 우선 처리
        console.info('🔍 정밀 로그인 플로우 시작 - 사용자 상태 분석');
        
        // 공유URL 분석 및 타학교 자동 관심학교 등록 처리
        let shareUrlSchoolCode = null;
        let shareUrlSchoolName = null;
        let isOtherSchoolShare = false;
        let isBattleShare = false;
        
        // OAuth 콜백 URL에서 직접 공유 파라미터 추출
        shareUrlSchoolCode = requestUrl.searchParams.get('share_school_code');
        const shareType = requestUrl.searchParams.get('share_type');
        isBattleShare = shareType === 'battle';
        
        console.info('🔗 OAuth 콜백 공유 파라미터 분석:', { 
          shareUrlSchoolCode, 
          shareType, 
          isBattleShare,
          shareUrl 
        });
        
        // 기존 shareUrl 방식도 유지 (fallback)
        if (!shareUrlSchoolCode && shareUrl) {
          try {
            const shareUrlObj = new URL(shareUrl, request.url);
            shareUrlSchoolCode = shareUrlObj.searchParams.get('school_code');
            if (!isBattleShare) {
              isBattleShare = shareUrlObj.pathname.includes('/battle');
            }
            console.info('🔗 fallback 공유URL 분석:', { shareUrl, shareUrlSchoolCode, isBattleShare });
          } catch (e) {
            console.warn('⚠️ 공유URL 파싱 오류:', e);
          }
        }
        
        // 1단계: 사용자의 관심학교 정보 확인
        const { data: existingSchool, error: schoolCheckError } = await supabase
          .from('user_interest_schools')
          .select(`
            school_code,
            school_infos!inner(school_name)
          `)
          .eq('user_id', data.session.user.id)
          .single();
        
        if (schoolCheckError && schoolCheckError.code !== 'PGRST116') {
          console.error('❌ 학교 정보 조회 오류:', schoolCheckError);
          redirectUrl = shareUrl || '/';
        } else if (existingSchool) {
          // 학교 정보 있음 → 공유URL 타학교 여부 확인
          console.info('✅ 등록된 학교 정보 발견');
          const schoolName = existingSchool.school_infos?.[0]?.school_name || '알 수 없음';
          console.info(`📚 내 학교: ${schoolName} (${existingSchool.school_code})`);
          
          if (shareUrlSchoolCode && shareUrlSchoolCode !== existingSchool.school_code) {
            // 타학교 공유URL → 관심학교 자동 등록
            console.info('🏫 타학교 공유URL 감지 → 관심학교 자동 등록 시도');
            isOtherSchoolShare = true;
            
            try {
              // 공유URL의 학교 정보 조회
              const { data: shareSchoolInfo } = await supabase
                .from('school_infos')
                .select('school_name')
                .eq('school_code', shareUrlSchoolCode)
                .limit(1)
                .single();
              
              if (shareSchoolInfo) {
                shareUrlSchoolName = shareSchoolInfo.school_name;
                
                // 관심학교 자동 등록 API 호출
                const interestResponse = await fetch(new URL('/api/interest-schools', request.url), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session.access_token}`
                  },
                  body: JSON.stringify({
                    school_code: shareUrlSchoolCode,
                    school_name: shareUrlSchoolName
                  })
                });
                
                if (interestResponse.ok) {
                  console.info(`✅ 타학교 관심학교 자동 등록 성공: ${shareUrlSchoolName}`);
                } else if (interestResponse.status === 400) {
                  console.info(`ℹ️ 이미 등록된 관심학교: ${shareUrlSchoolName}`);
                } else {
                  console.warn('⚠️ 관심학교 자동 등록 실패:', await interestResponse.text());
                }
              }
            } catch (autoRegisterError) {
              console.error('❌ 관심학교 자동 등록 오류:', autoRegisterError);
            }
          }
          
          redirectUrl = shareUrl || '/';
        } else {
          // 2단계: 학교 정보 없음 → 관심학교 확인
          console.info('🔍 학교 정보 없음 - 관심학교 등록 여부 확인');
          
          const { data: interestSchools, error: interestError } = await supabase
            .from('interest_schools')
            .select('id, school_code, school_name')
            .eq('user_id', data.session.user.id)
            .order('created_at', { ascending: true })
            .limit(1);
          
          if (interestError) {
            console.error('❌ 관심학교 조회 오류:', interestError);
            // 관심학교 조회 오류 시에도 나이 확인 후 분기 처리
            if (birthDate) {
              const today = new Date();
              const birth = new Date(birthDate);
              let age = today.getFullYear() - birth.getFullYear();
              const monthDiff = today.getMonth() - birth.getMonth();
              
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
              }
              
              const isStudent = age >= 6 && age <= 39; // 테스트: 만 6-39세
              
              if (isStudent) {
                console.info('✅ 관심학교 조회 오류이지만 학생 나이 확인 → 학교설정 페이지로 리다이렉트');
                // 공유URL이 있으면 school_code 파라미터를 포함하여 리다이렉트
                if (shareUrl && shareUrlSchoolCode) {
                  if (isBattleShare) {
                    redirectUrl = `/school-search?share_school_code=${shareUrlSchoolCode}&share_type=battle`;
                  } else {
                    redirectUrl = `/school-search?share_school_code=${shareUrlSchoolCode}`;
                  }
                } else {
                  redirectUrl = '/school-search';
                }
              } else {
                console.info('✅ 관심학교 조회 오류이지만 비학생 나이 확인 → 홈페이지로 리다이렉트');
                redirectUrl = shareUrl || '/';
              }
            } else {
              console.info('✅ 관심학교 조회 오류 및 생년월일 없음 → 홈페이지로 리다이렉트');
              redirectUrl = shareUrl || '/';
            }
          } else if (interestSchools && interestSchools.length > 0) {
            // 관심학교 있음 → 공유URL 타학교 자동 등록 후 리다이렉트
            const firstInterestSchool = interestSchools[0];
            console.info('✅ 등록된 관심학교 발견');
            console.info(`🏫 관심학교: ${firstInterestSchool.school_name} (${firstInterestSchool.school_code})`);
            
            // 공유URL에 타학교가 있으면 자동 등록
            if (shareUrl && shareUrlSchoolCode && shareUrlSchoolCode !== firstInterestSchool.school_code) {
              console.info('🏫 타학교 공유URL 감지 → 관심학교 자동 등록 시도');
              
              try {
                // 공유URL의 학교 정보 조회
                const { data: shareSchoolInfo } = await supabase
                  .from('school_infos')
                  .select('school_name')
                  .eq('school_code', shareUrlSchoolCode)
                  .limit(1)
                  .single();
                
                if (shareSchoolInfo) {
                  shareUrlSchoolName = shareSchoolInfo.school_name;
                  
                  // 관심학교 자동 등록 API 호출
                  const interestResponse = await fetch(new URL('/api/interest-schools', request.url), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${data.session.access_token}`
                    },
                    body: JSON.stringify({
                      school_code: shareUrlSchoolCode,
                      school_name: shareUrlSchoolName
                    })
                  });
                  
                  if (interestResponse.ok) {
                    console.info(`✅ 타학교 관심학교 자동 등록 성공: ${shareUrlSchoolName}`);
                  } else if (interestResponse.status === 400) {
                    console.info(`ℹ️ 이미 등록된 관심학교: ${shareUrlSchoolName}`);
                  } else {
                    console.warn('⚠️ 관심학교 자동 등록 실패:', await interestResponse.text());
                  }
                }
              } catch (autoRegisterError) {
                console.error('❌ 관심학교 자동 등록 오류:', autoRegisterError);
              }
            }
            
            redirectUrl = shareUrl || '/';
          } else {
            // 3단계: 관심학교도 없음 → 나이 확인 후 분기
            console.info('🔍 관심학교도 없음 - 나이 확인 후 분기 결정');
            
            // 공유URL에 학교코드가 있으면 자동 등록 시도 (생년월일 정보와 무관하게 실행)
            if (shareUrl && shareUrlSchoolCode) {
              console.info('🏫 공유URL에 학교코드 발견 → 관심학교 자동 등록 시도 (생년월일 정보 무관)');
              
              try {
                // 공유URL의 학교 정보 조회
                const { data: shareSchoolInfo } = await supabase
                  .from('school_infos')
                  .select('school_name')
                  .eq('school_code', shareUrlSchoolCode)
                  .limit(1)
                  .single();
                
                if (shareSchoolInfo) {
                  shareUrlSchoolName = shareSchoolInfo.school_name;
                  
                  // 관심학교 자동 등록 API 호출
                  const interestResponse = await fetch(new URL('/api/interest-schools', request.url), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${data.session.access_token}`
                    },
                    body: JSON.stringify({
                      school_code: shareUrlSchoolCode,
                      school_name: shareUrlSchoolName
                    })
                  });
                  
                  if (interestResponse.ok) {
                    console.info(`✅ 공유URL 학교 관심학교 자동 등록 성공: ${shareUrlSchoolName}`);
                    // 자동 등록 성공 시 바로 홈페이지로 리다이렉트
                    redirectUrl = shareUrl || '/';
                    console.info('🏠 관심학교 자동등록 완료 → 홈페이지로 리다이렉트');
                  } else if (interestResponse.status === 400) {
                    console.info(`ℹ️ 이미 등록된 관심학교: ${shareUrlSchoolName}`);
                    // 이미 등록된 경우도 홈페이지로 리다이렉트
                    redirectUrl = shareUrl || '/';
                    console.info('🏠 이미 등록된 관심학교 → 홈페이지로 리다이렉트');
                  } else {
                    console.warn('⚠️ 관심학교 자동 등록 실패:', await interestResponse.text());
                  }
                } else {
                  console.warn('⚠️ 공유URL 학교 정보를 찾을 수 없음:', shareUrlSchoolCode);
                }
              } catch (autoRegisterError) {
                console.error('❌ 관심학교 자동 등록 오류:', autoRegisterError);
              }
            }
            
            if (birthDate) {
              const today = new Date();
              const birth = new Date(birthDate);
              let age = today.getFullYear() - birth.getFullYear();
              const monthDiff = today.getMonth() - birth.getMonth();
              
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
              }
              
              const isStudent = age >= 6 && age <= 39; // 테스트: 만 6-39세
              
              if (isStudent) {
                console.info('✅ 학생 나이 확인 → 학교설정 페이지로 리다이렉트');
                // 공유URL이 있으면 school_code 파라미터를 포함하여 리다이렉트
                if (shareUrl && shareUrlSchoolCode) {
                  if (isBattleShare) {
                    redirectUrl = `/school-search?share_school_code=${shareUrlSchoolCode}&share_type=battle`;
                  } else {
                    redirectUrl = `/school-search?share_school_code=${shareUrlSchoolCode}`;
                  }
                } else {
                  redirectUrl = '/school-search';
                }
              } else {
                console.info('✅ 비학생 나이 확인 → 홈페이지(관심학교 안내)로 리다이렉트');
                redirectUrl = shareUrl || '/';
              }
            } else {
              console.info('✅ 생년월일 없음 → 홈페이지(관심학교 안내)로 리다이렉트');
              redirectUrl = shareUrl || '/';
            }
          }
        }
      }
    } else {
      console.error('No auth code received')
    }

    // 리다이렉트 전 세션 안정화를 위한 추가 지연
    console.log('🔄 세션 안정화를 위해 잠시 대기...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
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
