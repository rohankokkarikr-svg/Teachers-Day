/**
 * TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
 * Live Load Test Fixture & Environment Discovery Module
 *
 * Prepares a dedicated, safe test environment:
 * 1. Validates that the Supabase key is an anon/publishable key (rejects service_role).
 * 2. Discovers real active categories & assigned nominees dynamically.
 * 3. Registers real test student sessions via register_or_get_student() RPC.
 * 4. Provides isolated, non-destructive test teardown when enabled.
 */

import crypto from 'crypto';

/**
 * Validates that the provided Supabase key is genuinely an anon/publishable key
 * and strictly refuses execution if a service_role key is detected.
 */
export function validateAnonKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Supabase anon key is missing or invalid.');
  }

  const parts = key.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format for Supabase key.');
  }

  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    if (payload.role === 'service_role') {
      console.error('\n❌ REFUSING TO RUN: service_role key detected. Use the Supabase anon/publishable key.\n');
      process.exit(1);
    }
  } catch (err) {
    if (err.message.includes('REFUSING TO RUN')) throw err;
    throw new Error('Could not parse Supabase JWT payload.');
  }
}

/**
 * Dynamically discovers an active category and at least two active nominees assigned to it.
 */
export async function discoverCategoryAndTeachers(supabase, overrides = {}) {
  const categoryOverride = overrides.categoryId || process.env.LOAD_TEST_CATEGORY_ID;
  const teacherAOverride = overrides.teacherAId || process.env.LOAD_TEST_TEACHER_A;
  const teacherBOverride = overrides.teacherBId || process.env.LOAD_TEST_TEACHER_B;

  // 1. Discover Active Category
  let categoryId = categoryOverride;
  let categoryName = 'Award Category';

  if (!categoryId) {
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1);

    if (catErr || !categories || categories.length === 0) {
      throw new Error(`Failed to discover active category: ${catErr?.message || 'No active categories found'}`);
    }

    categoryId = categories[0].id;
    categoryName = categories[0].name;
  } else {
    const { data: catData } = await supabase
      .from('categories')
      .select('id, name, is_active')
      .eq('id', categoryId)
      .maybeSingle();

    if (catData) categoryName = catData.name;
  }

  // 2. Discover Active Assigned Nominees
  let teacherA = null;
  let teacherB = null;

  if (teacherAOverride && teacherBOverride) {
    const { data: teachersData } = await supabase
      .from('teachers')
      .select('id, name, is_active')
      .in('id', [teacherAOverride, teacherBOverride]);

    const tMap = new Map((teachersData || []).map((t) => [t.id, t]));
    teacherA = tMap.get(teacherAOverride) || { id: teacherAOverride, name: 'Nominee A' };
    teacherB = tMap.get(teacherBOverride) || { id: teacherBOverride, name: 'Nominee B' };
  } else {
    const { data: ctRows, error: ctErr } = await supabase
      .from('category_teachers')
      .select('teacher_id, teachers(id, name, is_active)')
      .eq('category_id', categoryId);

    if (ctErr || !ctRows || ctRows.length < 2) {
      throw new Error(
        `Category ${categoryId} does not have at least 2 assigned nominees in category_teachers: ${ctErr?.message || 'Insufficient nominees'}`
      );
    }

    const activeNominees = ctRows
      .map((row) => row.teachers)
      .filter((t) => t && t.is_active !== false);

    if (activeNominees.length < 2) {
      throw new Error(`Category ${categoryId} requires at least 2 active assigned nominees.`);
    }

    teacherA = { id: activeNominees[0].id, name: activeNominees[0].name };
    teacherB = { id: activeNominees[1].id, name: activeNominees[1].name };
  }

  return {
    categoryId,
    categoryName,
    teacherA,
    teacherB,
  };
}

/**
 * Creates and registers authentic test students with active user_sessions in batches.
 */
export async function prepareTestStudents(supabase, count, runId) {
  console.log(`\n⏳ Preparing fixture with ${count} legitimate student sessions (Run: ${runId})...`);

  const students = [];
  const batchSize = 25;
  const numBatches = Math.ceil(count / batchSize);

  for (let b = 0; b < numBatches; b++) {
    const startIdx = b * batchSize;
    const endIdx = Math.min(startIdx + batchSize, count);

    const batchPromises = Array.from({ length: endIdx - startIdx }).map(async (_, offset) => {
      const idx = startIdx + offset + 1;
      const fullName = `LOADTEST_${runId}_${String(idx).padStart(4, '0')}`;
      const deviceId = `dev_lt_${runId}_${String(idx).padStart(4, '0')}`;

      // Register student via authentic RPC
      const { data: regRes, error: regErr } = await supabase.rpc('register_or_get_student', {
        p_full_name: fullName,
        p_device_id: deviceId,
        p_user_agent: 'LoadTestRunner/1.0',
      });

      if (regErr || !regRes?.success || !regRes?.student?.id) {
        throw new Error(
          `Failed to register student ${fullName}: ${regErr?.message || regRes?.message || 'Unknown error'}`
        );
      }

      return {
        studentId: regRes.student.id,
        name: fullName,
        deviceId: deviceId,
        submissionId: crypto.randomUUID(),
      };
    });

    const batchResults = await Promise.all(batchPromises);
    students.push(...batchResults);
    process.stdout.write(`\r  ✓ Registered ${students.length} / ${count} test students...`);
  }

  console.log(`\n  ✅ All ${count} student test fixtures initialized with active sessions.`);
  return students;
}

/**
 * Safely cleans up data created strictly by this test run if LOAD_TEST_ALLOW_CLEANUP is enabled.
 */
export async function cleanupTestRun(supabase, runId) {
  const allowCleanup = process.env.LOAD_TEST_ALLOW_CLEANUP === 'true';

  if (!allowCleanup) {
    console.log(`\nℹ️ Test data retained for audit (LOAD_TEST_ALLOW_CLEANUP is false).`);
    return;
  }

  console.log(`\n🧹 Cleaning up test run ${runId}...`);
  try {
    // Find all test sessions for this run
    const devicePattern = `dev_lt_${runId}_%`;
    const { data: testSessions } = await supabase
      .from('user_sessions')
      .select('user_id, id')
      .like('device_id', devicePattern);

    if (testSessions && testSessions.length > 0) {
      const studentIds = Array.from(new Set(testSessions.map((s) => s.user_id)));

      // Delete submissions
      const { data: testSubs } = await supabase
        .from('vote_submissions')
        .select('id')
        .in('student_id', studentIds);

      if (testSubs && testSubs.length > 0) {
        const subIds = testSubs.map((s) => s.id);
        await supabase.from('vote_items').delete().in('submission_id', subIds);
        await supabase.from('vote_submissions').delete().in('id', subIds);
      }

      // Delete sessions and profiles
      await supabase.from('user_sessions').delete().like('device_id', devicePattern);
      await supabase.from('profiles').delete().in('id', studentIds);
    }

    console.log(`  ✅ Cleaned up isolated test records for ${runId}.`);
  } catch (err) {
    console.warn(`  ⚠️ Cleanup warning:`, err.message);
  }
}
