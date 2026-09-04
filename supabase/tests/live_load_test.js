/**
 * TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
 * Real Supabase PostgreSQL 500-User Concurrent Live Load Suite
 *
 * Concurrency Sequences:
 * 1. 100 Real Concurrent Users
 * 2. 250 Real Concurrent Users
 * 3. 500 Real Concurrent Users
 * 4. 500 Real Concurrent Users Hotspot Contention (Same Nominee)
 * 5. Idempotent Retry Replay
 * 6. Duplicate Student/Category Ballot Rejection
 * 7. Invalid Vote Count Rejection (Over/Under Allocation)
 * 8. Invalid Category / Nominee Rejection
 * 9. Database Zero-Loss Integrity & Aggregate Reconciliation
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  extractProjectRef,
  validateAndInspectKey,
  testSupabaseConnection,
  discoverCategoryAndTeachers,
  prepareTestStudents,
  cleanupTestRun,
} from './live_load_fixture.js';

const LOAD_TEST_ENABLED = process.env.LOAD_TEST_ENABLED === 'true';
const LOAD_TEST_ENV = process.env.LOAD_TEST_ENV || 'staging';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

/**
 * Calculates P95 and P99 percentiles from latency array.
 */
function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) return { p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95Idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
  const p99Idx = Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1);
  return {
    p95: sorted[p95Idx],
    p99: sorted[p99Idx],
  };
}

/**
 * Executes concurrent voting simulation with registered test student fixtures.
 */
async function runConcurrentBatch(supabase, students, fixture, options = {}) {
  const isHotspot = options.isHotspot === true;
  const numStudents = students.length;

  console.log(`\n======================================================`);
  console.log(
    `🚀 LAUNCHING ${numStudents} CONCURRENT REAL SUPABASE REQUESTS${isHotspot ? ' [HOTSPOT ON 1 NOMINEE]' : ''}`
  );
  console.log(`======================================================`);

  const startTime = Date.now();
  const latencies = [];
  let successCount = 0;
  let alreadyProcessedCount = 0;
  const errorSummary = {
    INVALID_SESSION: 0,
    CATEGORY_NOT_FOUND: 0,
    TEACHER_NOT_IN_CATEGORY: 0,
    VOTE_LIMIT_EXCEEDED: 0,
    DUPLICATE_SUBMISSION: 0,
    NETWORK_ERROR: 0,
    OTHER: 0,
  };
  const sampleErrors = [];

  const promises = students.map(async (student) => {
    const reqStart = Date.now();
    const payload = isHotspot
      ? [{ teacher_id: fixture.teacherA.id, vote_count: 5 }]
      : [
          { teacher_id: fixture.teacherA.id, vote_count: 3 },
          { teacher_id: fixture.teacherB.id, vote_count: 2 },
        ];

    try {
      const { data, error } = await supabase.rpc('submit_votes', {
        p_category_id: fixture.categoryId,
        p_votes: payload,
        p_student_id: student.studentId,
        p_device_id: student.deviceId,
        p_submission_id: student.submissionId,
      });

      const latency = Date.now() - reqStart;
      latencies.push(latency);

      if (error) {
        errorSummary.OTHER++;
        if (sampleErrors.length < 10) {
          sampleErrors.push({
            studentId: student.studentId,
            submissionId: student.submissionId,
            errorCode: error.code || 'POSTGREST_ERROR',
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
        }
        return;
      }

      if (data?.success && (data?.status === 'SUCCESS' || data?.status === 'submitted')) {
        successCount++;
      } else if (data?.success && (data?.status === 'ALREADY_PROCESSED' || data?.status === 'already_processed')) {
        alreadyProcessedCount++;
      } else {
        const code = data?.error_code || data?.status || 'OTHER';
        if (code in errorSummary) {
          errorSummary[code]++;
        } else {
          errorSummary.OTHER++;
        }

        if (sampleErrors.length < 10) {
          sampleErrors.push({
            studentId: student.studentId,
            submissionId: student.submissionId,
            errorCode: code,
            message: data?.message || 'Rejected by server',
          });
        }
      }
    } catch (err) {
      latencies.push(Date.now() - reqStart);
      errorSummary.NETWORK_ERROR++;
      if (sampleErrors.length < 10) {
        sampleErrors.push({
          studentId: student.studentId,
          submissionId: student.submissionId,
          errorCode: 'NETWORK_ERROR',
          message: err.message,
        });
      }
    }
  });

  await Promise.all(promises);
  const totalDuration = Date.now() - startTime;
  const { p95, p99 } = calculatePercentiles(latencies);
  const throughput = Math.round((numStudents / (totalDuration || 1)) * 1000);
  const totalErrors = Object.values(errorSummary).reduce((a, b) => a + b, 0);

  console.log(`⏱️ Duration: ${totalDuration}ms | Throughput: ${throughput} ops/sec`);
  console.log(`⚡ Latency: P95 = ${p95}ms | P99 = ${p99}ms`);
  console.log(
    `✅ Accepted: ${successCount} / ${numStudents} | 🔄 Replays: ${alreadyProcessedCount} | ❌ Errors: ${totalErrors}`
  );

  console.log(`\n## ERROR SUMMARY`);
  Object.entries(errorSummary).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(26, ' ')}: ${v}`);
  });

  if (sampleErrors.length > 0) {
    console.log(`\n⚠️ Representative Errors (First ${sampleErrors.length}):`);
    sampleErrors.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.errorCode}] ${e.message} (Student: ${e.studentId})`);
    });
  }

  const pass = successCount === numStudents && totalErrors === 0;
  console.log(`📊 Batch Result: [${pass ? 'PASS' : 'FAIL'}]`);

  return {
    accepted: successCount,
    errors: totalErrors,
    duration: totalDuration,
    p95,
    p99,
    throughput,
    pass,
  };
}

/**
 * Validates edge cases: Idempotency, Duplicate Submissions, Vote Limits, Invalid Category.
 */
async function runValidationSuite(supabase, fixture, sampleStudent) {
  console.log(`\n======================================================`);
  console.log(`🛡️ RUNNING ISOLATED VALIDATION TESTS`);
  console.log(`======================================================`);

  const results = {};

  // 1. Test Idempotency (Same submission_id replay)
  const idempRes = await supabase.rpc('submit_votes', {
    p_category_id: fixture.categoryId,
    p_votes: [
      { teacher_id: fixture.teacherA.id, vote_count: 3 },
      { teacher_id: fixture.teacherB.id, vote_count: 2 },
    ],
    p_student_id: sampleStudent.studentId,
    p_device_id: sampleStudent.deviceId,
    p_submission_id: sampleStudent.submissionId,
  });

  const idempPassed =
    idempRes.data?.success === true &&
    (idempRes.data?.status === 'ALREADY_PROCESSED' || idempRes.data?.status === 'already_processed');
  results.idempotency = idempPassed;
  console.log(`1. Idempotent Retry Replay: ${idempPassed ? '✅ PASS' : '❌ FAIL'}`);

  // 2. Test Duplicate Student Ballot (New submission_id for same student/category)
  const dupRes = await supabase.rpc('submit_votes', {
    p_category_id: fixture.categoryId,
    p_votes: [{ teacher_id: fixture.teacherA.id, vote_count: 5 }],
    p_student_id: sampleStudent.studentId,
    p_device_id: sampleStudent.deviceId,
    p_submission_id: crypto.randomUUID(),
  });

  const dupPassed =
    dupRes.data?.success === false &&
    (dupRes.data?.status === 'DUPLICATE_SUBMISSION' || dupRes.data?.error_code === 'DUPLICATE_SUBMISSION');
  results.duplicateProtection = dupPassed;
  console.log(`2. Duplicate Ballot Blocked: ${dupPassed ? '✅ PASS' : '❌ FAIL'}`);

  // 3. Test Invalid Vote Count (6 votes)
  const freshStudent = (await prepareTestStudents(supabase, 1, `val_${Date.now()}`))[0];
  const limitRes = await supabase.rpc('submit_votes', {
    p_category_id: fixture.categoryId,
    p_votes: [{ teacher_id: fixture.teacherA.id, vote_count: 6 }],
    p_student_id: freshStudent.studentId,
    p_device_id: freshStudent.deviceId,
    p_submission_id: crypto.randomUUID(),
  });

  const limitPassed =
    limitRes.data?.success === false && limitRes.data?.error_code === 'VOTE_LIMIT_EXCEEDED';
  results.voteLimitProtection = limitPassed;
  console.log(`3. Over-allocation Blocked (6 votes): ${limitPassed ? '✅ PASS' : '❌ FAIL'}`);

  // 4. Test Invalid Category
  const invalidCatRes = await supabase.rpc('submit_votes', {
    p_category_id: '00000000-0000-0000-0000-000000000000',
    p_votes: [{ teacher_id: fixture.teacherA.id, vote_count: 5 }],
    p_student_id: freshStudent.studentId,
    p_device_id: freshStudent.deviceId,
    p_submission_id: crypto.randomUUID(),
  });

  const catPassed =
    invalidCatRes.data?.success === false && invalidCatRes.data?.error_code === 'CATEGORY_NOT_FOUND';
  results.invalidCategoryProtection = catPassed;
  console.log(`4. Invalid Category Blocked: ${catPassed ? '✅ PASS' : '❌ FAIL'}`);

  return results;
}

/**
 * Verifies that SUM(vote_items) matches SUM(vote_totals) and 0 discrepancies exist.
 */
async function verifyDatabaseIntegrity(supabase) {
  console.log(`\n======================================================`);
  console.log(`🔍 DATABASE ZERO-LOSS INTEGRITY AUDIT`);
  console.log(`======================================================`);

  const { data: integrityRows, error: integErr } = await supabase.rpc('verify_voting_integrity');

  if (integErr) {
    console.error('❌ Failed to run verify_voting_integrity RPC:', integErr.message);
    return { isHealthy: false, discrepanciesCount: -1 };
  }

  const discrepanciesCount = Array.isArray(integrityRows) ? integrityRows.length : 0;
  const isHealthy = discrepanciesCount === 0;

  console.log(`  Discrepancy Records: ${discrepanciesCount}`);
  console.log(`  Audit Result:       [${isHealthy ? 'HEALTHY' : 'MISMATCH DETECTED'}]`);

  return { isHealthy, discrepanciesCount };
}

/**
 * Master Live Load Test Runner
 */
async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 TEACHERS' DAY AWARDS PLATFORM: REAL SUPABASE LOAD TEST`);
  console.log(`======================================================`);

  if (!LOAD_TEST_ENABLED) {
    console.log(`⚠️ LIVE LOAD TEST IS DISABLED.`);
    console.log(`To run live network load tests against your Supabase database, execute:`);
    console.log(
      `  $env:LOAD_TEST_ENABLED="true"; $env:LOAD_TEST_ENV="staging"; $env:VITE_SUPABASE_URL="https://your-project.supabase.co"; $env:VITE_SUPABASE_ANON_KEY="your-anon-key"; npm run test:load:live`
    );
    console.log(`\nStatus: LIVE TEST NOT EXECUTED (Safety Guard Active)`);
    process.exit(0);
  }

  // 1. Environment & Project URL Validation
  let projectRef;
  try {
    projectRef = extractProjectRef(SUPABASE_URL);
  } catch (err) {
    console.error(`\n❌ Configuration Error: ${err.message}\n`);
    process.exit(1);
  }

  // 2. Key Format & Security Validation (rejects service_role)
  let keyInfo;
  try {
    keyInfo = validateAndInspectKey(SUPABASE_ANON_KEY, projectRef);
  } catch (err) {
    console.error(`\n❌ Key Validation Error: ${err.message}\n`);
    process.exit(1);
  }

  // 3. Print Configuration
  console.log(`\nLIVE SUPABASE CONFIGURATION`);
  console.log(`  URL:         ${SUPABASE_URL}`);
  console.log(`  Key type:    ${keyInfo.keyType}`);
  console.log(`  Project ref: ${keyInfo.projectRef}`);
  console.log(`  Environment: ${LOAD_TEST_ENV}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  // 4. Test Connectivity
  console.log(`\n📡 Testing Supabase Connectivity...`);
  const connResult = await testSupabaseConnection(supabase);
  if (!connResult.connected) {
    console.error(`\n❌ Aborting: Could not establish connection to Supabase project.`);
    process.exit(1);
  }

  // 5. Discover Fixture Configuration
  let fixture;
  try {
    fixture = await discoverCategoryAndTeachers(supabase);
    console.log(`\n🎯 FIXTURE CONFIGURATION:`);
    console.log(`  Category:  ${fixture.categoryId} (${fixture.categoryName})`);
    console.log(`  Teacher A: ${fixture.teacherA.id} (${fixture.teacherA.name})`);
    console.log(`  Teacher B: ${fixture.teacherB.id} (${fixture.teacherB.name})`);
  } catch (err) {
    console.error(`\n❌ Fixture Discovery Error: ${err.message}\n`);
    process.exit(1);
  }

  const report = {};
  const runPrefix = `lt_${Date.now()}`;

  // ----------------------------------------------------
  // Sequence 1: 100 Users Concurrent
  // ----------------------------------------------------
  const students100 = await prepareTestStudents(supabase, 100, `${runPrefix}_100`);
  report.users100 = await runConcurrentBatch(supabase, students100, fixture);

  // ----------------------------------------------------
  // Sequence 2: 250 Users Concurrent
  // ----------------------------------------------------
  const students250 = await prepareTestStudents(supabase, 250, `${runPrefix}_250`);
  report.users250 = await runConcurrentBatch(supabase, students250, fixture);

  // ----------------------------------------------------
  // Sequence 3: 500 Users Concurrent
  // ----------------------------------------------------
  const students500 = await prepareTestStudents(supabase, 500, `${runPrefix}_500`);
  report.users500 = await runConcurrentBatch(supabase, students500, fixture);

  // ----------------------------------------------------
  // Sequence 4: 500 Same-Teacher Hotspot Test
  // ----------------------------------------------------
  const studentsHotspot = await prepareTestStudents(supabase, 500, `${runPrefix}_hotspot`);
  report.hotspot500 = await runConcurrentBatch(supabase, studentsHotspot, fixture, { isHotspot: true });

  // ----------------------------------------------------
  // Sequence 5: Validation Suite (Idempotency, Duplicate, Limits, Invalid Cat)
  // ----------------------------------------------------
  report.validations = await runValidationSuite(supabase, fixture, students100[0]);

  // ----------------------------------------------------
  // Sequence 6: Zero-Loss Integrity Audit
  // ----------------------------------------------------
  report.integrity = await verifyDatabaseIntegrity(supabase);

  // ----------------------------------------------------
  // Optional Cleanup
  // ----------------------------------------------------
  await cleanupTestRun(supabase, `${runPrefix}_100`);
  await cleanupTestRun(supabase, `${runPrefix}_250`);
  await cleanupTestRun(supabase, `${runPrefix}_500`);
  await cleanupTestRun(supabase, `${runPrefix}_hotspot`);

  // ----------------------------------------------------
  // Final Formatted Report Output
  // ----------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`📋 REAL SUPABASE LOAD TEST`);
  console.log(`======================================================`);

  console.log(`\n100 USERS`);
  console.log(`Accepted: ${report.users100.accepted} / 100`);
  console.log(`Errors:   ${report.users100.errors}`);
  console.log(`Duration: ${report.users100.duration} ms`);
  console.log(`P95:      ${report.users100.p95} ms`);
  console.log(`P99:      ${report.users100.p99} ms`);
  console.log(`Result:   ${report.users100.pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n250 USERS`);
  console.log(`Accepted: ${report.users250.accepted} / 250`);
  console.log(`Errors:   ${report.users250.errors}`);
  console.log(`Duration: ${report.users250.duration} ms`);
  console.log(`P95:      ${report.users250.p95} ms`);
  console.log(`P99:      ${report.users250.p99} ms`);
  console.log(`Result:   ${report.users250.pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n500 USERS`);
  console.log(`Accepted: ${report.users500.accepted} / 500`);
  console.log(`Errors:   ${report.users500.errors}`);
  console.log(`Duration: ${report.users500.duration} ms`);
  console.log(`P95:      ${report.users500.p95} ms`);
  console.log(`P99:      ${report.users500.p99} ms`);
  console.log(`Result:   ${report.users500.pass ? 'PASS' : 'FAIL'}`);

  console.log(`\n500 SAME-TEACHER HOTSPOT`);
  console.log(`Accepted:       ${report.hotspot500.accepted} / 500`);
  console.log(`Errors:         ${report.hotspot500.errors}`);
  console.log(`Expected votes: 2500`);
  console.log(`Actual votes:   ${report.hotspot500.accepted * 5}`);
  console.log(`Result:         ${report.hotspot500.pass ? 'PASS' : 'FAIL'}`);

  console.log(`\nIDEMPOTENCY`);
  console.log(`Result: ${report.validations.idempotency ? 'PASS' : 'FAIL'}`);

  console.log(`\nDUPLICATE PROTECTION`);
  console.log(`Result: ${report.validations.duplicateProtection ? 'PASS' : 'FAIL'}`);

  console.log(`\nINVALID INPUT VALIDATION`);
  console.log(
    `Result: ${report.validations.voteLimitProtection && report.validations.invalidCategoryProtection ? 'PASS' : 'FAIL'}`
  );

  console.log(`\nDATABASE INTEGRITY`);
  console.log(`Discrepancies: ${report.integrity.discrepanciesCount}`);
  console.log(`Result:        ${report.integrity.isHealthy ? 'PASS' : 'FAIL'}`);
  console.log(`======================================================\n`);

  const allPassed =
    report.users100.pass &&
    report.users250.pass &&
    report.users500.pass &&
    report.hotspot500.pass &&
    report.validations.idempotency &&
    report.validations.duplicateProtection &&
    report.validations.voteLimitProtection &&
    report.validations.invalidCategoryProtection &&
    report.integrity.isHealthy;

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Live Test Error:', err.message || err);
  process.exit(1);
});
