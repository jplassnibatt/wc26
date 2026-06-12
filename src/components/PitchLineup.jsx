import { useMemo } from 'react';
import { buildXI } from '../data/formations';
import { useLanguage } from '../i18n/LanguageContext';

function loc(value, lang) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const key = lang === 'pt-PT' ? 'pt' : 'en';
  return value[key] ?? value.pt ?? value.en ?? '';
}

// Index players by name for club/caps tooltips.
function squadIndex(squad) {
  const idx = {};
  if (!squad) return idx;
  for (const group of Object.values(squad)) {
    if (!Array.isArray(group)) continue;
    for (const p of group) if (p?.name) idx[p.name] = p;
  }
  return idx;
}

function lastName(full) {
  const parts = String(full).trim().split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

export default function PitchLineup({ lineup, squad, colors = ['#006341', '#00A651'] }) {
  const { lang } = useLanguage();
  const players = useMemo(() => buildXI(lineup), [lineup]);
  const idx = useMemo(() => squadIndex(squad), [squad]);

  if (!players.length) return null;

  return (
    <div className="pitch" style={{ '--kit-1': colors[0] || '#006341', '--kit-2': colors[1] || '#00A651' }}>
      <span className="pitch__formation">{lineup.formation}</span>

      <div className="pitch__field">
        <svg className="pitch__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
          <rect x="2" y="2" width="96" height="136" rx="2" />
          <line x1="2" y1="70" x2="98" y2="70" />
          <circle cx="50" cy="70" r="11" />
          <circle cx="50" cy="70" r="0.8" className="pitch__spot" />
          <rect x="24" y="2" width="52" height="20" />
          <rect x="24" y="118" width="52" height="20" />
          <rect x="38" y="2" width="24" height="8" />
          <rect x="38" y="130" width="24" height="8" />
        </svg>

        {players.map((p, i) => {
          const info = idx[p.name];
          return (
            <div
              key={i}
              className="pitch__player"
              style={{ left: `${p.x}%`, top: `${100 - p.y}%` }}
              title={info ? `${p.name} · ${info.club}${info.caps != null ? ` · ${info.caps} int.` : ''}` : p.name}
            >
              <span className="pitch__dot">{p.role}</span>
              <span className="pitch__name">{lastName(p.name)}</span>
            </div>
          );
        })}
      </div>

      {lineup.tacticalNote && (
        <p className="pitch__note">{loc(lineup.tacticalNote, lang)}</p>
      )}
    </div>
  );
}
