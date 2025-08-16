import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.info('🚀 OAuth 콜백 라우트 시작')
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  let redirectUrl = '/'

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
        console.info('🔍 OAuth 디버깅 - birthyear 확인:', rawProviderData?.birthyear);
        console.info('🔍 OAuth 디버깅 - birthday 확인:', rawProviderData?.birthday);
        console.info('🔍 카카오 데이터 모든 키:', Object.keys(rawProviderData || {}));
        
        // 추가 디버깅: 모든 필드 값 출력
        console.info('🔍 카카오 데이터 전체 값:', JSON.stringify(rawProviderData, null, 2));
        
        // birth 관련 모든 키 검색
        const birthKeys = Object.keys(rawProviderData || {}).filter(key => 
          key.toLowerCase().includes('birth') || key.toLowerCase().includes('age') || key.toLowerCase().includes('year')
        );
        console.info('🔍 birth/age/year 관련 키들:', birthKeys);
        
        // 카카오 사용자 정보 API 직접 호출 (생년 정보 획득)
        let kakaoUserInfo = null;
        if (data.session.provider_token) {
          try {
            console.info('🔍 카카오 사용자 정보 API 호출 시작...');
            const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
              headers: {
                'Authorization': `Bearer ${data.session.provider_token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
            
            if (kakaoResponse.ok) {
              kakaoUserInfo = await kakaoResponse.json();
              console.info('✅ 카카오 사용자 정보 API 응답:', JSON.stringify(kakaoUserInfo, null, 2));
            } else {
              console.error('❌ 카카오 사용자 정보 API 오류:', kakaoResponse.status, kakaoResponse.statusText);
            }
          } catch (apiError) {
            console.error('❌ 카카오 API 호출 실패:', apiError);
          }
        } else {
          console.info('⚠️ provider_token이 없어서 카카오 API 호출 불가');
        }
        
        // 생년월일 정보가 있는 경우 처리
        let birthDate = null;
        
        // 카카오에서 생년 정보 추출 (API 응답 우선, 없으면 기본 데이터 확인)
        if (kakaoUserInfo?.kakao_account?.birthyear) {
          const kakaoYear = kakaoUserInfo.kakao_account.birthyear;
          birthDate = `${kakaoYear}-01-01`; // 생년만 있으면 1월 1일로 설정
          console.info('✅ 카카오 API에서 생년 정보 받음:', { year: kakaoYear, formatted: birthDate });
        } else if (rawProviderData?.birthyear) {
          const kakaoYear = rawProviderData.birthyear;
          birthDate = `${kakaoYear}-01-01`; // 생년만 있으면 1월 1일로 설정
          console.info('✅ 카카오 기본 데이터에서 생년 정보 받음:', { year: kakaoYear, formatted: birthDate });
        }
        // 구글에서 생년월일 정보 추출 (가능한 경우)
        else if (rawProviderData?.birthdate) {
          birthDate = rawProviderData.birthdate;
          console.info('✅ 구글에서 생년월일 정보 받음:', { birthdate: birthDate });
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
            
            if (updateError) {
              console.error('❌ 사용자 정보 업데이트 오류:', updateError);
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
        
        // 세션이 성공적으로 생성되었으면 사용자 상태에 따라 리디렉션
        // 1. 학생 나이 (6-39세) + 생년월일 있음 → 학교설정 페이지
        // 2. 비학생 나이 + 생년월일 있음 → 관심학교 안내 (홈페이지)
        // 3. 생년월일 없음 → 관심학교 안내 (홈페이지)
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
            redirectUrl = '/school-search';
          } else {
            console.info('✅ 비학생 나이 확인 → 홈페이지(관심학교 안내)로 리다이렉트');
            redirectUrl = '/';
          }
        } else {
          console.info('✅ 생년월일 없음 → 홈페이지(관심학교 안내)로 리다이렉트');
          redirectUrl = '/';
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
