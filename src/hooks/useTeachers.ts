import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import { INITIAL_TEACHERS_DATA } from '../data/initialTeachers';
import { INITIAL_CATEGORY_ASSIGNMENTS } from '../data/initialCategories';
import type { Teacher } from '../types';

export const INITIAL_FALLBACK_TEACHERS: Teacher[] = INITIAL_TEACHERS_DATA;

/**
 * Gets all active teachers from storage or fallback, ensuring photos are hydrated
 */
export function getAllTeachers(): Teacher[] {
  const stored = getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_FALLBACK_TEACHERS);
  const photoMap = new Map<string, string>();
  INITIAL_FALLBACK_TEACHERS.forEach((initT) => {
    if (initT.photo_url) {
      photoMap.set(initT.id, initT.photo_url);
      photoMap.set(initT.name.trim().toLowerCase(), initT.photo_url);
    }
  });

  return stored.map((t) => ({
    ...t,
    photo_url: t.photo_url?.trim()
      ? t.photo_url
      : photoMap.get(t.id) || photoMap.get(t.name?.trim().toLowerCase()) || '',
  }));
}

export function useTeachers(categoryId?: string) {
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const all = getAllTeachers().filter((t) => t.is_active !== false);
    if (!categoryId) return all;
    const assignments = getLocalStorage<Record<string, string[]>>(
      'td_category_teacher_assignments',
      INITIAL_CATEGORY_ASSIGNMENTS
    );
    const catAssigned = assignments[categoryId];
    if (catAssigned !== undefined) {
      const set = new Set(catAssigned);
      return all.filter((t) => set.has(t.id));
    }
    return all;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areTeachersEqual = (a: Teacher[], b: Teacher[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (
        a[i].id !== b[i].id ||
        a[i].name !== b[i].name ||
        a[i].photo_url !== b[i].photo_url ||
        a[i].department !== b[i].department ||
        a[i].is_active !== b[i].is_active
      ) {
        return false;
      }
    }
    return true;
  };

  const fetchTeachers = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);

    // If local state is empty, initialize from cache
    setTeachers((prev) => {
      if (prev.length > 0) return prev;
      const localAll = getAllTeachers().filter((t) => t.is_active !== false);
      const assignments = getLocalStorage<Record<string, string[]>>(
        'td_category_teacher_assignments',
        INITIAL_CATEGORY_ASSIGNMENTS
      );
      const catAssigned = categoryId ? assignments[categoryId] : undefined;
      return categoryId
        ? catAssigned !== undefined
          ? localAll.filter((t) => new Set(catAssigned).has(t.id))
          : localAll
        : localAll;
    });

    if (!isSupabaseConfigured) {
      if (!isSilent) setIsLoading(false);
      return;
    }

    try {
      const teachersPromise = supabase.from('teachers').select('*').eq('is_active', true).order('name');
      const assignmentsPromise = categoryId
        ? supabase.from('category_teachers').select('teacher_id').eq('category_id', categoryId)
        : Promise.resolve({ data: null, error: null });

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Teachers fetch timeout')), 3000)
      );

      const [teachersRes, assignmentsRes] = (await Promise.race([
        Promise.all([teachersPromise, assignmentsPromise]),
        timeoutPromise,
      ])) as any;

      if (teachersRes.data && teachersRes.data.length > 0) {
        // Fallback photo lookup map
        const photoMap = new Map<string, string>();
        INITIAL_TEACHERS_DATA.forEach((initT) => {
          if (initT.photo_url) {
            photoMap.set(initT.id, initT.photo_url);
            photoMap.set(initT.name.trim().toLowerCase(), initT.photo_url);
          }
        });

        const mergedList: Teacher[] = teachersRes.data.map((t: Teacher) => ({
          ...t,
          photo_url: t.photo_url?.trim()
            ? t.photo_url
            : photoMap.get(t.id) || photoMap.get(t.name?.trim().toLowerCase()) || '',
        }));

        setLocalStorage('td_admin_teachers', mergedList);
        const liveAll = mergedList.filter((t: Teacher) => t.is_active !== false);

        let nextTeachers: Teacher[] = [];
        if (!categoryId) {
          nextTeachers = liveAll;
        } else {
          const assignments = getLocalStorage<Record<string, string[]>>(
            'td_category_teacher_assignments',
            INITIAL_CATEGORY_ASSIGNMENTS
          );
          if (assignmentsRes?.data !== null && assignmentsRes?.data !== undefined && !assignmentsRes.error) {
            const assignedIds: string[] = assignmentsRes.data.map((ct: { teacher_id: string }) => ct.teacher_id);
            assignments[categoryId] = assignedIds;
            setLocalStorage('td_category_teacher_assignments', assignments);
            const liveSet = new Set(assignedIds);
            nextTeachers = liveAll.filter((t: Teacher) => liveSet.has(t.id));
          } else if (assignments[categoryId] !== undefined) {
            const liveSet = new Set(assignments[categoryId]);
            nextTeachers = liveAll.filter((t: Teacher) => liveSet.has(t.id));
          } else {
            nextTeachers = liveAll;
          }
        }

        setTeachers((prev) => (areTeachersEqual(prev, nextTeachers) ? prev : nextTeachers));
      }
    } catch {
      // Keep local cached teachers
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchTeachers();

    const handleUpdate = () => {
      fetchTeachers(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTeachers(true);
      }
    };

    window.addEventListener('td_admin_teachers_updated', handleUpdate);
    window.addEventListener('td_admin_categories_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchTeachers]);

  return {
    teachers,
    isLoading,
    error,
    refetch: fetchTeachers,
  };
}
