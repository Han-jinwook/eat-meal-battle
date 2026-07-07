const client_id = process.env.NAVER_SEARCH_CLIENT_ID;
const client_secret = process.env.NAVER_SEARCH_CLIENT_SECRET;

async function test() {
  const url = 'https://openapi.naver.com/v1/search/local.json?query=' + encodeURIComponent('약수동 식당') + '&display=50';
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': client_id,
        'X-Naver-Client-Secret': client_secret
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
