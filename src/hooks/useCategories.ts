import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getUserSubmittedCategories } from '../lib/deviceId';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import type { Category } from '../types';

export interface CategoryWithStatus extends Category {
  voted: boolean;
  teacherCount: number;
}

export const INITIAL_FALLBACK_CATEGORIES: Category[] = [
  { id: '11111111-0000-0000-0000-000000000001', name: 'Most Inspiring Teacher', description: 'The teacher who lights the spark of curiosity and encourages students', icon: '✨', display_order: 1, is_active: true, created_at: '', updated_at: '' },
  { id: '11111111-0000-0000-0000-000000000002', name: 'Best Explainer', description: 'Makes even the most complex algorithms, formulas, and theories crystal clear', icon: '💡', display_order: 2, is_active: true, created_at: '', updated_at: '' },
  { id: '11111111-0000-0000-0000-000000000003', name: 'Most Supportive Teacher', description: 'Always available during office hours and goes out of their way to help', icon: '🤝', display_order: 3, is_active: true, created_at: '', updated_at: '' },
  { id: '11111111-0000-0000-0000-000000000004', name: 'Best Motivator', description: 'Pushes you to achieve your absolute best and never lets you give up', icon: '🔥', display_order: 4, is_active: true, created_at: '', updated_at: '' },
  { id: '11111111-0000-0000-0000-000000000005', name: 'Friendliest Teacher', description: 'Creates a warm, welcoming, and open environment in every lecture', icon: '😊', display_order: 5, is_active: true, created_at: '', updated_at: '' },
  { id: '11111111-0000-0000-0000-000000000006', name: 'Most Energetic Teacher', description: 'Brings unmatched passion, enthusiasm, and energy to every single class', icon: '⚡', display_order: 6, is_active: true, created_at: '', updated_at: '' },
  { id: '11111111-0000-0000-0000-000000000007', name: "Students' Favourite Teacher", description: 'The overall most beloved mentor of the college community', icon: '❤️', display_order: 7, is_active: true, created_at: '', updated_at: '' },
];

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
    const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});

    return raw.map((cat) => ({
      ...cat,
      voted: localVoted.has(cat.id),
      teacherCount: assignments[cat.id]?.length ?? 0,
    }));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    const userVotedArray = getUserSubmittedCategories(userId);
    const localVoted = new Set(userVotedArray);
    const raw = getAllCategories().filter((c) => c.is_active !== false);
    raw.sort((a, b) => a.display_order - b.display_order);

    const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});

    const formattedLocal: CategoryWithStatus[] = raw.map((c) => ({
      ...c,
      voted: localVoted.has(c.id),
      teacherCount: assignments[c.id]?.length ?? 0,
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
        .select('category_id');

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
        const teacherCounts: Record<string, number> = {};
        ctRes.data?.forEach((ct: any) => {
          teacherCounts[ct.category_id] = (teacherCounts[ct.category_id] || 0) + 1;
        });

        const votedCategoryIds = new Set<string>(localVoted);
        if (subRes.data) {
          subRes.data.forEach((s: any) => votedCategoryIds.add(s.category_id));
        }

        const formatted: CategoryWithStatus[] = catRes.data.map((cat: any) => ({
          ...cat,
          voted: votedCategoryIds.has(cat.id),
          teacherCount: teacherCounts[cat.id] ?? assignments[cat.id]?.length ?? 0,
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
