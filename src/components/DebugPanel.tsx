'use client';

import { useState } from 'react';

interface DebugPanelProps {
  title?: string;
}

export default function DebugPanel({ title = '디버그 정보' }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // 전역 콘솔 로그 오버라이드
  if (typeof window !== 'undefined') {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.log = function(...args) {
      originalConsoleLog.apply(console, args);
      const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `[LOG] ${logMessage}`]);
    };
    
    console.error = function(...args) {
      originalConsoleError.apply(console, args);
      const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `[ERROR] ${logMessage}`]);
    };
    
    console.warn = function(...args) {
      originalConsoleWarn.apply(console, args);
      const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `[WARN] ${logMessage}`]);
    };
  }
  
  const clearLogs = () => {
    setLogs([]);
  };
  
  const addTestLog = () => {
    console.log('테스트 로그 메시지');
    console.error('테스트 에러 메시지');
  };
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg z-50"
      >
        디버그 패널 열기
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-0 right-0 w-full md:w-1/2 lg:w-1/3 bg-gray-900 text-white shadow-lg z-50 max-h-[70vh] flex flex-col">
      <div className="flex justify-between items-center p-2 bg-gray-800">
        <h3 className="font-bold">{title}</h3>
        <div className="flex space-x-2">
          <button
            onClick={addTestLog}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
          >
            테스트 로그
          </button>
          <button
            onClick={clearLogs}
            className="px-2 py-1 bg-red-600 text-white text-xs rounded"
          >
            지우기
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
          >
            닫기
          </button>
        </div>
      </div>
      
      <div className="overflow-auto p-2 flex-grow bg-gray-950">
        {logs.length === 0 ? (
          <p className="text-gray-500 italic">로그가 없습니다.</p>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`py-1 border-b border-gray-800 ${
                  log.includes('[ERROR]') 
                    ? 'text-red-400' 
                    : log.includes('[WARN]') 
                      ? 'text-yellow-400' 
                      : 'text-green-400'
                }`}
              >
                {log}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
