import { useEffect, useRef } from 'react';

// YYYY-MM-DD for "now" in the viewer's timezone — matches the day keys from
// groupMatchesByDate so we can scroll to today's fixtures.
function todayKey() {
  const now = new Date();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mo}-${da}`;
}

// Lands a day-grouped match list on today's fixtures and keeps them pinned to
// the top while async data (live scores, bets) shifts the layout above today.
// Returns a ref whose `.current` is a map of dateKey -> day element; attach it
// to each day section's `ref`. Day keys must be chronological (as produced by
// groupMatchesByDate). Pinning stops the moment the user scrolls/zooms.
export function useScrollToToday(matchesByDate, enabled = true) {
  const dayRefs = useRef({});
  const userTookOverRef = useRef(false);

  // Stop auto-pinning once the user scrolls/zooms themselves. wheel / touchmove
  // / keydown only fire on real interaction — programmatic scrollIntoView does
  // not — so this never fights the user.
  useEffect(() => {
    const takeOver = () => { userTookOverRef.current = true; };
    const opts = { passive: true };
    window.addEventListener('wheel', takeOver, opts);
    window.addEventListener('touchmove', takeOver, opts);
    window.addEventListener('keydown', takeOver);
    return () => {
      window.removeEventListener('wheel', takeOver, opts);
      window.removeEventListener('touchmove', takeOver, opts);
      window.removeEventListener('keydown', takeOver);
    };
  }, []);

  useEffect(() => {
    if (!enabled || userTookOverRef.current) return;
    const dayKeys = Object.keys(matchesByDate);
    if (dayKeys.length === 0) return;

    const today = todayKey();
    const idx = dayKeys.findIndex((k) => k >= today);
    if (idx === 0) return; // first day is today/future → already at the top
    const target = idx === -1 ? dayKeys[dayKeys.length - 1] : dayKeys[idx];

    let raf = 0;
    const pin = () => {
      if (userTookOverRef.current) return;
      const el = dayRefs.current[target];
      if (el) el.scrollIntoView({ block: 'start' });
    };

    // Pin now, then re-pin as the page grows: async scores/bets add rows to the
    // earlier days, pushing today down. Re-correct until the layout settles or
    // the user takes over (pin() bails once they do).
    raf = requestAnimationFrame(pin);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(pin);
      });
      ro.observe(document.body);
    }
    // Stop watching after the initial load settles, so an unrelated later
    // layout change (e.g. opening a modal) can't yank the view back to today.
    const stop = setTimeout(() => ro && ro.disconnect(), 5000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(stop);
      if (ro) ro.disconnect();
    };
  }, [matchesByDate, enabled]);

  return dayRefs;
}
