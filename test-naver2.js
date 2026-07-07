const fetch = require('node-fetch');

async function run() {
  const url = 'https://m.search.naver.com/search.naver?query=' + encodeURIComponent('신당동 원조호남순대국');
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  let pos = 0;
  while(true) {
    let index = html.indexOf('"address"', pos);
    if(index === -1) break;
    pos = index + 10;
    let start = index;
    let braceCount = 0;
    while(start >= 0) {
      if(html[start] === '{') { braceCount--; if(braceCount < 0) break; }
      else if(html[start] === '}') { braceCount++; }
      start--;
    }
    let end = index; braceCount = 0;
    while(end < html.length) {
      if(html[end] === '}') { braceCount--; if(braceCount < 0) break; }
      else if(html[end] === '{') { braceCount++; }
      end++;
    }
    const chunk = html.substring(start, end+1).replace(/\\u([\d\w]{4})/gi, (m, g) => String.fromCharCode(parseInt(g, 16)));
    if (chunk.includes('원조호남순대국')) {
      const match = chunk.match(/"[^"]*address[^"]*"\s*:\s*"[^"]*"/gi);
      console.log(match);
      break;
    }
  }
}
run();
