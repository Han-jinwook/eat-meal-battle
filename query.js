const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key && val) acc[key.trim()] = val.join('=').trim().replace(/[\"']/g, '');
  return acc;
}, {});

fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/meal_images?place_name=eq.%EC%9B%90%EC%A1%B0%ED%98%B8%EB%82%A8%EC%88%9C%EB%8C%80%EA%B5%AD&select=id,place_name,place_address,explanation,meal_type', {
  headers: {
    'apikey': env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
