const title = "도우소사이어티 약수점";
const NAVER_SEARCH_CLIENT_ID = "Rj__BOhONxdeVpS4xkVN";
const NAVER_SEARCH_CLIENT_SECRET = "ecM8f68Iye";

fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(title)}&display=1`, {
  headers: {
    "X-Naver-Client-Id": NAVER_SEARCH_CLIENT_ID,
    "X-Naver-Client-Secret": NAVER_SEARCH_CLIENT_SECRET
  }
})
.then(res => res.json())
.then(data => {
  if (data.items && data.items.length > 0) {
    console.log("Address:", data.items[0].roadAddress || data.items[0].address);
  } else {
    console.log("Not found in Naver Local Search");
  }
});
