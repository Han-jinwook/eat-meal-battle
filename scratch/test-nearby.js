const lat = '37.5546145';
const lng = '127.0117056';

async function test() {
  try {
    const url = 'https://m.search.naver.com/search.naver?query=' + encodeURIComponent('신당동 식당') + '&lat=' + lat + '&lng=' + lng;
    console.log('Search URL:', url);
    
    const searchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F)' }});
    const html = await searchRes.text();
    
    const placesMap = new Map();
    let pos = 0;
    while (true) {
      const index = html.indexOf('"address"', pos);
      if (index === -1) break;

      let start = index;
      let braceCount = 0;
      while (start >= 0) {
        if (html[start] === '{') { braceCount--; if (braceCount < 0) break; } else if (html[start] === '}') { braceCount++; }
        start--;
      }
      let end = index;
      braceCount = 0;
      while (end < html.length) {
        if (html[end] === '}') { braceCount--; if (braceCount < 0) break; } else if (html[end] === '{') { braceCount++; }
        end++;
      }

      if (start >= 0 && end < html.length) {
        const chunk = html.substring(start, end + 1);
        try {
          const decoded = chunk.replace(/\\u([\d\w]{4})/gi, (m, g) => String.fromCharCode(parseInt(g, 16)));
          const nameMatch = decoded.match(/"name"\s*:\s*"([^"]+)"/);
          const addressMatch = decoded.match(/"address"\s*:\s*"([^"]+)"/);
          const bCatMatch = decoded.match(/"businessCategory"\s*:\s*"([^"]+)"/);
          
          if (nameMatch && addressMatch) {
            const name = nameMatch[1];
            const address = addressMatch[1];
            const bCat = bCatMatch ? bCatMatch[1] : null;
            if (name.length > 1 && address.includes(' ')) {
              placesMap.set(name, address + ' (' + bCat + ')');
            }
          }
        } catch(e) {}
      }
      pos = index + 9;
    }
    console.log('Places:', Array.from(placesMap.entries()).slice(0, 15));
  } catch (err) {
    console.error(err);
  }
}
test();
