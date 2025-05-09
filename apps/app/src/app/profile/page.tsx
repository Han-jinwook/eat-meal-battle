'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [dbStatus, setDbStatus] = useState<'loading' | 'success' | 'error' | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      try {
        setLoading(true)
        
        // 세션 및 사용자 정보 가져오기
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('사용자 인증 에러:', error)
          throw error
        }
        
        if (user) {
          console.log('인증된 사용자 정보:', user)
          setUser(user)
          
          // 사용자 테이블에서 메타데이터 가져오기
          setDbStatus('loading')
          const { data, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (profileError) {
            console.error('사용자 프로필 조회 에러:', profileError)
            setDbStatus('error')
            if (profileError.code !== 'PGRST116') { // No records found 에러가 아닐 경우에만 에러 표시
              setError(`DB 조회 에러: ${profileError.message}`)
            }
          } else if (data) {
            console.log('사용자 DB 프로필:', data)
            setUserProfile(data)
            setDbStatus('success')
            
            // 학교 정보 가져오기 - user_id로 직접 조회
            const { data: schoolData, error: schoolError } = await supabase
              .from('school_infos')
              .select('*')
              .eq('user_id', user.id)
              .single()
              
            if (!schoolError && schoolData) {
              setSchoolInfo(schoolData)
            }
          } else {
            setDbStatus('error')
            setError('사용자 데이터를 찾을 수 없습니다. DB에 저장되지 않았을 수 있습니다.')
          }
        } else {
          router.push('/login')
        }
      } catch (error: any) {
        console.error('프로필 로딩 에러:', error)
        setError(error.message || '사용자 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [supabase, router])

  // 로그아웃 처리 함수
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/')
    } catch (error: any) {
      setError(error.message || '로그아웃 중 오류가 발생했습니다')
    }
  }

  // 회원 탈퇴 처리 함수
  const handleDeleteAccount = async () => {
    if (!confirm('정말로 계정을 삭제하시겠습니까? \n\n이 작업은 되돌릴 수 없으며, 모든 계정 데이터가 영구적으로 삭제됩니다.')) {
      return
    }

    try {
      setDeletingAccount(true)
      setError(null)
      
      console.log('회원 탈퇴 시작...')
      
      // Step 1: API 호출로 DB 데이터 삭제 (코드 중복 제거)
      console.log('회원 탈퇴 API 호출')
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // API 응답 처리
      const responseData = await response.json()
      console.log('API 응답:', responseData)
      
      if (!response.ok) {
        throw new Error(responseData.error || '계정 삭제 중 API 오류가 발생했습니다.')
      }
      
      // Step 2: 로그아웃 처리 - 이것이 실제 사용자 삭제를 트리거합니다
      console.log('로그아웃 처리 시작...')
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        console.error('로그아웃 오류:', signOutError)
        throw new Error(`로그아웃 오류: ${signOutError.message}`)
      }
      
      // Step 3: 성공 메시지 표시
      alert('회원 탈퇴가 성공적으로 완료되었습니다.')
      
      // Step 4: 홈페이지로 리다이렉트
      router.push('/')
    } catch (error: any) {
      console.error('계정 삭제 중 오류 발생:', error)
      setError(error.message || '계정 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingAccount(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col p-4">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">내 프로필</h1>
          <Link
            href="/"
            className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
          >
            홈으로
          </Link>
        </div>

        {/* 인증 사용자 정보 */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold mb-4">사용자 정보</h2>
          <div className="space-y-4">
            <div className="flex flex-col space-y-1">
              <span className="text-sm text-gray-500">이메일</span>
              <span className="font-medium">{user?.email || '이메일 없음'}</span>
            </div>

            <div className="flex flex-col space-y-1">
              <span className="text-sm text-gray-500">계정 제공자</span>
              <span className="font-medium capitalize">
                {user?.app_metadata?.provider || '알 수 없음'}
              </span>
            </div>

            <div className="flex flex-col space-y-1">
              <span className="text-sm text-gray-500">계정 생성일</span>
              <span className="font-medium">
                {user?.created_at ? new Date(user.created_at).toLocaleString('ko-KR') : '알 수 없음'}
              </span>
            </div>

            <div className="flex flex-col space-y-1">
              <span className="text-sm text-gray-500">계정 ID</span>
              <span className="font-mono text-xs text-gray-600">{user?.id}</span>
            </div>
          </div>
        </div>

        {/* DB 사용자 데이터 */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold mb-4">DB 사용자 데이터</h2>
          
          {dbStatus === 'loading' && (
            <div className="p-4 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-600">데이터베이스 정보 가져오는 중...</p>
            </div>
          )}

          {dbStatus === 'error' && (
            <div className="p-4 bg-red-50 rounded-md text-red-700 text-sm">
              <p>데이터베이스에서 사용자 정보를 가져오는 중 오류가 발생했습니다.</p>
              <p>문제가 지속되면 관리자에게 문의하세요.</p>
            </div>
          )}

          {dbStatus === 'success' && userProfile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(userProfile).map(([key, value]) => (
                  <div key={key} className="flex flex-col space-y-1">
                    <span className="text-sm text-gray-500">{key}</span>
                    <span className="font-mono text-xs break-all">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-green-50 rounded-md text-green-700 text-sm">
                <p className="font-semibold">✔ 사용자 데이터가 Supabase DB에 성공적으로 저장되어 있습니다!</p>
              </div>
            </div>
          )}

          {dbStatus === 'success' && !userProfile && (
            <div className="p-4 bg-yellow-50 rounded-md text-yellow-700 text-sm">
              <p>데이터베이스에 사용자 정보가 없습니다. 트리거가 정상적으로 동작하지 않았을 수 있습니다.</p>
            </div>
          )}
        </div>
        
        {/* 학교 정보 */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">학교 정보</h2>
            <Link
              href="/school-search"
              className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              {schoolInfo ? '학교 정보 수정' : '학교 정보 설정'}
            </Link>
          </div>
          
          {schoolInfo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-gray-500">학교명</span>
                  <span className="font-medium">{schoolInfo.school_name}</span>
                </div>
                
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-gray-500">학교 유형</span>
                  <span className="font-medium">{schoolInfo.school_type}</span>
                </div>
                
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-gray-500">지역</span>
                  <span className="font-medium">{schoolInfo.region}</span>
                </div>
                
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-gray-500">주소</span>
                  <span className="font-medium text-sm">{schoolInfo.address}</span>
                </div>
                
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-gray-500">학년</span>
                  <span className="font-medium">{schoolInfo.grade}학년</span>
                </div>
                
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-gray-500">반</span>
                  <span className="font-medium">{schoolInfo.class_number}반</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 rounded-md">
              <p className="text-yellow-700 text-sm">아직 학교 정보가 업로드 되지 않았습니다.</p>
              <Link 
                href="/school-search"
                className="mt-2 inline-block px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                학교 정보 설정하기
              </Link>
            </div>
          )}
        </div>

        {/* 관리 버튼 */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold mb-4">계정 관리</h2>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
            
            <button
              onClick={handleSignOut}
              className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              로그아웃
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletingAccount ? '삭제 중...' : '회원 탈퇴'}
            </button>
          </div>
          
          {deletingAccount && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-md">
              <p className="text-yellow-700 text-sm">회원 탈퇴 처리 중... 잠시만 기다려주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
