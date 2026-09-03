import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import { INITIAL_TEACHERS_DATA } from '../data/initialTeachers';
import type { Teacher } from '../types';

export const INITIAL_FALLBACK_TEACHERS: Teacher[] = INITIAL_TEACHERS_DATA;

/**
 * Gets all active teachers from storage or fallback (minimum 50+ teachers)
 */
export function getAllTeachers(): Teacher[] {
  return getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_FALLBACK_TEACHERS);
}

export function useTeachers(categoryId?: string) {
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const all = getAllTeachers().filter((t) => t.is_active !== false);
    if (!categoryId) return all;
    const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});
    const catAssigned = assignments[categoryId];
    // If not customized yet, default to all active teachers
    if (!catAssigned) return all;
    const set = new Set(catAssigned);
    return all.filter((t) => set.has(t.id));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeachers = useCallback(async () => {
    const localAll = getAllTeachers().filter((t) => t.is_active !== false);
    const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});
    const catAssigned = categoryId ? assignments[categoryId] : undefined;
    const initialList = categoryId
      ? catAssigned
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

      if (teachersRes.error) throw teachersRes.error;

      if (teachersRes.data && teachersRes.data.length > 0) {
        setLocalStorage('td_admin_teachers', teachersRes.data);
        const liveAll = teachersRes.data.filter((t: Teacher) => t.is_active !== false);

        if (!categoryId) {
          setTeachers(liveAll);
        } else {
          let assignedIds: string[] = [];
          if (assignmentsRes?.data && assignmentsRes.data.length > 0) {
            assignedIds = assignmentsRes.data.map((ct: any) => ct.teacher_id);
            assignments[categoryId] = assignedIds;
            setLocalStorage('td_category_teacher_assignments', assignments);
            const liveSet = new Set(assignedIds);
            setTeachers(liveAll.filter((t: Teacher) => liveSet.has(t.id)));
          } else if (assignments[categoryId]) {
            assignedIds = assignments[categoryId];
            const liveSet = new Set(assignedIds);
            setTeachers(liveAll.filter((t: Teacher) => liveSet.has(t.id)));
          } else {
            // Default to all active teachers if no category-specific restriction
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

    return () => {
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchTeachers]);

  return {
    teachers,
    isLoading,
    error,
    refetch: fetchTeachers,
  };
}
