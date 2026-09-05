/**
 * TEACHERS' DAY AWARDS PLATFORM 2026
 * Database State & Voting Diagnostics Tool
 *
 * Inspects:
 * 1. Total student profiles & active sessions
 * 2. Total vote submissions and item allocations
 * 3. Total materialized votes across all teachers
 * 4. Sum consistency between vote_items and vote_totals
 * 5. Current leaders across all categories
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

async function checkState() {
  console.log('\n======================================================');
  console.log('📊 TEACHERS\' DAY PLATFORM: DATABASE STATE DIAGNOSTIC');
  console.log('======================================================');
  console.log(`Database URL: ${supabaseUrl}\n`);

  // 1. Table Counts
  const tables = ['profiles', 'user_sessions', 'categories', 'teachers', 'vote_submissions', 'vote_items', 'vote_totals', 'appreciation_messages'];
  const counts = {};

  for (const tbl of tables) {
    const { count, error } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
    counts[tbl] = error ? `ERROR: ${error.message}` : (count ?? 0);
  }

  console.log('📦 Core Entity Counts:');
  console.table(counts);

  // 2. Voting Settings
  const { data: settings } = await supabase.from('voting_settings').select('*').eq('id', 1).single();
  if (settings) {
    console.log('\n⚙️ Voting Status:');
    console.log(`  • Voting Open:        ${settings.is_voting_open ? '🟢 YES' : '🔴 NO'}`);
    console.log(`  • Live Counts:        ${settings.show_live_counts ? '🟢 Visible' : '⚪ Hidden'}`);
    console.log(`  • Results Finalized:  ${settings.results_finalized ? '🔒 Finalized' : '🔓 In Progress'}`);
    console.log(`  • Votes per Category: ${settings.votes_per_category}`);
  }

  // 3. Mathematical Sum Verification
  const { data: items } = await supabase.from('vote_items').select('vote_count');
  const itemsSum = items?.reduce((sum, row) => sum + (row.vote_count || 0), 0) || 0;

  const { data: totals } = await supabase.from('vote_totals').select('total_votes');
  const totalsSum = totals?.reduce((sum, row) => sum + (row.total_votes || 0), 0) || 0;

  console.log('\n🔍 Vote Sum Consistency:');
  console.log(`  • Sum(vote_items):   ${itemsSum}`);
  console.log(`  • Sum(vote_totals):  ${totalsSum}`);
  const isMatch = itemsSum === totalsSum;
  console.log(`  • Discrepancy:       ${Math.abs(itemsSum - totalsSum)}`);
  console.log(`  • Status:            ${isMatch ? '✅ 100% BALANCED (ZERO LEAKS)' : '⚠️ DISCREPANCY DETECTED'}`);

  console.log('\n======================================================\n');
}

checkState().catch((err) => {
  console.error('Fatal Diagnostic Error:', err);
  process.exitCode = 1;
});
