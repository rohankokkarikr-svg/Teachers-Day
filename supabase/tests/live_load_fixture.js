/**
 * TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
 * Live Load Test Fixture & Environment Discovery Module
 *
 * Prepares a dedicated, safe test environment:
 * 1. Automatically and safely loads environment variables from .env if present.
 * 2. Supports both legacy Supabase anon JWTs and modern publishable keys.
 * 3. Strictly rejects service_role or secret keys.
 * 4. Verifies project reference match between URL and key payload.
 * 5. Verifies database connectivity before running tests.
 * 6. Discovers real active categories & assigned nominees dynamically.
 * 7. Registers real test student sessions via register_or_get_student() RPC.
 * 8. Provides isolated, non-destructive test teardown when enabled.
 */

import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

/**
 * Safely loads environment variables from .env using dotenv.
 */
export function loadEnvironment(customPath) {
  const envPath = customPath || path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath, quiet: true });
}

// Load .env immediately upon import
loadEnvironment();

/**
 * Resolves Supabase URL and Key from environment (with VITE_* priority).
 */
export function resolveSupabaseConfig() {
  loadEnvironment();

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !url.trim()) {
    throw new Error(
      'Supabase URL is missing. Configure VITE_SUPABASE_URL or SUPABASE_URL.'
    );
  }

  if (!anonKey || !anonKey.trim()) {
    throw new Error(
      'Supabase key is missing. Configure VITE_SUPABASE_ANON_KEY with a valid anon/publishable key.'
    );
  }

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
  };
}

/**
 * Extracts the Supabase project reference from the project URL.
 */
export function extractProjectRef(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('Supabase URL is missing. Configure VITE_SUPABASE_URL or SUPABASE_URL.');
  }

  const cleanUrl = url.trim();

  if (
    cleanUrl.includes('your-project') ||
    cleanUrl.includes('your_supabase_url') ||
    cleanUrl.includes('placeholder') ||
    cleanUrl.includes('https://.supabase.co')
  ) {
    throw new Error(
      `Invalid or placeholder Supabase URL ("${cleanUrl}"). Expected production URL: https://vtokjwfefespmkvnnpxz.supabase.co`
    );
  }

  const match = cleanUrl.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.(co|in|net)(?:\/.*)?$/i);
  if (match && match[1] && match[1].length >= 3) {
    return match[1].toLowerCase();
  }

  try {
    const parsed = new URL(cleanUrl);
    if (!parsed.hostname || parsed.hostname.startsWith('.')) {
      throw new Error(`Malformed Supabase URL: "${cleanUrl}".`);
    }
    return parsed.hostname.toLowerCase();
  } catch {
    throw new Error(`Malformed Supabase URL: "${cleanUrl}".`);
  }
}

/**
 * Validates the Supabase key format, ensuring it is a legitimate anon/publishable key
 * and rejecting dangerous service_role or secret keys.
 *
 * Supports:
 * 1. Legacy anon JWT (e.g. 3-part base64url encoded token)
 * 2. Modern publishable keys (e.g. sb_publishable_..., pk_...)
 */
export function validateAndInspectKey(key, expectedProjectRef) {
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error('Supabase key is empty. Configure VITE_SUPABASE_ANON_KEY with a valid anon or publishable key.');
  }

  const cleanKey = key.trim();

  // Check for placeholder values or angle brackets
  if (
    cleanKey.startsWith('<') ||
    cleanKey.endsWith('>') ||
    cleanKey === 'your_real_anon_or_publishable_key' ||
    cleanKey === 'your_anon_or_publishable_key' ||
    cleanKey.toLowerCase().includes('your_real') ||
    cleanKey.toLowerCase().includes('your_anon') ||
    cleanKey.toLowerCase().includes('your-anon') ||
    cleanKey.toLowerCase().includes('placeholder')
  ) {
    throw new Error(
      'Supabase key is currently set to a placeholder. Please provide your real Supabase anon/publishable key.'
    );
  }

  // Reject secret keys immediately
  if (cleanKey.startsWith('sb_secret_') || cleanKey.startsWith('sk_') || cleanKey.startsWith('secret_')) {
    throw new Error('Supabase secret key detected. Do not use secret keys for this test.');
  }

  // 1. Accept modern publishable keys
  if (cleanKey.startsWith('sb_publishable_') || cleanKey.startsWith('pk_')) {
    return {
      keyType: 'publishable',
      projectRef: expectedProjectRef || 'vtokjwfefespmkvnnpxz',
    };
  }

  // 2. Detect and validate JWT format (exactly 3 dot-separated segments)
  const jwtParts = cleanKey.split('.');
  if (jwtParts.length === 3) {
    let payload;
    try {
      let b64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) {
        b64 += '=';
      }
      const payloadJson = Buffer.from(b64, 'base64').toString('utf-8');
      payload = JSON.parse(payloadJson);
    } catch {
      throw new Error('Could not parse Supabase JWT payload.');
    }

    if (payload.role === 'service_role') {
      throw new Error("Service-role key detected. Replace VITE_SUPABASE_ANON_KEY with the project's anon/publishable key.");
    }

    if (payload.role && payload.role !== 'anon') {
      throw new Error(`Supabase key role is "${payload.role}". Expected "anon". Use the Supabase anon key.`);
    }

    const keyRef = payload.ref ? String(payload.ref).toLowerCase() : null;

    if (keyRef && expectedProjectRef && expectedProjectRef.length >= 10) {
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
      projectRef: keyRef || expectedProjectRef || 'vtokjwfefespmkvnnpxz',
    };
  }

  throw new Error('Unsupported or malformed Supabase key format. Expected a 3-part JWT (anon role) or modern sb_publishable_* key.');
}

/**
 * Validates Supabase API connectivity before beginning test execution.
 */
export async function testSupabaseConnection(supabase) {
  try {
    const { error } = await supabase.from('categories').select('id').limit(1);

    if (error) {
      console.log(`SUPABASE CONNECTION: FAIL`);
      console.log(`  Code:    ${error.code || 'API_ERROR'}`);
      console.log(`  Message: ${error.message || 'API request rejected'}`);
      if (error.details) console.log(`  Details: ${error.details}`);
      if (error.hint) console.log(`  Hint:    ${error.hint}`);
      return { connected: false, error: error.message };
    }

    console.log(`SUPABASE CONNECTION: PASS`);
    return { connected: true };
  } catch (err) {
    console.log(`SUPABASE CONNECTION: FAIL`);
    console.log(`  Message: ${err.message}`);
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
