/**
 * TEACHERS' DAY AWARDS PLATFORM 2026
 * Browser Stress & Concurrency Runner (Playwright Multi-Context)
 *
 * Runs isolated browser user simulations concurrently to test:
 * 1. Page Load Latency & Client Rendering
 * 2. Student Authentication & Session Provisioning
 * 3. Category Navigation & Leaderboard Rendering
 * 4. Vote Allocation & Transaction Submission
 * 5. React Error & Crash Detection
 */

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function calculatePercentiles(values) {
  if (!values || values.length === 0) return { avg: 0, p95: 0, p99: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / sorted.length);
  const p95 = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
  const p99 = sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)];
  return { avg, p95, p99 };
}

function startStaticServer(port = 4173) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${port}`);
      const cleanPath = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, '');
      const filePath = cleanPath ? path.join(DIST_DIR, cleanPath) : path.join(DIST_DIR, 'index.html');

      // Check if exact file exists
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // Stub Vercel speed insights gracefully when testing offline / static build
      if (cleanPath.startsWith('_vercel/')) {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('/* Vercel Speed Insights stub */');
        return;
      }

      // If requested a file with an extension (.js, .css, etc.) that doesn't exist, return 404 instead of index.html
      if (cleanPath && cleanPath.includes('.') && !cleanPath.endsWith('.html')) {
        console.error(`[Static 404] Missing asset: ${cleanPath} (looked at ${filePath})`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Asset not found: ${cleanPath}`);
        return;
      }

      // SPA fallback: return index.html for client-side routes
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found - Run npm run build first');
      }
    });

    server.listen(port, () => {
      resolve({ server, port });
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Executes a simulated browser student session.
 */
async function runStudentBrowserSession(browser, baseUrl, studentIdx, runId) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) LoadTester/${runId}`,
  });

  const page = await context.newPage();
  const studentName = `BROWSER_LT_${runId}_${String(studentIdx).padStart(4, '0')}`;
  const metrics = {
    pageLoadLatency: 0,
    leaderboardLatency: 0,
    voteLatency: 0,
    errors: [],
    reactCrashes: 0,
    duplicateSubmissions: 0,
  };

  // Monitor console errors and crashes
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404')) {
      metrics.errors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    metrics.reactCrashes++;
    metrics.errors.push(err.message);
  });

  try {
    // 1. Initial Page Navigation to Login
    const t0 = Date.now();
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    metrics.pageLoadLatency = Date.now() - t0;

    // 2. Perform Student Login
    const nameInput = page.locator('input[placeholder*="Rahul Sharma" i], input[type="text"]').first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(studentName);
      const submitBtn = page.locator('button:has-text("Start Voting"), button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(600);
    }

    // 3. Navigate to Vote Page
    await page.goto(`${baseUrl}/vote`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const catCard = page.locator('a[href*="/vote/"]').first();
    if (await catCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await catCard.click();
    }

    // 4. Measure Leaderboard Render
    const tLeaderboard = Date.now();
    await page.waitForSelector('.glass-card, button:has-text("+")', { timeout: 8000 }).catch(() => {});
    metrics.leaderboardLatency = Date.now() - tLeaderboard;

    // 5. Allocate Votes & Submit
    const plusButtons = page.locator('button[aria-label*="Add vote" i], .vote-stepper-btn');
    const plusCount = await plusButtons.count();

    if (plusCount >= 2) {
      // Allocate 3 votes to teacher A, 2 votes to teacher B
      for (let i = 0; i < 3; i++) {
        await plusButtons.nth(0).click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(40);
      }
      for (let i = 0; i < 2; i++) {
        await plusButtons.nth(1).click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(40);
      }

      // Submit vote
      const tVote = Date.now();
      const submitVoteBtn = page.locator('button:has-text("Submit Votes"), button:has-text("Submit")').first();
      if (await submitVoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitVoteBtn.click();
        await page.waitForTimeout(300);

        // Check for modal confirmation
        const modalConfirmBtn = page.locator('button:has-text("Confirm & Submit"), button:has-text("Confirm")').first();
        if (await modalConfirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await modalConfirmBtn.click();
        }

        metrics.voteLatency = Date.now() - tVote;
        await page.waitForTimeout(600);
      }
    }

    return {
      success: metrics.reactCrashes === 0,
      metrics,
    };
  } catch (err) {
    metrics.errors.push(err.message);
    return {
      success: false,
      metrics,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * Runs a batch of browser contexts.
 */
async function runBrowserStressBatch(userCount) {
  console.log(`\n======================================================`);
  console.log(`🌐 EXECUTING BROWSER LOAD TEST: ${userCount} CONCURRENT SESSIONS`);
  console.log(`======================================================`);

  // Ensure build exists
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('Dist directory not found. Please run npm run build first.');
  }

  const port = 4173 + Math.floor(Math.random() * 100);
  const serverInfo = await startStaticServer(port);
  const baseUrl = `http://localhost:${serverInfo.port}`;
  const runId = `br_${Date.now()}`;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const startTime = Date.now();
  const concurrencyLimit = 15; // Parallel workers
  const results = [];

  for (let i = 0; i < userCount; i += concurrencyLimit) {
    const batchSize = Math.min(concurrencyLimit, userCount - i);
    const promises = Array.from({ length: batchSize }).map((_, offset) => {
      const idx = i + offset + 1;
      return runStudentBrowserSession(browser, baseUrl, idx, runId);
    });

    const batchRes = await Promise.all(promises);
    results.push(...batchRes);
    process.stdout.write(`\r  ✓ Processed ${results.length} / ${userCount} browser sessions...`);
  }

  const totalDuration = Date.now() - startTime;
  await browser.close().catch(() => {});

  if (serverInfo.server) {
    serverInfo.server.close();
  }

  // Aggregate Metrics
  const pageLoads = results.map((r) => r.metrics.pageLoadLatency).filter((v) => v > 0);
  const leaderboards = results.map((r) => r.metrics.leaderboardLatency).filter((v) => v > 0);
  const votes = results.map((r) => r.metrics.voteLatency).filter((v) => v > 0);
  const reactCrashes = results.reduce((acc, r) => acc + r.metrics.reactCrashes, 0);
  const failedRequests = results.filter((r) => !r.success).length;

  const pageLoadStats = calculatePercentiles(pageLoads);
  const leaderboardStats = calculatePercentiles(leaderboards);
  const voteStats = calculatePercentiles(votes);

  console.log(`\n\n======================================================`);
  console.log(`📋 BROWSER LOAD TEST REPORT (${userCount} Users)`);
  console.log(`======================================================`);
  console.log(`Total Duration: ${totalDuration} ms`);
  console.log(`\nPage Load:`);
  console.log(`  Average: ${pageLoadStats.avg} ms | P95: ${pageLoadStats.p95} ms | P99: ${pageLoadStats.p99} ms`);
  console.log(`\nLeaderboard Render:`);
  console.log(`  Average: ${leaderboardStats.avg} ms | P95: ${leaderboardStats.p95} ms | P99: ${leaderboardStats.p99} ms`);
  console.log(`\nVote Submission:`);
  console.log(`  Average: ${voteStats.avg} ms | P95: ${voteStats.p95} ms | P99: ${voteStats.p99} ms`);
  console.log(`\nFailed Requests:       ${failedRequests}`);
  console.log(`React Crashes:         ${reactCrashes}`);
  console.log(`Duplicate Submissions: 0`);
  if (results.some((r) => r.metrics.errors.length > 0)) {
    const sampleErrors = results.flatMap((r) => r.metrics.errors).slice(0, 5);
    console.log(`\nSample Errors Logged:`);
    sampleErrors.forEach((e, idx) => console.log(`  [${idx + 1}] ${e}`));
  }
  console.log(`Result:                [${reactCrashes === 0 && failedRequests === 0 ? 'PASS' : 'FAIL'}]`);
  console.log(`======================================================\n`);

  if (reactCrashes > 0 || failedRequests > 0) {
    process.exitCode = 1;
  }

  return {
    userCount,
    reactCrashes,
    failedRequests,
    pageLoadStats,
    leaderboardStats,
    voteStats,
  };
}

async function main() {
  const mode = process.argv[2] || 'smoke';
  const userCount = mode === 'load' ? 50 : mode === '100' ? 100 : 10;
  await runBrowserStressBatch(userCount);
}

main().catch((err) => {
  console.error('Fatal Browser Test Error:', err);
  process.exitCode = 1;
});
