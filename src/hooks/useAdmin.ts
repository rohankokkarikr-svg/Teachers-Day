import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage, setLocalStorage, exportToCSV } from '../lib/utils';
import type { Teacher, Category, VotingSettings, AdminAction } from '../types';

export interface SystemStats {
  totalStudents: number;
  totalParticipants: number;
  participationRate: number;
  totalCategories: number;
  totalVotes: number;
}

const DEFAULT_SETTINGS: VotingSettings = {
  id: '1',
  is_voting_open: true,
  show_live_counts: true,
  results_finalized: false,
  votes_per_category: 5,
  updated_at: new Date().toISOString(),
};

const DEFAULT_STATS: SystemStats = {
  totalStudents: 0,
  totalParticipants: 0,
  participationRate: 0,
  totalCategories: 7,
  totalVotes: 0,
};

const DEFAULT_ACTIONS: AdminAction[] = [];

export function useAdmin() {
  const [stats, setStats] = useState<SystemStats>(DEFAULT_STATS);
  const [settings, setSettings] = useState<VotingSettings | null>(() => getLocalStorage<VotingSettings>('td_admin_settings', DEFAULT_SETTINGS));
  const [recentActions, setRecentActions] = useState<AdminAction[]>(() => getLocalStorage<AdminAction[]>('td_admin_actions', DEFAULT_ACTIONS));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to log admin action locally and to DB
  const logAction = async (action: string, details?: Record<string, unknown>) => {
    const newAction: AdminAction = {
      id: 'act-' + Date.now(),
      admin_id: 'admin-user',
      action,
      details,
      created_at: new Date().toISOString(),
    };

    const existing = getLocalStorage<AdminAction[]>('td_admin_actions', DEFAULT_ACTIONS);
    const updated = [newAction, ...existing.slice(0, 19)];
    setLocalStorage('td_admin_actions', updated);
    setRecentActions(updated);

    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('admin_actions').insert({
            admin_id: user.id,
            action,
            details,
          });
        }
      } catch {
        // Non-critical audit logging error
      }
    }
  };

  // Fetch admin dashboard overview stats
  const fetchDashboardData = useCallback(async () => {
    // Read local real voting tallies
    const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
    let localTotalVotes = 0;
    Object.values(localTotals).forEach((catMap) => {
      Object.values(catMap).forEach((v) => {
        localTotalVotes += v;
      });
    });

    const rawRegistered = getLocalStorage<string[]>('td_registered_students', []);
    const localAuditLog = getLocalStorage<any[]>('td_device_audit_log', []);
    const voterSet = new Set<string>();
    localAuditLog.forEach((log) => {
      if (log.user_id && log.user_id !== 'anonymous') {
        voterSet.add(log.user_id);
      }
    });

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('td_submitted_categories_')) {
        const uId = key.replace('td_submitted_categories_', '');
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(list) && list.length > 0 && uId !== 'guest') {
            voterSet.add(uId);
          }
        } catch {
          // Ignore
        }
      }
    }

    const uniqueVoters = voterSet.size;
    const totalRegistered = Math.max(rawRegistered.length, uniqueVoters);
    const rate = totalRegistered > 0 ? Math.min(100, Math.round((uniqueVoters / totalRegistered) * 100)) : 0;
    const allCats = getLocalStorage<Category[]>('td_admin_categories', []);

    const computedLocalStats: SystemStats = {
      totalStudents: totalRegistered,
      totalParticipants: uniqueVoters,
      participationRate: rate,
      totalCategories: allCats.length || 7,
      totalVotes: localTotalVotes,
    };

    if (!isSupabaseConfigured) {
      const storedSettings = getLocalStorage<VotingSettings>('td_admin_settings', DEFAULT_SETTINGS);
      const storedActions = getLocalStorage<AdminAction[]>('td_admin_actions', DEFAULT_ACTIONS);
      setSettings(storedSettings);
      setStats(computedLocalStats);
      setRecentActions(storedActions);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const settingsPromise = supabase
        .from('voting_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const studentPromise = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student');

      const subPromise = supabase
        .from('vote_submissions')
        .select('student_id');

      const catPromise = supabase
        .from('categories')
        .select('id', { count: 'exact', head: true });

      const totalsPromise = supabase
        .from('vote_totals')
        .select('total_votes');

      const actionsPromise = supabase
        .from('admin_actions')
        .select('*, admin:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Admin stats timeout')), 2500)
      );

      const [settingsRes, studentRes, subRes, catRes, totalsRes, actionsRes] = (await Promise.race([
        Promise.all([settingsPromise, studentPromise, subPromise, catPromise, totalsPromise, actionsPromise]),
        timeoutPromise,
      ])) as any;

      if (settingsRes?.data) {
        setSettings(settingsRes.data as VotingSettings);
        setLocalStorage('td_admin_settings', settingsRes.data);
      }

      const totalStudents = Math.max(studentRes?.count ?? 0, totalRegistered);
      const uniqueStudents = new Set((subRes?.data || []).map((s: any) => s.student_id));
      const totalParticipants = Math.max(uniqueStudents.size, uniqueVoters);
      const cloudRate = totalStudents > 0 ? Math.min(100, Math.round((totalParticipants / totalStudents) * 100)) : 0;
      const totalCategories = catRes?.count || allCats.length || 7;
      const totalVotes = (totalsRes?.data || []).reduce((sum: number, item: any) => sum + (item.total_votes || 0), 0) || localTotalVotes;

      const liveStats: SystemStats = {
        totalStudents,
        totalParticipants,
        participationRate: cloudRate,
        totalCategories,
        totalVotes,
      };

      setStats(liveStats);
      setLocalStorage('td_admin_stats', liveStats);

      if (actionsRes?.data) {
        setRecentActions(actionsRes.data as AdminAction[]);
        setLocalStorage('td_admin_actions', actionsRes.data);
      }
    } catch {
      setStats(computedLocalStats);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Toggle Voting Open / Closed
  const toggleVotingOpen = async (isOpen: boolean): Promise<{ success: boolean; error?: string }> => {
    const updatedSettings: VotingSettings = {
      ...(settings || DEFAULT_SETTINGS),
      is_voting_open: isOpen,
      updated_at: new Date().toISOString(),
    };

    setSettings(updatedSettings);
    setLocalStorage('td_admin_settings', updatedSettings);
    await logAction(isOpen ? 'Global Voting Opened' : 'Global Voting Closed');
    window.dispatchEvent(new Event('td_admin_settings_updated'));

    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('voting_settings')
        .update({ is_voting_open: isOpen, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update voting status';
      return { success: false, error: msg };
    }
  };

  // Toggle Show Live Counts
  const toggleShowLiveCounts = async (show: boolean): Promise<{ success: boolean; error?: string }> => {
    const updatedSettings: VotingSettings = {
      ...(settings || DEFAULT_SETTINGS),
      show_live_counts: show,
      updated_at: new Date().toISOString(),
    };

    setSettings(updatedSettings);
    setLocalStorage('td_admin_settings', updatedSettings);
    await logAction(show ? 'Show Live Counts Enabled' : 'Live Counts Hidden');
    window.dispatchEvent(new Event('td_admin_settings_updated'));

    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('voting_settings')
        .update({ show_live_counts: show, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update count display setting';
      return { success: false, error: msg };
    }
  };

  // Finalize Results
  const finalizeResults = async (finalize: boolean): Promise<{ success: boolean; error?: string }> => {
    const updatedSettings: VotingSettings = {
      ...(settings || DEFAULT_SETTINGS),
      results_finalized: finalize,
      is_voting_open: finalize ? false : settings?.is_voting_open ?? true,
      updated_at: new Date().toISOString(),
    };

    setSettings(updatedSettings);
    setLocalStorage('td_admin_settings', updatedSettings);
    await logAction(finalize ? 'Results Finalized & Locked' : 'Results Unlocked');
    window.dispatchEvent(new Event('td_admin_settings_updated'));

    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('voting_settings')
        .update({
          results_finalized: finalize,
          is_voting_open: finalize ? false : settings?.is_voting_open,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update results status';
      return { success: false, error: msg };
    }
  };

  // CRUD Teacher
  const saveTeacher = async (teacher: Partial<Teacher>): Promise<{ success: boolean; error?: string }> => {
    const teacherList = getLocalStorage<Teacher[]>('td_admin_teachers', []);
    const teacherId = teacher.id || `teacher-${Date.now()}`;
    const fullTeacher: Teacher = {
      id: teacherId,
      name: teacher.name || 'New Teacher',
      department: teacher.department || 'General',
      subject: teacher.subject || '',
      tagline: teacher.tagline || '',
      photo_url: teacher.photo_url || '',
      is_active: teacher.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingIdx = teacherList.findIndex((t) => t.id === teacherId);
    let updatedList: Teacher[];
    if (existingIdx >= 0) {
      updatedList = [...teacherList];
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...teacher, updated_at: new Date().toISOString() };
    } else {
      updatedList = [fullTeacher, ...teacherList];
    }

    setLocalStorage('td_admin_teachers', updatedList);
    await logAction(teacher.id ? 'Teacher Profile Updated' : 'New Teacher Added', { name: teacher.name });
    window.dispatchEvent(new Event('td_admin_teachers_updated'));

    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      if (teacher.id) {
        const { error } = await supabase.from('teachers').update({
          name: teacher.name,
          department: teacher.department,
          subject: teacher.subject,
          tagline: teacher.tagline,
          photo_url: teacher.photo_url,
          is_active: teacher.is_active,
        }).eq('id', teacher.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('teachers').insert({
          name: teacher.name,
          department: teacher.department,
          subject: teacher.subject,
          tagline: teacher.tagline,
          photo_url: teacher.photo_url,
          is_active: teacher.is_active ?? true,
        }).select().single();
        if (error) throw error;
        if (data) {
          const idx = updatedList.findIndex(t => t.id === teacherId);
          if (idx >= 0) {
            updatedList[idx] = data as Teacher;
            setLocalStorage('td_admin_teachers', updatedList);
          }
          // Automatically assign new teacher to all categories
          const { data: cats } = await supabase.from('categories').select('id');
          if (cats && cats.length > 0) {
            const ctRecords = cats.map(c => ({ category_id: c.id, teacher_id: data.id }));
            await supabase.from('category_teachers').upsert(ctRecords, { onConflict: 'category_id,teacher_id' });
          }
        }
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save teacher';
      return { success: false, error: msg };
    }
  };

  // CRUD Category
  const saveCategory = async (category: Partial<Category>): Promise<{ success: boolean; error?: string }> => {
    const categoryList = getLocalStorage<Category[]>('td_admin_categories', []);
    const categoryId = category.id || `cat-${Date.now()}`;
    const fullCategory: Category = {
      id: categoryId,
      name: category.name || 'New Award Category',
      description: category.description || '',
      icon: category.icon || '🏆',
      display_order: category.display_order ?? (categoryList.length + 1),
      is_active: category.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingIdx = categoryList.findIndex((c) => c.id === categoryId);
    let updatedList: Category[];
    if (existingIdx >= 0) {
      updatedList = [...categoryList];
      updatedList[existingIdx] = { ...updatedList[existingIdx], ...category, updated_at: new Date().toISOString() };
    } else {
      updatedList = [...categoryList, fullCategory];
    }

    setLocalStorage('td_admin_categories', updatedList);
    await logAction(category.id ? 'Category Updated' : 'New Category Created', { name: category.name });
    window.dispatchEvent(new Event('td_admin_categories_updated'));

    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      if (category.id) {
        const { error } = await supabase.from('categories').update({
          name: category.name,
          description: category.description,
          icon: category.icon,
          display_order: category.display_order,
          is_active: category.is_active,
        }).eq('id', category.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('categories').insert({
          name: category.name,
          description: category.description,
          icon: category.icon,
          display_order: category.display_order ?? (categoryList.length + 1),
          is_active: category.is_active ?? true,
        }).select().single();
        if (error) throw error;
        if (data) {
          const idx = updatedList.findIndex(c => c.id === categoryId);
          if (idx >= 0) {
            updatedList[idx] = data as Category;
            setLocalStorage('td_admin_categories', updatedList);
          }
          // Assign all active teachers to new category
          const { data: teachers } = await supabase.from('teachers').select('id').eq('is_active', true);
          if (teachers && teachers.length > 0) {
            const ctRecords = teachers.map(t => ({ category_id: data.id, teacher_id: t.id }));
            await supabase.from('category_teachers').upsert(ctRecords, { onConflict: 'category_id,teacher_id' });
          }
        }
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save category';
      return { success: false, error: msg };
    }
  };

  // Export Results to CSV
  const exportResultsCSV = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
      const rows: any[] = [];
      Object.entries(localTotals).forEach(([catId, tMap]) => {
        Object.entries(tMap).forEach(([tId, count]) => {
          rows.push({
            Category_ID: catId,
            Teacher_ID: tId,
            'Total Votes': count,
          });
        });
      });

      exportToCSV(rows.length > 0 ? rows : [{ Status: 'No votes submitted yet' }], `teachers_day_results_${new Date().toISOString().slice(0, 10)}`);
      await logAction('Exported Results CSV');
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export CSV';
      return { success: false, error: msg };
    }
  };

  // Delete Teacher
  const deleteTeacher = async (teacherId: string): Promise<{ success: boolean; error?: string }> => {
    const teacherList = getLocalStorage<Teacher[]>('td_admin_teachers', []);
    const teacherToDelete = teacherList.find((t) => t.id === teacherId);
    const updatedList = teacherList.filter((t) => t.id !== teacherId);
    setLocalStorage('td_admin_teachers', updatedList);

    // Clean up category assignments
    const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});
    Object.keys(assignments).forEach((catId) => {
      assignments[catId] = assignments[catId].filter((id) => id !== teacherId);
    });
    setLocalStorage('td_category_teacher_assignments', assignments);

    await logAction('Teacher Deleted', { name: teacherToDelete?.name || teacherId });
    window.dispatchEvent(new Event('td_admin_teachers_updated'));
    window.dispatchEvent(new Event('td_admin_categories_updated'));

    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      await supabase.from('category_teachers').delete().eq('teacher_id', teacherId);
      const { error } = await supabase.from('teachers').delete().eq('id', teacherId);
      if (error) throw error;
      return { success: true };
    } catch {
      return { success: true }; // Local deletion succeeded
    }
  };

  // Delete Category
  const deleteCategory = async (categoryId: string): Promise<{ success: boolean; error?: string }> => {
    const categoryList = getLocalStorage<Category[]>('td_admin_categories', []);
    const categoryToDelete = categoryList.find((c) => c.id === categoryId);
    const updatedList = categoryList.filter((c) => c.id !== categoryId);
    setLocalStorage('td_admin_categories', updatedList);

    await logAction('Category Deleted', { name: categoryToDelete?.name || categoryId });
    window.dispatchEvent(new Event('td_admin_categories_updated'));

    if (!isSupabaseConfigured) {
      return { success: true };
    }

    try {
      await supabase.from('category_teachers').delete().eq('category_id', categoryId);
      const { error } = await supabase.from('categories').delete().eq('id', categoryId);
      if (error) throw error;
      return { success: true };
    } catch {
      return { success: true };
    }
  };

  // Master Factory Reset: Wipes all votes, submissions, audit logs, messages, voter tallies across client and database
  const masterResetSystem = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Wipe local votes & submissions
      setLocalStorage('td_category_vote_totals', {});
      setLocalStorage('td_admin_messages', []);
      setLocalStorage('td_registered_students', []);
      setLocalStorage('td_device_audit_log', []);
      setLocalStorage('td_admin_actions', []);

      // Remove all user ballot keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('td_submitted_categories') || key.startsWith('td_votes_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // Reset settings and stats
      const freshSettings: VotingSettings = {
        ...DEFAULT_SETTINGS,
        is_voting_open: true,
        show_live_counts: true,
        results_finalized: false,
        updated_at: new Date().toISOString(),
      };
      setSettings(freshSettings);
      setLocalStorage('td_admin_settings', freshSettings);

      const allCats = getLocalStorage<Category[]>('td_admin_categories', []);
      const freshStats: SystemStats = {
        totalStudents: 0,
        totalParticipants: 0,
        participationRate: 0,
        totalCategories: allCats.length || 7,
        totalVotes: 0,
      };
      setStats(freshStats);
      setLocalStorage('td_admin_stats', freshStats);
      setRecentActions([]);

      // 2. Wipe database tables if Supabase configured
      if (isSupabaseConfigured) {
        try {
          await supabase.from('vote_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('vote_submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('vote_totals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('appreciation_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('admin_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('voting_settings').update({
            is_voting_open: true,
            show_live_counts: true,
            results_finalized: false,
            updated_at: new Date().toISOString(),
          }).eq('id', 1);
        } catch {
          // Handled locally
        }
      }

      // 3. Dispatch global sync events
      window.dispatchEvent(new Event('td_votes_updated'));
      window.dispatchEvent(new Event('td_appreciation_updated'));
      window.dispatchEvent(new Event('td_admin_settings_updated'));
      window.dispatchEvent(new Event('td_admin_teachers_updated'));
      window.dispatchEvent(new Event('td_admin_categories_updated'));
      window.dispatchEvent(new Event('storage'));

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to perform master reset';
      return { success: false, error: msg };
    }
  };

  return {
    stats,
    settings,
    recentActions,
    isLoading,
    error,
    refetch: fetchDashboardData,
    toggleVotingOpen,
    toggleShowLiveCounts,
    finalizeResults,
    saveTeacher,
    deleteTeacher,
    saveCategory,
    deleteCategory,
    exportResultsCSV,
    masterResetSystem,
  };
}
