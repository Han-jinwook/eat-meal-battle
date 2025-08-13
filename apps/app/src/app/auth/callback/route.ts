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
        
        // OAuth에서 받은 생년월일 정보 처리
        const userMetadata = data.session.user.user_metadata;
        const rawProviderData = data.session.user.identities?.[0]?.identity_data;
        
        console.info('🔍 OAuth 콜백 실행됨 - 사용자 ID:', data.session.user.id);
        console.info('🔍 OAuth 디버깅 - User metadata:', JSON.stringify(userMetadata, null, 2));
        console.info('🔍 OAuth 디버깅 - Provider data:', JSON.stringify(rawProviderData, null, 2));
        console.info('🔍 OAuth 디버깅 - birthyear 확인:', rawProviderData?.birthyear);
        console.info('🔍 OAuth 디버깅 - birthday 확인:', rawProviderData?.birthday);
        
        // 카카오 데이터 구조 전체 분석
        if (rawProviderData) {
          console.info('🔍 카카오 데이터 모든 키:', Object.keys(rawProviderData));
          console.info('🔍 생년 관련 필드 검색:');
          Object.keys(rawProviderData).forEach(key => {
            if (key.toLowerCase().includes('birth') || key.toLowerCase().includes('year')) {
              console.info(`  - ${key}: ${rawProviderData[key]}`);
            }
          });
        }
        
        // 생년월일 정보가 있는 경우 처리
        let birthDate = null;
        let birthDateConsent = false;
        
        // 카카오에서 생년월일 정보 추출 (birthday + birthyear 조합)
        if (rawProviderData?.birthday && rawProviderData?.birthyear) {
          const kakaoYear = rawProviderData.birthyear;
          const kakaoBirthday = rawProviderData.birthday; // MMDD 형식
          const month = kakaoBirthday.substring(0, 2);
          const day = kakaoBirthday.substring(2, 4);
          birthDate = `${kakaoYear}-${month}-${day}`; // YYYY-MM-DD 형식으로 변환
          birthDateConsent = true;
          console.info('✅ 카카오에서 생년월일 정보 받음:', { year: kakaoYear, birthday: kakaoBirthday, formatted: birthDate });
        }
        // 카카오에서 생년만 받은 경우 (birthyear만 있는 경우)
        else if (rawProviderData?.birthyear) {
          const kakaoYear = rawProviderData.birthyear;
          birthDate = `${kakaoYear}-01-01`; // 생년만 있으면 1월 1일로 설정
          birthDateConsent = true;
          console.info('✅ 카카오에서 생년 정보 받음:', { year: kakaoYear, formatted: birthDate });
        }
        // 구글에서 생년월일 정보 추출 (가능한 경우)
        else if (rawProviderData?.birthdate) {
          birthDate = rawProviderData.birthdate;
          birthDateConsent = true;
          console.info('✅ 구글에서 생년월일 정보 받음:', { birthdate: birthDate });
        }
        
        // 생년월일이 있으면 나이 계산 및 학생 여부 판단
        if (birthDate && birthDateConsent) {
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
              birth_date_consent: birthDateConsent,
              is_student: isStudent,
              user_id: data.session.user.id
            });
            
            const { error: updateError } = await supabase
              .from('users')
              .update({
                birth_date: birthDate,
                birth_date_consent: birthDateConsent,
                is_student: isStudent
              })
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
          console.info('❌ 생년월일 정보 없음 - 기본값으로 설정');
          console.info('🔍 birthDate:', birthDate);
          console.info('🔍 birthDateConsent:', birthDateConsent);
          
          // 생년월일 정보가 없는 경우 기본값 설정
          const { error: updateError } = await supabase
            .from('users')
            .update({
              birth_date_consent: false,
              is_student: false
            })
            .eq('id', data.session.user.id);
            
          if (updateError) {
            console.error('기본값 설정 오류:', updateError);
          }
        }
        
        // 세션이 성공적으로 생성되었으면 홈페이지로 리디렉션
        redirectUrl = '/'
      }
    } else {
      console.error('No auth code received')
    }

    console.log('Redirecting to:', redirectUrl)
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (error) {
    console.error('Unexpected error in auth callback:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
