import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n/LanguageContext';
import { useModalA11y } from '../hooks/useModalA11y';

export default function NicknameModal() {
  const { saveProfile } = useAuth();
  const { t } = useLanguage();
  const ref = useModalA11y();
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimNick = nickname.trim();

    if (!trimNick || trimNick.length < 2) {
      setError(t('nicknameMinLength'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveProfile(trimNick);
    } catch {
      setError(t('nicknameSaveError'));
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form
        className="modal"
        onSubmit={handleSubmit}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-modal-title"
      >
        <span className="modal__icon" aria-hidden="true">⚽</span>
        <h2 className="modal__title" id="nickname-modal-title">{t('welcomeTitle')}</h2>
        <p className="modal__subtitle">{t('welcomeSubtitleSimple')}</p>

        <label className="modal__label">
          {t('nicknameLabel')}
          <input
            className="modal__input"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('nicknamePlaceholder')}
            maxLength={20}
            autoFocus
          />
        </label>

        {error && <p className="modal__error">{error}</p>}

        <button className="modal__btn" type="submit" disabled={saving}>
          {saving ? t('saving') : t('startBtn')}
        </button>
      </form>
    </div>
  );
}
