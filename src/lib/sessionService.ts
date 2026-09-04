/**
 * Session Management & Remote Logout Service
 * Handles user login history, active session tracking, and real-time administrator force logout across devices
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { getLocalStorage, setLocalStorage } from './utils';
import { getOrCreateDeviceId, getUserSubmittedCategories } from './deviceId';
import type { UserSessionRecord, UserRole } from '../types';

const STORAGE_SESSIONS_KEY = 'td_user_sessions';
const STORAGE_REVOKED_USERS_KEY = 'td_revoked_users';
const STORAGE_REVOKED_DEVICES_KEY = 'td_revoked_devices';

interface RevokedRecord {
  id: string; // userId or deviceId
  revokedAt: string;
}

/**
 * Parses browser and operating system details from the userAgent string
 */
export function getClientDeviceDetails(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent || '';
  
  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera';

  let os = 'OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

/**
 * Records a user's login session both locally and in Supabase
 */
export async function recordUserLoginSession(profile: {
  id: string;
  full_name: string;
  email: string;
  role?: UserRole;
  device_id?: string;
}): Promise<UserSessionRecord> {
  const deviceId = profile.device_id || getOrCreateDeviceId();
  const userAgent = getClientDeviceDetails();
  const now = new Date().toISOString();

  // Clear any existing revocation for this fresh login
  unrevokeUserSessionLocally(profile.id, deviceId);

  const newSession: UserSessionRecord = {
    id: `sess_${profile.id}_${deviceId.slice(-6)}`,
    user_id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role || 'student',
    device_id: deviceId,
    user_agent: userAgent,
    is_active: true,
    login_at: now,
    last_active_at: now,
  };

  // 1. Update local storage sessions
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const existingIdx = localSessions.findIndex(
    (s) => s.user_id === profile.id || (s.device_id === deviceId && s.user_id === profile.id)
  );

  let updatedSessions: UserSessionRecord[];
  if (existingIdx >= 0) {
    updatedSessions = [...localSessions];
    updatedSessions[existingIdx] = {
      ...updatedSessions[existingIdx],
      ...newSession,
      is_active: true,
      revoked_at: undefined,
      last_active_at: now,
    };
  } else {
    updatedSessions = [newSession, ...localSessions];
  }

  setLocalStorage(STORAGE_SESSIONS_KEY, updatedSessions);
  window.dispatchEvent(new Event('td_user_sessions_updated'));

  // 2. Upsert session record in Supabase
  if (isSupabaseConfigured) {
    try {
      const { error: upsertErr } = await supabase.from('user_sessions').upsert(
        {
          user_id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role || 'student',
          device_id: deviceId,
          user_agent: userAgent,
          is_active: true,
          login_at: now,
          last_active_at: now,
          revoked_at: null,
        },
        { onConflict: 'user_id,device_id' }
      );

      if (upsertErr) {
        // Fallback: check if row exists by user_id
        const { data: existingRows } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('user_id', profile.id)
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          await supabase
            .from('user_sessions')
            .update({
              full_name: profile.full_name,
              email: profile.email,
              device_id: deviceId,
              user_agent: userAgent,
              is_active: true,
              last_active_at: now,
              revoked_at: null,
            })
            .eq('user_id', profile.id);
        } else {
          await supabase.from('user_sessions').insert({
            user_id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role || 'student',
            device_id: deviceId,
            user_agent: userAgent,
            is_active: true,
            login_at: now,
            last_active_at: now,
          });
        }
      }

      // Broadcast login event to admin channels
      try {
        const authChannel = supabase.channel('system_auth_channel');
        authChannel.send({
          type: 'broadcast',
          event: 'user_logged_in',
          payload: {
            user_id: profile.id,
            full_name: profile.full_name,
            role: profile.role || 'student',
            device_id: deviceId,
            timestamp: Date.now(),
          },
        });
      } catch {
        // Ignore broadcast error
      }
    } catch {
      // Handled locally
    }
  }

  return newSession;
}

/**
 * Updates a user's last active heartbeat timestamp
 */
export async function updateSessionHeartbeat(userId: string, deviceId?: string): Promise<void> {
  const dId = deviceId || getOrCreateDeviceId();
  const now = new Date().toISOString();

  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const idx = localSessions.findIndex((s) => s.user_id === userId);
  if (idx >= 0 && localSessions[idx].is_active) {
    localSessions[idx].last_active_at = now;
    setLocalStorage(STORAGE_SESSIONS_KEY, localSessions);
  }

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('user_sessions')
        .update({ last_active_at: now })
        .eq('user_id', userId)
        .eq('device_id', dId)
        .eq('is_active', true);
    } catch {
      // Handled locally
    }
  }
}

/**
 * Retrieves all user sessions, merging registered accounts, vote history, and Supabase data
 */
export async function fetchAllUserSessions(): Promise<UserSessionRecord[]> {
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const registeredStudents = getLocalStorage<string[]>('td_registered_students', []);
  const localAuditLogs = getLocalStorage<any[]>('td_device_audit_log', []);
  const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
  const revokedUserSet = new Set(revokedUsers.map((r) => r.id));

  // Build map of sessions by user_id
  const sessionMap = new Map<string, UserSessionRecord>();

  // Add all local sessions
  localSessions.forEach((s) => {
    const isRevoked = revokedUserSet.has(s.user_id) || revokedUserSet.has(s.device_id);
    const votes = getUserSubmittedCategories(s.user_id);
    sessionMap.set(s.user_id, {
      ...s,
      is_active: isRevoked ? false : s.is_active,
      voted_categories_count: votes.length,
      total_categories_count: 8,
    });
  });

  // Ensure any students in registeredStudents have an entry
  registeredStudents.forEach((studentName) => {
    const slug = studentName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    const studentId = localStorage.getItem(`td_student_id_${slug}`) || `std_${slug}`;
    const email = `${slug}@student.college`;

    if (!sessionMap.has(studentId)) {
      const votes = getUserSubmittedCategories(studentId);
      const isRevoked = revokedUserSet.has(studentId);
      sessionMap.set(studentId, {
        id: `sess_${studentId}`,
        user_id: studentId,
        full_name: studentName,
        email,
        role: 'student',
        device_id: getOrCreateDeviceId(),
        user_agent: getClientDeviceDetails(),
        is_active: !isRevoked,
        login_at: new Date(Date.now() - 3600000).toISOString(),
        last_active_at: new Date(Date.now() - 1800000).toISOString(),
        voted_categories_count: votes.length,
        total_categories_count: 8,
      });
    }
  });

  // Also include any users discovered from audit logs
  localAuditLogs.forEach((log) => {
    if (log.user_id && log.user_id !== 'anonymous' && !sessionMap.has(log.user_id)) {
      const votes = getUserSubmittedCategories(log.user_id);
      const isRevoked = revokedUserSet.has(log.user_id) || revokedUserSet.has(log.device_id);
      sessionMap.set(log.user_id, {
        id: `sess_${log.user_id}`,
        user_id: log.user_id,
        full_name: log.user_id.replace(/^std_/, '').replace(/\./g, ' ').toUpperCase(),
        email: `${log.user_id}@student.college`,
        role: 'student',
        device_id: log.device_id || getOrCreateDeviceId(),
        user_agent: getClientDeviceDetails(),
        is_active: !isRevoked,
        login_at: log.voted_at || new Date().toISOString(),
        last_active_at: log.voted_at || new Date().toISOString(),
        voted_categories_count: votes.length,
        total_categories_count: 8,
      });
    }
  });

  // 2. If Supabase is configured, fetch remote ground truth from BOTH profiles and user_sessions
  if (isSupabaseConfigured) {
    try {
      const sessionsPromise = supabase
        .from('user_sessions')
        .select('*')
        .order('last_active_at', { ascending: false });

      const profilesPromise = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sessions fetch timeout')), 3000)
      );

      const [sessionsRes, profilesRes] = (await Promise.race([
        Promise.all([sessionsPromise, profilesPromise]),
        timeoutPromise,
      ])) as any;

      // 2a. Ingest all registered profiles from Supabase
      if (profilesRes?.data && Array.isArray(profilesRes.data)) {
        profilesRes.data.forEach((p: any) => {
          if (!sessionMap.has(p.id)) {
            const votes = getUserSubmittedCategories(p.id);
            const isRevoked = revokedUserSet.has(p.id);
            sessionMap.set(p.id, {
              id: `sess_${p.id}`,
              user_id: p.id,
              full_name: p.full_name || p.email,
              email: p.email,
              role: p.role || 'student',
              device_id: p.device_id || getOrCreateDeviceId(),
              user_agent: 'Web Client',
              is_active: !isRevoked,
              login_at: p.created_at || new Date().toISOString(),
              last_active_at: p.updated_at || p.created_at || new Date().toISOString(),
              voted_categories_count: votes.length,
              total_categories_count: 8,
            });
          }
        });
      }

      // 2b. Ingest detailed user sessions
      if (sessionsRes?.data && Array.isArray(sessionsRes.data)) {
        sessionsRes.data.forEach((remoteS: any) => {
          const votes = getUserSubmittedCategories(remoteS.user_id);
          const isRevoked = revokedUserSet.has(remoteS.user_id) || remoteS.is_active === false;
          sessionMap.set(remoteS.user_id, {
            id: remoteS.id || `sess_${remoteS.user_id}`,
            user_id: remoteS.user_id,
            full_name: remoteS.full_name,
            email: remoteS.email,
            role: remoteS.role || 'student',
            device_id: remoteS.device_id,
            user_agent: remoteS.user_agent || 'Web Client',
            ip_address: remoteS.ip_address,
            is_active: isRevoked ? false : (remoteS.is_active ?? true),
            login_at: remoteS.login_at || remoteS.created_at || new Date().toISOString(),
            last_active_at: remoteS.last_active_at || new Date().toISOString(),
            revoked_at: remoteS.revoked_at,
            voted_categories_count: votes.length,
            total_categories_count: 8,
          });
        });
      }
    } catch {
      // Keep merged local sessions
    }
  }

  const resultList = Array.from(sessionMap.values());

  // Sort: Active users first, then by last active timestamp descending
  resultList.sort((a, b) => {
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1;
    }
    return new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime();
  });

  // Update local storage cache
  setLocalStorage(STORAGE_SESSIONS_KEY, resultList);

  return resultList;
}

/**
 * Revokes a user's session (Admin Force Logout) in real-time across devices
 */
export async function revokeUserSession(userId: string, deviceId?: string): Promise<{ success: boolean }> {
  const now = new Date().toISOString();

  // 1. Record in local revoked user set
  const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
  if (!revokedUsers.some((r) => r.id === userId)) {
    revokedUsers.push({ id: userId, revokedAt: now });
    setLocalStorage(STORAGE_REVOKED_USERS_KEY, revokedUsers);
  }

  if (deviceId) {
    const revokedDevices = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);
    if (!revokedDevices.some((r) => r.id === deviceId)) {
      revokedDevices.push({ id: deviceId, revokedAt: now });
      setLocalStorage(STORAGE_REVOKED_DEVICES_KEY, revokedDevices);
    }
  }

  // 2. Mark session inactive in local storage
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const updatedSessions = localSessions.map((s) => {
    if (s.user_id === userId || (deviceId && s.device_id === deviceId)) {
      return { ...s, is_active: false, revoked_at: now };
    }
    return s;
  });
  setLocalStorage(STORAGE_SESSIONS_KEY, updatedSessions);

  // 3. Dispatch window events for local instant response
  window.dispatchEvent(new CustomEvent('td_user_session_revoked', { detail: { userId, deviceId } }));
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  // 4. Update Supabase and broadcast real-time force-logout
  if (isSupabaseConfigured) {
    try {
      // Update database table
      await supabase
        .from('user_sessions')
        .update({ is_active: false, revoked_at: now })
        .or(`user_id.eq.${userId}${deviceId ? `,device_id.eq.${deviceId}` : ''}`);

      // Broadcast instant push event to student devices
      const authChannel = supabase.channel('system_auth_channel');
      await authChannel.send({
        type: 'broadcast',
        event: 'force_logout',
        payload: {
          userId,
          deviceId: deviceId || null,
          timestamp: Date.now(),
        },
      });
    } catch {
      // Handled locally
    }
  }

  return { success: true };
}

/**
 * Revokes multiple selected user sessions simultaneously
 */
export async function revokeMultipleUserSessions(
  userIds: string[],
  deviceIds: string[] = []
): Promise<{ success: boolean; count: number }> {
  const now = new Date().toISOString();
  const userSet = new Set(userIds);
  const deviceSet = new Set(deviceIds);

  // 1. Update local revoked lists
  const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
  userIds.forEach((uId) => {
    if (!revokedUsers.some((r) => r.id === uId)) {
      revokedUsers.push({ id: uId, revokedAt: now });
    }
  });
  setLocalStorage(STORAGE_REVOKED_USERS_KEY, revokedUsers);

  if (deviceIds.length > 0) {
    const revokedDevices = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);
    deviceIds.forEach((dId) => {
      if (!revokedDevices.some((r) => r.id === dId)) {
        revokedDevices.push({ id: dId, revokedAt: now });
      }
    });
    setLocalStorage(STORAGE_REVOKED_DEVICES_KEY, revokedDevices);
  }

  // 2. Mark inactive in local sessions
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const updatedSessions = localSessions.map((s) => {
    if (userSet.has(s.user_id) || deviceSet.has(s.device_id)) {
      return { ...s, is_active: false, revoked_at: now };
    }
    return s;
  });
  setLocalStorage(STORAGE_SESSIONS_KEY, updatedSessions);

  // 3. Dispatch local events
  window.dispatchEvent(new CustomEvent('td_user_session_revoked', { detail: { userIds, deviceIds } }));
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  // 4. Update Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase.rpc('revoke_user_sessions', {
        p_user_ids: userIds,
        p_device_ids: deviceIds,
      });

      const authChannel = supabase.channel('system_auth_channel');
      await authChannel.send({
        type: 'broadcast',
        event: 'force_logout_batch',
        payload: {
          userIds,
          deviceIds,
          timestamp: Date.now(),
        },
      });
    } catch {
      // Direct fallback
      try {
        await supabase
          .from('user_sessions')
          .update({ is_active: false, revoked_at: now })
          .in('user_id', userIds);
      } catch {
        // Handled locally
      }
    }
  }

  return { success: true, count: userIds.length };
}

/**
 * Revokes all student sessions across all devices (Global Force Logout)
 */
export async function revokeAllStudentSessions(): Promise<{ success: boolean }> {
  const now = new Date().toISOString();

  // 1. Mark all local student sessions as revoked
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);

  const updatedSessions = localSessions.map((s) => {
    if (s.role !== 'admin') {
      if (!revokedUsers.some((r) => r.id === s.user_id)) {
        revokedUsers.push({ id: s.user_id, revokedAt: now });
      }
      return { ...s, is_active: false, revoked_at: now };
    }
    return s;
  });

  setLocalStorage(STORAGE_REVOKED_USERS_KEY, revokedUsers);
  setLocalStorage(STORAGE_SESSIONS_KEY, updatedSessions);

  window.dispatchEvent(new CustomEvent('td_user_session_revoked', { detail: { all: true } }));
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  if (isSupabaseConfigured) {
    try {
      await supabase.rpc('revoke_all_student_sessions');

      const authChannel = supabase.channel('system_auth_channel');
      await authChannel.send({
        type: 'broadcast',
        event: 'force_logout_all',
        payload: {
          all: true,
          timestamp: Date.now(),
        },
      });
    } catch {
      try {
        await supabase
          .from('user_sessions')
          .update({ is_active: false, revoked_at: now })
          .eq('role', 'student');
      } catch {
        // Handled locally
      }
    }
  }

  return { success: true };
}

/**
 * Checks if a specific user or device is currently marked as revoked
 */
export function isSessionRevoked(userId?: string, deviceId?: string): boolean {
  if (!userId && !deviceId) return false;

  const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
  const revokedDevices = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);

  if (userId && revokedUsers.some((r) => r.id === userId)) {
    return true;
  }

  if (deviceId && revokedDevices.some((r) => r.id === deviceId)) {
    return true;
  }

  return false;
}

/**
 * Removes user/device from local revoked registry upon fresh login
 */
function unrevokeUserSessionLocally(userId: string, deviceId?: string): void {
  try {
    const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
    const filteredUsers = revokedUsers.filter((r) => r.id !== userId);
    setLocalStorage(STORAGE_REVOKED_USERS_KEY, filteredUsers);

    if (deviceId) {
      const revokedDevices = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);
      const filteredDevices = revokedDevices.filter((r) => r.id !== deviceId);
      setLocalStorage(STORAGE_REVOKED_DEVICES_KEY, filteredDevices);
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Reactivates a user session (Admin allows access again)
 */
export async function reactivateUserSession(userId: string): Promise<{ success: boolean }> {
  unrevokeUserSessionLocally(userId);

  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const updated = localSessions.map((s) => {
    if (s.user_id === userId) {
      return { ...s, is_active: true, revoked_at: undefined };
    }
    return s;
  });
  setLocalStorage(STORAGE_SESSIONS_KEY, updated);
  window.dispatchEvent(new Event('td_user_sessions_updated'));

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('user_sessions')
        .update({ is_active: true, revoked_at: null })
        .eq('user_id', userId);
    } catch {
      // Handled locally
    }
  }

  return { success: true };
}
