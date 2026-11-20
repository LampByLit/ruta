import type { Locale } from './messages'

export const LOCALE_COOKIE = 'ruta-locale'

export function readLocaleCookie(value: string | undefined): Locale {
  return value === 'es' ? 'es' : 'en'
}
