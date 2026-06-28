import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { usePools } from '../hooks/usePools';
import { useLanguage } from '../i18n/LanguageContext';
import { defaultLeaderboardTab, groupStageComplete } from '../utils/phases';
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
  const { activePoolId } = usePools();
  const { t } = useLanguage();
  const [entries, setEntries] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(defaultLeaderboardTab);
  const [certOpen, setCertOpen] = useState(false);
  const tabRefs = useRef([]);

  useEffect(() => {
    if (!activePoolId) return;
    let cancelled = false;
    (async () => {
      const snap = await getDocs(collection(db, 'pools', activePoolId, 'leaderboard'));
      if (cancelled) return;
      setEntries(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      setLoading(false);
      // Manual-adjustment audit trail (best-effort; absent on older pools).
      try {
        const adjSnap = await getDocs(
          query(collection(db, 'pools', activePoolId, 'adjustments'), orderBy('at', 'desc'))
        );
        if (!cancelled) setAdjustments(adjSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch { /* no adjustments / not readable — hide the section */ }
    })();
    return () => { cancelled = true; };
  }, [activePoolId]);

  if (loading) {
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
