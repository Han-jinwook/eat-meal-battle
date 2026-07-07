const query = "도우소사이어티 약수점";
const KAKAO_REST_API_KEY = "ca4d8a1dbfbabdf6a83ccf9dff5ab246"; // Kakao key from env

fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`, {
  headers: {
    Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`
  }
})
.then(res => res.json())
.then(data => {
  if (data.documents && data.documents.length > 0) {
    console.log("Address:", data.documents[0].address_name);
  } else {
    console.log("Not found in Kakao");
  }
});
