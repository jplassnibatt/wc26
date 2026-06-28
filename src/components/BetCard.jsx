import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { isMatchLocked } from '../data/matchLock';
import { kickoffDateStr, kickoffTimeStr } from '../utils/matchTime';
import { slotLabel } from '../utils/knockout';
import MatchBets from './MatchBets';

function getFlagUrl(iso) {
  return `https://flagcdn.com/w80/${iso}.png`;
}

export default function BetCard({ match, bet, onSave, matchScore, onTeamClick, resolvedHome, resolvedAway }) {
  const { t } = useLanguage();
  // Knockout fixtures carry slot strings ("2A", "W73") instead of team isos;
  // fill them with the teams already certain from results (same as the calendar).
  const isKnockout = !match.home_iso;
  const homeIso = match.home_iso || resolvedHome || null;
  const awayIso = match.away_iso || resolvedAway || null;
  const hasTeams = !!homeIso && !!awayIso; // both known → bettable
  const [showBets, setShowBets] = useState(false);
  const revealAvailable = hasTeams && isMatchLocked(match.id);

  const homeName = homeIso ? t(`team.${homeIso}`) : slotLabel(match.home, t);
  const awayName = awayIso ? t(`team.${awayIso}`) : slotLabel(match.away, t);

  const isFinished = matchScore?.status === 'finished';
  const isLive = matchScore?.status === 'live';
  // Lock at kickoff too (not just when the live feed reports it), so a lagging
  // feed can't leave the inputs editable after the match has started.
  const isLocked = isFinished || isLive || isMatchLocked(match.id);

  const [scoreA, setScoreA] = useState(bet?.predictedScoreA ?? '');
  const [scoreB, setScoreB] = useState(bet?.predictedScoreB ?? '');
  // Knockout-only extra prediction (when the 90' guess is a draw): who advances
  // and how it's decided. Track A scores these + a boost for getting it all right.
  const [advancer, setAdvancer] = useState(bet?.predictedAdvancer ?? null);
  const [decidedBy, setDecidedBy] = useState(bet?.predictedDecidedBy ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const debounceRef = useRef(null);

  const isDraw = scoreA !== '' && scoreB !== '' && Number(scoreA) === Number(scoreB);
  const showKoExtra = isKnockout && hasTeams && isDraw;

  const dateStr = kickoffDateStr(match, t('dateLocale'), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const persist = useCallback(async (a, b, adv, dec) => {
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    try {
      await onSave(match.id, Number(a), Number(b), { predictedAdvancer: adv, predictedDecidedBy: dec });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save bet:', err);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    }
    setSaving(false);
  }, [match.id, onSave]);

  const handleChange = useCallback(
    (side, value) => {
      const num = value === '' ? '' : Math.max(0, parseInt(value) || 0);
      const newA = side === 'home' ? num : scoreA;
      const newB = side === 'away' ? num : scoreB;
      if (side === 'home') setScoreA(num);
      else setScoreB(num);

      clearTimeout(debounceRef.current);
      if (newA !== '' && newB !== '') {
        // A decisive score clears any draw-only extra prediction.
        const draw = Number(newA) === Number(newB);
        const adv = draw ? advancer : null;
        const dec = draw ? decidedBy : null;
        if (!draw && (advancer || decidedBy)) { setAdvancer(null); setDecidedBy(null); }
        debounceRef.current = setTimeout(() => persist(newA, newB, adv, dec), 800);
      }
    },
    [scoreA, scoreB, advancer, decidedBy, persist]
  );

  const pickAdvancer = (iso) => {
    if (isLocked) return;
    setAdvancer(iso);
    persist(scoreA, scoreB, iso, decidedBy);
  };
  const pickDecidedBy = (val) => {
    if (isLocked) return;
    setDecidedBy(val);
    persist(scoreA, scoreB, advancer, val);
  };

  return (
    <div className={`bet-card ${isLive ? 'bet-card--live' : ''} ${isFinished ? 'bet-card--finished' : ''}`}>
      {match.group_label && (
        <span className="match-card__group">{t('group')} {match.group_label}</span>
      )}
      {match.label && isKnockout && (
        <span className="match-card__label">{t(`label.${match.label}`) || match.label}</span>
      )}

      <div className="bet-card__date">
        {dateStr} &middot; {kickoffTimeStr(match)}
        {isLive && <span className="bet-card__live-badge">{t('live')}</span>}
        <span className="bet-card__status-live" aria-live="polite">
          {saving && <span className="bet-card__status">{t('saving')}</span>}
          {saved && <span className="bet-card__status bet-card__status--saved">✓</span>}
          {saveError && <span className="bet-card__status bet-card__status--error">{t('saveFailed')}</span>}
        </span>
      </div>

      {match.venue && match.venue !== 'TBD' && (
        <div className="match-card__venue">
          📍 {match.venue} · {match.city}
        </div>
      )}

      <div className="bet-card__teams">
        <button
          type="button"
          className="bet-card__team"
          onClick={() => onTeamClick?.(homeIso)}
          disabled={!homeIso || !onTeamClick}
        >
          {homeIso ? (
            <img src={getFlagUrl(homeIso)} alt="" className="match-card__flag match-card__flag--clickable" loading="lazy" />
          ) : (
            <div className="match-card__flag-placeholder" />
          )}
          <span className="match-card__name">{homeName}</span>
        </button>

        <div className="bet-card__scores">
          <input
            className="bet-card__input"
            type="number"
            inputMode="numeric"
            min="0"
            value={scoreA}
            onChange={(e) => handleChange('home', e.target.value)}
            disabled={isLocked || !hasTeams}
            aria-label={`${homeName} ${t('goals')}`}
          />
          <span className="bet-card__separator">:</span>
          <input
            className="bet-card__input"
            type="number"
            inputMode="numeric"
            min="0"
            value={scoreB}
            onChange={(e) => handleChange('away', e.target.value)}
            disabled={isLocked || !hasTeams}
            aria-label={`${awayName} ${t('goals')}`}
          />
        </div>

        <button
          type="button"
          className="bet-card__team bet-card__team--away"
          onClick={() => onTeamClick?.(awayIso)}
          disabled={!awayIso || !onTeamClick}
        >
          <span className="match-card__name">{awayName}</span>
          {awayIso ? (
            <img src={getFlagUrl(awayIso)} alt="" className="match-card__flag match-card__flag--clickable" loading="lazy" />
          ) : (
            <div className="match-card__flag-placeholder" />
          )}
        </button>
      </div>

      {showKoExtra && !isLocked && (
        <div className="bet-card__ko">
          <div className="bet-card__ko-row">
            <span className="bet-card__ko-label">{t('koWhoAdvances')}</span>
            <div className="bet-card__ko-opts">
              <button
                type="button"
                className={`bet-card__ko-opt ${advancer === homeIso ? 'bet-card__ko-opt--on' : ''}`}
                onClick={() => pickAdvancer(homeIso)}
              >{homeName}</button>
              <button
                type="button"
                className={`bet-card__ko-opt ${advancer === awayIso ? 'bet-card__ko-opt--on' : ''}`}
                onClick={() => pickAdvancer(awayIso)}
              >{awayName}</button>
            </div>
          </div>
          <div className="bet-card__ko-row">
            <span className="bet-card__ko-label">{t('koHowEnds')}</span>
            <div className="bet-card__ko-opts">
              <button
                type="button"
                className={`bet-card__ko-opt ${decidedBy === 'et' ? 'bet-card__ko-opt--on' : ''}`}
                onClick={() => pickDecidedBy('et')}
              >{t('koET')}</button>
              <button
                type="button"
                className={`bet-card__ko-opt ${decidedBy === 'pens' ? 'bet-card__ko-opt--on' : ''}`}
                onClick={() => pickDecidedBy('pens')}
              >{t('koPens')}</button>
            </div>
          </div>
        </div>
      )}

      {isKnockout && isLocked && bet?.predictedAdvancer && (
        <div className="bet-card__ko-summary">
          {t('koWhoAdvances')}: <strong>{t(`team.${bet.predictedAdvancer}`)}</strong>
          {bet.predictedDecidedBy && ` · ${bet.predictedDecidedBy === 'pens' ? t('koPens') : t('koET')}`}
        </div>
      )}

      {isFinished && matchScore?.scoreHome != null && (
        <div className="bet-card__result">
          <span className="bet-card__actual">
            {t('finalResult')}: {matchScore.scoreHome} - {matchScore.scoreAway}
          </span>
          {bet?.pointsAwarded != null && (
            <span className={`bet-card__points bet-card__points--${bet.pointsAwarded}`}>
              +{bet.pointsAwarded} {t('pts')}
            </span>
          )}
        </div>
      )}

      {revealAvailable && (
        <div className="bet-card__group">
          <button
            className="bet-card__group-toggle"
            aria-expanded={showBets}
            onClick={() => setShowBets((s) => !s)}
          >
            {showBets ? '▾' : '▸'} 📊 {t('matchBetsToggle')}
          </button>
          {showBets && (
            <MatchBets
              matchId={match.id}
              homeName={homeName}
              awayName={awayName}
              finished={isFinished}
              actualA={matchScore?.scoreHome}
              actualB={matchScore?.scoreAway}
            />
          )}
        </div>
      )}
    </div>
  );
}
