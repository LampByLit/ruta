'use client'

import { useI18n } from './locale'

/** EN / ES. The choice is stored in a cookie and used on the next page load too. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  return <div role="group" aria-label={t('lang.switch')} className={`inline-flex h-9 items-center rounded-full bg-white p-0.5 ring-1 ring-rule ${className}`}>
    {(['en', 'es'] as const).map(code => <button key={code} type="button" aria-pressed={locale === code} onClick={() => setLocale(code)}
      className={`press h-8 min-w-10 rounded-full px-2 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-tide ${locale === code ? 'bg-ruta text-ink' : 'text-ink-2'}`}>
      {t(code === 'en' ? 'lang.en' : 'lang.es')}
    </button>)}
  </div>
}
