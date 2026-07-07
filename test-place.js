const fs = require('fs');
async function test() {
  const url = "https://m.place.naver.com/restaurant/18120803/home";
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' }});
  const html = await res.text();
  const addressMatch = html.match(/address\\?"\s*:\s*\\?"([^"]+)\\?"/i);
  if (addressMatch) {
    console.log("Found address:", addressMatch[1]);
  } else {
    console.log("Not found address");
  }
  const apollo = html.includes('__APOLLO_STATE__');
  console.log("Apollo state exists:", apollo);
  
  const roadAddressMatch = html.match(/roadAddress\\?"\s*:\s*\\?"([^"]+)\\?"/i) || html.match(/roadAddress":"([^"]+)"/i);
  if (roadAddressMatch) {
    console.log("Found roadAddress:", roadAddressMatch[1]);
  }
}
test();
