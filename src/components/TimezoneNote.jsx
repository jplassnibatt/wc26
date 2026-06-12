import { useLanguage } from '../i18n/LanguageContext';
import { viewerTimeZone } from '../utils/matchTime';

// Shown only to viewers outside Portugal, so travelling players know the
// kickoff times on screen are already in their device's timezone.
export default function TimezoneNote() {
  const { t } = useLanguage();
  const tz = viewerTimeZone();
  if (!tz || tz === 'Europe/Lisbon') return null;
  return (
    <p className="tz-note">
      🕐 {t('tzNote')} ({tz.replace(/_/g, ' ')})
    </p>
  );
}
