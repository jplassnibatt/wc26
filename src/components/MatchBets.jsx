import { useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { useMatchStats } from '../hooks/useMatchStats';

export default function MatchBets({ matchId, homeName, awayName, finished, actualA, actualB }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { bets, loading, error, reload } = useMatchStats(matchId, true);

  const stats = useMemo(() => {
    const total = bets.length;
    if (!total) return null;
    let home = 0, draw = 0, away = 0, goals = 0;
    const lines = {};
    for (const b of bets) {
      if (b.a > b.b) home += 1;
      else if (b.a < b.b) away += 1;
      else draw += 1;
      goals += b.a + b.b;
      const key = `${b.a}-${b.b}`;
      lines[key] = (lines[key] || 0) + 1;
    }
    const topLine = Object.entries(lines).sort((a, b) => b[1] - a[1])[0];
    const pct = (n) => Math.round((n / total) * 100);
    const ordered = [...bets].sort((a, b) => {
      if (finished && (b.points ?? -1) !== (a.points ?? -1)) return (b.points ?? -1) - (a.points ?? -1);
      return a.nickname.localeCompare(b.nickname);
    });
    return {
      total,
      homePct: pct(home), drawPct: pct(draw), awayPct: pct(away),
      avgGoals: (goals / total).toFixed(1),
      topLine: { score: topLine[0], count: topLine[1] },
      ordered,
    };
  }, [bets, finished]);

  if (loading) {
    return <div className="match-bets__loading">{t('loading')}</div>;
  }
  if (error) {
    return (
      <div className="match-bets__error">
        <span>{t('matchBetsError')}</span>
        <button type="button" className="match-bets__retry" onClick={reload}>
          {t('retry')}
        </button>
      </div>
    );
  }
  if (!stats) {
    return <div className="match-bets__empty">{t('matchBetsEmpty')}</div>;
  }

  return (
    <div className="match-bets">
      <div className="match-bets__summary">
        <div className="match-bets__outcomes">
          <span className="match-bets__outcome">🏠 {stats.homePct}%</span>
          <span className="match-bets__outcome">🤝 {stats.drawPct}%</span>
          <span className="match-bets__outcome">✈️ {stats.awayPct}%</span>
        </div>
        <div className="match-bets__facts">
          <span>{t('matchBetsTopScore')}: <strong>{stats.topLine.score}</strong> ({stats.topLine.count})</span>
          <span>{t('matchBetsAvgGoals')}: <strong>{stats.avgGoals}</strong></span>
        </div>
      </div>

      <div className="match-bets__list">
        {stats.ordered.map((b) => {
          const exact = finished && actualA != null && b.a === actualA && b.b === actualB;
          return (
            <div
              key={b.uid}
              className={`match-bets__row ${b.uid === user?.uid ? 'match-bets__row--me' : ''}`}
            >
              <span className="match-bets__name">
                {b.nickname}
                {b.uid === user?.uid && <span className="match-bets__you">{t('you')}</span>}
              </span>
              <span className={`match-bets__score ${exact ? 'match-bets__score--exact' : ''}`}>
                {exact && '🎯 '}{b.a}–{b.b}
              </span>
              {finished && (
                <span className={`match-bets__pts ${b.points ? 'match-bets__pts--scored' : ''}`}>
                  {b.points != null ? `+${b.points}` : '—'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
