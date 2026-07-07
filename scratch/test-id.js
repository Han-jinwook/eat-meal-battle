const fs = require('fs');
const html = fs.readFileSync('scratch/yaksu.html', 'utf8');

let pos = 0;
while (true) {
  const index = html.indexOf('"address"', pos);
  if (index === -1) break;

  let start = index;
  let braceCount = 0;
  while (start >= 0) {
    if (html[start] === '{') {
      braceCount--;
      if (braceCount < 0) break;
    } else if (html[start] === '}') {
      braceCount++;
    }
    start--;
  }

  let end = index;
  braceCount = 0;
  while (end < html.length) {
    if (html[end] === '}') {
      braceCount--;
      if (braceCount < 0) break;
    } else if (html[end] === '{') {
      braceCount++;
    }
    end++;
  }

  if (start >= 0 && end < html.length) {
    const chunk = html.substring(start, end + 1);
    const decoded = chunk.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
      return String.fromCharCode(parseInt(grp, 16));
    });
    
    if (decoded.includes('우리집떡볶이')) {
      console.log(decoded);
    }
  }
  pos = index + 9;
}
