const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key

async function fetchSchema() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch REST schema:', res.status, await res.text());
    return;
  }

  const schema = await res.json();
  const tables = Object.keys(schema.definitions || {});
  console.log('Available Tables in Supabase Schema:');
  console.log(tables);

  console.log('\nTable Details:');
  tables.forEach(table => {
    const properties = schema.definitions[table].properties;
    const columns = Object.keys(properties).map(col => {
      const prop = properties[col];
      return `${col} (${prop.type}${prop.format ? `, ${prop.format}` : ''})`;
    });
    console.log(`- ${table}:`);
    console.log(`    Columns: ${columns.join(', ')}`);
  });
}

fetchSchema();
