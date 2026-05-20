import { useLanguage } from '../i18n/LanguageContext';

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, danger }) {
  const { t } = useLanguage();

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{title}</h3>
        <p className="confirm-modal__message">{message}</p>
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
    </div>
  );
}
