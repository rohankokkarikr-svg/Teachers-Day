import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getUserSubmittedCategories, syncUserSubmittedCategories } from '../lib/deviceId';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import {
  INITIAL_CATEGORIES_DATA,
  getCategoryTeacherAssignments,
  getDefaultCategoryTeachers,
} from '../data/initialCategories';
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
    const assignments = getCategoryTeacherAssignments();

    return raw.map((cat) => {
      const assignedList = assignments[cat.id] || getDefaultCategoryTeachers(cat);
      return {
        ...cat,
        voted: localVoted.has(cat.id),
        teacherCount: assignedList.length,
      };
    });
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areCategoriesEqual = (a: CategoryWithStatus[], b: CategoryWithStatus[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (
        a[i].id !== b[i].id ||
        a[i].name !== b[i].name ||
        a[i].voted !== b[i].voted ||
        a[i].teacherCount !== b[i].teacherCount ||
        a[i].is_active !== b[i].is_active ||
        a[i].display_order !== b[i].display_order
      ) {
        return false;
      }
    }
    return true;
  };

  const fetchCategories = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);

    // Initial cache sync
    const userVotedArray = getUserSubmittedCategories(userId);
    const localVoted = new Set(userVotedArray);
    const raw = getAllCategories().filter((c) => c.is_active !== false);
    raw.sort((a, b) => a.display_order - b.display_order);
    const assignments = getCategoryTeacherAssignments();

    const localFormatted = raw.map((c) => {
      const assignedList = assignments[c.id] || getDefaultCategoryTeachers(c);
      return {
        ...c,
        voted: localVoted.has(c.id),
        teacherCount: assignedList.length,
      };
    });

    setCategories((prev) => (areCategoriesEqual(prev, localFormatted) ? prev : localFormatted));

    if (!isSupabaseConfigured) {
      if (!isSilent) setIsLoading(false);
      return;
    }

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

        const currentAssignments = getCategoryTeacherAssignments();
        const freshAssignments: Record<string, string[]> = { ...currentAssignments };

        // Only populate from Supabase if ctRes has actual data
        if (ctRes?.data && Array.isArray(ctRes.data) && ctRes.data.length > 0) {
          const remoteGroups: Record<string, string[]> = {};
          ctRes.data.forEach((ct: { category_id: string; teacher_id: string }) => {
            if (!remoteGroups[ct.category_id]) {
              remoteGroups[ct.category_id] = [];
            }
            if (!remoteGroups[ct.category_id].includes(ct.teacher_id)) {
              remoteGroups[ct.category_id].push(ct.teacher_id);
            }
          });

          // Only override categories that have remote records
          Object.entries(remoteGroups).forEach(([catId, tIds]) => {
            if (tIds.length > 0) {
              freshAssignments[catId] = tIds;
            }
          });
        }

        // Ensure all loaded categories have non-empty nominees
        let needsCloudNomineeSync = false;
        catRes.data.forEach((cat: Category) => {
          if (!freshAssignments[cat.id] || freshAssignments[cat.id].length === 0) {
            freshAssignments[cat.id] = getDefaultCategoryTeachers(cat);
            needsCloudNomineeSync = true;
          }
        });

        setLocalStorage('td_category_teacher_assignments', freshAssignments);

        // Auto-heal empty remote category_teachers table
        if (needsCloudNomineeSync || !ctRes?.data || ctRes.data.length === 0) {
          (async () => {
            try {
              await supabase.rpc('sync_system_defaults');
            } catch {
              // Ignore background auto-heal error
            }
          })();
        }

        // Ground truth voted category IDs from Supabase
        const votedCategoryIds = new Set<string>();
        if (subRes?.data) {
          subRes.data.forEach((s: any) => votedCategoryIds.add(s.category_id));
          syncUserSubmittedCategories(Array.from(votedCategoryIds), userId);
        }

        const formatted: CategoryWithStatus[] = catRes.data.map((cat: any) => {
          const assignedList = freshAssignments[cat.id] || getDefaultCategoryTeachers(cat);
          return {
            ...cat,
            voted: votedCategoryIds.has(cat.id),
            teacherCount: assignedList.length,
          };
        });

        setCategories((prev) => (areCategoriesEqual(prev, formatted) ? prev : formatted));
      }
    } catch {
      // Keep local categories
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCategories();

    const handleUpdate = () => {
      fetchCategories(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCategories(true);
      }
    };

    const handleOnline = () => {
      fetchCategories(true);
    };

    window.addEventListener('td_admin_categories_updated', handleUpdate);
    window.addEventListener('td_admin_teachers_updated', handleUpdate);
    window.addEventListener('td_votes_updated', handleUpdate);
    window.addEventListener('td_system_reset', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_votes_updated', handleUpdate);
      window.removeEventListener('td_system_reset', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
  };
}
