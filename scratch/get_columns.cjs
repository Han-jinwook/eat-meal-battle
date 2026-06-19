const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  console.log('Parsed env keys:', Object.keys(env));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function printSchema() {
  const tables = ['meal_images', 'comments', 'comment_replies', 'meal_menus', 'users'];
  for (const table of tables) {
    console.log(`\n--- SCHEMA FOR TABLE: ${table} ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error querying table ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample Row:', data[0]);
    } else {
      console.log('Table is empty. Querying non-existent column to see error for columns:');
      const { error: err } = await supabase.from(table).select('non_existent_column_name_xyz').limit(1);
      if (err) {
        console.log(err.message);
      }
    }
  }
}

printSchema();
