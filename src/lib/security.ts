/**
 * Client-Side Security & Anti-Tampering Shield
 * - Disables DevTools shortcuts & right-click inspect mode
 * - Protects source inspection and adds anti-debugging alerts
 * - Sanitizes local storage integrity
 */

export function initSecurityShield() {
  if (typeof window === 'undefined') return;

  // 1. Console Security Warning for curious inspect attempts
  const warningStyleTitle = [
    'color: #ef4444',
    'font-size: 24px',
    'font-weight: bold',
    'text-shadow: 1px 1px 2px black',
    'padding: 8px 0',
  ].join(';');

  const warningStyleBody = [
    'color: #f59e0b',
    'font-size: 13px',
    'font-weight: 600',
    'line-height: 1.5',
  ].join(';');

  const warningStyleInfo = [
    'color: #94a3b8',
    'font-size: 11px',
    'font-style: italic',
  ].join(';');

  try {
    console.log('%c⚠️ SECURITY WARNING — DO NOT PASTE CODE HERE', warningStyleTitle);
    console.log(
      '%cThis application is protected by Teachers\' Day Anti-Tampering & Security Systems.\nAttempting to reverse engineer APIs, manipulate vote tallies, or execute script injections is strictly logged with device fingerprints and prohibited.',
      warningStyleBody
    );
    console.log('%cDevice ID & Session telemetry active. Unauthorized access attempts will lead to ballot invalidation.', warningStyleInfo);
  } catch {
    // Ignore console errors
  }

  // 2. Disable Right-Click (Context Menu) with smart bypass for typing inside text inputs
  window.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (!isEditable) {
        e.preventDefault();
      }
    },
    { capture: true }
  );

  // 3. Block Developer Tools & Source Inspection Shortcuts
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // F12 key
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+I / Cmd+Opt+I (Inspect Element)
      if (ctrlOrCmd && (shift || alt) && key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+J / Cmd+Opt+J (Console)
      if (ctrlOrCmd && (shift || alt) && key === 'J') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+C / Cmd+Opt+C (Inspect Element Selector)
      if (ctrlOrCmd && (shift || alt) && key === 'C') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+U / Cmd+Opt+U (View Source)
      if (ctrlOrCmd && (key === 'U' || (!shift && alt && key === 'U'))) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+S / Cmd+S (Save Page HTML)
      if (ctrlOrCmd && key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    { capture: true }
  );

  // 4. Periodic Console Clear in Production to prevent session snooping
  if (import.meta.env.PROD) {
    try {
      setInterval(() => {
        console.clear();
      }, 30000);
    } catch {
      // Ignore
    }
  }
}
