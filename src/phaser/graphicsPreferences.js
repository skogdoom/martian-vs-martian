// Presentation preferences deliberately live outside the original game options.
// An artwork change never changes a session, a world or its random stream.
export const GRAPHICS_KEY = 'martian-vs-martian.graphics';

export function createGraphicsPreferences(storage, search = '') {
  let classic = false;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    classic = JSON.parse(storage?.getItem(GRAPHICS_KEY))?.classic === true;
  } catch {
    // Private browsing, corrupt preferences and unavailable storage use cartoon.
  }
  const override = new URLSearchParams(search).get('graphics');
  if (override === 'classic' || override === 'cartoon') classic = override === 'classic';
  const listeners = new Set();
  return {
    get classic() {
      return classic;
    },
    toggle() {
      classic = !classic;
      try {
        storage?.setItem(GRAPHICS_KEY, JSON.stringify({ classic }));
      } catch {
        // The setting still works for this page when storage is unavailable.
      }
      for (const changed of listeners) changed(classic);
      return classic;
    },
    subscribe(changed) {
      listeners.add(changed);
      return () => listeners.delete(changed);
    },
  };
}
