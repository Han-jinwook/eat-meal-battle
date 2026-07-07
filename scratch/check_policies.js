const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf-8')
  .split('\n')
  .reduce((acc, line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      acc[key] = value.trim();
    }
    return acc;
  }, {});

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  // Query pg_policies to see RLS policies for meal_images table
  const { data: policies, error } = await supabaseAdmin
    .rpc('get_policies_for_table', { table_name: 'meal_images' });

  if (error) {
    // If rpc doesn't exist, let's query using custom sql query via a direct select on pg_policies using custom function or raw select if possible
    console.log('RPC get_policies_for_table not found, trying raw query via pg_policies if accessible, or general view.');
    
    // We can run a direct query on pg_policies by selecting via RPC or creating a helper SQL.
    // Wait, let's try querying standard tables or check if we can query pg_policies using standard postgrest if there is a view.
    // Since PostgREST doesn't expose pg_catalog directly, let's check if there is an existing sql query we can run or check if there is an admin RPC.
    // Wait! Let's see if there is another table we can query or if we can run an arbitrary SQL query via a known RPC.
    // Let's search the codebase for `rpc(` to see what RPCs are defined in the project!
  } else {
    console.log('Policies for meal_images:', policies);
  }
}

async function findRpcs() {
  // Let's search the codebase for rpc calls
  console.log('No policies direct RPC known. Let us try to select policies using standard queries if possible.');
}

checkPolicies();
