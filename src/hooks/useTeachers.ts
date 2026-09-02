import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import type { Teacher } from '../types';

export const INITIAL_FALLBACK_TEACHERS: Teacher[] = [
  { id: '22222222-0000-0000-0000-000000000001', name: 'Dr. Priya Sharma', department: 'Computer Science', subject: 'Data Structures & Algorithms', tagline: 'Making algorithms intuitive and fun!', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000002', name: 'Prof. Rajesh Kumar', department: 'Mathematics', subject: 'Linear Algebra & Calculus', tagline: 'Numbers tell stories if you listen closely.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000003', name: 'Dr. Ananya Desai', department: 'Physics', subject: 'Quantum Mechanics', tagline: 'Exploring the mysteries of the universe.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000004', name: 'Prof. Vikram Singh', department: 'English Literature', subject: 'Modern Communication', tagline: 'Words have the power to change minds.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000005', name: 'Dr. Meera Patel', department: 'Chemistry', subject: 'Organic Chemistry', tagline: 'Chemistry is in everything around us.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000006', name: 'Prof. Arjun Nair', department: 'Electronics', subject: 'Digital System Design', tagline: 'Building tomorrow hardware today.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000007', name: 'Dr. Sunita Rao', department: 'Biotechnology', subject: 'Genetic Engineering', tagline: 'Unraveling the code of life.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
  { id: '22222222-0000-0000-0000-000000000008', name: 'Prof. Kabir Verma', department: 'Mechanical Eng.', subject: 'Thermodynamics', tagline: 'Engineering efficiency in motion.', photo_url: '', is_active: true, created_at: '', updated_at: '' },
];

/**
 * Gets all active teachers from storage or fallback
 */
export function getAllTeachers(): Teacher[] {
  return getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_FALLBACK_TEACHERS);
}

export function useTeachers(categoryId?: string) {
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const all = getAllTeachers().filter((t) => t.is_active !== false);
    if (!categoryId) return all;
    const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});
    const catAssigned = assignments[categoryId] || [];
    const set = new Set(catAssigned);
    return all.filter((t) => set.has(t.id));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeachers = useCallback(async () => {
    const all = getAllTeachers().filter((t) => t.is_active !== false);
    
    if (!categoryId) {
      setTeachers(all);
      setIsLoading(false);
      return;
    }

    const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});
    const catAssigned = assignments[categoryId] || [];
    const set = new Set(catAssigned);
    const filtered = all.filter((t) => set.has(t.id));
    setTeachers(filtered);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase.from('teachers').select('*').eq('is_active', true).order('name');
      
      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Teachers fetch timeout')), 2500)
      );

      const { data, error: fetchErr } = ((await Promise.race([query, timeoutPromise])) as any);

      if (fetchErr) throw fetchErr;

      if (data && data.length > 0) {
        setLocalStorage('td_admin_teachers', data);
        const liveAll = data.filter((t: Teacher) => t.is_active !== false);
        const liveFiltered = liveAll.filter((t: Teacher) => set.has(t.id));
        setTeachers(liveFiltered);
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
