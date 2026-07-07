const fs = require('fs');
async function test() {
  const url = "https://naver.me/5ss0Zdnd";
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' }});
  const html = await res.text();
  
  const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i) || 
                 html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/i);
  console.log("og:description:", ogDesc ? ogDesc[1] : "Not found");
}
test();
