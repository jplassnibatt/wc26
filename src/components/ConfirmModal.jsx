import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useModalA11y } from '../hooks/useModalA11y';

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger }) {
  const { t } = useLanguage();
  const ref = useModalA11y({ onEscape: onCancel });

  // Portal to <body> so the overlay escapes <main> (the app-shell scroll
  // container) — a position:fixed descendant of it is clipped on iOS.
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal confirm-modal"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <h3 className="modal__title" id="confirm-modal-title">{title}</h3>
        <p className="confirm-modal__message" id="confirm-modal-message">{message}</p>
        <div className="confirm-modal__actions">
          <button className="confirm-modal__btn confirm-modal__btn--cancel" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button
            className={`confirm-modal__btn ${danger ? 'confirm-modal__btn--danger' : 'confirm-modal__btn--confirm'}`}
            onClick={onConfirm}
          >
            {confirmLabel || t('confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
