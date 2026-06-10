const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ekyqxkmwtvwtiszopery.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not defined in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const TARGET_USER_ID = '7357f439-afe4-4fac-9f87-69224074fbe6';
const TARGET_EMAIL = 'sundream7879@gmail.com';

async function deleteUserCascade() {
  console.log(`Starting cascade delete for User ID: ${TARGET_USER_ID} (${TARGET_EMAIL})...`);

  try {
    // 1. family_user_registrations 삭제
    const { error: regErr } = await supabase
      .from('family_user_registrations')
      .delete()
      .eq('user_id', TARGET_USER_ID);
    if (regErr) console.warn('Warning deleting family_user_registrations:', regErr.message);
    else console.log('Successfully cleared family_user_registrations');

    // 2. family_wallet_transactions 삭제
    const { error: txErr } = await supabase
      .from('family_wallet_transactions')
      .delete()
      .eq('user_id', TARGET_USER_ID);
    if (txErr) console.warn('Warning deleting family_wallet_transactions:', txErr.message);
    else console.log('Successfully cleared family_wallet_transactions');

    // 3. family_wallet_balances 삭제
    const { error: balErr } = await supabase
      .from('family_wallet_balances')
      .delete()
      .eq('user_id', TARGET_USER_ID);
    if (balErr) console.warn('Warning deleting family_wallet_balances:', balErr.message);
    else console.log('Successfully cleared family_wallet_balances');

    // 4. 타 유저의 invited_by_id Null 처리 (이 유저가 다른 유저를 초대했을 경우 대비)
    const { error: invErr } = await supabase
      .from('family_users')
      .update({ invited_by_id: null })
      .eq('invited_by_id', TARGET_USER_ID);
    if (invErr) console.warn('Warning updating invited_by_id null:', invErr.message);
    else console.log('Successfully updated referenced invited_by_id to null');

    // 5. family_users 테이블에서 유저 행 최종 삭제
    const { error: userErr } = await supabase
      .from('family_users')
      .delete()
      .eq('id', TARGET_USER_ID);
    if (userErr) {
      throw userErr;
    }
    console.log(`Successfully deleted user row from family_users!`);
    console.log('Cascade deletion completed successfully.');

  } catch (error) {
    console.error('Fatal error during cascade deletion:', error.message);
  }
}

deleteUserCascade();
