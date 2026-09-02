/**
 * Device Fingerprint & Identifier Module
 * Associates device ID with student profiles and isolates vote storage per user
 */

const DEVICE_ID_KEY = 'td_device_id';

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
 * Returns the list of category IDs that have been voted on by a specific user
 */
export function getUserSubmittedCategories(userId?: string): string[] {
  try {
    const key = getUserSubmittedCategoriesKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);

    // Fallback: check legacy non-namespaced key if userId matches current demo user
    if (!userId) {
      const legacy = localStorage.getItem('td_submitted_categories');
      return legacy ? JSON.parse(legacy) : [];
    }

    return [];
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

    // Also store device-level registration map for admin audit
    const deviceId = getOrCreateDeviceId();
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
 * Checks whether a specific user has already submitted a vote for a given category
 */
export function hasUserVotedInCategory(categoryId: string, userId?: string): boolean {
  if (!categoryId) return false;
  const voted = getUserSubmittedCategories(userId);
  return voted.includes(categoryId);
}

