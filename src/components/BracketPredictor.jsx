import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useBracket } from '../hooks/useBracket';
import { isSpecialLocked } from '../data/specialBets';
import {
  BRACKET, PHASE_POINTS,
  matchTeams, candidatesFor, predictedAdvancers, scoreBracket, normalizePrediction,
} from '../data/bracket';

const PHASE_FEEDS = { r32: 'r16', r16: 'qf', qf: 'sf', sf: 'final', final: 'champion' };

function flag(iso) {
  return `https://flagcdn.com/w40/${iso}.png`;
}

export default function BracketPredictor() {
  const { t } = useLanguage();
  const { pred, results, loading, save } = useBracket();
  const [picking, setPicking] = useState(null); // { matchId, key, source }

  const locked = isSpecialLocked();
  const resolved = !!results?.resolved;
  const teamName = (iso) => (iso ? t(`team.${iso}`) : null);

  const advancers = useMemo(() => predictedAdvancers(pred), [pred]);
  const score = useMemo(
    () => (resolved ? scoreBracket(pred, results.advancers) : null),
    [pred, results, resolved]
  );
  // Teams already placed in the R32 — excluded from other pickers.
  const usedIsos = useMemo(() => Object.values(pred.slots || {}).filter(Boolean), [pred.slots]);

  const assignSlot = (matchId, key, iso) => {
    if (locked) return;
    // Build slots without ever storing `undefined` — Firestore rejects undefined
    // values, which would throw on save. Clearing removes the key entirely.
    const slots = { ...pred.slots };
    if (iso) slots[`${matchId}${key}`] = iso;
    else delete slots[`${matchId}${key}`];
    save(normalizePrediction({ slots, picks: pred.picks }));
  };

  const pickWinner = (matchId, iso) => {
    if (locked || !iso) return;
    save(normalizePrediction({
      slots: pred.slots,
      picks: { ...pred.picks, [matchId]: iso },
    }));
  };

  const isCorrect = (phaseId, iso) => {
    if (!resolved || !iso) return false;
    const feed = PHASE_FEEDS[phaseId];
    if (feed === 'champion') return results.advancers?.champion === iso;
    return (results.advancers?.[feed] || []).includes(iso);
  };

  if (loading) return <div className="bets__loading">{t('loading')}</div>;

  const champion = advancers.champion;

  return (
    <div className="bracket">
      <p className="special__intro">{t('bracketIntro')}</p>
      <p className={`special__deadline ${locked ? 'special__deadline--locked' : ''}`}>
        {locked ? `🔒 ${t('specialLocked')}` : `⏳ ${t('specialDeadlineNote')}`}
      </p>

      <div className="bracket__champion">
        <span className="bracket__champion-label">🏆 {t('bracketChampion')}</span>
        {champion ? (
          <span className="bracket__champion-team">
            <img src={flag(champion)} alt="" className="bracket__flag" />
            {teamName(champion)}
            {resolved && (
              isCorrect('final', champion)
                ? <span className="bracket__pts">+{PHASE_POINTS.champion}</span>
                : <span className="bracket__pts bracket__pts--miss">✗</span>
            )}
          </span>
        ) : (
          <span className="bracket__champion-empty">{t('bracketPickToFinal')}</span>
        )}
      </div>

      {resolved && (
        <div className="bracket__score">{t('bracketYourScore')}: <strong>{score.points} {t('pts')}</strong></div>
      )}

      {!locked && <p className="bracket__hint">{t('bracketHint')}</p>}

      <div className="bkt-board">
        {BRACKET.map((phase) => (
          <div key={phase.id} className="bkt-col">
            <div className="bkt-col-head">{t(`bracket.round.${phase.id}`)}</div>
            <div className="bkt-col-body">
              {phase.matches.map((m) => {
                const { home, away } = matchTeams(m, pred);
                const winner = pred.picks?.[m.id];
                const bothKnown = !!home && !!away;

                const renderSlot = (iso, source, key) => {
                  if (!iso) {
                    if (source?.type === 'group' && !locked) {
                      return (
                        <button
                          type="button"
                          className="bkt-slot bkt-slot--add"
                          onClick={() => setPicking({ matchId: m.id, key, source })}
                        >
                          ＋ <span>{t('bracketPickTeam')}</span>
                        </button>
                      );
                    }
                    return <div className="bkt-slot bkt-slot--empty">—</div>;
                  }
                  const isWinner = winner === iso;
                  const correct = isCorrect(m.phase, iso);
                  const stateCls = resolved && isWinner
                    ? (correct ? 'bkt-slot--ok' : 'bkt-slot--bad')
                    : (isWinner ? 'bkt-slot--win' : (winner ? 'bkt-slot--out' : ''));
                  return (
                    <div className={`bkt-slot ${stateCls}`}>
                      <button
                        type="button"
                        className="bkt-slot-btn"
                        disabled={locked || !bothKnown}
                        onClick={() => pickWinner(m.id, iso)}
                      >
                        <img src={flag(iso)} alt="" className="bkt-flag" />
                        <span className="bkt-name">{teamName(iso)}</span>
                        {isWinner && <span className="bkt-adv">→</span>}
                      </button>
                      {source?.type === 'group' && !locked && (
                        <button
                          type="button"
                          className="bkt-clear"
                          aria-label="Limpar equipa"
                          onClick={() => assignSlot(m.id, key, null)}
                        >✕</button>
                      )}
                    </div>
                  );
                };

                return (
                  <div key={m.id} className="bkt-match">
                    {renderSlot(home, m.home, 'H')}
                    {renderSlot(away, m.away, 'A')}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bkt-col bkt-col--champ">
          <div className="bkt-col-head">🏆</div>
          <div className="bkt-col-body">
            <div className={`bkt-champ ${champion ? '' : 'bkt-champ--empty'}`}>
              {champion ? (
                <>
                  <img src={flag(champion)} alt="" className="bkt-flag" />
                  <span className="bkt-name">{teamName(champion)}</span>
                </>
              ) : '—'}
            </div>
          </div>
        </div>
      </div>

      {picking && createPortal(
        <div className="bkt-modal" onClick={() => setPicking(null)}>
          <div className="bkt-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bkt-modal-head">
              <span>{t('bracketPickTeam')}</span>
              <button type="button" aria-label="Fechar" onClick={() => setPicking(null)}>✕</button>
            </div>
            <div className="bkt-modal-list">
              {candidatesFor(picking.source, usedIsos).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="bkt-modal-item"
                  onClick={() => { assignSlot(picking.matchId, picking.key, opt.id); setPicking(null); }}
                >
                  <img src={flag(opt.id)} alt="" className="bkt-flag" />
                  <span className="bkt-modal-name">{teamName(opt.id)}</span>
                  <span className="bkt-modal-group">{opt.sublabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
