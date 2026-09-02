# 🏆 Teachers' Day Live Voting & Awards Platform 2026

A production-ready, mobile-first, real-time Teachers' Day Live Voting & Awards Platform built for college events supporting **500+ concurrent students**.

---

## 🌟 Core Concept & Voting Rules

Students log in and vote for teachers across multiple award categories.

- **5 Votes Per Category**: Every student receives exactly 5 votes for each award category.
- **Flexible Distribution**: Votes can be distributed freely among candidate teachers in that category.
  - Examples: `5+0+0+0`, `4+1+0+0`, `3+2+0+0`, `2+2+1+0`, `1+1+1+1+1`
- **Strict Server-Side Validation**: The total MUST equal exactly 5 votes before submission. Validated atomically in PostgreSQL database RPC functions—not frontend JavaScript.
- **One Submission Per Category**: Database-level unique constraint (`student_id + category_id`) guarantees no student can vote twice in the same category.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18+, Vite 5+, TypeScript 5+, Tailwind CSS 3.4+ / v4 |
| **Icons & Motion** | Lucide React, Framer Motion |
| **State Management** | React Context (`AuthContext`), Zustand (`appStore`) |
| **Backend & DB** | Supabase (PostgreSQL, Supabase Auth, Supabase Realtime, RPC, RLS) |
| **Routing** | React Router v6 (with lazy loading code-splitting) |
| **Deployment** | Vercel SPA production ready |

---

## 🚀 Key Features

### 📱 Student Experience
1. **Mobile-First Touch UI**: Optimized for 360px–430px smartphone viewports with large tap targets and sticky action bars.
2. **5-Vote Allocation Stepper**: Interactive `[ - ] count [ + ]` controls with progress ring visualization and localStorage draft preservation.
3. **Real-time Live Leaderboard**: Powered by Supabase Realtime—rankings reorder smoothly with Framer Motion layout animations without page refreshes.
4. **Appreciation Wall**: Students can leave anonymous gratitude notes for teachers, moderated by administrators.
5. **Session & Draft Recovery**: Reloading the browser restores unsubmitted vote allocations or shows "Submitted" state if already voted.

### 🛡️ Admin Control Center
1. **Dashboard Overview**: Turnout stats, total votes, participant counts, and real-time activity feed.
2. **Teacher & Category CRUD**: Manage teachers, assign them to award categories, set display order, and upload photo avatars.
3. **Voting Control Center**: One-click global Open/Close voting switch enforced server-side. Toggle exact live count visibility (`show_live_counts`).
4. **Appreciation Moderation**: Queue to Approve, Feature, Reject, or Delete student messages.
5. **Results Finalization & Lock**: Finalize results to lock vote totals permanently. Export results to CSV/Excel.
6. **Projector Event Mode**: Full-screen 16:9 presentation view with 3-stage animated winner reveals (3rd Place 🥉 → 2nd Place 🥈 → Winner 🥇) and keyboard shortcuts.

---

## 📁 Repository Structure

```
d:\Teacher's Day\
├── public/
│   └── favicon.svg                  # Brand SVG favicon
├── src/
│   ├── components/
│   │   ├── ui/                      # Button, Card, Input, Badge, Modal, Toast, Skeleton, Progress, LiveBadge
│   │   ├── layout/                  # Navbar, MobileBottomNav, AdminSidebar, AdminHeader, ProtectedRoute
│   │   ├── voting/                  # Teacher cards & vote stepper
│   │   └── results/                 # Leaderboard component
│   ├── pages/
│   │   ├── student/                 # HomePage, LoginPage, VotePage, CategoryVotePage, LiveResultsPage, AppreciationPage, ProfilePage
│   │   ├── admin/                   # AdminDashboard, AdminTeachers, AdminCategories, AdminVotingControl, AdminParticipation, AdminAppreciation, AdminResults, AdminEventMode
│   │   └── EventModePage.tsx        # Projector 16:9 presentation mode
│   ├── contexts/                    # AuthContext.tsx (Supabase Auth & Session)
│   ├── hooks/                       # useAuth, useVoting, useCategories, useTeachers, useRealtime, useAdmin
│   ├── lib/                         # supabase.ts, constants.ts, utils.ts
│   ├── types/                       # All TypeScript interfaces
│   ├── App.tsx                      # Main app router & layouts
│   └── index.css                    # Tailwind design system & tokens
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # PostgreSQL tables, constraints & indexes
│   │   ├── 002_rls_policies.sql     # Row Level Security policies
│   │   ├── 003_rpc_functions.sql    # Atomic `submit_votes` & leaderboard RPCs
│   │   ├── 004_seed_data.sql        # Seed teachers & categories
│   │   └── 005_auth_triggers.sql    # Auto-profile creation trigger
│   └── tests/
│       └── concurrency_test.js      # Load testing script (100–500 concurrent voters)
├── .env.example
├── vercel.json
└── README.md
```

---

## ⚡ Quick Start & Setup Guide

### 1. Prerequisites
- Node.js v18+ installed
- npm or yarn
- Supabase account & project

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env.local` and add your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database Setup (Supabase SQL Editor)
Execute the migration scripts in order in your Supabase SQL Editor:
1. Run `supabase/migrations/001_initial_schema.sql`
2. Run `supabase/migrations/002_rls_policies.sql`
3. Run `supabase/migrations/003_rpc_functions.sql`
4. Run `supabase/migrations/004_seed_data.sql`
5. Run `supabase/migrations/005_auth_triggers.sql`

### 5. Create an Admin Account
1. Sign up a user through the platform login screen.
2. In Supabase Dashboard → SQL Editor, upgrade the profile to admin:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@college.edu';
```

### 6. Run Development Server
```bash
npm run dev
```

---

## 🔒 Database Security & Server-Side RPC Rules

### Atomic Vote Submission RPC (`submit_votes`)
All vote submissions call `public.submit_votes(p_category_id, p_votes)`:

```sql
SELECT public.submit_votes(
  'category-uuid-here',
  '[{"teacher_id": "teacher-uuid-1", "vote_count": 3}, {"teacher_id": "teacher-uuid-2", "vote_count": 2}]'::jsonb
);
```

**10 Server-Side Validation Checks:**
1. Caller is authenticated (`auth.uid()`).
2. Global voting is open (`is_voting_open = true`).
3. Results are not finalized (`results_finalized = false`).
4. Category exists and is active.
5. Student has NOT already submitted votes for this category (`unique_student_category_vote` check).
6. Vote counts are non-negative integers.
7. Selected teachers belong to the specified category and are active.
8. SUM(vote_count) equals **exactly 5**.
9. Inserts `vote_submissions` and `vote_items` inside a single atomic SQL transaction.
10. Updates `vote_totals` atomically (`total_votes = total_votes + EXCLUDED.total_votes`).

---

## ⚡ Concurrency & Load Testing

To simulate 100+ concurrent students submitting votes simultaneously:

```bash
node supabase/tests/concurrency_test.js
```

---

## 📊 Exporting Results

Admin Dashboard → Results & Finalization → Click **Export CSV**.
Generates a sanitized CSV report with:
- Category Name
- Teacher Name & Department
- Total Vote Counts

---

## 🚢 Production Build & Deployment

### Build Command
```bash
npm run build
```

### Deploy to Vercel
1. Import repository to Vercel.
2. Set environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Vercel automatically uses `vercel.json` for SPA routing rewrites and security headers.
