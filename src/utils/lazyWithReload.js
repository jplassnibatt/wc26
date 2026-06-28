import { lazy } from 'react';

// After a deploy, the old hashed chunk files are removed from the server. A
// client that loaded index.html *before* the deploy still references the old
// chunk names, so a dynamic import() rejects with "Importing a module script
// failed" / "Failed to fetch dynamically imported module". The fix: force one
// full reload to pick up the fresh index.html and its new chunk names. A
// sessionStorage flag prevents an infinite reload loop if the import keeps
// failing for some other reason (e.g. the chunk is genuinely broken/offline).
const RELOAD_FLAG = 'chunk-reload';

export default function lazyWithReload(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Loaded fine — clear the guard so a future stale chunk can reload again.
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        // Never resolve, so React keeps showing the Suspense fallback while the
        // page reloads instead of flashing the error boundary.
        return new Promise(() => {});
      }
      throw err;
    }
  });
}
