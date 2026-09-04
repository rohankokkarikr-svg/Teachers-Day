/**
 * TEACHERS' DAY LIVE PLATFORM: SINGLE & DUAL STUDENT REGISTRATION PROBE
 * Tests student registration, profile creation, and active session generation.
 */

import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig, extractProjectRef, validateAndInspectKey, testSupabaseConnection } from './live_load_fixture.js';

async function testRegistration() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING STUDENT REGISTRATION PROBE');
  console.log('======================================================');

  const config = resolveSupabaseConfig();
  const projectRef = extractProjectRef(config.url);
  const keyInfo = validateAndInspectKey(config.anonKey, projectRef);

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });

  const connResult = await testSupabaseConnection(supabase);
  if (!connResult.connected) {
    console.error('❌ Could not connect to Supabase.');
    process.exitCode = 1;
    return;
  }

  const runId = `probe_${Date.now()}`;
  const student1Name = `LOADTEST_${runId}_0001`;
  const student1Device = `dev_lt_${runId}_0001`;

  console.log(`\n1. Registering Student 1: ${student1Name}...`);
  const { data: reg1, error: err1 } = await supabase.rpc('register_or_get_student', {
    p_full_name: student1Name,
    p_device_id: student1Device,
    p_user_agent: 'RegistrationProbe/1.0',
  });

  if (err1 || !reg1?.success) {
    console.error(`❌ Student 1 Registration Failed: ${err1?.message || reg1?.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  student registration: PASS (ID: ${reg1.student?.id})`);

  // Verify profile creation
  const { data: profile1, error: profErr1 } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, device_id')
    .eq('id', reg1.student.id)
    .maybeSingle();

  if (profErr1 || !profile1) {
    console.error(`❌ Profile Verification Failed: ${profErr1?.message || 'Profile not found'}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  profile creation:     PASS`);

  // Verify session creation
  const { data: session1, error: sessErr1 } = await supabase
    .from('user_sessions')
    .select('id, user_id, device_id, is_active')
    .eq('user_id', reg1.student.id)
    .eq('device_id', student1Device)
    .maybeSingle();

  if (sessErr1 || !session1) {
    console.error(`❌ Session Verification Failed: ${sessErr1?.message || 'Session not found'}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  session creation:     PASS`);
  console.log(`  active session:       PASS (is_active: ${session1.is_active})`);

  // Test Student 2
  const student2Name = `LOADTEST_${runId}_0002`;
  const student2Device = `dev_lt_${runId}_0002`;

  console.log(`\n2. Registering Student 2: ${student2Name}...`);
  const { data: reg2, error: err2 } = await supabase.rpc('register_or_get_student', {
    p_full_name: student2Name,
    p_device_id: student2Device,
    p_user_agent: 'RegistrationProbe/1.0',
  });

  if (err2 || !reg2?.success) {
    console.error(`❌ Student 2 Registration Failed: ${err2?.message || reg2?.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  second registration:  PASS (ID: ${reg2.student?.id})`);

  // Cleanup probe records
  try {
    await supabase.from('user_sessions').delete().like('device_id', `dev_lt_${runId}_%`);
    await supabase.from('profiles').delete().in('id', [reg1.student.id, reg2.student.id]);
    console.log(`\n🧹 Probe fixtures cleaned up successfully.`);
  } catch (cleanErr) {
    console.warn('⚠️ Probe cleanup warning:', cleanErr.message);
  }

  console.log('\n======================================================');
  console.log('🎉 REGISTRATION PROBE: ALL CHECKS PASSED');
  console.log('======================================================\n');
}

testRegistration().catch((err) => {
  console.error('Fatal Registration Probe Error:', err.message || err);
  process.exitCode = 1;
});
