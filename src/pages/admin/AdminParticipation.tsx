import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Download, RefreshCw } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { exportToCSV, getLocalStorage } from '../../lib/utils';
import { getAllCategories } from '../../hooks/useCategories';
import { toast } from '../../components/ui/Toast';
import type { Category } from '../../types';

interface CategoryTurnout {
  id: string;
  name: string;
  icon?: string;
  submissionCount: number;
  totalStudents: number;
  percentage: number;
}

export default function AdminParticipation() {
  const [turnoutData, setTurnoutData] = useState<CategoryTurnout[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [uniqueParticipants, setUniqueParticipants] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchParticipationData = useCallback(async () => {
    // 1. Gather all active categories dynamically
    const categories: Category[] = getAllCategories().filter((c) => c.is_active !== false);

    // 2. Discover all distinct student accounts from localStorage
    const rawRegistered = getLocalStorage<string[]>('td_registered_students', []);
    const localAuditLog = getLocalStorage<any[]>('td_device_audit_log', []);
    
    // Find all student users who have placed votes
    const voterSet = new Set<string>();
    localAuditLog.forEach((log) => {
      if (log.user_id && log.user_id !== 'anonymous') {
        voterSet.add(log.user_id);
      }
    });

    // Also scan any localStorage keys matching td_submitted_categories_*
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

    const distinctVotersCount = voterSet.size;
    const distinctRegisteredCount = Math.max(rawRegistered.length, distinctVotersCount);
    
    // Count per-category voter submissions
    const categorySubmissions: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('td_submitted_categories_')) {
        try {
          const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(list)) {
            list.forEach((catId) => {
              categorySubmissions[catId] = (categorySubmissions[catId] || 0) + 1;
            });
          }
        } catch {
          // Ignore
        }
      }
    }

    // Fallback calculation for totals
    const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
    categories.forEach((c) => {
      if (!categorySubmissions[c.id]) {
        const votesMap = localTotals[c.id] || {};
        const totalVotes = Object.values(votesMap).reduce((sum, v) => sum + v, 0);
        if (totalVotes > 0) {
          categorySubmissions[c.id] = Math.max(1, Math.floor(totalVotes / 5));
        }
      }
    });

    const localFormatted: CategoryTurnout[] = categories.map((c) => {
      const subCount = categorySubmissions[c.id] || 0;
      const pct = distinctRegisteredCount > 0
        ? Math.min(100, Math.round((subCount / distinctRegisteredCount) * 100))
        : 0;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        submissionCount: subCount,
        totalStudents: distinctRegisteredCount,
        percentage: pct,
      };
    });

    setTotalStudents(distinctRegisteredCount);
    setUniqueParticipants(distinctVotersCount);
    setTurnoutData(localFormatted);

    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const studentPromise = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student');

      const subPromise = supabase
        .from('vote_submissions')
        .select('student_id, category_id');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Participation fetch timeout')), 2500)
      );

      const [studentRes, subRes] = (await Promise.race([
        Promise.all([studentPromise, subPromise]),
        timeoutPromise,
      ])) as any;

      const sTotal = Math.max(studentRes?.count ?? 0, distinctRegisteredCount);
      setTotalStudents(sTotal);

      const submissions = subRes?.data || [];
      const cloudUniqueSet = new Set(submissions.map((s: any) => s.student_id));
      const totalUnique = Math.max(cloudUniqueSet.size, distinctVotersCount);
      setUniqueParticipants(totalUnique);

      const cloudCategoryCounts: Record<string, number> = { ...categorySubmissions };
      submissions.forEach((s: any) => {
        cloudCategoryCounts[s.category_id] = (cloudCategoryCounts[s.category_id] || 0) + 1;
      });

      const formatted: CategoryTurnout[] = categories.map((c) => {
        const count = cloudCategoryCounts[c.id] || 0;
        return {
          id: c.id,
          name: c.name,
          icon: c.icon,
          submissionCount: count,
          totalStudents: sTotal,
          percentage: sTotal > 0 ? Math.min(100, Math.round((count / sTotal) * 100)) : 0,
        };
      });
      setTurnoutData(formatted);
    } catch {
      // Keep local
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParticipationData();

    const handleUpdate = () => {
      fetchParticipationData();
    };

    window.addEventListener('td_votes_updated', handleUpdate);
    window.addEventListener('td_admin_categories_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('td_votes_updated', handleUpdate);
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchParticipationData]);

  const handleExportParticipation = () => {
    const csvData = turnoutData.map((row) => ({
      Category: row.name,
      'Submissions Count': row.submissionCount,
      'Total Students': row.totalStudents,
      'Turnout Percentage': `${row.percentage}%`,
    }));

    exportToCSV(csvData, `participation_report_${new Date().toISOString().slice(0, 10)}`);
    toast.success('Report Exported', 'Participation CSV file downloaded.');
  };

  const overallRate = totalStudents > 0 ? Math.min(100, Math.round((uniqueParticipants / totalStudents) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users className="text-primary-400" size={24} />
            Student Participation & Turnout
          </h1>
          <p className="section-subtitle">
            Track genuine student engagement and real-time category turnout statistics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={() => fetchParticipationData()}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            icon={<Download size={16} />}
            onClick={handleExportParticipation}
          >
            Export Report
          </Button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="stat-value">{totalStudents}</p>
          <p className="stat-label">Total Registered Students</p>
        </Card>
        <Card className="text-center">
          <p className="stat-value text-emerald-400">{uniqueParticipants}</p>
          <p className="stat-label">Active Voters</p>
        </Card>
        <Card className="text-center">
          <p className="stat-value text-gold-400">{overallRate}%</p>
          <p className="stat-label">Overall Turnout Rate</p>
        </Card>
      </div>

      {/* Per Category Breakdown Table */}
      <Card>
        <h2 className="text-base font-semibold text-white mb-4">Turnout by Category</h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} variant="card" />
            ))}
          </div>
        ) : turnoutData.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-6">No categories configured yet.</p>
        ) : (
          <div className="space-y-4">
            {turnoutData.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-medium text-white flex items-center gap-1.5">
                    <span>{item.icon || '🏆'}</span>
                    <span>{item.name}</span>
                  </span>
                  <span className="text-surface-400 font-semibold">
                    {item.submissionCount} / {item.totalStudents} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-700/60 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
