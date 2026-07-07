const fs = require('fs');
const html = fs.readFileSync('scratch/yaksu.html', 'utf8');

const target = '우리집떡볶이';
let index = html.indexOf(target);
if (index !== -1) {
  console.log('Surrounding JSON for ' + target + ':');
  console.log(html.substring(index - 300, index + 300));
}
