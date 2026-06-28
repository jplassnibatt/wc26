import { createContext, useContext, useState, useCallback, useRef } from 'react';

// Minimal app-wide toast system. `useToast()` returns a `toast(message, type?,
// duration?)` function; toasts stack bottom-centre (above the nav) and auto-
// dismiss, with a manual close. Used to surface save/load failures that were
// previously swallowed silently, so the user never thinks a pick was saved when
// it wasn't. aria-live announces them to screen readers.
const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const toast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++nextId;
    setToasts((list) => [...list, { id, message, type }]);
    if (duration > 0) timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((tst) => (
          <div key={tst.id} className={`toast toast--${tst.type}`} role="status">
            <span className="toast__msg">{tst.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(tst.id)}
              aria-label="OK"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
