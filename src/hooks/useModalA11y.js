import { useEffect, useRef } from 'react';

// Accessibility for dialogs/overlays: when active, traps Tab focus inside the
// modal, moves focus in on open, restores it on close, and (if onEscape is
// given) closes on Escape. Attach the returned ref to the modal's content
// element. onEscape is read through a ref so passing an inline handler doesn't
// re-run the trap (and steal focus) on every render.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// `key` lets a caller re-arm the trap when the modal swaps its root element
// (e.g. a multi-step dialog that re-renders a different form per step).
export function useModalA11y({ onEscape, active = true, key } = {}) {
  const ref = useRef(null);
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const previouslyFocused = document.activeElement;
    const focusables = () =>
      Array.from(el.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);

    // Don't steal focus if an autoFocus input already placed it inside.
    if (!el.contains(document.activeElement)) {
      focusables()[0]?.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && escRef.current) {
        e.stopPropagation();
        escRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [active, key]);

  return ref;
}
