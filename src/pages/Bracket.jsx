import { useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useCachedScores } from '../hooks/useLiveScores';
import { resolveWinners, slotLabel, matchSlots, BRACKET_SIDES, ROUND_IDS } from '../utils/knockout';
import { currentBracketPhase } from '../utils/phases';

// Read-only ACTUAL tournament bracket. On wide screens it's a classic two-sided
// knockout tree converging on the centre (final + champion). On phones the tree
// is unreadable (≈1300px wide), so we switch to a round-by-round view: a phase
// selector + one full-width column at a time. Teams fill in as group standings /
// knockout results become certain (reusing the calendar's resolver); undecided
// slots show a readable placeholder.
const OUTER_TO_INNER = ['r32', 'r16', 'qf', 'sf'];
const PHASES = ['r32', 'r16', 'qf', 'sf', 'final'];

// w80 (rendered at 20px) keeps flags crisp on retina screens.
const flag = (iso) => `https://flagcdn.com/w80/${iso}.png`;

export default function Bracket({ onTeamClick }) {
  const { t } = useLanguage();
  const scores = useCachedScores();
  const { teams, winners, champion } = useMemo(() => resolveWinners(scores), [scores]);
  const [phase, setPhase] = useState(currentBracketPhase);

  const teamRow = (iso, raw, win, key, score) => {
    if (!iso) {
      return (
        <span key={key} className="kbr-t kbr-t--ph">
          <span className="kbr-fl" />
          <span className="kbr-name">{slotLabel(raw, t)}</span>
        </span>
      );
    }
    const isWin = win === iso;
    return (
      <button
        key={key}
        type="button"
        className={`kbr-t ${isWin ? 'kbr-t--win' : win ? 'kbr-t--out' : ''}`}
        onClick={() => onTeamClick?.(iso)}
        disabled={!onTeamClick}
      >
        <img src={flag(iso)} alt="" className="kbr-fl" />
        <span className="kbr-name">{t(`team.${iso}`)}</span>
        {score != null && <span className="kbr-score">{score}</span>}
      </button>
    );
  };

  const matchBox = (id) => {
    const [rawH, rawA] = matchSlots(id);
    const tt = teams[id] || {};
    const win = winners[id];
    const r = scores[id];
    const live = r?.status === 'live';
    const showScore = r && r.scoreHome != null && r.scoreAway != null
      && (r.status === 'finished' || live);
    return (
      <div className={`kbr-box ${live ? 'kbr-box--live' : ''}`}>
        {live && <span className="kbr-live">{t('live')}</span>}
        {teamRow(tt.home, rawH, win, 'h', showScore ? r.scoreHome : null)}
        {teamRow(tt.away, rawA, win, 'a', showScore ? r.scoreAway : null)}
      </div>
    );
  };

  const championBlock = (
    <div className={`kbr-champ ${champion ? '' : 'kbr-champ--empty'}`}>
      {champion ? (
        <>
          <img src={flag(champion)} alt="" className="kbr-fl" />
          <span className="kbr-name">{t(`team.${champion}`)}</span>
        </>
      ) : `🏆 ${t('bracketChampion')}`}
    </div>
  );

  const renderSide = (sideKey) => {
    const half = BRACKET_SIDES[sideKey];
    let cols = OUTER_TO_INNER.map((ph) => ({ ph, ids: half[ph] || [] }));
    if (sideKey === 'right') cols = [...cols].reverse();
    return (
      <div className={`kbr-side kbr-side--${sideKey}`}>
        {cols.map(({ ph, ids }) => (
          <div key={ph} className="kbr-col">
            <div className="kbr-col-head">{t(`bracket.round.${ph}`)}</div>
            {ids.map((id, i) => (
              <div
                key={id}
                className={`kbr-m ${i % 2 === 0 ? 'kbr-m--top' : 'kbr-m--bot'}`
                  + `${ph !== 'sf' ? ' kbr-m--merge' : ''}${ph !== 'r32' ? ' kbr-m--recv' : ''}`}
              >
                {matchBox(id)}
                {ph !== 'sf' && <span className="kbr-lnk" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bracket">
      <p className="special__intro">{t('bracketActualIntro')}</p>

      {/* Phones: round-by-round */}
      <div className="kbr-mobile">
        <div className="kbr-phasebar" role="tablist" aria-label={t('bracketTab')}>
          {PHASES.map((ph) => (
            <button
              key={ph}
              type="button"
              role="tab"
              aria-selected={ph === phase}
              className={`kbr-phasebar__tab ${ph === phase ? 'kbr-phasebar__tab--active' : ''}`}
              onClick={() => setPhase(ph)}
            >
              {t(`bracket.round.${ph}`)}
            </button>
          ))}
        </div>

        <div className="kbr-list">
          {(ROUND_IDS[phase] || []).map((id) => (
            <div key={id} className="kbr-list-item">{matchBox(id)}</div>
          ))}
          {phase === 'final' && (
            <div className="kbr-list-champ">
              <div className="kbr-col-head kbr-final-head">🏆 {t('bracketChampion')}</div>
              {championBlock}
            </div>
          )}
        </div>
      </div>

      {/* Wide screens: two-sided tree */}
      <div className="kbr-board">
        {renderSide('left')}

        <div className="kbr-center">
          <div className="kbr-col-head kbr-final-head">{t('bracket.round.final')}</div>
          <div className="kbr-m kbr-final">{matchBox(BRACKET_SIDES.finalId)}</div>
          {championBlock}
        </div>

        {renderSide('right')}
      </div>
    </div>
  );
}
