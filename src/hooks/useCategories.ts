import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getUserSubmittedCategories } from '../lib/deviceId';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import { INITIAL_CATEGORIES_DATA, INITIAL_CATEGORY_ASSIGNMENTS } from '../data/initialCategories';
import type { Category } from '../types';

export interface CategoryWithStatus extends Category {
  voted: boolean;
  teacherCount: number;
}

export const INITIAL_FALLBACK_CATEGORIES: Category[] = INITIAL_CATEGORIES_DATA;

/**
 * Gets all active categories from storage or fallback
 */
export function getAllCategories(): Category[] {
  return getLocalStorage<Category[]>('td_admin_categories', INITIAL_FALLBACK_CATEGORIES);
}

export function useCategories(userId?: string) {
  const [categories, setCategories] = useState<CategoryWithStatus[]>(() => {
    const raw = getAllCategories().filter((c) => c.is_active !== false);
    raw.sort((a, b) => a.display_order - b.display_order);
    const userVotedArray = getUserSubmittedCategories(userId);
    const localVoted = new Set(userVotedArray);
    const assignments = getLocalStorage<Record<string, string[]>>(
      'td_category_teacher_assignments',
      INITIAL_CATEGORY_ASSIGNMENTS
    );

    return raw.map((cat) => ({
      ...cat,
      voted: localVoted.has(cat.id),
      teacherCount: assignments[cat.id] ? assignments[cat.id].length : 0,
    }));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    const userVotedArray = getUserSubmittedCategories(userId);
    const localVoted = new Set(userVotedArray);
    const raw = getAllCategories().filter((c) => c.is_active !== false);
    raw.sort((a, b) => a.display_order - b.display_order);

    const assignments = getLocalStorage<Record<string, string[]>>(
      'td_category_teacher_assignments',
      INITIAL_CATEGORY_ASSIGNMENTS
    );

    const formattedLocal: CategoryWithStatus[] = raw.map((c) => ({
      ...c,
      voted: localVoted.has(c.id),
      teacherCount: assignments[c.id] ? assignments[c.id].length : 0,
    }));

    setCategories(formattedLocal);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const catsPromise = supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      const countPromise = supabase
        .from('category_teachers')
        .select('category_id, teacher_id');

      const subPromise = userId
        ? supabase.from('vote_submissions').select('category_id').eq('student_id', userId)
        : Promise.resolve({ data: [] });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Categories fetch timeout')), 2500)
      );

      const [catRes, ctRes, subRes] = (await Promise.race([
        Promise.all([catsPromise, countPromise, subPromise]),
        timeoutPromise,
      ])) as any;

      if (catRes?.data && catRes.data.length > 0) {
        setLocalStorage('td_admin_categories', catRes.data);

        // Group category assignments
        const teacherCounts: Record<string, number> = {};
        const freshAssignments: Record<string, string[]> = { ...assignments };

        // Initialize fresh assignments for loaded categories
        catRes.data.forEach((cat: Category) => {
          freshAssignments[cat.id] = [];
        });

        if (ctRes?.data) {
          ctRes.data.forEach((ct: { category_id: string; teacher_id: string }) => {
            teacherCounts[ct.category_id] = (teacherCounts[ct.category_id] || 0) + 1;
            if (!freshAssignments[ct.category_id]) {
              freshAssignments[ct.category_id] = [];
            }
            if (!freshAssignments[ct.category_id].includes(ct.teacher_id)) {
              freshAssignments[ct.category_id].push(ct.teacher_id);
            }
          });
        }

        setLocalStorage('td_category_teacher_assignments', freshAssignments);

        const votedCategoryIds = new Set<string>(localVoted);
        if (subRes.data) {
          subRes.data.forEach((s: any) => votedCategoryIds.add(s.category_id));
        }

        const formatted: CategoryWithStatus[] = catRes.data.map((cat: any) => ({
          ...cat,
          voted: votedCategoryIds.has(cat.id),
          teacherCount: teacherCounts[cat.id] ?? 0,
        }));
        setCategories(formatted);
      }
    } catch {
      // Keep local categories
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCategories();

    const handleUpdate = () => {
      fetchCategories();
    };

    window.addEventListener('td_admin_categories_updated', handleUpdate);
    window.addEventListener('td_admin_teachers_updated', handleUpdate);
    window.addEventListener('td_votes_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_votes_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
  };
}
