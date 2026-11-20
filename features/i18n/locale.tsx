'use client'

import { createContext, useContext, useState } from 'react'
import { LOCALE_COOKIE } from './cookie'
import { translate, type Locale, type MessageKey } from './messages'

type LocaleValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleValue | null>(null)

export function LocaleProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial)
  function setLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    document.documentElement.lang = next
    setLocaleState(next)
  }
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars)
  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
}

export function useI18n(): LocaleValue {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useI18n must be used inside LocaleProvider')
  return value
}
