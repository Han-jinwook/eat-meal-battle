const lat = 37.5546145;
const lng = 127.0117056;

// Haversine distance
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function test() {
  const url = 'https://m.search.naver.com/search.naver?query=' + encodeURIComponent('신당동 육개장') + '&lat=' + lat + '&lng=' + lng;
  console.log('Fetching:', url);
  
  const searchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F)' }});
  const html = await searchRes.text();
  
  const placesMap = new Map();
  let pos = 0;
  while (true) {
    const index = html.indexOf('"address"', pos);
    if (index === -1) break;

    let start = index; let braceCount = 0;
    while (start >= 0) {
      if (html[start] === '{') { braceCount--; if (braceCount < 0) break; } else if (html[start] === '}') { braceCount++; }
      start--;
    }
    let end = index; braceCount = 0;
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
        const xMatch = decoded.match(/"x"\s*:\s*"([^"]+)"/);
        const yMatch = decoded.match(/"y"\s*:\s*"([^"]+)"/);
        
        if (nameMatch && addressMatch && xMatch && yMatch) {
          const name = nameMatch[1];
          const address = addressMatch[1];
          const px = parseFloat(xMatch[1]);
          const py = parseFloat(yMatch[1]);
          
          if (name.length > 1 && address.includes(' ')) {
            const dist = getDistance(lat, lng, py, px);
            placesMap.set(name, { name, address, dist: Math.round(dist) });
          }
        }
      } catch(e) {}
    }
    pos = index + 9;
  }
  
  const places = Array.from(placesMap.values()).sort((a, b) => a.dist - b.dist);
  console.log(`Found ${places.length} places.`);
  places.forEach(p => console.log(`${p.name} - ${p.dist}m - ${p.address}`));
}
test();
