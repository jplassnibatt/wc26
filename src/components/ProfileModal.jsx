import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n/LanguageContext';
import { useModalA11y } from '../hooks/useModalA11y';
import { LEGEND_PHOTOS } from '../utils/legends';
import Avatar from './Avatar';

const legendValue = (file) => `legend:${file}`;

export default function ProfileModal({ onClose }) {
  const { profile, updateUserProfile } = useAuth();
  const { t } = useLanguage();
  const ref = useModalA11y({ onEscape: onClose });

  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [sel, setSel] = useState({
    avatarKind: profile?.avatarKind || (profile?.avatar ? 'legend' : 'initial'),
    avatar: profile?.avatar || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Lock background scroll while the modal is open. Plain overflow:hidden (not
  // position:fixed) so the fixed bottom-nav isn't displaced — combined with the
  // portal + overscroll-behavior on the overlay, this stops scroll chaining.
  useEffect(() => {
    const b = document.body;
    const prev = b.style.overflow;
    b.style.overflow = 'hidden';
    return () => { b.style.overflow = prev; };
  }, []);

  const pickLegend = (file) => setSel({ avatarKind: 'legend', avatar: legendValue(file) });
  const clearAvatar = () => setSel({ avatarKind: 'initial', avatar: '' });

  const handleSave = async () => {
    const trimNick = nickname.trim();
    if (trimNick.length < 2) { setError(t('nicknameMinLength')); return; }
    setSaving(true);
    setError('');
    try {
      await updateUserProfile({
        nickname: trimNick,
        avatarKind: sel.avatarKind,
        avatar: sel.avatar,
        customPhotoURL: '',
      });
      onClose();
    } catch {
      setError(t('nicknameSaveError'));
      setSaving(false);
    }
  };

  // Rendered into <body> via a portal so the overlay escapes the header's
  // stacking context (z-index 100, same as the bottom nav, which would
  // otherwise paint over the modal's footer).
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal profile-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-modal__head">
          <h2 className="modal__title" id="profile-modal-title">{t('editProfileTitle')}</h2>
          <button type="button" className="profile-modal__close" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>

        <div className="profile-modal__scroll">
          <div className="profile-modal__preview">
            <Avatar
              nickname={nickname}
              avatar={sel.avatar}
              avatarKind={sel.avatarKind}
              className="profile-modal__preview-avatar"
            />
          </div>

          <label className="modal__label">
            {t('nicknameLabel')}
            <input
              className="modal__input"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
            />
          </label>

          <div className="profile-modal__section-head">
            <span className="profile-modal__section-label">{t('avatarLegendsLabel')}</span>
            {sel.avatarKind !== 'initial' && (
              <button type="button" className="profile-modal__clear" onClick={clearAvatar}>
                {t('avatarRemoveBtn')}
              </button>
            )}
          </div>

          <ul className="profile-modal__legend-list" role="radiogroup" aria-label={t('avatarLegendsLabel')}>
            {LEGEND_PHOTOS.map((l) => {
              const active = sel.avatar === legendValue(l.file);
              return (
                <li key={l.file}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`profile-modal__legend-row ${active ? 'profile-modal__legend-row--active' : ''}`}
                    onClick={() => pickLegend(l.file)}
                  >
                    <Avatar avatar={legendValue(l.file)} className="profile-modal__row-avatar" />
                    <span className="profile-modal__row-text">
                      <strong>{l.name}</strong>
                      <span className="profile-modal__row-tagline">{l.tagline}</span>
                    </span>
                    {active && <span className="profile-modal__row-check" aria-hidden="true">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {error && <p className="modal__error profile-modal__error">{error}</p>}

        <div className="profile-modal__footer">
          <button type="button" className="profile-modal__cancel" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="button" className="modal__btn" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
