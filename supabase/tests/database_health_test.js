/**
 * TEACHERS' DAY AWARDS PLATFORM 2026
 * Database Health & Production Connectivity Test
 *
 * Verifies:
 * 1. Supabase endpoint reachability
 * 2. Schema and table accessibility
 * 3. Required RPC functions
 * 4. Voting settings configuration
 * 5. Leaderboard query speed
 * 6. Non-destructive health check
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pkiuwdcjommlsjiwwyzk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraXV3ZGNqb21tbHNqaXd3eXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzY4NDUsImV4cCI6MjEwNDExMjg0NX0.0JvU7zwq1zSHAptEUuXSRQwuNb_4ajW2sQlnhC8NdFc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runHealthCheck() {
  console.log('\n======================================================');
  console.log('🏥 TEACHERS\' DAY PLATFORM: DATABASE HEALTH CHECK');
  console.log('======================================================');
  console.log(`Target: ${supabaseUrl}`);

  let hasError = false;

  // 1. Check Tables
  const requiredTables = [
    'categories',
    'teachers',
    'category_teachers',
    'voting_settings',
    'profiles',
    'user_sessions',
    'vote_submissions',
    'vote_items',
    'vote_totals',
    'appreciation_messages',
  ];

  console.log('\n1. Verifying Core Tables & Data Accessibility...');
  for (const table of requiredTables) {
    const t0 = Date.now();
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    const latency = Date.now() - t0;

    if (error) {
      console.error(`   ❌ ${table.padEnd(24)}: ERROR (${error.message})`);
      hasError = true;
    } else {
      console.log(`   ✅ ${table.padEnd(24)}: OK (${count ?? 0} rows, ${latency}ms)`);
    }
  }

  // 2. Check Voting Settings
  console.log('\n2. Verifying Voting Settings...');
  const { data: settings, error: setErr } = await supabase
    .from('voting_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (setErr || !settings) {
    console.error(`   ❌ voting_settings row: ERROR (${setErr?.message || 'Row 1 not found'})`);
    hasError = true;
  } else {
    console.log(`   ✅ Voting Open:       ${settings.is_voting_open}`);
    console.log(`   ✅ Live Counts:       ${settings.show_live_counts}`);
    console.log(`   ✅ Results Finalized: ${settings.results_finalized}`);
    console.log(`   ✅ Votes / Category:  ${settings.votes_per_category}`);
  }

  // 3. Test RPC: get_category_leaderboard
  console.log('\n3. Testing Leaderboard RPC...');
  const tLeaderboard = Date.now();
  const { data: lbData, error: lbErr } = await supabase.rpc('get_category_leaderboard', {
    p_category_id: '11111111-0000-0000-0000-000000000001',
  });
  const lbLatency = Date.now() - tLeaderboard;

  if (lbErr) {
    console.error(`   ❌ get_category_leaderboard: ERROR (${lbErr.message})`);
    hasError = true;
  } else {
    console.log(`   ✅ get_category_leaderboard: OK (${lbData?.length || 0} nominees ranked in ${lbLatency}ms)`);
  }

  // 4. Test RPC: register_or_get_student (Safe probe)
  console.log('\n4. Testing Student Registration RPC...');
  const testProbeName = `HealthCheck Probe ${Date.now().toString().slice(-4)}`;
  const testProbeDevice = `health_dev_${Date.now().toString().slice(-6)}`;
  const { data: regData, error: regErr } = await supabase.rpc('register_or_get_student', {
    p_full_name: testProbeName,
    p_device_id: testProbeDevice,
    p_user_agent: 'HealthCheck Script',
  });

  if (regErr || !regData?.success) {
    console.error(`   ❌ register_or_get_student: ERROR (${regErr?.message || regData?.message})`);
    hasError = true;
  } else {
    console.log(`   ✅ register_or_get_student: OK (Student ID: ${regData.student?.id})`);
    // Cleanup probe profile & session
    if (regData.student?.id) {
      await supabase.from('user_sessions').delete().eq('device_id', testProbeDevice);
      await supabase.from('profiles').delete().eq('id', regData.student.id);
    }
  }

  // 5. Check Auth Service
  console.log('\n5. Verifying Supabase Auth Service...');
  const { error: authErr } = await supabase.auth.getSession();
  if (authErr) {
    console.error(`   ❌ Auth Service: ERROR (${authErr.message})`);
    hasError = true;
  } else {
    console.log('   ✅ Auth Service: OK');
  }

  console.log('\n======================================================');
  if (hasError) {
    console.error('❌ DATABASE HEALTH CHECK FAILED');
    process.exitCode = 1;
  } else {
    console.log('🎉 ALL DATABASE HEALTH CHECKS PASSED SUCCESSFULLY');
  }
  console.log('======================================================\n');
}

runHealthCheck().catch((err) => {
  console.error('Fatal Health Check Error:', err);
  process.exitCode = 1;
});
