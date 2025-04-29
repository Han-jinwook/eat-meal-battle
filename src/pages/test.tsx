import { useState } from 'react';

export default function TestPage() {
  const [result, setResult] = useState<string>('결과가 여기에 표시됩니다');
  const [loading, setLoading] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');

  const testApi = async () => {
    setLoading(true);
    try {
      // API 엔드포인트 직접 호출
      const response = await fetch(`/api/cron/meals?api_key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.text();
      setResult(`상태 코드: ${response.status}\n\n${data}`);
    } catch (error) {
      setResult(`오류 발생: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>API 테스트 페이지</h1>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="apiKey" style={{ display: 'block', marginBottom: '5px' }}>
          API 키:
        </label>
        <input
          id="apiKey"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ padding: '8px', width: '100%', marginBottom: '10px' }}
        />
        <button
          onClick={testApi}
          disabled={loading}
          style={{
            padding: '10px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '테스트 중...' : 'API 테스트'}
        </button>
      </div>
      <div>
        <h2>결과:</h2>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px',
          }}
        >
          {result}
        </pre>
      </div>
    </div>
  );
}
