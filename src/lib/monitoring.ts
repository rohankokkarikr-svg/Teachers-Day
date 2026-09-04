/**
 * TEACHERS' DAY AWARDS PLATFORM 2026
 * Lightweight Client-Side Production Monitoring & Health Tracking
 *
 * Safe, sanitized telemetry for application health, voting RPCs,
 * realtime lifecycle, and performance metrics.
 * NEVER logs passwords, JWTs, secrets, or private tokens.
 */

export type SystemHealth = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type RealtimeStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface MonitoredError {
  message: string;
  category: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface MonitoredEvent {
  name: string;
  category: 'voting' | 'leaderboard' | 'realtime' | 'system';
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface MonitoredMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'ratio';
  timestamp: number;
}

// In-memory ring buffers (capped to prevent memory growth)
const MAX_BUFFER_SIZE = 50;
const recentErrors: MonitoredError[] = [];
const recentEvents: MonitoredEvent[] = [];
const metrics: Record<string, number[]> = {};

let realtimeStatus: RealtimeStatus = 'DISCONNECTED';
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

/**
 * Sanitizes arbitrary values to ensure no secrets, keys, or JWTs are logged.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (typeof data === 'string') {
    return data
      .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
      .replace(/sb_(secret|publishable)_[a-zA-Z0-9_-]+/g, '[REDACTED_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer [REDACTED]')
      .replace(/("?password"?\s*:\s*)"[^"]+"/gi, '$1"[REDACTED]"');
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('key')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(val);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Captures an application error safely with sanitized context.
 */
export function captureError(error: unknown, context?: Record<string, unknown>, category = 'system') {
  const rawMsg = error instanceof Error ? error.message : String(error || 'Unknown error');
  const sanitizedMsg = String(sanitizeLogData(rawMsg));

  const entry: MonitoredError = {
    message: sanitizedMsg,
    category,
    timestamp: Date.now(),
    context: context ? (sanitizeLogData(context) as Record<string, unknown>) : undefined,
  };

  recentErrors.push(entry);
  if (recentErrors.length > MAX_BUFFER_SIZE) {
    recentErrors.shift();
  }

  if (import.meta.env.DEV) {
    console.warn(`[Monitoring] [${category.toUpperCase()}] ${sanitizedMsg}`, entry.context || '');
  }
}

/**
 * Records a functional lifecycle event.
 */
export function captureEvent(
  name: string,
  category: 'voting' | 'leaderboard' | 'realtime' | 'system' = 'system',
  data?: Record<string, unknown>
) {
  const entry: MonitoredEvent = {
    name,
    category,
    timestamp: Date.now(),
    data: data ? (sanitizeLogData(data) as Record<string, unknown>) : undefined,
  };

  recentEvents.push(entry);
  if (recentEvents.length > MAX_BUFFER_SIZE) {
    recentEvents.shift();
  }
}

/**
 * Records a latency or count metric.
 */
export function captureMetric(name: string, value: number, _unit: 'ms' | 'count' | 'ratio' = 'ms') {
  if (!metrics[name]) {
    metrics[name] = [];
  }
  metrics[name].push(value);
  if (metrics[name].length > 100) {
    metrics[name].shift();
  }
}

/**
 * Updates the tracked realtime connection status.
 */
export function setRealtimeStatus(status: RealtimeStatus) {
  if (realtimeStatus !== status) {
    realtimeStatus = status;
    captureEvent(`realtime_status_${status.toLowerCase()}`, 'realtime', { status });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('td_monitoring_status_change', { detail: { realtimeStatus: status } }));
    }
  }
}

/**
 * Returns the current health state:
 * - ONLINE: Internet connected and realtime active.
 * - DEGRADED: Internet connected but realtime disconnected (fallback polling active).
 * - OFFLINE: Browser offline / internet lost.
 */
export function getSystemHealth(): SystemHealth {
  if (!isOnline) return 'OFFLINE';
  if (realtimeStatus === 'CONNECTED') return 'ONLINE';
  return 'DEGRADED';
}

/**
 * Provides a snapshot summary for admin dashboards or telemetry.
 */
export function getMonitoringSummary() {
  const voteEvents = recentEvents.filter((e) => e.category === 'voting');
  const voteSuccessCount = voteEvents.filter((e) => e.name === 'vote_submitted_success').length;
  const voteRejectCount = voteEvents.filter((e) => e.name === 'vote_submitted_rejected').length;

  return {
    health: getSystemHealth(),
    isOnline,
    realtimeStatus,
    totalErrorsCaptured: recentErrors.length,
    recentErrors: [...recentErrors],
    voteSuccessCount,
    voteRejectCount,
    metricsSummary: Object.fromEntries(
      Object.entries(metrics).map(([k, values]) => {
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / (values.length || 1));
        return [k, { avg, count: values.length }];
      })
    ),
  };
}

// Global browser listeners for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    captureEvent('network_online', 'system');
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    captureEvent('network_offline', 'system');
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, { type: 'unhandledrejection' }, 'system');
  });
}
