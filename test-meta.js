const url = "https://naver.me/5ss0Zdnd";
fetch(`https://whateat.sundreamer.app/api/naver-place-meta?url=${encodeURIComponent(url)}`)
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
