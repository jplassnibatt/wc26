import { useState, useMemo, useRef, useEffect } from 'react';

function normalize(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Generic autocomplete over a list of { id, label, sublabel? }.
// Controlled by `value` (an option id) + `onChange(id|null)`.
export default function Autocomplete({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  emptyText = '—',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value) || null,
    [options, value]
  );

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options.slice(0, 8);
    return options
      .filter((o) => {
        const hay = normalize(`${o.label} ${o.sublabel || ''}`);
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [options, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (opt) => {
    onChange(opt.id);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
  };

  // Display mode: a value is selected and we're not actively searching.
  if (selected && !open) {
    return (
      <div className="autocomplete" ref={wrapRef}>
        <div className="autocomplete__selected">
          <button
            type="button"
            className="autocomplete__selected-main"
            disabled={disabled}
            aria-label={placeholder || selected.label}
            onClick={() => disabled ? null : setOpen(true)}
          >
            <span className="autocomplete__selected-label">{selected.label}</span>
            {selected.sublabel && (
              <span className="autocomplete__selected-sub">{selected.sublabel}</span>
            )}
          </button>
          {!disabled && (
            <button
              type="button"
              className="autocomplete__clear"
              aria-label="Limpar seleção"
              onClick={clear}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="autocomplete">
        <div className="autocomplete__selected autocomplete__selected--empty">
          {emptyText}
        </div>
      </div>
    );
  }

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        className="autocomplete__input"
        type="text"
        value={query}
        placeholder={placeholder}
        aria-label={placeholder || 'Pesquisar'}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) pick(matches[active]); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
      />
      {open && matches.length > 0 && (
        <ul className="autocomplete__list">
          {matches.map((opt, i) => (
            <li
              key={opt.id}
              className={`autocomplete__option ${i === active ? 'autocomplete__option--active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
            >
              <span className="autocomplete__option-label">{opt.label}</span>
              {opt.sublabel && (
                <span className="autocomplete__option-sub">{opt.sublabel}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
