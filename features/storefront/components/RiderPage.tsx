'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LanguageSwitch } from '@/features/i18n/LanguageSwitch'
import { useI18n } from '@/features/i18n/locale'
import { Icon } from './ui'

/** The plain white page for account screens: a back arrow, a big title, then content (Uber's account pages). */
export function RiderPage({ title, children, back = '/' }: { title: string; children: React.ReactNode; back?: string }) {
  const router = useRouter()
  const { t } = useI18n()
  return <div className="rider min-h-dvh bg-paper text-ink">
    <div className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="flex items-center justify-between">
        <button type="button" aria-label={t('nav.back')} onClick={() => (window.history.length > 1 ? router.back() : router.push(back))} className="press -ml-2 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-tide"><Icon.back className="size-6" /></button>
        <LanguageSwitch />
      </div>
      <h1 className="display mt-2 text-[32px] font-bold leading-10">{title}</h1>
      <div className="mt-6">{children}</div>
      <nav aria-label="Ruta" className="mt-10 flex flex-wrap gap-x-5 border-t border-rule pt-5 text-[14px] text-ink-2">
        <Link href="/" className="inline-flex min-h-11 items-center hover:text-ink">{t('nav.book')}</Link>
        <Link href="/account/rides" className="inline-flex min-h-11 items-center hover:text-ink">{t('nav.rides')}</Link>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center hover:text-ink">{t('nav.drivers')}</Link>
      </nav>
    </div>
  </div>
}
