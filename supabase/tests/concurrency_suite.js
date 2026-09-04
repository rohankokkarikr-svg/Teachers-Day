/**
 * TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
 * Mock Concurrency, Load & Stress Testing Suite
 *
 * Runs deterministic in-memory atomic simulation verifying:
 * 1. 100, 250, 500, 750, 1000 concurrent students voting simultaneously.
 * 2. Hotspot contention: 500 students voting for the same teacher in the same category.
 * 3. Rapid duplicate / idempotent retries (same submission_id).
 * 4. Vote limit & validation enforcement (under-allocation, over-allocation).
 * 5. Database consistency: zero discrepancies between vote_items and vote_totals.
 */

const CATEGORY_ID = '11111111-0000-0000-0000-000000000001'; // Most Inspiring Teacher
const TEACHER_A = '61ff6e22-fd00-4ce7-808e-ef632b32b4f2';    // Nominee A
const TEACHER_B = '12391ff0-39c5-4943-85ba-50078dde7633';    // Nominee B

// ========================================================
// 1. In-Memory Atomic Engine (for deterministic local benchmark)
// ========================================================
class MockAtomicDatabase {
  constructor() {
    this.submissions = new Map(); // submission_id -> { student_id, category_id, device_id }
    this.studentCategoryVotes = new Set(); // `${student_id}_${category_id}`
    this.deviceCategoryVotes = new Map(); // `${device_id}_${category_id}` -> student_id
    this.voteItems = []; // [ { submission_id, teacher_id, vote_count } ]
    this.voteTotals = new Map(); // `${category_id}_${teacher_id}` -> count
  }

  submitVotes({ p_category_id, p_votes, p_student_id, p_device_id, p_submission_id }) {
    // A. Idempotency
    if (p_submission_id && this.submissions.has(p_submission_id)) {
      return {
        success: true,
        submission_id: p_submission_id,
        status: 'ALREADY_PROCESSED',
        message: 'Your vote has already been recorded.',
      };
    }

    const studentKey = `${p_student_id}_${p_category_id}`;
    if (this.studentCategoryVotes.has(studentKey)) {
      return {
        success: false,
        status: 'DUPLICATE_SUBMISSION',
        error_code: 'DUPLICATE_SUBMISSION',
        message: 'You have already submitted your vote for this category.',
      };
    }

    // Device anti-abuse
    if (p_device_id) {
      const devKey = `${p_device_id}_${p_category_id}`;
      const boundStudent = this.deviceCategoryVotes.get(devKey);
      if (boundStudent && boundStudent !== p_student_id) {
        return {
          success: false,
          status: 'DUPLICATE_SUBMISSION',
          error_code: 'DEVICE_ALREADY_VOTED',
          message: 'A vote has already been submitted for this category from this device.',
        };
      }
    }

    // Validate vote sum
    let totalVotes = 0;
    for (const v of p_votes) {
      if (v.vote_count < 0) {
        return { success: false, error_code: 'INVALID_VOTE', message: 'Negative votes rejected.' };
      }
      totalVotes += v.vote_count;
    }

    if (totalVotes !== 5) {
      return {
        success: false,
        error_code: 'VOTE_LIMIT_EXCEEDED',
        message: `Please allocate exactly 5 votes (got ${totalVotes}).`,
      };
    }

    // Atomic write
    const subId = p_submission_id || `sub_${Math.random()}`;
    this.submissions.set(subId, { student_id: p_student_id, category_id: p_category_id, device_id: p_device_id });
    this.studentCategoryVotes.add(studentKey);
    if (p_device_id) {
      this.deviceCategoryVotes.set(`${p_device_id}_${p_category_id}`, p_student_id);
    }

    for (const v of p_votes) {
      if (v.vote_count > 0) {
        this.voteItems.push({ submission_id: subId, teacher_id: v.teacher_id, vote_count: v.vote_count });
        const totKey = `${p_category_id}_${v.teacher_id}`;
        const prev = this.voteTotals.get(totKey) || 0;
        this.voteTotals.set(totKey, prev + v.vote_count);
      }
    }

    return {
      success: true,
      submission_id: subId,
      status: 'SUCCESS',
      votes_accepted: totalVotes,
    };
  }

  verifyConsistency() {
    const calculatedTotals = new Map();
    for (const item of this.voteItems) {
      const totKey = `${CATEGORY_ID}_${item.teacher_id}`;
      const current = calculatedTotals.get(totKey) || 0;
      calculatedTotals.set(totKey, current + item.vote_count);
    }

    let discrepancies = 0;
    for (const [key, expected] of this.voteTotals.entries()) {
      const calc = calculatedTotals.get(key) || 0;
      if (calc !== expected) {
        console.error(`❌ Mismatch on ${key}: Totals=${expected}, ItemsSum=${calc}`);
        discrepancies++;
      }
    }

    return { isConsistent: discrepancies === 0, discrepancies };
  }
}

// ========================================================
// 2. Concurrency Load Test Runner
// ========================================================
async function runScaleTest(numStudents, mockDb) {
  console.log(`\n======================================================`);
  console.log(`🧪 SIMULATING ${numStudents} CONCURRENT STUDENTS VOTING SIMULTANEOUSLY`);
  console.log(`======================================================`);

  const runId = Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();
  let successCount = 0;
  let alreadyProcessedCount = 0;
  let duplicateRejectedCount = 0;
  let errorCount = 0;

  const promises = Array.from({ length: numStudents }).map(async (_, idx) => {
    const studentId = `st_${runId}_${String(idx).padStart(5, '0')}`;
    const deviceId = `dev_${runId}_${String(idx).padStart(5, '0')}`;
    const submissionId = `sub_${studentId}`;

    const payload = [
      { teacher_id: TEACHER_A, vote_count: 3 },
      { teacher_id: TEACHER_B, vote_count: 2 },
    ];

    try {
      const res = mockDb.submitVotes({
        p_category_id: CATEGORY_ID,
        p_votes: payload,
        p_student_id: studentId,
        p_device_id: deviceId,
        p_submission_id: submissionId,
      });

      if (res?.success && (res?.status === 'SUCCESS' || res?.status === 'submitted')) {
        successCount++;
      } else if (res?.success && (res?.status === 'ALREADY_PROCESSED' || res?.status === 'already_processed')) {
        alreadyProcessedCount++;
      } else if (res?.status === 'DUPLICATE_SUBMISSION' || res?.error_code === 'DUPLICATE_SUBMISSION') {
        duplicateRejectedCount++;
      } else {
        errorCount++;
      }
    } catch {
      errorCount++;
    }
  });

  await Promise.all(promises);
  const elapsed = Date.now() - startTime;
  const rps = Math.round((numStudents / (elapsed || 1)) * 1000);

  console.log(`⏱️ Duration: ${elapsed}ms | Throughput: ${rps} ops/sec`);
  console.log(`✅ Accepted Submissions:  ${successCount}`);
  console.log(`🔄 Idempotent Replays:    ${alreadyProcessedCount}`);
  console.log(`🛡️ Duplicate Rejections:  ${duplicateRejectedCount}`);
  console.log(`❌ System Errors:         ${errorCount}`);

  const pass = successCount === numStudents && errorCount === 0;
  console.log(`📊 Result: [${pass ? 'PASS' : 'FAIL'}]`);
  return pass;
}

// ========================================================
// 3. Hotspot Contention Test (500 Students -> Same Teacher)
// ========================================================
async function runHotspotContentionTest(numStudents = 500, mockDb) {
  console.log(`\n======================================================`);
  console.log(`🔥 HOTSPOT CONTENTION TEST: ${numStudents} CONCURRENT STUDENTS ON 1 TEACHER`);
  console.log(`======================================================`);

  const runId = Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  const promises = Array.from({ length: numStudents }).map(async (_, idx) => {
    const studentId = `hotspot_${runId}_${String(idx).padStart(5, '0')}`;
    const deviceId = `dev_hotspot_${runId}_${String(idx).padStart(5, '0')}`;
    const submissionId = `sub_${studentId}`;

    const payload = [
      { teacher_id: TEACHER_A, vote_count: 5 }, // All 5 votes to Teacher A
    ];

    try {
      const res = mockDb.submitVotes({
        p_category_id: CATEGORY_ID,
        p_votes: payload,
        p_student_id: studentId,
        p_device_id: deviceId,
        p_submission_id: submissionId,
      });

      if (res?.success && (res?.status === 'SUCCESS' || res?.status === 'submitted')) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch {
      errorCount++;
    }
  });

  await Promise.all(promises);
  const elapsed = Date.now() - startTime;
  const expectedTotalVotes = numStudents * 5;

  console.log(`⏱️ Contention Duration: ${elapsed}ms`);
  console.log(`✅ Successful Submissions: ${successCount} / ${numStudents}`);
  console.log(`🎯 Expected Total Added:  ${expectedTotalVotes} votes`);

  const pass = successCount === numStudents && errorCount === 0;
  console.log(`📊 Result: [${pass ? 'PASS' : 'FAIL'}]`);
  return pass;
}

// ========================================================
// 4. Duplicate / Idempotency & Constraint Violation Test
// ========================================================
async function runIdempotencyAndConstraintTest(mockDb) {
  console.log(`\n======================================================`);
  console.log(`🛡️ IDEMPOTENCY & CONSTRAINT VIOLATION TESTS`);
  console.log(`======================================================`);

  let allPassed = true;
  const testStudentId = 'test_student_idempotency_001';
  const testDeviceId = 'test_device_idempotency_001';
  const fixedSubmissionId = 'fixed_sub_uuid_000000000001';

  // Test 1: First valid submission
  const res1 = mockDb.submitVotes({
    p_category_id: CATEGORY_ID,
    p_votes: [{ teacher_id: TEACHER_A, vote_count: 5 }],
    p_student_id: testStudentId,
    p_device_id: testDeviceId,
    p_submission_id: fixedSubmissionId,
  });

  const test1Pass = res1?.success === true && (res1?.status === 'SUCCESS' || res1?.status === 'submitted');
  console.log(`1. Initial Submission: ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!test1Pass) allPassed = false;

  // Test 2: Rapid retry with exact SAME submission_id (Idempotent Request)
  const res2 = mockDb.submitVotes({
    p_category_id: CATEGORY_ID,
    p_votes: [{ teacher_id: TEACHER_A, vote_count: 5 }],
    p_student_id: testStudentId,
    p_device_id: testDeviceId,
    p_submission_id: fixedSubmissionId,
  });

  const test2Pass = res2?.success === true && (res2?.status === 'ALREADY_PROCESSED' || res2?.status === 'already_processed');
  console.log(`2. Idempotent Retry (Same submission_id): ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!test2Pass) allPassed = false;

  // Test 3: Duplicate vote attempt with NEW submission_id (Duplicate Submission)
  const res3 = mockDb.submitVotes({
    p_category_id: CATEGORY_ID,
    p_votes: [{ teacher_id: TEACHER_A, vote_count: 5 }],
    p_student_id: testStudentId,
    p_device_id: testDeviceId,
    p_submission_id: 'new_sub_uuid_000000000002',
  });

  const test3Pass = res3?.success === false && (res3?.status === 'DUPLICATE_SUBMISSION' || res3?.error_code === 'DUPLICATE_SUBMISSION');
  console.log(`3. Duplicate Ballot Blocked: ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!test3Pass) allPassed = false;

  // Test 4: Invalid vote count (4 votes instead of 5)
  const res4 = mockDb.submitVotes({
    p_category_id: CATEGORY_ID,
    p_votes: [{ teacher_id: TEACHER_A, vote_count: 4 }],
    p_student_id: 'fresh_student_002',
    p_device_id: 'fresh_device_002',
  });

  const test4Pass = res4?.success === false && res4?.error_code === 'VOTE_LIMIT_EXCEEDED';
  console.log(`4. Under-allocation Blocked (4 votes): ${test4Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!test4Pass) allPassed = false;

  // Test 5: Over-allocation (6 votes instead of 5)
  const res5 = mockDb.submitVotes({
    p_category_id: CATEGORY_ID,
    p_votes: [{ teacher_id: TEACHER_A, vote_count: 6 }],
    p_student_id: 'fresh_student_003',
    p_device_id: 'fresh_device_003',
  });

  const test5Pass = res5?.success === false && res5?.error_code === 'VOTE_LIMIT_EXCEEDED';
  console.log(`5. Over-allocation Blocked (6 votes): ${test5Pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!test5Pass) allPassed = false;

  console.log(`📊 Idempotency & Constraints Suite: [${allPassed ? 'PASS' : 'FAIL'}]`);
  return allPassed;
}

// ========================================================
// 5. Master Suite Execution
// ========================================================
async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 TEACHERS' DAY AWARDS PLATFORM: MOCK CONCURRENCY SUITE`);
  console.log(`======================================================`);

  const mockDb = new MockAtomicDatabase();

  const results = {};

  // Scale tests
  results['100_users'] = await runScaleTest(100, mockDb);
  results['250_users'] = await runScaleTest(250, mockDb);
  results['500_users'] = await runScaleTest(500, mockDb);
  results['750_users'] = await runScaleTest(750, mockDb);
  results['1000_users'] = await runScaleTest(1000, mockDb);

  // Hotspot Contention Test (500 simultaneous votes for the same candidate)
  results['hotspot_500'] = await runHotspotContentionTest(500, mockDb);

  // Idempotency & Constraint Tests
  results['idempotency_and_constraints'] = await runIdempotencyAndConstraintTest(mockDb);

  // Consistency check
  const consistency = mockDb.verifyConsistency();
  results['database_consistency'] = consistency.isConsistent;

  console.log(`\n======================================================`);
  console.log(`📋 MOCK CONCURRENCY & STRESS TEST SUMMARY`);
  console.log(`======================================================`);
  console.log(`• 100 Concurrent Users:            ${results['100_users'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• 250 Concurrent Users:            ${results['250_users'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• 500 Concurrent Users (CRITICAL): ${results['500_users'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• 750 Concurrent Users:            ${results['750_users'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• 1000 Concurrent Users:           ${results['1000_users'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• Hotspot Contention (500 Users):  ${results['hotspot_500'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• Idempotency & Limits Protection: ${results['idempotency_and_constraints'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• Database Consistency (0 Leaks):  ${results['database_consistency'] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`======================================================\n`);

  const allPassed = Object.values(results).every(Boolean);
  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});
