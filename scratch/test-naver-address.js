const url = "https://pcmap.place.naver.com/restaurant/1155986862/home"; // Some place ID
fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  .then(res => res.text())
  .then(html => {
    // Try to find address
    const match = html.match(/"roadAddress"\s*:\s*"([^"]+)"/);
    const match2 = html.match(/"address"\s*:\s*"([^"]+)"/);
    console.log("roadAddress:", match ? match[1] : "Not found");
    console.log("address:", match2 ? match2[1] : "Not found");
  });
