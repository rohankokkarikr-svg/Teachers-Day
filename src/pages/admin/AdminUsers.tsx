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
  RotateCcw,
  Clock,
  Vote,
  Shield,
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

  // Modals state
  const [singleLogoutTarget, setSingleLogoutTarget] = useState<UserSessionRecord | null>(null);
  const [showBulkLogoutModal, setShowBulkLogoutModal] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [isProcessingLogout, setIsProcessingLogout] = useState(false);

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
      window.removeEventListener('td_system_reset', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [loadData]);

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

  // Force Logout & Reactivation Actions
  const handleConfirmSingleLogout = async () => {
    if (!singleLogoutTarget) return;
    setIsProcessingLogout(true);
    try {
      await revokeUserSession(
        singleLogoutTarget.user_id,
        singleLogoutTarget.device_id,
        singleLogoutTarget.email,
        singleLogoutTarget.full_name
      );
      toast.success(
        'User Logged Out & Access Restricted',
        `${singleLogoutTarget.full_name}'s session has been terminated and access is blocked until allowed.`
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
      const selectedSessions = sessions.filter((s) => selectedUserIds.has(s.user_id));
      const targetDevices = selectedSessions.map((s) => s.device_id);
      const targetEmails = selectedSessions.map((s) => s.email);
      const targetNames = selectedSessions.map((s) => s.full_name);

      await revokeMultipleUserSessions(userIdsArray, targetDevices, targetEmails, targetNames);
      toast.success(
        'Bulk Logout Complete',
        `Successfully logged out and restricted ${userIdsArray.length} user account(s).`
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
        'All student sessions have been logged out and restricted across all devices.'
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
      await reactivateUserSession({
        userId: session.user_id,
        email: session.email,
        deviceId: session.device_id,
        fullName: session.full_name,
      });
      toast.success('Access Restored', `${session.full_name} is now permitted to log in again.`);
      loadData(true);
    } catch {
      toast.error('Notice', 'Could not reactivate user session.');
    }
  };

  const handleBulkReactivateSelected = async () => {
    const userIdsArray = Array.from(selectedUserIds);
    if (userIdsArray.length === 0) return;

    try {
      const selectedSessions = sessions.filter((s) => selectedUserIds.has(s.user_id));
      for (const s of selectedSessions) {
        await reactivateUserSession({
          userId: s.user_id,
          email: s.email,
          deviceId: s.device_id,
          fullName: s.full_name,
        });
      }
      toast.success(
        'Access Restored for Selected',
        `Successfully allowed login access for ${selectedSessions.length} user(s).`
      );
      setSelectedUserIds(new Set());
      loadData(true);
    } catch {
      toast.error('Action Failed', 'Failed to restore access for selected users.');
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
      'Session Status': s.is_active ? 'Active' : 'Revoked / Terminated',
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
            Track student and admin active sessions, monitor login activity, and enforce instant remote device logout
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
            className="flex items-center justify-between p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/30 text-xs text-white"
          >
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="!text-xs">
                {selectedUserIds.size} User(s) Selected
              </Badge>
              <span className="text-surface-400">Ready for batch action</span>
            </div>

            <div className="flex items-center gap-2">
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
                icon={<RotateCcw size={13} className="text-emerald-400" />}
                onClick={handleBulkReactivateSelected}
                className="text-xs !py-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
              >
                Allow Access for Selected ({selectedUserIds.size})
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<LogOut size={13} />}
                onClick={() => setShowBulkLogoutModal(true)}
                className="text-xs !py-1"
              >
                Force Logout Selected ({selectedUserIds.size})
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Users & Sessions List Table / Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <LoadingSkeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card variant="flat" className="text-center py-12">
          <UserCheck size={40} className="mx-auto text-surface-600 mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No matching sessions found</h3>
          <p className="text-sm text-surface-400 max-w-sm mx-auto mb-4">
            Try adjusting your search terms or status filters.
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
          {/* Quick Selection Summary Header */}
          <div className="flex items-center justify-between px-1 text-xs text-surface-400">
            <span>
              Showing {filteredSessions.length} of {totalUsers} user records
            </span>
            {filteredSessions.some((s) => s.role !== 'admin') && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                Select all visible students
              </button>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {filteredSessions.map((session) => {
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
                      !session.is_active ? 'opacity-75 bg-surface-900/40' : ''
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
                              : 'bg-surface-800 text-surface-400 border border-surface-700'
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
                                Active Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <XCircle size={10} />
                                Access Restricted
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

                        {/* Action: Force Logout Button */}
                        <div className="flex items-center gap-2">
                          {!isAdmin && (
                            session.is_active ? (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<LogOut size={13} className="text-rose-400" />}
                                onClick={() => setSingleLogoutTarget(session)}
                                className="text-xs !py-1.5 border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300"
                                title="Instantly force logout this user and restrict re-login"
                              >
                                Force Logout
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<RotateCcw size={13} className="text-emerald-400" />}
                                onClick={() => handleReactivateSession(session)}
                                className="text-xs !py-1.5 border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                title="Allow this user to log in again"
                              >
                                Allow Access
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Single User Force Logout Modal */}
      <ConfirmationModal
        isOpen={!!singleLogoutTarget}
        onClose={() => setSingleLogoutTarget(null)}
        onConfirm={handleConfirmSingleLogout}
        title="Confirm Remote Force Logout"
        message={`Are you sure you want to terminate the active session for "${singleLogoutTarget?.full_name}"?`}
        warning="This user will be immediately logged out of their connected device and blocked from logging in again until you click Allow Access."
        confirmText="Force Logout & Restrict User"
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
        warning="All selected students will be immediately logged out and prevented from logging back in until you click Allow Access."
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
        warning="This will immediately revoke active sessions and block all students from logging in until access is restored."
        confirmText="Force Logout All Students"
        cancelText="Cancel"
        variant="danger"
        isLoading={isProcessingLogout}
      />
    </div>
  );
}
