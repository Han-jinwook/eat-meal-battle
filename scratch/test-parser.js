const fs = require('fs');
const html = fs.readFileSync('scratch/yaksu.html', 'utf8');

const placesMap = new Map();
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
    try {
      const decoded = chunk.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
        return String.fromCharCode(parseInt(grp, 16));
      });

      const nameMatch = decoded.match(/"name"\s*:\s*"([^"]+)"/);
      const titleMatch = decoded.match(/"title"\s*:\s*"([^"]+)"/);
      const addressMatch = decoded.match(/"address"\s*:\s*"([^"]+)"/);
      const categoryMatch = decoded.match(/"category"\s*:\s*"([^"]+)"/);
      const imgMatch = decoded.match(/"smartplaceImages"\s*:\s*\[\s*"([^"]+)"/);

      const name = nameMatch ? nameMatch[1] : (titleMatch ? titleMatch[1] : null);
      const address = addressMatch ? addressMatch[1] : null;
      const category = categoryMatch ? categoryMatch[1] : '음식점';

      if (name && address && address.includes(' ')) { // Basic sanity check for address
        // Exclude UI noise
        if (!placesMap.has(name) && name.length > 1) {
          placesMap.set(name, {
            name,
            address,
            category
          });
        }
      }
    } catch (e) {}
  }
  pos = index + 9; // move past "address"
}

console.log('Parsed Places:', Array.from(placesMap.values()).slice(0, 15));
