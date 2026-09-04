import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck,
  Users,
  Search,
  LogOut,
  ShieldAlert,
  Smartphone,
  Laptop,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  CheckCheck,
  RotateCcw,
  Clock,
  Vote,
  Shield,
  Trash2,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { exportToCSV, formatTimeAgo } from '../../lib/utils';
import {
  fetchAllUserSessions,
  revokeUserSession,
  revokeMultipleUserSessions,
  revokeAllStudentSessions,
  reactivateUserSession,
  reactivateMultipleUserSessions,
  deleteUserAccount,
  deleteMultipleUserAccounts,
  deleteAllStudentAccounts,
} from '../../lib/sessionService';
import { toast } from '../../components/ui/Toast';
import type { UserSessionRecord } from '../../types';

export default function AdminUsers() {
  const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Modals state
  const [singleLogoutTarget, setSingleLogoutTarget] = useState<UserSessionRecord | null>(null);
  const [showBulkLogoutModal, setShowBulkLogoutModal] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [isProcessingLogout, setIsProcessingLogout] = useState(false);
  const [isProcessingAllow, setIsProcessingAllow] = useState(false);

  // Deletion modals state
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<UserSessionRecord | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const data = await fetchAllUserSessions();
      setSessions(data);
    } catch {
      toast.error('Sync Notice', 'Could not refresh remote session state.');
    } finally {
      if (!isSilent) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData(true);
    };

    window.addEventListener('td_user_sessions_updated', handleUpdate);
    window.addEventListener('td_user_session_reactivated', handleUpdate);
    window.addEventListener('td_system_reset', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Periodic auto-refresh every 8 seconds for real-time dashboard monitoring
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 8000);

    return () => {
      window.removeEventListener('td_user_sessions_updated', handleUpdate);
      window.removeEventListener('td_user_session_reactivated', handleUpdate);
      window.removeEventListener('td_system_reset', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [loadData]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter]);

  // Derived metrics
  const totalUsers = sessions.length;
  const activeSessions = useMemo(() => sessions.filter((s) => s.is_active).length, [sessions]);
  const revokedSessions = totalUsers - activeSessions;
  const studentCount = useMemo(() => sessions.filter((s) => s.role === 'student').length, [sessions]);
  const adminCount = totalUsers - studentCount;

  // Filtered session records
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.device_id.toLowerCase().includes(search.toLowerCase()) ||
        (s.user_agent && s.user_agent.toLowerCase().includes(search.toLowerCase()));

      const matchesRole = roleFilter === 'all' || s.role === roleFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.is_active) ||
        (statusFilter === 'revoked' && !s.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [sessions, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage, pageSize]);

  // Bulk selection helpers
  const handleToggleSelectUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleSelectAllFiltered = () => {
    const activeFiltered = filteredSessions.filter((s) => s.role !== 'admin');
    const allFilteredIds = activeFiltered.map((s) => s.user_id);
    setSelectedUserIds(new Set(allFilteredIds));
  };

  const handleClearSelection = () => {
    setSelectedUserIds(new Set());
  };

  // Force Logout Actions
  const handleConfirmSingleLogout = async () => {
    if (!singleLogoutTarget) return;
    setIsProcessingLogout(true);
    try {
      await revokeUserSession(
        singleLogoutTarget.user_id,
        singleLogoutTarget.device_id,
        singleLogoutTarget.full_name,
        singleLogoutTarget.email
      );
      toast.success(
        'User Access Revoked',
        `${singleLogoutTarget.full_name} has been force logged out and cannot log in until access is granted.`
      );
      setSingleLogoutTarget(null);
      loadData(true);
    } catch {
      toast.error('Action Failed', 'Failed to terminate session.');
    } finally {
      setIsProcessingLogout(false);
    }
  };

  const handleConfirmBulkLogout = async () => {
    const userIdsArray = Array.from(selectedUserIds);
    if (userIdsArray.length === 0) return;

    setIsProcessingLogout(true);
    try {
      const targetDevices = sessions
        .filter((s) => selectedUserIds.has(s.user_id))
        .map((s) => s.device_id);

      await revokeMultipleUserSessions(userIdsArray, targetDevices);
      toast.success(
        'Bulk Logout Complete',
        `Successfully logged out ${userIdsArray.length} student account(s) and restricted their login access.`
      );
      setSelectedUserIds(new Set());
      setShowBulkLogoutModal(false);
      loadData(true);
    } catch {
      toast.error('Action Failed', 'Failed to logout selected users.');
    } finally {
      setIsProcessingLogout(false);
    }
  };

  const handleConfirmLogoutAll = async () => {
    setIsProcessingLogout(true);
    try {
      await revokeAllStudentSessions();
      toast.success(
        'Global Logout Complete',
        'All student sessions have been force-logged out and access restricted until granted.'
      );
      setShowLogoutAllModal(false);
      setSelectedUserIds(new Set());
      loadData(true);
    } catch {
      toast.error('Action Failed', 'Failed to execute global logout.');
    } finally {
      setIsProcessingLogout(false);
    }
  };

  const handleReactivateSession = async (session: UserSessionRecord) => {
    try {
      await reactivateUserSession(session.user_id, session.device_id, session.email, session.full_name);
      toast.success('Access Restored', `${session.full_name} is now permitted to log in again.`);
      loadData(true);
    } catch {
      toast.error('Notice', 'Could not reactivate user session.');
    }
  };

  const handleBulkAllowAccess = async () => {
    const userIdsArray = Array.from(selectedUserIds);
    if (userIdsArray.length === 0) return;

    setIsProcessingAllow(true);
    try {
      await reactivateMultipleUserSessions(userIdsArray);
      toast.success(
        'Access Granted',
        `Successfully restored login access for ${userIdsArray.length} selected student(s).`
      );
      setSelectedUserIds(new Set());
      loadData(true);
    } catch {
      toast.error('Notice', 'Failed to grant access to selected users.');
    } finally {
      setIsProcessingAllow(false);
    }
  };

  // Delete User Actions
  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteTarget) return;
    setIsProcessingDelete(true);
    try {
      await deleteUserAccount(
        singleDeleteTarget.user_id,
        singleDeleteTarget.device_id,
        singleDeleteTarget.full_name,
        singleDeleteTarget.email
      );
      toast.success(
        'User Deleted',
        `Account for "${singleDeleteTarget.full_name}" and all associated data have been permanently removed.`
      );
      setSingleDeleteTarget(null);
      loadData(true);
    } catch {
      toast.error('Action Failed', 'Failed to delete user account.');
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    const userIdsArray = Array.from(selectedUserIds);
    if (userIdsArray.length === 0) return;

    setIsProcessingDelete(true);
    try {
      await deleteMultipleUserAccounts(userIdsArray);
      toast.success(
        'Bulk Delete Complete',
        `Successfully deleted ${userIdsArray.length} student account(s) and wiped their records.`
      );
      setSelectedUserIds(new Set());
      setShowBulkDeleteModal(false);
      loadData(true);
    } catch {
      toast.error('Action Failed', 'Failed to delete selected users.');
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setIsProcessingDelete(true);
    try {
      await deleteAllStudentAccounts();
      toast.success(
        'All Student Accounts Deleted',
        'All student profiles, sessions, device bindings, and ballots have been permanently wiped.'
      );
      setShowDeleteAllModal(false);
      setSelectedUserIds(new Set());
      loadData(true);
    } catch {
      toast.error('Action Failed', 'Failed to delete all student accounts.');
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleExportCSV = () => {
    const rows = sessions.map((s) => ({
      'User ID': s.user_id,
      'Full Name': s.full_name,
      Email: s.email,
      Role: s.role.toUpperCase(),
      'Device ID': s.device_id,
      'Client Details': s.user_agent || '',
      'Session Status': s.is_active ? 'Active (Allowed)' : 'Revoked (Blocked)',
      'Login Timestamp': s.login_at ? new Date(s.login_at).toLocaleString() : '',
      'Last Active Timestamp': s.last_active_at ? new Date(s.last_active_at).toLocaleString() : '',
      'Categories Voted': `${s.voted_categories_count || 0} / ${s.total_categories_count || 8}`,
    }));

    exportToCSV(rows, `user_login_history_${new Date().toISOString().slice(0, 10)}`);
    toast.success('Report Exported', 'User login history CSV file downloaded.');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <UserCheck className="text-primary-400" size={24} />
            Users & Login History Management
          </h1>
          <p className="section-subtitle">
            Track student and admin active sessions, monitor login activity, and delete or enforce instant remote device logout
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />}
            onClick={() => loadData()}
            title="Refresh session logs"
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<ShieldAlert size={14} />}
            onClick={() => setShowLogoutAllModal(true)}
            disabled={activeSessions === 0}
          >
            Force Logout All Users
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={() => setShowDeleteAllModal(true)}
            disabled={studentCount === 0}
            className="!bg-rose-700/85 hover:!bg-rose-600 border border-rose-500/50 text-white font-medium"
            title="Permanently delete all registered students, sessions, and voting ballots"
          >
            Delete All Students
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center flex-shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Total User Accounts</p>
            <p className="text-xl font-bold text-white">{totalUsers}</p>
          </div>
        </Card>

        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Active Online Sessions</p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xl font-bold text-emerald-400">{activeSessions}</p>
            </div>
          </div>
        </Card>

        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center flex-shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Logged Out / Revoked</p>
            <p className="text-xl font-bold text-rose-400">{revokedSessions}</p>
          </div>
        </Card>

        <Card variant="flat" padding="sm" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-xs text-surface-400">Students / Admins</p>
            <p className="text-xl font-bold text-indigo-300">
              {studentCount} <span className="text-xs text-surface-500 font-normal">/ {adminCount}</span>
            </p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by student name, email, device ID, or OS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>

          {/* Controls: Role + Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Role Filter */}
            <div className="flex items-center bg-surface-900 border border-surface-700/60 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all font-medium ${
                  roleFilter === 'all'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                All Roles ({totalUsers})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('student')}
                className={`px-3 py-1 rounded-lg transition-all font-medium ${
                  roleFilter === 'student'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Students ({studentCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('admin')}
                className={`px-3 py-1 rounded-lg transition-all font-medium ${
                  roleFilter === 'admin'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Admins ({adminCount})
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-surface-900 border border-surface-700/60 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                  statusFilter === 'all'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1 ${
                  statusFilter === 'active'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active ({activeSessions})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('revoked')}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                  statusFilter === 'revoked'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                Logged Out ({revokedSessions})
              </button>
            </div>
          </div>
        </div>

        {/* Multi-selection Action Bar */}
        {selectedUserIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/30 text-xs text-white flex-wrap gap-2"
          >
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="!text-xs">
                {selectedUserIds.size} User(s) Selected
              </Badge>
              <span className="text-surface-400">Ready for batch action</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-xs !py-1 text-surface-400 hover:text-white"
              >
                Deselect All
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<CheckCircle2 size={13} className="text-emerald-400" />}
                onClick={handleBulkAllowAccess}
                isLoading={isProcessingAllow}
                className="text-xs !py-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                title="Restore login access for all selected users"
              >
                Allow Access to Selected ({selectedUserIds.size})
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<LogOut size={13} />}
                onClick={() => setShowBulkLogoutModal(true)}
                className="text-xs !py-1"
                title="Force logout all selected users and block their login"
              >
                Force Logout Selected ({selectedUserIds.size})
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={() => setShowBulkDeleteModal(true)}
                className="text-xs !py-1 !bg-rose-700/85 hover:!bg-rose-600 border border-rose-500/50"
                title="Permanently delete all selected student accounts"
              >
                Delete Selected ({selectedUserIds.size})
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Users & Sessions List Table / Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card className="p-12 text-center text-surface-400 space-y-3">
          <p className="text-base font-semibold text-white">No user sessions found</p>
          <p className="text-xs max-w-sm mx-auto">
            No user login records match your search criteria or selected filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setRoleFilter('all');
              setStatusFilter('all');
            }}
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Table Header Controls */}
          <div className="flex items-center justify-between px-2 text-xs text-surface-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1"
              >
                <CheckCheck size={14} />
                Select All ({filteredSessions.filter((s) => s.role !== 'admin').length})
              </button>
            </div>
            <span>
              Showing {filteredSessions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, filteredSessions.length)} of {filteredSessions.length} user session records
            </span>
          </div>

          {/* List of Session Cards */}
          <AnimatePresence>
            {paginatedSessions.map((session) => {
              const isSelected = selectedUserIds.has(session.user_id);
              const isAdmin = session.role === 'admin';
              const votedCount = session.voted_categories_count || 0;
              const totalCats = session.total_categories_count || 8;
              const votePct = Math.min(100, Math.round((votedCount / totalCats) * 100));

              return (
                <motion.div
                  key={session.id || session.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                >
                  <Card
                    variant={isSelected ? 'selected' : 'default'}
                    padding="none"
                    className={`transition-all ${
                      !session.is_active ? 'opacity-85 bg-surface-900/50 border-rose-500/20' : ''
                    }`}
                  >
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Checkbox + Avatar + User Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Checkbox (students only) */}
                        {!isAdmin ? (
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectUser(session.user_id)}
                              className="rounded bg-surface-800 border-surface-600 text-primary-500 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                              aria-label={`Select ${session.full_name}`}
                            />
                          </div>
                        ) : (
                          <div className="w-4" />
                        )}

                        {/* Avatar */}
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md ${
                            isAdmin
                              ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
                              : session.is_active
                              ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white'
                              : 'bg-surface-800 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {session.full_name.charAt(0).toUpperCase()}
                        </div>

                        {/* User Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-semibold text-white truncate" title={session.full_name}>
                              {session.full_name}
                            </h3>
                            <Badge variant={isAdmin ? 'gold' : 'neutral'} className="!text-[10px] !py-0">
                              {isAdmin ? '🛡️ Administrator' : '🎓 Student'}
                            </Badge>

                            {/* Active / Offline Status Badge */}
                            {session.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active Online (Access Allowed)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <XCircle size={11} className="text-rose-400" />
                                Access Revoked (Login Blocked)
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-surface-400 font-mono truncate">
                            {session.email}
                          </p>

                          {/* Device & Client details */}
                          <div className="flex items-center gap-3 text-[11px] text-surface-400 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              {session.user_agent?.includes('iOS') || session.user_agent?.includes('Android') ? (
                                <Smartphone size={13} className="text-surface-400" />
                              ) : (
                                <Laptop size={13} className="text-surface-400" />
                              )}
                              <span className="text-surface-300">{session.user_agent || 'Web Browser'}</span>
                            </span>

                            <span className="font-mono text-surface-500 text-[10px]">
                              Device ID: {session.device_id ? `${session.device_id.slice(0, 16)}...` : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Activity Timestamps & Voting Turnout */}
                      <div className="flex items-center gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-surface-800/60 flex-shrink-0">
                        {/* Timestamps */}
                        <div className="text-left md:text-right space-y-0.5">
                          <p className="text-[10px] text-surface-500 flex items-center md:justify-end gap-1">
                            <Clock size={11} />
                            Last Active: <span className="text-surface-300 font-medium">{formatTimeAgo(session.last_active_at)}</span>
                          </p>
                          <p className="text-[10px] text-surface-500">
                            Logged in: <span className="text-surface-400 font-mono">{new Date(session.login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </p>
                        </div>

                        {/* Voting progress (for students) */}
                        {!isAdmin && (
                          <div className="w-28 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-surface-400 flex items-center gap-1">
                                <Vote size={11} className="text-primary-400" />
                                Ballots
                              </span>
                              <span className="text-white font-semibold">{votedCount}/{totalCats}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                                style={{ width: `${votePct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Action: Force Logout / Allow Access & Delete User Buttons */}
                        <div className="flex items-center gap-2">
                          {!isAdmin && (
                            <>
                              {session.is_active ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  icon={<LogOut size={13} className="text-rose-400" />}
                                  onClick={() => setSingleLogoutTarget(session)}
                                  className="text-xs !py-1.5 border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300"
                                  title="Instantly force logout this user and restrict their login access"
                                >
                                  Force Logout
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  icon={<RotateCcw size={13} className="text-emerald-400" />}
                                  onClick={() => handleReactivateSession(session)}
                                  className="text-xs !py-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500 font-medium"
                                  title="Allow this user to log in and cast votes again"
                                >
                                  Allow Access
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<Trash2 size={13} className="text-rose-400" />}
                                onClick={() => setSingleDeleteTarget(session)}
                                className="text-xs !py-1.5 border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/20 text-rose-300"
                                title="Permanently delete this user account and wipe their records"
                              >
                                Delete User
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-3 pb-1 border-t border-surface-800/60 text-xs text-surface-400 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </Button>
              <span className="font-medium text-white">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Single User Force Logout Modal */}
      <ConfirmationModal
        isOpen={!!singleLogoutTarget}
        onClose={() => setSingleLogoutTarget(null)}
        onConfirm={handleConfirmSingleLogout}
        title="Confirm Remote Force Logout"
        message={`Are you sure you want to terminate the active session for "${singleLogoutTarget?.full_name}"?`}
        warning="This user will be immediately logged out of their connected device in real-time."
        confirmText="Force Logout User"
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessingLogout}
      />

      {/* Bulk Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkLogoutModal}
        onClose={() => setShowBulkLogoutModal(false)}
        onConfirm={handleConfirmBulkLogout}
        title={`Force Logout (${selectedUserIds.size}) Selected Users`}
        message={`You are about to terminate active sessions for ${selectedUserIds.size} student account(s).`}
        warning="All selected students will be immediately logged out of their devices in real-time."
        confirmText={`Force Logout (${selectedUserIds.size}) Users`}
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessingLogout}
      />

      {/* Logout All Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutAllModal}
        onClose={() => setShowLogoutAllModal(false)}
        onConfirm={handleConfirmLogoutAll}
        title="Force Logout All Student Users"
        message="Are you sure you want to force logout every active student user across all devices?"
        warning="This will immediately revoke active sessions for all logged-in students. Students will need to log in again to place any remaining votes."
        confirmText="Force Logout All Students"
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessingLogout}
      />

      {/* Single User Delete Modal */}
      <ConfirmationModal
        isOpen={!!singleDeleteTarget}
        onClose={() => setSingleDeleteTarget(null)}
        onConfirm={handleConfirmSingleDelete}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete the account for "${singleDeleteTarget?.full_name}"?`}
        warning="This action is permanent and will wipe the student's profile, active session, device registration, and all cast voting ballots."
        confirmText="Delete User Permanently"
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessingDelete}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete (${selectedUserIds.size}) Selected User Accounts`}
        message={`Are you sure you want to permanently delete ${selectedUserIds.size} student account(s)?`}
        warning="All selected student profiles, login sessions, and cast ballots will be permanently purged from the database and local storage."
        confirmText={`Delete (${selectedUserIds.size}) Users`}
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessingDelete}
      />

      {/* Delete All Students Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleConfirmDeleteAll}
        title="Delete All Student Accounts"
        message="Are you sure you want to permanently delete ALL student user accounts?"
        warning="CRITICAL ACTION: This will permanently wipe all student accounts, active sessions, device bindings, and voting ballots across the database and local storage. Admin accounts will be preserved."
        confirmText="Permanently Delete All Students"
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessingDelete}
      />
    </div>
  );
}
