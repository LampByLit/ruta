export { formatMoney } from '@/features/lib/currency'

export const clock = (date: Date, locale: 'en' | 'es' = 'en') => date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
export const minutes = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`
export function dayAndTime(value: string | Date, locale: 'en' | 'es' = 'en') {
  const date = typeof value === 'string' ? new Date(value) : value
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const todayLabel = locale === 'es' ? 'Hoy' : 'Today'
  const tomorrowLabel = locale === 'es' ? 'Mañana' : 'Tomorrow'
  const day = date.toDateString() === today.toDateString() ? todayLabel : date.toDateString() === tomorrow.toDateString() ? tomorrowLabel : date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  return `${day}, ${clock(date, locale)}`
}
/** "Del Amo Fashion Center, 3525 West Carson Street" → "Del Amo Fashion Center". */
export const shortPlace = (label?: string | null) => label?.split(',')[0]?.trim() || ''
export const initials = (name: string) => name.split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
export const vehicleName = (vehicle?: { color?: string | null; make?: string | null; model?: string | null; label?: string | null } | null) =>
  vehicle?.label || [vehicle?.color, vehicle?.make, vehicle?.model].filter(Boolean).join(' ')
