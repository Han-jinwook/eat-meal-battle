// 페이지 소스 확인 도구
(function() {
  function createViewSourceTool() {
    const styles = `
      .source-viewer {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        background-color: #fff;
        border: 1px solid #ccc;
        box-shadow: 0 0 10px rgba(0,0,0,0.2);
        border-radius: 4px;
        padding: 10px;
        max-width: 90vw;
        max-height: 80vh;
        overflow: auto;
      }
      .source-viewer pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: monospace;
        font-size: 12px;
        line-height: 1.4;
      }
      .source-viewer button {
        margin: 5px;
        padding: 4px 8px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .source-viewer button:hover {
        background: #45a049;
      }
      .source-controls {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
      }
    `;

    // 스타일 요소 추가
    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    document.head.appendChild(styleEl);

    // 소스 뷰어 컨테이너 생성
    const container = document.createElement('div');
    container.className = 'source-viewer';
    
    // 컨트롤 영역
    const controls = document.createElement('div');
    controls.className = 'source-controls';
    
    // 제목
    const title = document.createElement('div');
    title.textContent = '현재 페이지 소스 확인 도구';
    title.style.fontWeight = 'bold';
    controls.appendChild(title);
    
    // 닫기 버튼
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '닫기';
    closeBtn.onclick = function() {
      document.body.removeChild(container);
    };
    controls.appendChild(closeBtn);
    
    container.appendChild(controls);
    
    // 버튼 그룹
    const buttonGroup = document.createElement('div');
    
    // 현재 페이지 HTML 보기 버튼
    const viewCurrentBtn = document.createElement('button');
    viewCurrentBtn.textContent = '현재 페이지 HTML';
    viewCurrentBtn.onclick = function() {
      viewSource('html');
    };
    buttonGroup.appendChild(viewCurrentBtn);
    
    // 프로필 컴포넌트 찾기 버튼
    const findProfileBtn = document.createElement('button');
    findProfileBtn.textContent = '프로필 컴포넌트 찾기';
    findProfileBtn.onclick = function() {
      findComponents(['ProfileClient', 'ProfileModal']);
    };
    buttonGroup.appendChild(findProfileBtn);
    
    container.appendChild(buttonGroup);
    
    // 소스 표시 영역
    const pre = document.createElement('pre');
    container.appendChild(pre);
    
    // 현재 페이지 소스 보기
    function viewSource(type) {
      switch(type) {
        case 'html':
          pre.textContent = document.documentElement.outerHTML;
          break;
      }
    }
    
    // 컴포넌트 찾기
    function findComponents(componentNames) {
      const scripts = document.querySelectorAll('script');
      let found = false;
      
      pre.textContent = '컴포넌트 검색 중...\n';
      
      componentNames.forEach(name => {
        pre.textContent += `\n${name} 검색 결과:\n`;
        
        scripts.forEach((script, index) => {
          if (script.src) {
            pre.textContent += `확인 중: ${script.src}\n`;
          } else if (script.textContent.includes(name)) {
            found = true;
            pre.textContent += `[스크립트 #${index}] ${name} 발견!\n`;
            
            // 컴포넌트 코드 부분 추출 시도
            const text = script.textContent;
            const regex = new RegExp(`(function|const|class|var)\\s+${name}\\s*\\(.*?\\{`, 'i');
            const match = text.match(regex);
            
            if (match) {
              const start = match.index;
              let bracketCount = 1;
              let end = start + match[0].length;
              
              while (bracketCount > 0 && end < text.length) {
                if (text[end] === '{') bracketCount++;
                if (text[end] === '}') bracketCount--;
                end++;
              }
              
              if (bracketCount === 0) {
                const componentCode = text.substring(start, end);
                pre.textContent += `\n--- 컴포넌트 코드 ---\n${componentCode}\n---------------\n`;
              }
            }
          }
        });
      });
      
      if (!found) {
        pre.textContent += '\n컴포넌트를 찾을 수 없습니다. 코드가 압축/난독화되어 있을 가능성이 있습니다.';
      }
    }
    
    document.body.appendChild(container);
  }
  
  createViewSourceTool();
})();
