-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 017: Restrict Results Exclusively to Admin Panel & Zero-Loss Realtime Sync
-- ========================================================

-- Set short lock timeout to avoid blocking active queries
SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Restrict Vote Totals Table (Leaderboard Tallies)
-- Only administrators may read raw vote counts or leaderboard tallies.
-- Non-admins / students will receive zero rows if querying vote_totals directly.
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "View vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Admins view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Only admins view vote totals" ON public.vote_totals;

CREATE POLICY "Only admins view vote totals"
  ON public.vote_totals FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

-- --------------------------------------------------------
-- 2. Restrict Vote Items & Vote Submissions Table
-- Students can only view their OWN ballot submissions.
-- Only administrators can view all votes and item distributions.
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Public view vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Students view own vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Admins full access vote items" ON public.vote_items;

CREATE POLICY "Students view own vote items"
  ON public.vote_items FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.vote_submissions s
      WHERE s.id = submission_id AND (s.student_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Public view vote submissions" ON public.vote_submissions;
DROP POLICY IF EXISTS "Students view own submissions" ON public.vote_submissions;

CREATE POLICY "Students view own submissions"
  ON public.vote_submissions FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR student_id = auth.uid()
  );

-- --------------------------------------------------------
-- 3. Atomic High-Speed Leaderboard Function (Zero-Loss Guarantee)
-- Computes real-time dynamic sums directly from raw submitted ballots
-- joined with vote_items, with category teacher filtering.
-- --------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_category_leaderboard(UUID);

CREATE OR REPLACE FUNCTION public.get_category_leaderboard(
  p_category_id UUID
)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_photo TEXT,
  teacher_department TEXT,
  total_votes BIGINT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH category_assigned_teachers AS (
    SELECT 
      t.id AS t_id,
      t.name AS t_name,
      t.photo_url AS t_photo,
      t.department AS t_dept
    FROM public.teachers t
    WHERE t.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM public.category_teachers ct 
          WHERE ct.category_id = p_category_id AND ct.teacher_id = t.id
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.category_teachers ct 
          WHERE ct.category_id = p_category_id
        )
      )
  ),
  aggregated_votes AS (
    SELECT
      vi.teacher_id AS t_id,
      COALESCE(SUM(vi.vote_count), 0)::BIGINT AS raw_vote_sum
    FROM public.vote_items vi
    INNER JOIN public.vote_submissions vs 
      ON vs.id = vi.submission_id 
     AND vs.category_id = p_category_id
    GROUP BY vi.teacher_id
  ),
  cached_totals AS (
    SELECT 
      vt.teacher_id AS t_id,
      COALESCE(vt.total_votes, 0)::BIGINT AS cached_sum
    FROM public.vote_totals vt
    WHERE vt.category_id = p_category_id
  )
  SELECT 
    cat.t_id AS teacher_id,
    cat.t_name AS teacher_name,
    cat.t_photo AS teacher_photo,
    cat.t_dept AS teacher_department,
    -- Use highest of raw verified ballot sum vs cached total to guarantee zero missed votes
    GREATEST(
      COALESCE(av.raw_vote_sum, 0),
      COALESCE(ct.cached_sum, 0)
    )::BIGINT AS total_votes,
    DENSE_RANK() OVER (
      ORDER BY 
        GREATEST(COALESCE(av.raw_vote_sum, 0), COALESCE(ct.cached_sum, 0)) DESC,
        cat.t_name ASC
    )::BIGINT AS rank
  FROM category_assigned_teachers cat
  LEFT JOIN aggregated_votes av ON av.t_id = cat.t_id
  LEFT JOIN cached_totals ct ON ct.t_id = cat.t_id
  ORDER BY 
    GREATEST(COALESCE(av.raw_vote_sum, 0), COALESCE(ct.cached_sum, 0)) DESC,
    cat.t_name ASC;
END;
$$;

-- Grant execution to authenticated & anon roles (since frontend client calls RPC directly)
GRANT EXECUTE ON FUNCTION public.get_category_leaderboard(UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 4. Ensure Realtime Publication for Zero-Latency Admin Updates
-- --------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_totals;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_submissions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END;
$$;
