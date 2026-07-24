import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { usePools } from '../hooks/usePools';
import { useLanguage } from '../i18n/LanguageContext';
import { defaultLeaderboardTab, groupStageComplete, tournamentComplete } from '../utils/phases';
import Avatar from './Avatar';
import GroupChampionCertificate from './GroupChampionCertificate';

// Each tab ranks by its own points field. 'total' is the headline ranking;
// 'group'/'knockout' come from match bets bucketed by phase; 'special' from
// tournament-wide special bets. Brackets fold into 'total' only.
const TABS = [
  { id: 'group', labelKey: 'lbTabGroup', field: 'groupPoints' },
  { id: 'knockout', labelKey: 'lbTabKnockout', field: 'knockoutPoints' },
  { id: 'special', labelKey: 'lbTabSpecial', field: 'specialPoints' },
  { id: 'total', labelKey: 'lbTabTotal', field: 'totalPoints' },
];

// The parts that make up a final total, in stacking order. Each is a bucket
// field on the leaderboard doc; together with any residual (manual total-only
// adjustments) they sum to `totalPoints`. Drives the tournament-over build-up.
const SEGMENTS = [
  { key: 'group', labelKey: 'lbTabGroup', field: 'groupPoints' },
  { key: 'knockout', labelKey: 'lbTabKnockout', field: 'knockoutPoints' },
  { key: 'special', labelKey: 'lbTabSpecial', field: 'specialPoints' },
  { key: 'bracket', labelKey: 'lbSegBracket', field: 'bracketPoints' },
];

// Break a total into segments that ALWAYS sum to `totalPoints`, so the stacked
// bar can never over- or under-shoot the headline number. A positive residual
// (total-only adjustment) becomes an "other" segment; a negative one (e.g.
// specialPoints tracked but excluded from the total for some users) is trimmed
// off the known buckets, special first.
function buildSegments(entry) {
  const total = entry.totalPoints || 0;
  const parts = SEGMENTS.map((s) => ({ ...s, value: Math.max(0, entry[s.field] || 0) }));
  const known = parts.reduce((sum, p) => sum + p.value, 0);
  if (total > known) {
    parts.push({ key: 'other', labelKey: 'lbSegOther', value: total - known });
  } else if (total < known) {
    let excess = known - total;
    for (let i = parts.length - 1; i >= 0 && excess > 0; i -= 1) {
      const cut = Math.min(parts[i].value, excess);
      parts[i].value -= cut;
      excess -= cut;
    }
  }
  return parts.filter((p) => p.value > 0);
}

// Fields an adjustment can touch, with their i18n label keys. Used to render
// only the values that actually changed in the audit history.
const ADJ_FIELDS = [
  { key: 'totalPoints', labelKey: 'lbTabTotal' },
  { key: 'groupPoints', labelKey: 'lbTabGroup' },
  { key: 'knockoutPoints', labelKey: 'lbTabKnockout' },
  { key: 'specialPoints', labelKey: 'lbTabSpecial' },
  { key: 'exactResultsCount', labelKey: 'lbFieldExact' },
  { key: 'correctOutcomeCount', labelKey: 'lbFieldOutcome' },
];

function adjustmentDate(at) {
  const d = at?.toDate ? at.toDate() : (at ? new Date(at) : null);
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Leaderboard() {
  const { user } = useAuth();
  const { activePoolId, loading: poolsLoading } = usePools();
  const { t } = useLanguage();
  const [entries, setEntries] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(defaultLeaderboardTab);
  const [certOpen, setCertOpen] = useState(false);
  const tabRefs = useRef([]);

  useEffect(() => {
    // No pool selected (yet): clear the spinner and let the empty state show.
    // The `poolsLoading` guard below keeps the spinner up while pools resolve.
    if (!activePoolId) {
      setEntries([]);
      setAdjustments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'pools', activePoolId, 'leaderboard'));
        if (cancelled) return;
        setEntries(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
        // Manual-adjustment audit trail (best-effort; absent on older pools).
        try {
          const adjSnap = await getDocs(
            query(collection(db, 'pools', activePoolId, 'adjustments'), orderBy('at', 'desc'))
          );
          if (!cancelled) setAdjustments(adjSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch { /* no adjustments / not readable — hide the section */ }
      } catch {
        // Leaderboard read failed (offline/permissions): fall back to the empty
        // state instead of spinning forever.
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activePoolId]);

  if (poolsLoading || loading) {
    return <div className="leaderboard__loading">{t('loading')}</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="leaderboard__empty">
        <span className="leaderboard__empty-icon">🏅</span>
        <p>{t('leaderboardEmpty')}</p>
      </div>
    );
  }

  const activeTab = TABS.find((tb) => tb.id === tab) || TABS[TABS.length - 1];
  const field = activeTab.field;

  // Rank by the active tab's field, falling back to total then accuracy so
  // ties resolve the same way the overall ranking does.
  const ranked = [...entries].sort((a, b) => {
    if ((b[field] || 0) !== (a[field] || 0)) return (b[field] || 0) - (a[field] || 0);
    if ((b.totalPoints || 0) !== (a.totalPoints || 0)) return (b.totalPoints || 0) - (a.totalPoints || 0);
    if ((b.exactResultsCount || 0) !== (a.exactResultsCount || 0)) return (b.exactResultsCount || 0) - (a.exactResultsCount || 0);
    return (b.correctOutcomeCount || 0) - (a.correctOutcomeCount || 0);
  });

  const medals = ['🥇', '🥈', '🥉'];

  // Once the final is played, the Total tab swaps the plain list for a build-up
  // view: a stacked bar per player showing how their score was assembled. Bar
  // length scales to the leader's total so players are comparable at a glance.
  const showFinal = tab === 'total' && tournamentComplete();
  const maxTotal = ranked[0]?.totalPoints || 0;

  // The "Oráculo da Circunvalação": top of the Groups ranking, but only once the
  // group stage is actually over and there are points to speak of — so we never
  // crown a mid-stage leader.
  const groupChampion =
    tab === 'group' && groupStageComplete() && (ranked[0]?.groupPoints || 0) > 0
      ? ranked[0]
      : null;

  // Roving-tabindex arrow navigation across the tab strip.
  const onTabKeyDown = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight'
      ? (i + 1) % TABS.length
      : (i - 1 + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="leaderboard">
      <div className="leaderboard__tabs" role="tablist" aria-label={t('player')}>
        {TABS.map((tb, i) => (
          <button
            key={tb.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            id={`lb-tab-${tb.id}`}
            aria-selected={tb.id === tab}
            aria-controls="lb-panel"
            tabIndex={tb.id === tab ? 0 : -1}
            className={`leaderboard__tab ${tb.id === tab ? 'leaderboard__tab--active' : ''}`}
            onClick={() => setTab(tb.id)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div id="lb-panel" role="tabpanel" aria-labelledby={`lb-tab-${tab}`}>
        {groupChampion && (
          <div className="leaderboard__oracle">
            <span className="leaderboard__oracle-icon" aria-hidden="true">🔮</span>
            <span className="leaderboard__oracle-text">
              <strong>{groupChampion.nickname}</strong> {t('lbOracleBanner')}
            </span>
            <button
              type="button"
              className="leaderboard__oracle-btn"
              onClick={() => setCertOpen(true)}
            >
              {t('lbViewCertificate')}
            </button>
          </div>
        )}

        {showFinal ? (
          <div className="lb-final">
            <div className="lb-final__intro">
              <h3 className="lb-final__title">{t('lbFinalTitle')}</h3>
              <p className="lb-final__subtitle">{t('lbFinalSubtitle')}</p>
            </div>

            <div className="lb-final__legend" aria-hidden="true">
              {[...SEGMENTS, { key: 'other', labelKey: 'lbSegOther' }].map((s) => (
                <span key={s.key} className="lb-final__legend-item">
                  <span className={`lb-final__swatch lb-final__swatch--${s.key}`} />
                  {t(s.labelKey)}
                </span>
              ))}
            </div>

            {ranked.map((entry, i) => {
              const isMe = entry.uid === user?.uid;
              const total = entry.totalPoints || 0;
              const segments = buildSegments(entry);
              return (
                <div
                  key={entry.uid}
                  className={`lb-final__row ${isMe ? 'lb-final__row--me' : ''} ${i < 3 ? 'lb-final__row--top' : ''}`}
                >
                  <div className="lb-final__head">
                    <span className="lb-final__pos">{i < 3 ? medals[i] : i + 1}</span>
                    <Avatar
                      nickname={entry.nickname}
                      avatar={entry.avatar}
                      customPhotoURL={entry.customPhotoURL}
                      avatarKind={entry.avatarKind}
                      className="leaderboard__avatar"
                    />
                    <span className="lb-final__name">{entry.nickname}</span>
                    {isMe && <span className="leaderboard__me-badge">{t('you')}</span>}
                    <span className="lb-final__total">{total} <small>{t('pts')}</small></span>
                  </div>
                  <div
                    className="lb-final__bar"
                    style={{ width: `${maxTotal > 0 ? Math.max((total / maxTotal) * 100, 4) : 0}%` }}
                    role="img"
                    aria-label={segments.map((s) => `${t(s.labelKey)} ${s.value}`).join(', ')}
                  >
                    {segments.map((s) => (
                      <span
                        key={s.key}
                        className={`lb-final__seg lb-final__seg--${s.key}`}
                        style={{ flexGrow: s.value }}
                        title={`${t(s.labelKey)}: ${s.value}`}
                      >
                        {s.value}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="leaderboard__header">
              <span className="leaderboard__col leaderboard__col--pos">#</span>
              <span className="leaderboard__col leaderboard__col--name">{t('player')}</span>
              <span className="leaderboard__col leaderboard__col--exact">🎯</span>
              <span className="leaderboard__col leaderboard__col--pts">{t('pts')}</span>
            </div>

            {ranked.map((entry, i) => {
              const isMe = entry.uid === user?.uid;
              return (
                <div
                  key={entry.uid}
                  className={`leaderboard__row ${isMe ? 'leaderboard__row--me' : ''} ${i < 3 ? 'leaderboard__row--top' : ''}`}
                >
                  <span className="leaderboard__col leaderboard__col--pos">
                    {i < 3 ? medals[i] : i + 1}
                  </span>
                  <span className="leaderboard__col leaderboard__col--name">
                    <Avatar
                      nickname={entry.nickname}
                      avatar={entry.avatar}
                      customPhotoURL={entry.customPhotoURL}
                      avatarKind={entry.avatarKind}
                      className="leaderboard__avatar"
                    />
                    {entry.nickname}
                    {isMe && <span className="leaderboard__me-badge">{t('you')}</span>}
                    {groupChampion?.uid === entry.uid && (
                      <button
                        type="button"
                        className="leaderboard__oracle-tag"
                        onClick={() => setCertOpen(true)}
                        title={t('lbViewCertificate')}
                      >
                        🔮 {t('lbOracleTag')}
                      </button>
                    )}
                  </span>
                  <span className="leaderboard__col leaderboard__col--exact">
                    {entry.exactResultsCount || 0}
                  </span>
                  <span className="leaderboard__col leaderboard__col--pts">
                    {entry[field] || 0}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {adjustments.length > 0 && (
        <div className="leaderboard__history">
          <button
            type="button"
            className="leaderboard__history-toggle"
            aria-expanded={historyOpen}
            aria-controls="lb-history-list"
            onClick={() => setHistoryOpen((o) => !o)}
          >
            <span>⚖️ {t('lbHistoryTitle')} ({adjustments.length})</span>
            <span aria-hidden="true">{historyOpen ? '▾' : '▸'}</span>
          </button>

          {historyOpen && (
            <ul id="lb-history-list" className="leaderboard__history-list">
              {adjustments.map((a) => {
                const changed = ADJ_FIELDS
                  .map((f) => ({ ...f, before: a.before?.[f.key], after: a.after?.[f.key] }))
                  .filter((f) => f.after != null && f.before !== f.after);
                return (
                  <li key={a.id} className="leaderboard__history-item">
                    <div className="leaderboard__history-head">
                      <strong>{a.nickname || a.uid}</strong>
                      <span className="leaderboard__history-date">{adjustmentDate(a.at)}</span>
                    </div>
                    <div className="leaderboard__history-changes">
                      {changed.length > 0 ? changed.map((f) => (
                        <span key={f.key} className="leaderboard__history-delta">
                          {t(f.labelKey)} {f.before ?? 0}→{f.after}
                        </span>
                      )) : <span className="leaderboard__history-delta">—</span>}
                    </div>
                    {a.reason && <p className="leaderboard__history-reason">{a.reason}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {certOpen && groupChampion && (
        <GroupChampionCertificate winner={groupChampion} onClose={() => setCertOpen(false)} />
      )}
    </div>
  );
}
