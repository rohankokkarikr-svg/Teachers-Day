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
const STORAGE_REVOKED_EMAILS_KEY = 'td_revoked_emails';
const STORAGE_REVOKED_NAMES_KEY = 'td_revoked_names';

interface RevokedRecord {
  id: string; // userId, deviceId, email, or name-slug
  revokedAt: string;
}

export interface AccessCheckParams {
  userId?: string;
  name?: string;
  email?: string;
  deviceId?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
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
 * Normalizes a student's name into a matching key
 */
function normalizeNameKey(name?: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
}

/**
 * Checks synchronously if a user, device, name, or email is currently marked as revoked
 */
export function isSessionRevoked(
  userId?: string,
  deviceId?: string,
  name?: string,
  email?: string
): boolean {
  if (!userId && !deviceId && !name && !email) return false;

  const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
  const revokedDevices = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);
  const revokedEmails = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_EMAILS_KEY, []);
  const revokedNames = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_NAMES_KEY, []);

  if (userId && revokedUsers.some((r) => r.id === userId)) {
    return true;
  }

  if (deviceId && revokedDevices.some((r) => r.id === deviceId)) {
    return true;
  }

  if (email && revokedEmails.some((r) => r.id.toLowerCase() === email.toLowerCase())) {
    return true;
  }

  const nameSlug = normalizeNameKey(name);
  if (nameSlug && revokedNames.some((r) => r.id === nameSlug)) {
    return true;
  }

  // Also check local session table
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const matched = localSessions.find(
    (s) =>
      (userId && s.user_id === userId) ||
      (email && s.email.toLowerCase() === email.toLowerCase()) ||
      (nameSlug && normalizeNameKey(s.full_name) === nameSlug) ||
      (deviceId && s.device_id === deviceId)
  );

  if (matched && matched.is_active === false) {
    return true;
  }

  return false;
}

/**
 * Comprehensive async access check: checks both local storage and Supabase remote records across profiles and user_sessions.
 * If revoked by the admin, returns allowed: false and blocks login or session access across all devices.
 */
export async function checkUserAccessAllowed(params: AccessCheckParams): Promise<AccessCheckResult> {
  const { userId, name, email, deviceId } = params;
  const nameSlug = normalizeNameKey(name);
  const derivedEmail = email || (nameSlug ? `${nameSlug}@student.college` : undefined);

  // 1. Fast local synchronous check
  if (isSessionRevoked(userId, deviceId, name, derivedEmail)) {
    return {
      allowed: false,
      reason:
        'Access Denied: Your account access has been restricted by the administrator. You cannot log in until an administrator grants you access.',
    };
  }

  // 2. Supabase remote ground truth check
  if (isSupabaseConfigured) {
    try {
      // 2a. Check user_sessions table
      const sessionQueries: PromiseLike<any>[] = [];
      if (userId) {
        sessionQueries.push(
          supabase
            .from('user_sessions')
            .select('id, user_id, email, is_active, revoked_at')
            .eq('user_id', userId)
            .limit(1)
        );
      }
      if (derivedEmail) {
        sessionQueries.push(
          supabase
            .from('user_sessions')
            .select('id, user_id, email, is_active, revoked_at')
            .ilike('email', derivedEmail)
            .limit(1)
        );
      }
      if (name) {
        sessionQueries.push(
          supabase
            .from('user_sessions')
            .select('id, user_id, email, is_active, revoked_at')
            .ilike('full_name', name.trim())
            .limit(1)
        );
      }
      if (deviceId) {
        sessionQueries.push(
          supabase
            .from('user_sessions')
            .select('id, user_id, email, is_active, revoked_at')
            .eq('device_id', deviceId)
            .limit(1)
        );
      }

      // 2b. Check profiles table
      const profileQueries: PromiseLike<any>[] = [];
      if (userId) {
        profileQueries.push(
          supabase
            .from('profiles')
            .select('id, email, is_active, revoked_at')
            .eq('id', userId)
            .limit(1)
        );
      }
      if (derivedEmail) {
        profileQueries.push(
          supabase
            .from('profiles')
            .select('id, email, is_active, revoked_at')
            .ilike('email', derivedEmail)
            .limit(1)
        );
      }
      if (name) {
        profileQueries.push(
          supabase
            .from('profiles')
            .select('id, email, is_active, revoked_at')
            .ilike('full_name', name.trim())
            .limit(1)
        );
      }
      if (deviceId) {
        profileQueries.push(
          supabase
            .from('profiles')
            .select('id, email, is_active, revoked_at')
            .eq('device_id', deviceId)
            .limit(1)
        );
      }

      const allResponses = await Promise.all([...sessionQueries, ...profileQueries]);

      for (const res of allResponses) {
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          const row = res.data[0];
          if (row.is_active === false || row.revoked_at != null) {
            // Persist locally so subsequent checks block immediately
            if (userId) markUserRevokedLocally(userId);
            if (deviceId) markDeviceRevokedLocally(deviceId);
            if (derivedEmail) markEmailRevokedLocally(derivedEmail);
            if (nameSlug) markNameRevokedLocally(nameSlug);

            return {
              allowed: false,
              reason:
                'Access Denied: Your account access has been restricted by the administrator. You cannot log in until an administrator grants you access.',
            };
          }
        }
      }
    } catch {
      // Handled locally
    }
  }

  return { allowed: true };
}

function markUserRevokedLocally(userId: string) {
  const list = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
  if (!list.some((r) => r.id === userId)) {
    list.push({ id: userId, revokedAt: new Date().toISOString() });
    setLocalStorage(STORAGE_REVOKED_USERS_KEY, list);
  }
}

function markDeviceRevokedLocally(deviceId: string) {
  const list = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);
  if (!list.some((r) => r.id === deviceId)) {
    list.push({ id: deviceId, revokedAt: new Date().toISOString() });
    setLocalStorage(STORAGE_REVOKED_DEVICES_KEY, list);
  }
}

function markEmailRevokedLocally(email: string) {
  const list = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_EMAILS_KEY, []);
  const clean = email.toLowerCase();
  if (!list.some((r) => r.id === clean)) {
    list.push({ id: clean, revokedAt: new Date().toISOString() });
    setLocalStorage(STORAGE_REVOKED_EMAILS_KEY, list);
  }
}

function markNameRevokedLocally(nameSlug: string) {
  const list = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_NAMES_KEY, []);
  if (!list.some((r) => r.id === nameSlug)) {
    list.push({ id: nameSlug, revokedAt: new Date().toISOString() });
    setLocalStorage(STORAGE_REVOKED_NAMES_KEY, list);
  }
}

/**
 * Records a user's login session both locally and in Supabase.
 * NOTE: Does NOT unrevoke automatically. Only authorized admin reactivation can unrevoke.
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

const lastHeartbeatSentMap = new Map<string, number>();

/**
 * Updates a user's last active heartbeat timestamp (throttled to max 1 update per 25s)
 */
export async function updateSessionHeartbeat(userId: string, deviceId?: string): Promise<void> {
  const dId = deviceId || getOrCreateDeviceId();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const idx = localSessions.findIndex((s) => s.user_id === userId);
  if (idx >= 0 && localSessions[idx].is_active) {
    localSessions[idx].last_active_at = now;
    setLocalStorage(STORAGE_SESSIONS_KEY, localSessions);
  }

  // Throttle remote DB heartbeat call (max once every 25 seconds per user)
  const lastSent = lastHeartbeatSentMap.get(userId) || 0;
  if (nowMs - lastSent < 25000) {
    return;
  }
  lastHeartbeatSentMap.set(userId, nowMs);

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
  const revokedEmails = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_EMAILS_KEY, []);
  const revokedNames = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_NAMES_KEY, []);
  const revokedDevices = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);

  const revokedUserSet = new Set(revokedUsers.map((r) => r.id));
  const revokedEmailSet = new Set(revokedEmails.map((r) => r.id.toLowerCase()));
  const revokedNameSet = new Set(revokedNames.map((r) => r.id));
  const revokedDeviceSet = new Set(revokedDevices.map((r) => r.id));

  const isIdentifierRevoked = (uId: string, email?: string, name?: string, devId?: string) => {
    if (revokedUserSet.has(uId)) return true;
    if (email && revokedEmailSet.has(email.toLowerCase())) return true;
    if (name && revokedNameSet.has(normalizeNameKey(name))) return true;
    if (devId && revokedDeviceSet.has(devId)) return true;
    return false;
  };

  // Build map of sessions by user_id
  const sessionMap = new Map<string, UserSessionRecord>();

  // Add all local sessions
  localSessions.forEach((s) => {
    const isRevoked = isIdentifierRevoked(s.user_id, s.email, s.full_name, s.device_id) || s.is_active === false;
    const votes = getUserSubmittedCategories(s.user_id);
    sessionMap.set(s.user_id, {
      ...s,
      is_active: !isRevoked,
      voted_categories_count: votes.length,
      total_categories_count: 8,
    });
  });

  // Ensure any students in registeredStudents have an entry
  registeredStudents.forEach((studentName) => {
    const slug = normalizeNameKey(studentName);
    const studentId = localStorage.getItem(`td_student_id_${slug}`) || `std_${slug}`;
    const email = `${slug}@student.college`;

    if (!sessionMap.has(studentId)) {
      const votes = getUserSubmittedCategories(studentId);
      const isRevoked = isIdentifierRevoked(studentId, email, studentName);
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
      const email = `${log.user_id}@student.college`;
      const isRevoked = isIdentifierRevoked(log.user_id, email, undefined, log.device_id);
      sessionMap.set(log.user_id, {
        id: `sess_${log.user_id}`,
        user_id: log.user_id,
        full_name: log.user_id.replace(/^std_/, '').replace(/\./g, ' ').toUpperCase(),
        email,
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
            const isRevoked = isIdentifierRevoked(p.id, p.email, p.full_name, p.device_id);
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
          const isRemotelyRevoked = remoteS.is_active === false || remoteS.revoked_at != null;
          const isLocallyRevoked = isIdentifierRevoked(remoteS.user_id, remoteS.email, remoteS.full_name, remoteS.device_id);
          const isRevoked = isRemotelyRevoked || isLocallyRevoked;

          // Sync remote revocation to local storage
          if (isRemotelyRevoked) {
            markUserRevokedLocally(remoteS.user_id);
            if (remoteS.device_id) markDeviceRevokedLocally(remoteS.device_id);
            if (remoteS.email) markEmailRevokedLocally(remoteS.email);
            if (remoteS.full_name) markNameRevokedLocally(normalizeNameKey(remoteS.full_name));
          }

          sessionMap.set(remoteS.user_id, {
            id: remoteS.id || `sess_${remoteS.user_id}`,
            user_id: remoteS.user_id,
            full_name: remoteS.full_name,
            email: remoteS.email,
            role: remoteS.role || 'student',
            device_id: remoteS.device_id,
            user_agent: remoteS.user_agent || 'Web Client',
            ip_address: remoteS.ip_address,
            is_active: !isRevoked,
            login_at: remoteS.login_at || remoteS.created_at || new Date().toISOString(),
            last_active_at: remoteS.last_active_at || new Date().toISOString(),
            revoked_at: isRevoked ? (remoteS.revoked_at || new Date().toISOString()) : undefined,
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
 * Revokes a user's session (Admin Force Logout & Restrict Access) in real-time across devices
 */
export async function revokeUserSession(
  userId: string,
  deviceId?: string,
  fullName?: string,
  email?: string
): Promise<{ success: boolean }> {
  const now = new Date().toISOString();
  const nameSlug = normalizeNameKey(fullName);
  const cleanEmail = email || (nameSlug ? `${nameSlug}@student.college` : undefined);

  // 1. Mark in all local revocation sets
  markUserRevokedLocally(userId);
  if (deviceId) markDeviceRevokedLocally(deviceId);
  if (cleanEmail) markEmailRevokedLocally(cleanEmail);
  if (nameSlug) markNameRevokedLocally(nameSlug);

  // 2. Mark session inactive in local storage
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const updatedSessions = localSessions.map((s) => {
    if (
      s.user_id === userId ||
      (deviceId && s.device_id === deviceId) ||
      (cleanEmail && s.email.toLowerCase() === cleanEmail.toLowerCase()) ||
      (nameSlug && normalizeNameKey(s.full_name) === nameSlug)
    ) {
      return { ...s, is_active: false, revoked_at: now };
    }
    return s;
  });
  setLocalStorage(STORAGE_SESSIONS_KEY, updatedSessions);

  // 3. Dispatch window events for local instant response
  window.dispatchEvent(
    new CustomEvent('td_user_session_revoked', {
      detail: { userId, deviceId, name: fullName, email: cleanEmail },
    })
  );
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  // 4. Update Supabase across user_sessions and profiles
  if (isSupabaseConfigured) {
    try {
      // 4a. Update user_sessions
      const sessionUpdate = supabase
        .from('user_sessions')
        .update({ is_active: false, revoked_at: now });

      if (userId) {
        await sessionUpdate.eq('user_id', userId);
      } else if (cleanEmail) {
        await sessionUpdate.ilike('email', cleanEmail);
      }

      // Guarantee at least one revoked record exists in user_sessions
      await supabase.from('user_sessions').upsert(
        {
          user_id: userId,
          full_name: fullName || 'Student',
          email: cleanEmail || `${userId}@student.college`,
          device_id: deviceId || getOrCreateDeviceId(),
          is_active: false,
          revoked_at: now,
        },
        { onConflict: 'user_id,device_id' }
      );

      // 4b. Update profiles table
      try {
        if (userId) {
          await supabase
            .from('profiles')
            .update({ is_active: false, revoked_at: now })
            .eq('id', userId);
        }
        if (cleanEmail) {
          await supabase
            .from('profiles')
            .update({ is_active: false, revoked_at: now })
            .ilike('email', cleanEmail);
        }
        if (fullName) {
          await supabase
            .from('profiles')
            .update({ is_active: false, revoked_at: now })
            .ilike('full_name', fullName.trim());
        }
      } catch {
        // Handled gracefully
      }

      // 4c. Broadcast instant push event to student devices
      const authChannel = supabase.channel('system_auth_channel');
      await authChannel.send({
        type: 'broadcast',
        event: 'force_logout',
        payload: {
          userId,
          deviceId: deviceId || null,
          email: cleanEmail || null,
          name: fullName || null,
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
  userIds.forEach((uId) => markUserRevokedLocally(uId));
  deviceIds.forEach((dId) => markDeviceRevokedLocally(dId));

  // 2. Mark inactive in local sessions
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const updatedSessions = localSessions.map((s) => {
    if (userSet.has(s.user_id) || (s.device_id && deviceSet.has(s.device_id))) {
      markEmailRevokedLocally(s.email);
      markNameRevokedLocally(normalizeNameKey(s.full_name));
      return { ...s, is_active: false, revoked_at: now };
    }
    return s;
  });
  setLocalStorage(STORAGE_SESSIONS_KEY, updatedSessions);

  // 3. Dispatch local events
  window.dispatchEvent(
    new CustomEvent('td_user_session_revoked', { detail: { userIds, deviceIds } })
  );
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  // 4. Update Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase.rpc('revoke_user_sessions', {
        p_user_ids: userIds,
        p_device_ids: deviceIds,
      });

      // Direct fallbacks for both tables
      await supabase
        .from('user_sessions')
        .update({ is_active: false, revoked_at: now })
        .in('user_id', userIds);

      await supabase
        .from('profiles')
        .update({ is_active: false, revoked_at: now })
        .in('id', userIds);

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
      // Handled locally
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
  const updatedSessions = localSessions.map((s) => {
    if (s.role !== 'admin') {
      markUserRevokedLocally(s.user_id);
      markDeviceRevokedLocally(s.device_id);
      markEmailRevokedLocally(s.email);
      markNameRevokedLocally(normalizeNameKey(s.full_name));
      return { ...s, is_active: false, revoked_at: now };
    }
    return s;
  });

  setLocalStorage(STORAGE_SESSIONS_KEY, updatedSessions);

  window.dispatchEvent(new CustomEvent('td_user_session_revoked', { detail: { all: true } }));
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  if (isSupabaseConfigured) {
    try {
      await supabase.rpc('revoke_all_student_sessions');

      await supabase
        .from('user_sessions')
        .update({ is_active: false, revoked_at: now })
        .eq('role', 'student');

      await supabase
        .from('profiles')
        .update({ is_active: false, revoked_at: now })
        .eq('role', 'student');

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
      // Handled locally
    }
  }

  return { success: true };
}

/**
 * Removes user/device/email/name from all local revoked registries
 */
export function unrevokeUserSessionLocally(
  userId: string,
  deviceId?: string,
  email?: string,
  name?: string
): void {
  try {
    const revokedUsers = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_USERS_KEY, []);
    setLocalStorage(
      STORAGE_REVOKED_USERS_KEY,
      revokedUsers.filter((r) => r.id !== userId)
    );

    if (deviceId) {
      const revokedDevices = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_DEVICES_KEY, []);
      setLocalStorage(
        STORAGE_REVOKED_DEVICES_KEY,
        revokedDevices.filter((r) => r.id !== deviceId)
      );
    }

    if (email) {
      const revokedEmails = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_EMAILS_KEY, []);
      setLocalStorage(
        STORAGE_REVOKED_EMAILS_KEY,
        revokedEmails.filter((r) => r.id.toLowerCase() !== email.toLowerCase())
      );
    }

    const nameSlug = normalizeNameKey(name);
    if (nameSlug) {
      const revokedNames = getLocalStorage<RevokedRecord[]>(STORAGE_REVOKED_NAMES_KEY, []);
      setLocalStorage(
        STORAGE_REVOKED_NAMES_KEY,
        revokedNames.filter((r) => r.id !== nameSlug)
      );
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Reactivates a single user session (Admin grants access again)
 */
export async function reactivateUserSession(
  userId: string,
  deviceId?: string,
  email?: string,
  name?: string
): Promise<{ success: boolean }> {
  const nameSlug = normalizeNameKey(name);
  const cleanEmail = email || (nameSlug ? `${nameSlug}@student.college` : undefined);

  // 1. Unrevoke from all local storage lists
  unrevokeUserSessionLocally(userId, deviceId, cleanEmail, name);

  // 2. Mark active in local sessions
  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const updated = localSessions.map((s) => {
    if (
      s.user_id === userId ||
      (cleanEmail && s.email.toLowerCase() === cleanEmail.toLowerCase()) ||
      (name && normalizeNameKey(s.full_name) === nameSlug) ||
      (deviceId && s.device_id === deviceId)
    ) {
      unrevokeUserSessionLocally(s.user_id, s.device_id, s.email, s.full_name);
      return { ...s, is_active: true, revoked_at: undefined };
    }
    return s;
  });
  setLocalStorage(STORAGE_SESSIONS_KEY, updated);

  // 3. Dispatch local reactivation events
  window.dispatchEvent(
    new CustomEvent('td_user_session_reactivated', { detail: { userId, email: cleanEmail, name } })
  );
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  // 4. Update Supabase across user_sessions and profiles
  if (isSupabaseConfigured) {
    try {
      // 4a. Update user_sessions table
      if (userId) {
        await supabase
          .from('user_sessions')
          .update({ is_active: true, revoked_at: null })
          .eq('user_id', userId);
      }
      if (cleanEmail) {
        await supabase
          .from('user_sessions')
          .update({ is_active: true, revoked_at: null })
          .ilike('email', cleanEmail);
      }
      if (name) {
        await supabase
          .from('user_sessions')
          .update({ is_active: true, revoked_at: null })
          .ilike('full_name', name.trim());
      }
      if (deviceId) {
        await supabase
          .from('user_sessions')
          .update({ is_active: true, revoked_at: null })
          .eq('device_id', deviceId);
      }

      // 4b. Update profiles table
      try {
        if (userId) {
          await supabase
            .from('profiles')
            .update({ is_active: true, revoked_at: null })
            .eq('id', userId);
        }
        if (cleanEmail) {
          await supabase
            .from('profiles')
            .update({ is_active: true, revoked_at: null })
            .ilike('email', cleanEmail);
        }
        if (name) {
          await supabase
            .from('profiles')
            .update({ is_active: true, revoked_at: null })
            .ilike('full_name', name.trim());
        }
      } catch {
        // Handled gracefully
      }

      // 4c. Broadcast access restored event
      const authChannel = supabase.channel('system_auth_channel');
      await authChannel.send({
        type: 'broadcast',
        event: 'user_access_granted',
        payload: {
          userId,
          email: cleanEmail || null,
          name: name || null,
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
 * Reactivates multiple user sessions simultaneously (Admin grants access to batch)
 */
export async function reactivateMultipleUserSessions(
  userIds: string[]
): Promise<{ success: boolean; count: number }> {
  const userSet = new Set(userIds);

  // 1. Update local storage
  userIds.forEach((uId) => unrevokeUserSessionLocally(uId));

  const localSessions = getLocalStorage<UserSessionRecord[]>(STORAGE_SESSIONS_KEY, []);
  const updated = localSessions.map((s) => {
    if (userSet.has(s.user_id)) {
      unrevokeUserSessionLocally(s.user_id, s.device_id, s.email, s.full_name);
      return { ...s, is_active: true, revoked_at: undefined };
    }
    return s;
  });
  setLocalStorage(STORAGE_SESSIONS_KEY, updated);

  // 2. Dispatch events
  window.dispatchEvent(
    new CustomEvent('td_user_session_reactivated', { detail: { userIds } })
  );
  window.dispatchEvent(new Event('td_user_sessions_updated'));
  window.dispatchEvent(new Event('storage'));

  // 3. Supabase update across user_sessions and profiles
  if (isSupabaseConfigured) {
    try {
      await supabase.rpc('reactivate_user_sessions', {
        p_user_ids: userIds,
      });

      await supabase
        .from('user_sessions')
        .update({ is_active: true, revoked_at: null })
        .in('user_id', userIds);

      await supabase
        .from('profiles')
        .update({ is_active: true, revoked_at: null })
        .in('id', userIds);

      const authChannel = supabase.channel('system_auth_channel');
      await authChannel.send({
        type: 'broadcast',
        event: 'user_access_granted_batch',
        payload: {
          userIds,
          timestamp: Date.now(),
        },
      });
    } catch {
      // Handled locally
    }
  }

  return { success: true, count: userIds.length };
}



