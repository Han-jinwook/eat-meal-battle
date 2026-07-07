const url = "https://pcmap.place.naver.com/restaurant/1155986862/home";
fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  .then(res => res.text())
  .then(html => {
    // search for words like 서울특별시 or address parts
    const match = html.match(/.{0,80}신당동.{0,80}/g);
    console.log("Matches:", match);
  });
