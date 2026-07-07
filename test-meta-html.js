const fs = require('fs');
async function test() {
  const url = "https://naver.me/5ss0Zdnd";
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
  const html = await res.text();
  fs.writeFileSync('temp_naver.html', html);
  console.log("Saved to temp_naver.html");
}
test();
