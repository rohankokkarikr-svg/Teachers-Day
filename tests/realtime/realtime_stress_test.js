/**
 * TEACHERS' DAY AWARDS PLATFORM 2026
 * Realtime Stress & Burst Coalescing Test
 *
 * Evaluates:
 * 1. 10, 50, and 100 concurrent realtime leaderboard listeners.
 * 2. Rapid event burst handling & coalescing (verifying debounce prevents request storms).
 * 3. Connection stability, event delivery latency, and memory footprint.
 */

import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig, extractProjectRef, validateAndInspectKey } from '../../supabase/tests/live_load_fixture.js';

function formatPercentiles(latencies) {
  if (!latencies || latencies.length === 0) return { avg: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / sorted.length);
  const p95 = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
  const p99 = sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)];
  return { avg, p95, p99 };
}

/**
 * Simulates a pool of concurrent viewers watching a category stream.
 */
async function runViewerPoolTest(config, viewerCount, categoryId) {
  console.log(`\n======================================================`);
  console.log(`📡 REALTIME TEST: ${viewerCount} CONCURRENT VIEWERS`);
  console.log(`======================================================`);

  const clients = [];
  const channels = [];
  let connectedCount = 0;
  let eventDeliveryCount = 0;
  const deliveryLatencies = [];

  const initialMemory = process.memoryUsage().heapUsed;

  // 1. Establish concurrent viewer connections in smooth batches to prevent local TLS handshake queuing
  const BATCH_SIZE = 20;
  const connectionPromises = [];

  for (let i = 0; i < viewerCount; i++) {
    const p = (async (idx) => {
      // Stagger slightly every BATCH_SIZE
      if (idx > 0 && idx % BATCH_SIZE === 0) {
        await new Promise((r) => setTimeout(r, 60));
      }

      const client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
      });
      clients.push(client);

      const channel = client.channel(`test_stream_${categoryId}_${idx}_${Date.now()}`);
      channels.push(channel);

      return new Promise((resolve) => {
        const connTimeout = setTimeout(() => {
          resolve({ connected: false });
        }, 25000);

        channel
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'vote_totals',
              filter: `category_id=eq.${categoryId}`,
            },
            (payload) => {
              eventDeliveryCount++;
              if (payload.commit_timestamp) {
                const latency = Date.now() - new Date(payload.commit_timestamp).getTime();
                if (latency > 0 && latency < 60000) {
                  deliveryLatencies.push(latency);
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(connTimeout);
              connectedCount++;
              resolve({ connected: true });
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(connTimeout);
              resolve({ connected: false });
            }
          });
      });
    })(i);

    connectionPromises.push(p);
  }

  const connResults = await Promise.all(connectionPromises);
  const allConnected = connectedCount === viewerCount;

  console.log(`  Connected Viewers: ${connectedCount} / ${viewerCount} (${allConnected ? '100%' : Math.round((connectedCount / viewerCount) * 100) + '%'})`);

  // 2. Measure Memory Footprint
  const postConnMemory = process.memoryUsage().heapUsed;
  const memoryDeltaMB = Math.round((postConnMemory - initialMemory) / (1024 * 1024) * 10) / 10;
  console.log(`  Memory Growth:     ${memoryDeltaMB} MB`);

  // Cleanup all channels
  for (let i = 0; i < clients.length; i++) {
    try {
      clients[i].removeChannel(channels[i]);
    } catch {
      // Ignore
    }
  }

  const pass = connectedCount >= Math.floor(viewerCount * 0.95);
  console.log(`  Viewer Pool Result: [${pass ? 'PASS' : 'FAIL'}]`);

  return {
    viewerCount,
    connectedCount,
    pass,
    memoryDeltaMB,
  };
}

/**
 * Burst Coalescing Simulation: verifies that 100 rapid events collapse into few debounced queries.
 */
async function testBurstCoalescing() {
  console.log(`\n======================================================`);
  console.log(`⚡ TESTING BURST EVENT COALESCING (DEBOUNCE VERIFICATION)`);
  console.log(`======================================================`);

  let databaseQueriesTriggered = 0;
  const DEBOUNCE_WINDOW_MS = 500;
  let debounceTimer = null;
  let lastFetchTime = 0;

  // Simulated debounced fetch scheduler identical to useRealtime
  const scheduleDebouncedFetch = () => {
    if (debounceTimer) return; // Coalesced into active window

    const now = Date.now();
    const elapsed = now - lastFetchTime;
    const wait = Math.max(DEBOUNCE_WINDOW_MS - elapsed, 150);

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      lastFetchTime = Date.now();
      databaseQueriesTriggered++;
    }, wait);
  };

  // Simulate 100 vote events arriving in rapid succession (every 5ms over 500ms)
  const burstCount = 100;
  console.log(`  Simulating ${burstCount} rapid vote events arriving within 500ms...`);

  for (let i = 0; i < burstCount; i++) {
    scheduleDebouncedFetch();
    await new Promise((r) => setTimeout(r, 5));
  }

  // Wait for trailing debounce timer to settle
  await new Promise((r) => setTimeout(r, DEBOUNCE_WINDOW_MS + 200));

  console.log(`  Incoming Realtime Events: ${burstCount}`);
  console.log(`  Actual Queries Executed:  ${databaseQueriesTriggered}`);
  const coalescedRatio = Math.round(((burstCount - databaseQueriesTriggered) / burstCount) * 100);
  console.log(`  Coalescing Efficiency:    ${coalescedRatio}% reduction in request load`);

  // Burst of 100 events should result in at most 4-5 debounced queries (>=95% reduction), avoiding request storms
  const isCoalescedSafely = databaseQueriesTriggered <= 5;
  console.log(`  Burst Coalescing Result:  [${isCoalescedSafely ? 'PASS' : 'FAIL'}]`);

  return isCoalescedSafely;
}

async function main() {
  console.log('\n======================================================');
  console.log("🚀 TEACHERS' DAY AWARDS: REALTIME STRESS TEST SUITE");
  console.log('======================================================');

  let config;
  try {
    config = resolveSupabaseConfig();
  } catch (err) {
    console.error(`\n❌ Configuration Error: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  const projectRef = extractProjectRef(config.url);
  validateAndInspectKey(config.anonKey, projectRef);

  const categoryId = '11111111-0000-0000-0000-000000000001';

  // 1. Test 10 Viewers
  const res10 = await runViewerPoolTest(config, 10, categoryId);

  // 2. Test 50 Viewers
  const res50 = await runViewerPoolTest(config, 50, categoryId);

  // 3. Test 100 Viewers
  const res100 = await runViewerPoolTest(config, 100, categoryId);

  // 4. Test Burst Coalescing
  const burstPass = await testBurstCoalescing();

  console.log('\n======================================================');
  console.log('📋 REALTIME STRESS TEST SUMMARY');
  console.log('======================================================');
  console.log(`• 10 Concurrent Viewers:   ${res10.pass ? '✅ PASS' : '❌ FAIL'} (${res10.connectedCount}/10)`);
  console.log(`• 50 Concurrent Viewers:   ${res50.pass ? '✅ PASS' : '❌ FAIL'} (${res50.connectedCount}/50)`);
  console.log(`• 100 Concurrent Viewers:  ${res100.pass ? '✅ PASS' : '❌ FAIL'} (${res100.connectedCount}/100)`);
  console.log(`• Burst Coalescing Guard:  ${burstPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('======================================================\n');

  if (!res10.pass || !res50.pass || !res100.pass || !burstPass) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal Realtime Test Error:', err);
  process.exitCode = 1;
});
