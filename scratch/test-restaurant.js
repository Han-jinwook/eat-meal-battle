const lat = '37.5546145';
const lng = '127.0117056';

async function test() {
  try {
    const geoRes = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=ko', { headers: { 'User-Agent': 'WhatEatApp/1.0' }});
    const geoData = await geoRes.json();
    const addr = geoData.address || {};
    let dong = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.village || '역삼동';
    dong = dong.replace(/\d+동$/, '동').trim();
    console.log('Parsed Dong:', dong);
    
    const searchUrl = 'https://m.search.naver.com/search.naver?query=' + encodeURIComponent(dong + ' 식당');
    console.log('Search URL:', searchUrl);
    
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }});
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
