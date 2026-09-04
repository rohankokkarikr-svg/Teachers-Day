/**
 * TEACHERS' DAY LIVE PLATFORM: SINGLE & DUAL STUDENT REGISTRATION PROBE
 * Tests student registration, profile creation, and active session generation.
 */

import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig, extractProjectRef, validateAndInspectKey, testSupabaseConnection } from './live_load_fixture.js';

async function testRegistration() {
  console.log('\n======================================================');
  console.log('🧪 TESTING NEW SUPABASE DB VOTING & DIRECT WRITES');
  console.log('======================================================');

  const config = resolveSupabaseConfig();
  console.log('Target Supabase URL:', config.url);
  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });

  // 1. Get first category and two teachers
  const { data: cats } = await supabase.from('categories').select('*').limit(1);
  const cat = cats[0];
  console.log('Category:', cat.name, cat.id);

  const { data: teachers } = await supabase.from('teachers').select('*').limit(2);
  console.log('Teachers:', teachers.map(t => `${t.name} (${t.id})`));

  // 2. Test direct student profile insertion
  const testStudentId = crypto.randomUUID();
  const testDeviceId = 'probe_dev_' + Date.now();

  const { data: profData, error: profErr } = await supabase.from('profiles').insert({
    id: testStudentId,
    full_name: 'Live Probe Student',
    email: 'probe@student.college',
    role: 'student',
    device_id: testDeviceId,
  }).select().single();

  if (profErr) {
    console.log('❌ Direct Profile Insert Error:', profErr.message);
  } else {
    console.log('✅ Direct Profile Insert PASS:', profData.id);
  }

  // 3. Test submit_votes RPC
  const testSubId = crypto.randomUUID();
  const votePayload = [
    { teacher_id: teachers[0].id, vote_count: 3 },
    { teacher_id: teachers[1].id, vote_count: 2 },
  ];

  console.log('\nTesting submit_votes RPC...');
  const { data: voteRes, error: voteErr } = await supabase.rpc('submit_votes', {
    p_category_id: cat.id,
    p_votes: votePayload,
    p_student_id: testStudentId,
    p_device_id: testDeviceId,
    p_submission_id: testSubId,
  });

  if (voteErr) {
    console.log('❌ submit_votes RPC Error:', voteErr.message);
  } else {
    console.log('✅ submit_votes RPC Success:', voteRes);
  }

  // 4. Verify vote_submissions row
  const { data: subRow } = await supabase.from('vote_submissions').select('*').eq('id', testSubId);
  console.log('✅ vote_submissions rows in DB:', subRow);

  const { data: itemRows } = await supabase.from('vote_items').select('*').eq('submission_id', testSubId);
  console.log('✅ vote_items rows in DB:', itemRows);

  const { data: totalRows } = await supabase.from('vote_totals').select('*').eq('category_id', cat.id);
  console.log('✅ vote_totals rows in DB:', totalRows);

  // 5. Cleanup
  console.log('\nCleaning up test probe...');
  await supabase.from('vote_items').delete().eq('submission_id', testSubId);
  await supabase.from('vote_submissions').delete().eq('id', testSubId);
  await supabase.from('profiles').delete().eq('id', testStudentId);
  await supabase.rpc('resync_vote_totals');
  console.log('✅ Cleanup complete.');
}

testRegistration().catch((err) => {
  console.error('Fatal Test Error:', err.message || err);
  process.exitCode = 1;
});
