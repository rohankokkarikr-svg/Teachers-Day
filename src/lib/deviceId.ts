/**
 * Device Fingerprint & Identifier Module
 * Associates device ID with student profiles and isolates vote storage per user
 */

const DEVICE_ID_KEY = 'td_device_id';
const DEVICE_BOUND_STUDENT_KEY = 'td_device_bound_student';

export interface DeviceBinding {
  name: string;
  slug: string;
  boundAt: string;
}

/**
 * Retrieves the student account permanently bound to this device
 */
export function getDeviceBoundStudent(): DeviceBinding | null {
  try {
    const raw = localStorage.getItem(DEVICE_BOUND_STUDENT_KEY);
    if (raw) return JSON.parse(raw);

    const cookieMatch = document.cookie.match(new RegExp(`(^| )${DEVICE_BOUND_STUDENT_KEY}=([^;]+)`));
    if (cookieMatch) {
      return JSON.parse(decodeURIComponent(cookieMatch[2]));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Permanently binds this physical device to the first student account created on it
 */
export function bindDeviceToStudent(fullName: string): void {
  try {
    const cleanName = fullName.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    const binding: DeviceBinding = {
      name: cleanName,
      slug,
      boundAt: new Date().toISOString(),
    };
    localStorage.setItem(DEVICE_BOUND_STUDENT_KEY, JSON.stringify(binding));
    try {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `${DEVICE_BOUND_STUDENT_KEY}=${encodeURIComponent(JSON.stringify(binding))}; expires=${expires}; path=/; SameSite=Lax`;
    } catch {
      // Ignore cookie error
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Checks if this device is already bound to a different student account
 */
export function isDeviceBoundToDifferentStudent(fullName: string): { isBlocked: boolean; boundName?: string } {
  const bound = getDeviceBoundStudent();
  if (!bound || !bound.name) return { isBlocked: false };

  const currentSlug = fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
  if (bound.slug && bound.slug !== currentSlug) {
    return { isBlocked: true, boundName: bound.name };
  }
  return { isBlocked: false, boundName: bound.name };
}

/**
 * Generates or retrieves a persistent, unique Device ID
 */
export function getOrCreateDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Also check document cookie fallback
      const cookieMatch = document.cookie.match(new RegExp(`(^| )${DEVICE_ID_KEY}=([^;]+)`));
      if (cookieMatch) {
        deviceId = decodeURIComponent(cookieMatch[2]);
      }
    }

    if (!deviceId) {
      const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);

      deviceId = `dev_${randomPart}`;
    }

    // Persist to localStorage & cookie (1 year expiry)
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    try {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `${DEVICE_ID_KEY}=${encodeURIComponent(deviceId)}; expires=${expires}; path=/; SameSite=Lax`;
    } catch {
      // Ignore cookie errors
    }

    return deviceId;
  } catch {
    return 'dev_fallback_' + Date.now();
  }
}

/**
 * Returns storage key for a user's submitted categories
 */
export function getUserSubmittedCategoriesKey(userId?: string): string {
  return userId ? `td_submitted_categories_${userId}` : 'td_submitted_categories_guest';
}

/**
 * Returns the list of category IDs that have been voted on by a specific user or device
 */
export function getUserSubmittedCategories(userId?: string): string[] {
  try {
    const key = getUserSubmittedCategoriesKey(userId);
    const raw = localStorage.getItem(key);
    const userVoted = raw ? JSON.parse(raw) : [];

    // Also check global device vote record
    const deviceId = getOrCreateDeviceId();
    const deviceKey = `td_device_voted_categories_${deviceId}`;
    const rawDevice = localStorage.getItem(deviceKey);
    const deviceVoted = rawDevice ? JSON.parse(rawDevice) : [];

    const merged = Array.from(new Set([...userVoted, ...deviceVoted]));
    return merged;
  } catch {
    return [];
  }
}

/**
 * Records that a specific user has submitted a vote in a category
 */
export function recordUserCategoryVote(categoryId: string, userId?: string): void {
  try {
    const key = getUserSubmittedCategoriesKey(userId);
    const existing = getUserSubmittedCategories(userId);
    if (!existing.includes(categoryId)) {
      const updated = [...existing, categoryId];
      localStorage.setItem(key, JSON.stringify(updated));
    }

    // Also lock device for this category
    const deviceId = getOrCreateDeviceId();
    const deviceKey = `td_device_voted_categories_${deviceId}`;
    const rawDevice = localStorage.getItem(deviceKey);
    const deviceVoted = rawDevice ? JSON.parse(rawDevice) : [];
    if (!deviceVoted.includes(categoryId)) {
      deviceVoted.push(categoryId);
      localStorage.setItem(deviceKey, JSON.stringify(deviceVoted));
    }

    // Also store device-level registration map for admin audit
    const deviceLogsKey = 'td_device_audit_log';
    const rawLogs = localStorage.getItem(deviceLogsKey);
    const logs = rawLogs ? JSON.parse(rawLogs) : [];
    logs.push({
      user_id: userId || 'anonymous',
      category_id: categoryId,
      device_id: deviceId,
      voted_at: new Date().toISOString(),
    });
    localStorage.setItem(deviceLogsKey, JSON.stringify(logs.slice(-50)));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Removes a specific category from local user & device voted records
 */
export function removeCategoryVoteLocally(categoryId: string, userId?: string): void {
  try {
    const key = getUserSubmittedCategoriesKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const list: string[] = JSON.parse(raw);
      const filtered = list.filter((id) => id !== categoryId);
      localStorage.setItem(key, JSON.stringify(filtered));
    }

    const deviceId = getOrCreateDeviceId();
    const deviceKey = `td_device_voted_categories_${deviceId}`;
    const rawDevice = localStorage.getItem(deviceKey);
    if (rawDevice) {
      const list: string[] = JSON.parse(rawDevice);
      const filtered = list.filter((id) => id !== categoryId);
      localStorage.setItem(deviceKey, JSON.stringify(filtered));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Synchronizes the local user and device voted category list with ground truth (e.g. Supabase)
 */
export function syncUserSubmittedCategories(activeCategoryIds: string[], userId?: string): void {
  try {
    const key = getUserSubmittedCategoriesKey(userId);
    localStorage.setItem(key, JSON.stringify(activeCategoryIds));

    const deviceId = getOrCreateDeviceId();
    const deviceKey = `td_device_voted_categories_${deviceId}`;
    localStorage.setItem(deviceKey, JSON.stringify(activeCategoryIds));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Checks whether a specific user or this device has already submitted a vote for a given category
 */
export function hasUserVotedInCategory(categoryId: string, userId?: string): boolean {
  if (!categoryId) return false;
  const voted = getUserSubmittedCategories(userId);
  return voted.includes(categoryId);
}

/**
 * Clears all local device bindings, cookies, voter histories, draft votes, and ballots
 */
export function clearDeviceBindingsAndVotes(): void {
  try {
    localStorage.removeItem(DEVICE_BOUND_STUDENT_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem('td_device_audit_log');
    localStorage.removeItem('td_registered_students');
    localStorage.removeItem('td_category_vote_totals');

    // Remove all user ballot keys, draft keys, student id keys, device vote keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('td_submitted_categories') ||
          key.startsWith('td_device_voted_categories') ||
          key.startsWith('td_draft_votes') ||
          key.startsWith('td_votes_') ||
          key.startsWith('td_student_id_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // Clear all cookies
    document.cookie = `${DEVICE_BOUND_STUDENT_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    document.cookie = `${DEVICE_ID_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  } catch {
    // Ignore storage errors
  }
}


