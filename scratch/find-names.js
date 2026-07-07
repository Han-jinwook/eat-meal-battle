const fs = require('fs');
const html = fs.readFileSync('scratch/yaksu.html', 'utf8');

// Find all occurrences of "name":"..."
const matches = html.match(/"name"\s*:\s*"([^"]+)"/g);
if (matches) {
  const names = Array.from(new Set(matches.map(m => m.replace(/"name"\s*:\s*"|"/g, ''))));
  console.log('Found names:', names.slice(0, 30));
}

// See if we have "businesses" or "places" or "list"
let index = html.indexOf('"businesses"');
console.log('Has "businesses"?', index !== -1);
index = html.indexOf('"list"');
console.log('Has "list"?', index !== -1);
index = html.indexOf('window.__skt_img_');
console.log('Has "skt_img"?', index !== -1);

// Find '토리아에즈'
index = html.indexOf('토리아에즈');
if (index !== -1) {
  console.log('Found 토리아에즈 around:', html.substring(index - 100, index + 200));
}
