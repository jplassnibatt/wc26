import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      className="lang-switcher"
      onClick={() => setLang(lang === 'pt-PT' ? 'en-GB' : 'pt-PT')}
      aria-label="Switch language"
    >
      {lang === 'pt-PT' ? '🇬🇧' : '🇵🇹'}
    </button>
  );
}
