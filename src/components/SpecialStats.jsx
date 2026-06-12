import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { SPECIAL_CATEGORIES } from '../data/specialBets';
import { lookupOption } from '../data/playerIndex';

// Computes, for one category, the distribution of picks across all members.
function tally(members, catId) {
  const counts = {}; // optionId -> { count, names: [] }
  let totalWithPick = 0;
  for (const m of members) {
    const id = m.picks?.[catId];
    if (!id) continue;
    totalWithPick += 1;
    if (!counts[id]) counts[id] = { count: 0, names: [] };
    counts[id].count += 1;
    counts[id].names.push(m.nickname);
  }
  const rows = Object.entries(counts)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count);
  const maxCount = rows.length ? rows[0].count : 0;
  return { rows, totalWithPick, maxCount };
}

export default function SpecialStats({ members, results, myPicks }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(null); // catId whose voter list is open

  // Ranking: who got the most resolved specials right.
  const ranking = useMemo(() => {
    const resolvedCats = SPECIAL_CATEGORIES.filter((c) => results?.resolved?.[c.id] && results?.picks?.[c.id]);
    if (!resolvedCats.length) return null;
    return members
      .map((m) => {
        const hits = resolvedCats.reduce(
          (n, c) => n + (m.picks?.[c.id] && m.picks[c.id] === results.picks[c.id] ? 1 : 0),
          0
        );
        return { uid: m.uid, nickname: m.nickname, hits };
      })
      .sort((a, b) => b.hits - a.hits);
  }, [members, results]);

  if (!members.length) {
    return (
      <div className="special-stats__empty">
        <span className="special-stats__empty-icon">📊</span>
        <p>{t('specialNoParticipants')}</p>
      </div>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="special-stats">
      <p className="special-stats__count">
        {members.length} {members.length === 1 ? t('specialOneBettor') : t('specialManyBettors')}
      </p>

      {ranking && (
        <div className="special-stats__ranking">
          <h3 className="special-stats__ranking-title">🏅 {t('specialRanking')}</h3>
          {ranking.map((r, i) => (
            <div
              key={r.uid}
              className={`special-stats__rank-row ${r.uid === user?.uid ? 'special-stats__rank-row--me' : ''}`}
            >
              <span className="special-stats__rank-pos">{i < 3 ? medals[i] : i + 1}</span>
              <span className="special-stats__rank-name">{r.nickname}</span>
              <span className="special-stats__rank-hits">{r.hits} {t('specialHits')}</span>
            </div>
          ))}
        </div>
      )}

      {SPECIAL_CATEGORIES.map((cat) => {
        const { rows, totalWithPick, maxCount } = tally(members, cat.id);
        const myId = myPicks?.[cat.id] || null;
        const resolved = !!(results?.resolved?.[cat.id] && results?.picks?.[cat.id]);
        const correctId = resolved ? results.picks[cat.id] : null;

        // Consensus badge for my pick.
        let badge = null;
        if (myId && totalWithPick > 0) {
          const mine = rows.find((r) => r.id === myId);
          const myCount = mine ? mine.count : 0;
          if (myCount <= 1) badge = { key: 'unique', label: t('specialBadgeUnique') };
          else if (myCount === maxCount) badge = { key: 'majority', label: t('specialBadgeMajority') };
          else badge = { key: 'minority', label: t('specialBadgeMinority') };
        }

        return (
          <div key={cat.id} className="special-stats__cat">
            <div className="special-stats__cat-head">
              <span className="special-stats__cat-icon">{cat.icon}</span>
              <span className="special-stats__cat-label">{t(`special.${cat.id}.label`)}</span>
              {badge && (
                <span className={`special-stats__badge special-stats__badge--${badge.key}`}>{badge.label}</span>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="special-stats__none">{t('specialNoPick')}</p>
            ) : (
              <div className="special-stats__bars">
                {rows.map((row) => {
                  const opt = lookupOption(cat.kind, row.id);
                  const pct = Math.round((row.count / totalWithPick) * 100);
                  const isMine = row.id === myId;
                  const isCorrect = resolved && row.id === correctId;
                  return (
                    <div
                      key={row.id}
                      className={`special-stats__bar-row ${isCorrect ? 'special-stats__bar-row--correct' : ''} ${isMine ? 'special-stats__bar-row--mine' : ''}`}
                    >
                      <div className="special-stats__bar-info">
                        <span className="special-stats__bar-name">
                          {isCorrect && '✅ '}{opt ? opt.label : row.id}
                          {isMine && <span className="special-stats__you">{t('you')}</span>}
                        </span>
                        <span className="special-stats__bar-pct">{row.count} · {pct}%</span>
                      </div>
                      <div className="special-stats__bar-track">
                        <div className="special-stats__bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {rows.length > 0 && (
              <button
                className="special-stats__who-toggle"
                onClick={() => setExpanded((e) => (e === cat.id ? null : cat.id))}
              >
                {expanded === cat.id ? '▾ ' : '▸ '}{t('specialWhoPicked')}
              </button>
            )}
            {expanded === cat.id && (
              <div className="special-stats__who">
                {rows.map((row) => {
                  const opt = lookupOption(cat.kind, row.id);
                  return (
                    <div key={row.id} className="special-stats__who-group">
                      <span className="special-stats__who-opt">{opt ? opt.label : row.id}</span>
                      <span className="special-stats__who-names">{row.names.join(', ')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
