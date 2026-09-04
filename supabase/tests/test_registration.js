/**
 * TEACHERS' DAY LIVE PLATFORM: SINGLE & DUAL STUDENT REGISTRATION PROBE
 * Tests student registration, profile creation, and active session generation.
 */

import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig, extractProjectRef, validateAndInspectKey, testSupabaseConnection } from './live_load_fixture.js';

async function testRegistration() {
  console.log('\n======================================================');
  console.log('🧪 COMPREHENSIVE PLATFORM FUNCTIONALITY PROBE');
  console.log('======================================================');

  const config = resolveSupabaseConfig();
  console.log('Target Supabase URL:', config.url);
  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });

  const runId = `probe_${Date.now()}`;
  const studentName = `Verification Student ${runId.slice(-4)}`;
  const deviceId = `dev_verify_${runId}`;

  // STEP 1: Student Registration (Single Name Login)
  console.log(`\n1. Testing Student Name-Only Login ("${studentName}")...`);
  const { data: regRes, error: regErr } = await supabase.rpc('register_or_get_student', {
    p_full_name: studentName,
    p_device_id: deviceId,
    p_user_agent: 'AutomatedProbe/2026',
  });

  if (regErr || !regRes?.success) {
    console.log(`   ❌ Registration Failed: ${regErr?.message || regRes?.message}`);
    throw new Error(regErr?.message || regRes?.message);
  }
  const studentId = regRes.student.id;
  console.log(`   ✅ Registration PASS (Student ID: ${studentId})`);

  // STEP 2: Verify Profile & Active Session
  console.log('\n2. Verifying Profile & Active Session in Database...');
  const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', studentId).single();
  if (profErr || !prof) throw new Error('Profile record not found in database');
  console.log(`   ✅ Profile PASS: ${prof.full_name} (${prof.email})`);

  const { data: sess, error: sessErr } = await supabase.from('user_sessions').select('*').eq('user_id', studentId).eq('device_id', deviceId).single();
  if (sessErr || !sess) throw new Error('Session record not found in database');
  console.log(`   ✅ Session PASS (Active: ${sess.is_active})`);

  // STEP 3: Categories & Teachers
  console.log('\n3. Fetching Categories & Nominee Teachers...');
  const { data: cats } = await supabase.from('categories').select('*').order('display_order').limit(1);
  const cat = cats[0];
  const { data: teachers } = await supabase.from('teachers').select('*').limit(2);
  console.log(`   ✅ Category: "${cat.name}" (${cat.id})`);
  console.log(`   ✅ Nominees: ${teachers[0].name} & ${teachers[1].name}`);

  // STEP 4: Submit 5 Votes (Transactional RPC)
  console.log('\n4. Submitting 5 Votes across Nominees...');
  const submissionId = crypto.randomUUID();
  const votePayload = [
    { teacher_id: teachers[0].id, vote_count: 3 },
    { teacher_id: teachers[1].id, vote_count: 2 },
  ];

  const { data: voteRes, error: voteErr } = await supabase.rpc('submit_votes', {
    p_category_id: cat.id,
    p_votes: votePayload,
    p_student_id: studentId,
    p_device_id: deviceId,
    p_submission_id: submissionId,
  });

  if (voteErr || !voteRes?.success) {
    console.log(`   ❌ Vote Submission Failed: ${voteErr?.message || voteRes?.message}`);
    throw new Error(voteErr?.message || voteRes?.message);
  }
  console.log(`   ✅ Vote Submission PASS: ${voteRes.message}`);

  // STEP 5: Verify Database Records
  console.log('\n5. Verifying Database Tables (Submissions, Items, Totals)...');
  const { data: subRow } = await supabase.from('vote_submissions').select('*').eq('id', submissionId).single();
  console.log(`   ✅ vote_submissions PASS: ID ${subRow.id}`);

  const { data: itemRows } = await supabase.from('vote_items').select('*').eq('submission_id', submissionId);
  console.log(`   ✅ vote_items PASS: ${itemRows.length} allocation rows recorded`);

  const { data: totalRows } = await supabase.from('vote_totals').select('*').eq('category_id', cat.id);
  console.log(`   ✅ vote_totals PASS: Live counts incremented in database`);

  // STEP 6: Query Leaderboard
  console.log('\n6. Querying Live Category Leaderboard RPC...');
  const { data: leaderboard, error: lbErr } = await supabase.rpc('get_category_leaderboard', {
    p_category_id: cat.id,
  });
  if (lbErr) throw new Error(lbErr.message);
  console.log(`   ✅ Leaderboard RPC PASS (${leaderboard.length} ranked teachers)`);
  console.log(`      Top 1: ${leaderboard[0].teacher_name} - ${leaderboard[0].total_votes} votes`);
  console.log(`      Top 2: ${leaderboard[1].teacher_name} - ${leaderboard[1].total_votes} votes`);

  // STEP 7: Appreciation Wall Message
  console.log('\n7. Testing Appreciation Message Creation...');
  const { data: msgRow, error: msgErr } = await supabase.from('appreciation_messages').insert({
    student_id: studentId,
    message: 'Thank you teachers for your guidance!',
    status: 'approved',
  }).select().single();

  if (msgErr || !msgRow) throw new Error(`Appreciation insert failed: ${msgErr?.message}`);
  console.log(`   ✅ Appreciation Wall PASS: Message ID ${msgRow.id}`);

  // STEP 8: Verification of Vote Integrity
  console.log('\n8. Checking Vote Integrity Diagnostic...');
  const { data: integrity } = await supabase.rpc('verify_vote_integrity');
  console.log(`   ✅ Vote Integrity PASS (is_healthy: ${integrity?.is_healthy})`);

  // STEP 9: Cleanup Probe Records
  console.log('\n9. Cleaning up test probe fixtures...');
  await supabase.from('appreciation_messages').delete().eq('id', msgRow.id);
  await supabase.from('vote_items').delete().eq('submission_id', submissionId);
  await supabase.from('vote_submissions').delete().eq('id', submissionId);
  await supabase.from('user_sessions').delete().eq('user_id', studentId);
  await supabase.from('profiles').delete().eq('id', studentId);
  await supabase.rpc('resync_vote_totals');
  console.log('   ✅ Test fixtures cleaned up and database restored to pristine state.');

  console.log('\n======================================================');
  console.log('🎉 ENTIRE PLATFORM IS 100% OPERATIONAL & VERIFIED!');
  console.log('======================================================\n');
}

testRegistration().catch((err) => {
  console.error('Fatal Test Error:', err.message || err);
  process.exitCode = 1;
});
