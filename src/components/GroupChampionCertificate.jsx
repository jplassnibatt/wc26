import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useModalA11y } from '../hooks/useModalA11y';
import Avatar from './Avatar';

// Tongue-in-cheek certificate for the group-stage winner — the "Oráculo da
// Circunvalação" (the champion lives by Porto's Circunvalação). The grand
// "Nostradamus" title stays reserved for whoever wins the whole tournament.
// Opened from the ranking's Groups tab; framed as a shareable card.
export default function GroupChampionCertificate({ winner, onClose }) {
  const { t } = useLanguage();
  const ref = useModalA11y({ onEscape: onClose });

  const reasons = [t('certReason1'), t('certReason2'), t('certReason3')];

  // Portal to <body>: the modal must escape <main>, which is the app-shell's
  // scroll container (overflow:auto) — a position:fixed descendant of it gets
  // clipped/mis-placed on iOS. Same pattern as ProfileModal / the bracket picker.
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal cert"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-title"
      >
        <div className="cert__seal" aria-hidden="true">🔮</div>
        <span className="cert__badge">{t('certBadge')}</span>

        <p className="cert__intro">{t('certIntro')}</p>

        <div className="cert__winner">
          <Avatar
            nickname={winner.nickname}
            avatar={winner.avatar}
            customPhotoURL={winner.customPhotoURL}
            avatarKind={winner.avatarKind}
            className="cert__avatar"
          />
          <strong className="cert__name">{winner.nickname}</strong>
        </div>

        <h3 className="cert__title" id="cert-title">{t('certTitle')}</h3>
        <p className="cert__phase">{t('certPhase')}</p>

        <ul className="cert__reasons">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <div className="cert__prize">
          <span className="cert__prize-label">{t('certPrizeLabel')}</span>
          <span className="cert__prize-value">{t('certPrize')}</span>
        </div>

        <p className="cert__nostradamus">{t('certNostradamus')}</p>

        <button type="button" className="cert__close" onClick={onClose}>
          {t('certClose')}
        </button>
      </div>
    </div>,
    document.body
  );
}
