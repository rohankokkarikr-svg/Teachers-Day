import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import { INITIAL_TEACHERS_DATA } from '../data/initialTeachers';
import {
  getCategoryTeacherAssignments,
  getDefaultCategoryTeachers,
} from '../data/initialCategories';
import type { Teacher } from '../types';

export const INITIAL_FALLBACK_TEACHERS: Teacher[] = INITIAL_TEACHERS_DATA;

/**
 * Normalizes a teacher/staff name for fuzzy & resilient matching
 */
export function normalizeTeacherName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(prof\.?|dr\.?|mr\.?|mrs\.?|miss\.?|mis\.?)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Permanent Photo Mapping for all 19 Teaching Faculty and Non-Technical Staff
 */
export const PERMANENT_TEACHER_PHOTOS: Record<string, string> = {
  // Teaching Faculty
  '61ff6e22-fd00-4ce7-808e-ef632b32b4f2': '/teachers/teacher_3.jpeg', // Prof Prashant Kivati.
  '12391ff0-39c5-4943-85ba-50078dde7633': '/teachers/teacher_7.jpeg', // Prof Malikjan Bagwan.
  '2af866ab-bb11-4e75-99d2-309aadffba05': '/teachers/teacher_10.jpeg', // Prof Akshay Hiremath.
  '74a7b656-31a2-4c7a-951a-29405707d463': '/teachers/teacher_8.jpeg', // Prof Krutika Lakkannavar.
  '69880310-6cd0-40d5-80c3-fc257affc81d': '/teachers/teacher_13.jpeg', // Prof Aishwarya Desai.
  '8381a885-2537-462a-8211-0d1443ab4f68': '/teachers/teacher_6.jpeg', // Prof Akshata Pethe.
  '2dcff07e-39d7-4d6a-a72c-4d9b784e10d2': '/teachers/teacher_11.jpeg', // Prof Akshata Vantagodi.
  '365d3ed5-f3c7-47be-b3d9-970b346c2ab2': '/teachers/teacher_9.jpeg', // Prof Anand Bilagi.
  '81beb89b-d752-45ac-9d2c-c44284112679': '/teachers/teacher_19.jpeg', // Prof Anup Kalyanshetti.
  '74cbeffa-e7c2-46b3-9289-4b5f621639e4': '/teachers/teacher_4.jpeg', // Prof Anusha Hiremath.
  '3b7fe6f2-b16e-44ab-b3cc-89f019268d40': '/teachers/teacher_12.jpeg', // Prof Pramod Kugatoli.
  '8dd524fc-cf31-4fec-90ac-9843113d8ff5': '/teachers/teacher_2.jpeg', // Prof Shanta Bhujjanavar.
  '1950874b-1d30-4420-82b3-90649061a0f1': '/teachers/teacher_1.jpeg', // Prof Shilpa Hosamani.
  '633af82e-ca0d-4785-ba7b-08909cc92ce1': '/teachers/teacher_5.jpeg', // Prof Suprita Walvekar.
  '87d77938-d6bb-4197-b1b4-5e12f485e17a': '/teachers/teacher_17.jpeg', // Prof Vinod Jain.

  // Non-Technical Staff
  'f0e5af11-e1de-4a6f-975e-7c0e193693c0': '/teachers/teacher_18.jpeg', // Mr Ravi Bennole.
  'bed87c04-9a5a-46ef-bb0b-4fba71238538': '/teachers/teacher_14.jpeg', // Mr Mahantesh Manaji.
  'b2c9cbda-5158-4e64-8b85-9b245625f864': '/teachers/teacher_15.jpeg', // Mis Mamata Mattikalli.
  '3208c751-30bd-4898-8f17-e22d7fa2e3d5': '/teachers/teacher_16.jpeg', // Mr Sidrayi Nayak.
};

/**
 * Builds resilient photo lookup map by ID and normalized name
 */
function buildPhotoLookup(): Map<string, string> {
  const photoMap = new Map<string, string>();

  // Add all static initial teachers
  INITIAL_FALLBACK_TEACHERS.forEach((t) => {
    if (t.photo_url) {
      photoMap.set(t.id, t.photo_url);
      photoMap.set(normalizeTeacherName(t.name), t.photo_url);
      photoMap.set(t.name.trim().toLowerCase(), t.photo_url);
    }
  });

  // Ensure explicit hardcoded overrides take highest priority
  Object.entries(PERMANENT_TEACHER_PHOTOS).forEach(([id, url]) => {
    photoMap.set(id, url);
  });

  return photoMap;
}

/**
 * Resolves the accurate permanent photo URL for any teacher record
 */
export function resolvePermanentPhoto(teacher: { id?: string; name?: string; photo_url?: string }): string {
  const photoMap = buildPhotoLookup();
  const byId = teacher.id ? photoMap.get(teacher.id) : undefined;
  if (byId) return byId;

  const byNormName = teacher.name ? photoMap.get(normalizeTeacherName(teacher.name)) : undefined;
  if (byNormName) return byNormName;

  const byRawName = teacher.name ? photoMap.get(teacher.name.trim().toLowerCase()) : undefined;
  if (byRawName) return byRawName;

  if (teacher.photo_url && (teacher.photo_url.startsWith('data:') || teacher.photo_url.startsWith('blob:'))) {
    return teacher.photo_url;
  }

  return teacher.photo_url || '';
}

/**
 * Gets all active teachers from storage or fallback, ensuring photos & core staff are permanent
 */
export function getAllTeachers(): Teacher[] {
  const stored = getLocalStorage<Teacher[]>('td_admin_teachers', INITIAL_FALLBACK_TEACHERS);
  const storedMap = new Map<string, Teacher>();
  stored.forEach((t) => storedMap.set(t.id, t));

  // Ensure all 19 core teachers & staff are always present
  const mergedList: Teacher[] = INITIAL_FALLBACK_TEACHERS.map((initT) => {
    const existing = storedMap.get(initT.id);
    const resolvedPhoto = resolvePermanentPhoto(existing || initT);
    return {
      ...(existing || initT),
      name: initT.name,
      department: initT.department,
      photo_url: resolvedPhoto,
      is_active: existing ? existing.is_active : initT.is_active,
    };
  });

  // Also include any custom added teachers created by admin
  stored.forEach((s) => {
    if (!INITIAL_FALLBACK_TEACHERS.some((initT) => initT.id === s.id)) {
      mergedList.push({
        ...s,
        photo_url: resolvePermanentPhoto(s),
      });
    }
  });

  return mergedList;
}

/**
 * Helper to filter teachers for a specific category safely
 */
function getTeachersForCategory(allTeachers: Teacher[], categoryId?: string): Teacher[] {
  const activeAll = allTeachers.filter((t) => t.is_active !== false);
  if (!categoryId) return activeAll;

  const assignments = getCategoryTeacherAssignments();
  let assignedIds = assignments[categoryId];

  if (!assignedIds || assignedIds.length === 0) {
    assignedIds = getDefaultCategoryTeachers({ id: categoryId });
  }

  const set = new Set(assignedIds);
  const filtered = activeAll.filter((t) => set.has(t.id));

  // Robust fallback if filtered array is empty
  if (filtered.length === 0) {
    const isNonTechCategory = categoryId === '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0';
    if (isNonTechCategory) {
      return activeAll.filter(
        (t) =>
          t.department === 'Non-Technical Staff' ||
          t.department?.toLowerCase().includes('non-technical')
      );
    }
    return activeAll.filter(
      (t) =>
        t.department !== 'Non-Technical Staff' &&
        !t.department?.toLowerCase().includes('non-technical')
    );
  }

  return filtered;
}

export function useTeachers(categoryId?: string) {
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const all = getAllTeachers();
    return getTeachersForCategory(all, categoryId);
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

    // Initial cache state
    const localAll = getAllTeachers();
    const localFiltered = getTeachersForCategory(localAll, categoryId);
    setTeachers((prev) => (areTeachersEqual(prev, localFiltered) ? prev : localFiltered));

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
        const fetchedTeachers: Teacher[] = teachersRes.data.map((t: Teacher) => ({
          ...t,
          photo_url: resolvePermanentPhoto(t),
        }));

        // Merge to make sure all 19 permanent staff exist
        const fetchedMap = new Map<string, Teacher>();
        fetchedTeachers.forEach((t) => fetchedMap.set(t.id, t));

        const completeMerged: Teacher[] = INITIAL_FALLBACK_TEACHERS.map((initT) => {
          const remote = fetchedMap.get(initT.id);
          return {
            ...(remote || initT),
            name: initT.name,
            department: initT.department,
            photo_url: resolvePermanentPhoto(remote || initT),
            is_active: remote ? remote.is_active : initT.is_active,
          };
        });

        fetchedTeachers.forEach((t) => {
          if (!INITIAL_FALLBACK_TEACHERS.some((initT) => initT.id === t.id)) {
            completeMerged.push(t);
          }
        });

        setLocalStorage('td_admin_teachers', completeMerged);

        let nextTeachers: Teacher[] = [];
        if (!categoryId) {
          nextTeachers = completeMerged.filter((t: Teacher) => t.is_active !== false);
        } else {
          const freshAssignments = getCategoryTeacherAssignments();

          // Only override from Supabase if assignmentsRes has actual rows
          if (
            assignmentsRes?.data &&
            Array.isArray(assignmentsRes.data) &&
            assignmentsRes.data.length > 0
          ) {
            const assignedIds: string[] = assignmentsRes.data.map((ct: { teacher_id: string }) => ct.teacher_id);
            freshAssignments[categoryId] = assignedIds;
            setLocalStorage('td_category_teacher_assignments', freshAssignments);
          }

          nextTeachers = getTeachersForCategory(completeMerged, categoryId);
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
    window.addEventListener('td_system_reset', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('td_system_reset', handleUpdate);
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
