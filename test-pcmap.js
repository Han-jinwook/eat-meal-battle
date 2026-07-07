const fs = require('fs');
async function test() {
  const url = "https://pcmap.place.naver.com/restaurant/18120803/home";
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }});
  const html = await res.text();
  const roadAddrMatch = html.match(/"roadAddress"\s*:\s*"([^"]+)"/i) || html.match(/roadAddress\\?"\s*:\s*\\?"([^"]+)\\?"/i) || html.match(/주소.*?<span[^>]*>([^<]+)<\/span>/i);
  const addrMatch = html.match(/"address"\s*:\s*"([^"]+)"/i) || html.match(/address\\?"\s*:\s*\\?"([^"]+)\\?"/i);
  console.log("roadAddrMatch:", roadAddrMatch ? roadAddrMatch[1] : "None");
  console.log("addrMatch:", addrMatch ? addrMatch[1] : "None");
  
  // also let's just regex for the common address format in __APOLLO_STATE__
  const apolloAddress = html.match(/roadAddress":"([^"]+)"/);
  console.log("Apollo Address:", apolloAddress ? apolloAddress[1] : "None");
}
test();
