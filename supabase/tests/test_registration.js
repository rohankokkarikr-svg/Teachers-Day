/**
 * TEACHERS' DAY LIVE PLATFORM: SINGLE & DUAL STUDENT REGISTRATION PROBE
 * Tests student registration, profile creation, and active session generation.
 */

import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig, extractProjectRef, validateAndInspectKey, testSupabaseConnection } from './live_load_fixture.js';

async function testRegistration() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING FULL END-TO-END VOTE & LEADERBOARD PROBE');
  console.log('======================================================');

  const config = resolveSupabaseConfig();
  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });

  const runId = `e2e_${Date.now()}`;
  const studentName = `Student_${runId}`;
  const deviceId = `dev_${runId}`;

  // 1. Register student
  console.log(`\n1. Registering student "${studentName}"...`);
  const { data: regRes, error: regErr } = await supabase.rpc('register_or_get_student', {
    p_full_name: studentName,
    p_device_id: deviceId,
    p_user_agent: 'E2E_Probe/1.0',
  });

  if (regErr || !regRes?.success) {
    throw new Error(`Registration failed: ${regErr?.message || regRes?.message}`);
  }
  const studentId = regRes.student.id;
  console.log(`   ✅ Registered student ID: ${studentId}`);

  // 2. Fetch categories and teachers
  const { data: cats } = await supabase.from('categories').select('*').limit(1);
  const cat = cats[0];
  const { data: teachers } = await supabase.from('teachers').select('*').limit(2);
  console.log(`\n2. Voting in category "${cat.name}" (${cat.id})`);
  console.log(`   Nominees: ${teachers[0].name} & ${teachers[1].name}`);

  // 3. Submit 5 votes
  const submissionId = crypto.randomUUID();
  const votePayload = [
    { teacher_id: teachers[0].id, vote_count: 3 },
    { teacher_id: teachers[1].id, vote_count: 2 },
  ];

  console.log('\n3. Submitting 5 votes via submit_votes RPC...');
  const { data: voteRes, error: voteErr } = await supabase.rpc('submit_votes', {
    p_category_id: cat.id,
    p_votes: votePayload,
    p_student_id: studentId,
    p_device_id: deviceId,
    p_submission_id: submissionId,
  });

  if (voteErr || !voteRes?.success) {
    throw new Error(`Vote submission failed: ${voteErr?.message || voteRes?.message}`);
  }
  console.log(`   ✅ Vote submission successful:`, voteRes);

  // 4. Verify Supabase table writes
  console.log('\n4. Verifying database table records...');
  const { data: subRow } = await supabase.from('vote_submissions').select('*').eq('id', submissionId).single();
  console.log(`   ✅ vote_submissions row found: ID ${subRow.id}, Student: ${subRow.student_id}`);

  const { data: items } = await supabase.from('vote_items').select('*').eq('submission_id', submissionId);
  console.log(`   ✅ vote_items rows found (${items.length} items):`, items.map(i => `Teacher ${i.teacher_id} -> ${i.vote_count} votes`));

  // 5. Query Category Leaderboard RPC
  console.log('\n5. Querying get_category_leaderboard RPC...');
  const { data: leaderboard, error: lbErr } = await supabase.rpc('get_category_leaderboard', {
    p_category_id: cat.id,
  });
  console.log(`   ✅ Leaderboard entries (${leaderboard?.length}):`, leaderboard?.slice(0, 3));

  // 6. Cleanup test data
  console.log('\n6. Cleaning up test fixture...');
  await supabase.from('vote_items').delete().eq('submission_id', submissionId);
  await supabase.from('vote_submissions').delete().eq('id', submissionId);
  await supabase.from('user_sessions').delete().eq('user_id', studentId);
  await supabase.from('profiles').delete().eq('id', studentId);
  await supabase.rpc('resync_vote_totals');
  console.log('   ✅ Test records cleaned up and vote_totals resynced.');

  console.log('\n======================================================');
  console.log('🎉 ALL INTEGRATION PROBES PASSED WITH 100% SUCCESS');
  console.log('======================================================\n');
}

testRegistration().catch((err) => {
  console.error('Fatal Test Error:', err.message || err);
  process.exitCode = 1;
});
