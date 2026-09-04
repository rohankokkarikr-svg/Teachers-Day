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

  const fetchTeachers = useCallback(async () => {
    const localAll = getAllTeachers().filter((t) => t.is_active !== false);
    const assignments = getLocalStorage<Record<string, string[]>>(
      'td_category_teacher_assignments',
      INITIAL_CATEGORY_ASSIGNMENTS
    );
    const catAssigned = categoryId ? assignments[categoryId] : undefined;
    const initialList = categoryId
      ? catAssigned !== undefined
        ? localAll.filter((t) => new Set(catAssigned).has(t.id))
        : localAll
      : localAll;
    setTeachers(initialList);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

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

        if (!categoryId) {
          setTeachers(liveAll);
        } else {
          // If Supabase returned category assignment records (even if empty array)
          if (assignmentsRes?.data !== null && assignmentsRes?.data !== undefined && !assignmentsRes.error) {
            const assignedIds: string[] = assignmentsRes.data.map((ct: { teacher_id: string }) => ct.teacher_id);
            assignments[categoryId] = assignedIds;
            setLocalStorage('td_category_teacher_assignments', assignments);
            const liveSet = new Set(assignedIds);
            setTeachers(liveAll.filter((t: Teacher) => liveSet.has(t.id)));
          } else if (assignments[categoryId] !== undefined) {
            const liveSet = new Set(assignments[categoryId]);
            setTeachers(liveAll.filter((t: Teacher) => liveSet.has(t.id)));
          } else {
            setTeachers(liveAll);
          }
        }
      }
    } catch {
      // Keep local cached teachers
    } finally {
      setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchTeachers();

    const handleUpdate = () => {
      fetchTeachers();
    };

    window.addEventListener('td_admin_teachers_updated', handleUpdate);
    window.addEventListener('td_admin_categories_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // 10-second regular database polling loop
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTeachers();
      }
    }, 10000);

    return () => {
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchTeachers]);

  return {
    teachers,
    isLoading,
    error,
    refetch: fetchTeachers,
  };
}
