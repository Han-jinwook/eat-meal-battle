const fs = require('fs');
async function test() {
  const url = "https://naver.me/5ss0Zdnd";
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' }});
  const html = await res.text();
  const metaTags = html.match(/<meta[^>]*>/ig);
  console.log(metaTags.join('\n'));
}
test();
