/**
 * TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
 * Live Load Test Fixture & Environment Discovery Module
 *
 * Prepares a dedicated, safe test environment:
 * 1. Supports both legacy anon JWTs and modern Supabase publishable keys.
 * 2. Strictly rejects service_role or secret keys.
 * 3. Verifies project reference match between VITE_SUPABASE_URL and key payload.
 * 4. Verifies database connectivity before running tests.
 * 5. Discovers real active categories & assigned nominees dynamically.
 * 6. Registers real test student sessions via register_or_get_student() RPC.
 * 7. Provides isolated, non-destructive test teardown when enabled.
 */

import crypto from 'crypto';

/**
 * Extracts the Supabase project reference from the project URL.
 */
export function extractProjectRef(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('Supabase URL is empty. Please set VITE_SUPABASE_URL.');
  }

  const cleanUrl = url.trim();

  if (
    cleanUrl.includes('your-project') ||
    cleanUrl.includes('your_supabase_url') ||
    cleanUrl.includes('placeholder')
  ) {
    throw new Error(
      `Supabase URL is a placeholder ("${cleanUrl}"). Please provide a valid Supabase project URL (e.g. https://your-project-ref.supabase.co).`
    );
  }

  const match = cleanUrl.match(/https?:\/\/([a-z0-9-]+)\.supabase\.(co|in|net)/i);
  if (match && match[1]) {
    return match[1].toLowerCase();
  }

  try {
    const parsed = new URL(cleanUrl);
    return parsed.hostname;
  } catch {
    throw new Error(`Invalid Supabase URL format: "${cleanUrl}".`);
  }
}

/**
 * Validates the Supabase key format, ensuring it is a legitimate anon/publishable key
 * and rejecting dangerous service_role or secret keys.
 *
 * Supports:
 * 1. Legacy anon JWT (e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)
 * 2. Modern publishable keys (e.g. sb_publishable_..., pk_...)
 */
export function validateAndInspectKey(key, expectedProjectRef) {
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error('Supabase key is empty. Please provide your Supabase anon/publishable key.');
  }

  const cleanKey = key.trim();

  // Check for placeholder values
  if (
    cleanKey.includes('your-anon') ||
    cleanKey.includes('your_supabase_anon_key') ||
    cleanKey.includes('your_anon_key') ||
    cleanKey.includes('placeholder')
  ) {
    throw new Error(
      'Supabase key is a placeholder value. Please provide your real Supabase anon/publishable key from your Supabase Dashboard.'
    );
  }

  // Check for dangerous secret keys
  if (cleanKey.startsWith('sb_secret_') || cleanKey.startsWith('sk_') || cleanKey.startsWith('secret_')) {
    throw new Error('Supabase secret key detected. Do not use secret keys for this test.');
  }

  // Check for modern publishable keys
  if (cleanKey.startsWith('sb_publishable_') || cleanKey.startsWith('pk_')) {
    return {
      keyType: 'publishable',
      projectRef: expectedProjectRef || 'unknown',
    };
  }

  // Check for JWT format
  if (cleanKey.startsWith('ey') || cleanKey.includes('.')) {
    const parts = cleanKey.split('.');
    if (parts.length !== 3) {
      throw new Error(
        'Unsupported or malformed Supabase key format (JWT expected 3 segments). Use the Supabase anon key.'
      );
    }

    let payload;
    try {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
      payload = JSON.parse(payloadJson);
    } catch {
      throw new Error('Could not parse Supabase JWT payload.');
    }

    if (payload.role === 'service_role') {
      throw new Error('Supabase service_role key detected. Use the anon/publishable key.');
    }

    if (payload.role && payload.role !== 'anon') {
      throw new Error(`Supabase JWT role is "${payload.role}". Expected "anon". Use the anon key.`);
    }

    const keyRef = payload.ref ? String(payload.ref).toLowerCase() : null;

    if (keyRef && expectedProjectRef && expectedProjectRef.length === 20) {
      if (keyRef !== expectedProjectRef.toLowerCase()) {
        throw new Error(
          `Supabase URL and anon key belong to different projects.\n` +
            `  URL project ref: "${expectedProjectRef}"\n` +
            `  Key project ref: "${keyRef}"\n` +
            `Please set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the same Supabase project.`
        );
      }
    }

    return {
      keyType: 'anon JWT',
      projectRef: keyRef || expectedProjectRef || 'unknown',
    };
  }

  throw new Error('Unsupported or malformed Supabase key format. Use the Supabase anon/publishable key.');
}

/**
 * Validates Supabase API connectivity before beginning test execution.
 */
export async function testSupabaseConnection(supabase) {
  try {
    const { error } = await supabase.from('categories').select('id').limit(1);

    if (error) {
      console.log(`SUPABASE CONNECTION: FAIL (${error.message || 'API request rejected'})`);
      return { connected: false, error: error.message };
    }

    console.log(`SUPABASE CONNECTION: PASS`);
    return { connected: true };
  } catch (err) {
    console.log(`SUPABASE CONNECTION: FAIL (${err.message})`);
    return { connected: false, error: err.message };
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
    const devicePattern = `dev_lt_${runId}_%`;
    const { data: testSessions } = await supabase
      .from('user_sessions')
      .select('user_id, id')
      .like('device_id', devicePattern);

    if (testSessions && testSessions.length > 0) {
      const studentIds = Array.from(new Set(testSessions.map((s) => s.user_id)));

      const { data: testSubs } = await supabase
        .from('vote_submissions')
        .select('id')
        .in('student_id', studentIds);

      if (testSubs && testSubs.length > 0) {
        const subIds = testSubs.map((s) => s.id);
        await supabase.from('vote_items').delete().in('submission_id', subIds);
        await supabase.from('vote_submissions').delete().in('id', subIds);
      }

      await supabase.from('user_sessions').delete().like('device_id', devicePattern);
      await supabase.from('profiles').delete().in('id', studentIds);
    }

    console.log(`  ✅ Cleaned up isolated test records for ${runId}.`);
  } catch (err) {
    console.warn(`  ⚠️ Cleanup warning:`, err.message);
  }
}
