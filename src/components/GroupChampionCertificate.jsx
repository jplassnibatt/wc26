import { createPortal } from 'react-dom';
import { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useModalA11y } from '../hooks/useModalA11y';
import { shareCertificate, printCertificate, prewarmCertificateExport } from '../utils/certificateImage';
import Avatar from './Avatar';

// Tongue-in-cheek certificate for the group-stage winner — the "Oráculo da
// Circunvalação" (the champion lives by Porto's Circunvalação). The grand
// "Nostradamus" title stays reserved for whoever wins the whole tournament.
// Opened from the ranking's Groups tab; framed as a shareable card that can be
// printed/saved as PDF (native print) or exported as a PNG to share on WhatsApp.
export default function GroupChampionCertificate({ winner, onClose }) {
  const { t } = useLanguage();
  const a11yRef = useModalA11y({ onEscape: onClose });
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // The card element carries two refs: the a11y focus-trap and our own handle.
  const setCardRef = (node) => {
    a11yRef.current = node;
    cardRef.current = node;
  };

  // Pre-embed the web fonts as soon as the card is open, so the first export
  // (image or PDF) doesn't pay the one-time font-fetch cost on click.
  useEffect(() => {
    prewarmCertificateExport(cardRef.current);
  }, []);

  // "Save as PDF": rasterise the card and print that image (see
  // utils/certificateImage.js) so the gold background prints reliably.
  const handlePrint = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await printCertificate(cardRef.current);
    } catch {
      alert(t('certExportError'));
    } finally {
      setBusy(false);
    }
  };

  // Export a PNG snapshot of the live card and hand it to the share sheet
  // (mobile) or download it (desktop). See utils/certificateImage.js.
  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await shareCertificate(cardRef.current, t);
    } catch {
      alert(t('certExportError'));
    } finally {
      setBusy(false);
    }
  };

  // Portal to <body>: the modal must escape <main>, which is the app-shell's
  // scroll container (overflow:auto) — a position:fixed descendant of it gets
  // clipped/mis-placed on iOS. Same pattern as ProfileModal / the bracket picker.
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal cert"
        onClick={(e) => e.stopPropagation()}
        ref={setCardRef}
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
          {reasonsOf(t).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <div className="cert__prize">
          <span className="cert__prize-label">{t('certPrizeLabel')}</span>
          <span className="cert__prize-value">{t('certPrize')}</span>
        </div>

        <p className="cert__nostradamus">{t('certNostradamus')}</p>

        <div className="cert__actions">
          <button
            type="button"
            className="cert__action cert__action--print"
            onClick={handlePrint}
            disabled={busy}
          >
            {t('certPrint')}
          </button>
          <button
            type="button"
            className="cert__action cert__action--share"
            onClick={handleShare}
            disabled={busy}
          >
            {busy ? t('certExportBusy') : t('certShareImg')}
          </button>
        </div>

        <button type="button" className="cert__close" onClick={onClose}>
          {t('certClose')}
        </button>
      </div>
    </div>,
    document.body
  );
}

function reasonsOf(t) {
  return [t('certReason1'), t('certReason2'), t('certReason3')];
}
