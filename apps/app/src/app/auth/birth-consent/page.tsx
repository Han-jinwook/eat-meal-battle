'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BirthConsentPage() {
  const [birthDate, setBirthDate] = useState('')
  const [consent, setConsent] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 나이 계산 함수
  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    return age
  }

  // 학생 여부 판단 (만 7-19세)
  const isStudentAge = (birthDate: string) => {
    const age = calculateAge(birthDate)
    return age >= 7 && age <= 19
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        return
      }

      // 동의한 경우에만 생년월일과 학생 여부 업데이트
      if (consent && birthDate) {
        const isStudent = isStudentAge(birthDate)
        
        const { error: updateError } = await supabase
          .from('users')
          .update({
            birth_date: birthDate,
            birth_date_consent: true,
            is_student: isStudent
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('사용자 정보 업데이트 오류:', updateError)
          setError('정보 저장 중 오류가 발생했습니다.')
          return
        }

        console.log('생년월일 동의 완료:', { birthDate, isStudent })
        
        // 학생인 경우 학교 설정으로, 아닌 경우 메인으로
        if (isStudent) {
          router.push('/school-search')
        } else {
          router.push('/')
        }
      } else {
        // 동의하지 않은 경우 기본값으로 업데이트
        const { error: updateError } = await supabase
          .from('users')
          .update({
            birth_date_consent: false,
            is_student: false
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('사용자 정보 업데이트 오류:', updateError)
          setError('정보 저장 중 오류가 발생했습니다.')
          return
        }

        console.log('생년월일 동의 거부')
        router.push('/')
      }
    } catch (error: any) {
      console.error('처리 중 오류:', error)
      setError('처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-lg">
            
            {/* 헤더 */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-4 8a2 2 0 100-4 2 2 0 000 4zm0 0v4a2 2 0 002 2h4a2 2 0 002-2v-4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">생년월일 제공 동의</h2>
              <p className="mt-2 text-gray-600">
                더 나은 서비스 제공을 위해 생년월일 정보를 요청합니다
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 설명 */}
            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="font-medium text-blue-900">왜 생년월일이 필요한가요?</h3>
              <ul className="mt-2 space-y-1 text-sm text-blue-800">
                <li>• 학생 대상 서비스 제공</li>
                <li>• 연령대별 맞춤 콘텐츠</li>
                <li>• 서비스 품질 개선</li>
              </ul>
            </div>

            {/* 동의 선택 */}
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="consent"
                    checked={consent === true}
                    onChange={() => setConsent(true)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">동의합니다 (생년월일 제공)</span>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="consent"
                    checked={consent === false}
                    onChange={() => setConsent(false)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">동의하지 않습니다</span>
                </label>
              </div>

              {/* 생년월일 입력 (동의한 경우에만 표시) */}
              {consent === true && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    생년월일
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  
                  {birthDate && (
                    <div className="text-sm text-gray-600">
                      만 {calculateAge(birthDate)}세 
                      {isStudentAge(birthDate) ? ' (학생 대상 서비스 이용 가능)' : ' (일반 사용자)'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 안내 메시지 */}
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <p className="font-medium">📌 개인정보 처리 안내</p>
              <p className="mt-1">
                제공해주신 생년월일은 서비스 개선 목적으로만 사용되며, 
                언제든지 프로필에서 수정하거나 삭제할 수 있습니다.
              </p>
            </div>

            {/* 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={loading || consent === null || (consent === true && !birthDate)}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? '처리 중...' : '계속하기'}
            </button>

            {/* 나중에 설정 링크 */}
            <div className="text-center">
              <button
                onClick={() => router.push('/')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                나중에 설정하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
