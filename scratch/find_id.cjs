const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findId() {
  const targetId = '4c47c3fa-e228-4c47-868c-b9a05150be1e';
  
  const { data: menuData } = await supabase.from('meal_menus').select('id').eq('id', targetId);
  console.log('Exists in meal_menus:', menuData && menuData.length > 0);

  const { data: imgData } = await supabase.from('meal_images').select('id').eq('id', targetId);
  console.log('Exists in meal_images:', imgData && imgData.length > 0);
}

findId();
