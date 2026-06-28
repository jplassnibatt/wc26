import { useState } from 'react';
import Autocomplete from './Autocomplete';
import SpecialStats from './SpecialStats';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { usePools } from '../hooks/usePools';
import { useSpecialBets } from '../hooks/useSpecialBets';
import { useSpecialStats } from '../hooks/useSpecialStats';
import { SPECIAL_CATEGORIES, SPECIAL_POINTS, isSpecialLocked, isSpecialExceptionActive } from '../data/specialBets';
import { optionsFor, lookupOption } from '../data/playerIndex';

export default function SpecialBets() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const { activePool } = usePools();
  const { picks, results, loading, savePick } = useSpecialBets();
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [view, setView] = useState('mine'); // 'mine' | 'group'

  // Global lock, unless this user has the one-off late-extension exception.
  const locked = isSpecialLocked()
    && !isSpecialExceptionActive(activePool?.inviteCode, user?.email);
  const { members, loading: statsLoading } = useSpecialStats(view === 'group');

  const handleChange = async (categoryId, optionId) => {
    setSavingId(categoryId);
    setSavedId(null);
    try {
      await savePick(categoryId, optionId);
      setSavedId(categoryId);
      setTimeout(() => setSavedId((id) => (id === categoryId ? null : id)), 1500);
    } catch {
      // logError happens inside the hook; the toast tells the user it failed so
      // they don't assume the pick was saved.
      toast(t('toastSaveError'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="bets__loading">{t('loading')}</div>;
  }

  return (
    <div className="special">
      <p className="special__intro">{t('specialIntro')}</p>
      <p className={`special__deadline ${locked ? 'special__deadline--locked' : ''}`}>
        {locked ? `🔒 ${t('specialLocked')}` : `⏳ ${t('specialDeadlineNote')}`}
      </p>

      <div className="special__subnav">
        <button
          className={`special__subnav-chip ${view === 'mine' ? 'special__subnav-chip--active' : ''}`}
          aria-pressed={view === 'mine'}
          onClick={() => setView('mine')}
        >
          🎯 {t('specialMyPicks')}
        </button>
        <button
          className={`special__subnav-chip ${view === 'group' ? 'special__subnav-chip--active' : ''}`}
          aria-pressed={view === 'group'}
          onClick={() => setView('group')}
        >
          📊 {t('specialGroup')}
        </button>
      </div>

      {view === 'group' ? (
        !locked ? (
          <div className="special__group-locked">
            <span className="special__group-locked-icon">🔒</span>
            <p>{t('specialGroupLocked')}</p>
          </div>
        ) : statsLoading ? (
          <div className="bets__loading">{t('loading')}</div>
        ) : (
          <SpecialStats members={members} results={results} myPicks={picks} />
        )
      ) : (
      <div className="special__list">
        {SPECIAL_CATEGORIES.map((cat) => {
          const options = optionsFor(cat.kind);
          const myPickId = picks[cat.id] || null;
          const correctId = results?.picks?.[cat.id] || null;
          const resolved = !!(results?.resolved?.[cat.id] && correctId);
          const correctOpt = resolved ? lookupOption(cat.kind, correctId) : null;
          const myOpt = lookupOption(cat.kind, myPickId);
          const hit = resolved && myPickId && myPickId === correctId;

          return (
            <div
              key={cat.id}
              className={`special-card ${resolved ? (hit ? 'special-card--hit' : 'special-card--miss') : ''}`}
            >
              <div className="special-card__head">
                <span className="special-card__icon">{cat.icon}</span>
                <div className="special-card__titles">
                  <span className="special-card__label">{t(`special.${cat.id}.label`)}</span>
                  <span className="special-card__desc">{t(`special.${cat.id}.desc`)}</span>
                </div>
                <span className="special-card__points">+{SPECIAL_POINTS}</span>
              </div>

              {resolved ? (
                <div className="special-card__resolved">
                  <div className="special-card__row">
                    <span className="special-card__row-key">{t('specialYourPick')}</span>
                    <span className="special-card__row-val">
                      {myOpt ? myOpt.label : '—'}
                    </span>
                  </div>
                  <div className="special-card__row">
                    <span className="special-card__row-key">{t('specialCorrect')}</span>
                    <span className="special-card__row-val special-card__row-val--correct">
                      {correctOpt ? correctOpt.label : '—'}
                    </span>
                  </div>
                  <span className={`special-card__verdict ${hit ? 'special-card__verdict--hit' : 'special-card__verdict--miss'}`}>
                    {hit ? `✅ +${SPECIAL_POINTS} pts` : '❌ 0 pts'}
                  </span>
                </div>
              ) : (
                <div className="special-card__pick">
                  <Autocomplete
                    options={options}
                    value={myPickId}
                    onChange={(optId) => handleChange(cat.id, optId)}
                    disabled={locked}
                    placeholder={cat.kind === 'team' ? t('specialPickTeam') : t('specialPickPlayer')}
                    emptyText={t('specialNoPick')}
                  />
                  {savingId === cat.id && <span className="special-card__status">…</span>}
                  {savedId === cat.id && <span className="special-card__status special-card__status--ok">✓</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
