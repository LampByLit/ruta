'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/features/i18n/locale'
import { canonicalPhone, type PhoneCountry } from '@/features/phones/parse'
import { gql, whoAmI, type Identity } from '../lib/api'
import { RiderPage } from '../components/RiderPage'
import { Button, ButtonLink, Icon, Spinner } from '../components/ui'
import { SavedCardRow, finishCardSetup, useSavedCard } from '../components/SavedCard'

/** Sign in, create an account, or (signed in) the account itself. Native Keystone session; no password kept in state. */
export default function RiderAccount({ register = false }: { register?: boolean }) {
  const router = useRouter()
  const { t } = useI18n()
  const [identity, setIdentity] = useState<Identity | undefined>(undefined)
  const [signupOpen, setSignupOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const saved = useSavedCard(Boolean(identity))
  const [cardNotice, setCardNotice] = useState('')
  useEffect(() => {
    if (!identity) return
    void finishCardSetup().then(result => { if (result) { setCardNotice(result.message); saved.reload() } })
  }, [identity]) // eslint-disable-line react-hooks/exhaustive-deps
  async function removeCard() {
    if (!window.confirm(t('account.removeCardAsk'))) return
    try { await gql('mutation RemoveCard { removeRiderCard }'); saved.reload(); setCardNotice(t('account.cardRemoved')) } catch { setCardNotice(t('account.cardRemoveFailed')) }
  }
  useEffect(() => {
    let active = true
    whoAmI().then(found => { if (active) setIdentity(found) }).catch(() => { if (active) setIdentity(null) })
    gql<{ riderAccountOptions: { registrationEnabled?: boolean } }>('query RiderOptions { riderAccountOptions }').then(data => { if (active) setSignupOpen(data.riderAccountOptions?.registrationEnabled === true) }).catch(() => {})
    return () => { active = false }
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    const country = String(values.get('country') || '')
    const chosen: PhoneCountry | null = country === 'PE' ? 'PE' : country === 'US' ? 'US' : null
    const phone = canonicalPhone(String(values.get('phone') || ''), chosen)
    const pin = String(values.get('pin') || '')
    inFlight.current = true; setBusy(true); setError('')
    try {
      if (!phone || !/^\d{6}$/.test(pin)) throw new Error()
      if (register) {
        const created = await gql<{ createUser: { id: string } | null }>('mutation RiderRegister($name: String!, $phone: String!, $password: String!) { createUser(data: { name: $name, phone: $phone, password: $password }) { id } }', { name: String(values.get('name') || '').trim(), phone, password: pin })
        if (!created.createUser?.id) throw new Error()
      }
      const result = await gql<{ authenticateUserWithPassword: { item?: { id: string } } | null }>('mutation RiderSignIn($phone: String!, $password: String!) { authenticateUserWithPassword(phone: $phone, password: $password) { ... on UserAuthenticationWithPasswordSuccess { item { id } } ... on UserAuthenticationWithPasswordFailure { __typename } } }', { phone, password: pin })
      if (!result.authenticateUserWithPassword?.item?.id) throw new Error()
      router.replace('/'); router.refresh()
    } catch { setError(register ? t('account.createFailed') : t('account.signInFailed')) }
    finally {
      const input = form.elements.namedItem('pin')
      if (input instanceof HTMLInputElement) input.value = ''
      inFlight.current = false; setBusy(false)
    }
  }
  async function signOut() {
    setBusy(true)
    try { await gql('mutation RiderSignOut { endSession }'); setIdentity(null); router.refresh() } catch { setError(t('account.signOutFailed')) }
    setBusy(false)
  }

  if (identity === undefined) return <RiderPage title={t('account.title')}><p className="flex items-center gap-3 text-[16px]"><Spinner />{t('account.loading')}</p></RiderPage>
  if (identity) return <RiderPage title={t('account.title')}>
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full bg-tide-soft text-tide"><Icon.person className="size-8" /></span>
      <div className="min-w-0"><p className="truncate text-[20px] font-bold">{identity.name}</p><p className="truncate text-[15px] text-ink-2">{identity.phone || identity.email}</p></div>
    </div>
    <form className="mt-6 space-y-3" onSubmit={async event => {
      event.preventDefault()
      const values = new FormData(event.currentTarget)
      const country = String(values.get('country') || '')
      const chosen: PhoneCountry | null = country === 'PE' ? 'PE' : country === 'US' ? 'US' : null
      const phone = canonicalPhone(String(values.get('phone') || ''), chosen)
      const pin = String(values.get('pin') || '')
      if (!phone || !/^\d{6}$/.test(pin)) { setError(t('account.signInFailed')); return }
      setBusy(true); setError('')
      try {
        await gql('mutation($id: ID!, $phone: String!, $password: String!) { updateUser(where: { id: $id }, data: { phone: $phone, password: $password }) { id } }', { id: identity.id, phone, password: pin })
        setIdentity({ ...identity, phone })
      } catch { setError(t('account.signInFailed')) }
      setBusy(false)
    }}>
      <label className="block"><span className="mb-1.5 block text-[15px] font-medium">{t('account.country')}</span>
        <select name="country" defaultValue="US" className="h-14 w-full rounded-[16px] bg-white px-4 text-[16px] ring-1 ring-inset ring-rule">
          <option value="US">{t('account.countryUs')}</option>
          <option value="PE">{t('account.countryPe')}</option>
        </select>
      </label>
      <label className="block"><span className="mb-1.5 block text-[15px] font-medium">{t('account.phone')}</span><input name="phone" type="tel" required inputMode="tel" defaultValue={identity.phone || ''} className="h-14 w-full rounded-[16px] bg-white px-4 text-[16px] ring-1 ring-inset ring-rule" /></label>
      <label className="block"><span className="mb-1.5 block text-[15px] font-medium">{t('account.pin')}</span><input name="pin" type="password" required inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} className="h-14 w-full rounded-[16px] bg-white px-4 text-[16px] ring-1 ring-inset ring-rule" /></label>
      <Button type="submit" className="w-full" disabled={busy}>{t('account.savePhone')}</Button>
    </form>
    {saved.enabled && <section className="mt-6" aria-labelledby="payment-heading">
      <h2 id="payment-heading" className="mb-2 text-[15px] font-semibold text-ink-2">{t('account.payment')}</h2>
      <SavedCardRow card={saved.card} returnTo="/account" onError={setCardNotice} />
      <p className="mt-2 text-[13px] text-ink-2">{saved.card ? t('account.cardOnFile') : t('account.cardOffer')}</p>
      {saved.card && <button type="button" className="mt-1 text-[14px] font-semibold text-alert underline underline-offset-2" onClick={() => void removeCard()}>{t('account.removeCard')}</button>}
      {cardNotice && <p role="status" className="mt-2 text-[14px] text-ink-2">{cardNotice}</p>}
    </section>}
    <div className="mt-6 divide-y divide-rule border-y border-rule">
      <Link href="/account/rides" className="flex min-h-14 items-center justify-between text-[16px] font-medium">{t('nav.rides')}<Icon.chevronRight className="size-4 text-ink-3" /></Link>
      <Link href="/" className="flex min-h-14 items-center justify-between text-[16px] font-medium">{t('nav.book')}<Icon.chevronRight className="size-4 text-ink-3" /></Link>
    </div>
    <Button tone="danger" className="mt-6 w-full" disabled={busy} onClick={() => void signOut()}>{t('account.signOut')}</Button>
    {error && <p role="alert" className="mt-3 text-[14px] text-alert">{error}</p>}
  </RiderPage>

  const field = 'h-14 w-full rounded-[16px] bg-white ring-1 ring-inset ring-rule px-4 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-tide'
  return <RiderPage title={register ? t('account.create') : t('account.signInTitle')}>
    {register && !signupOpen ? <p className="text-[16px] text-ink-2">{t('account.closed')} <Link href="/account/signin" className="font-semibold text-ink underline underline-offset-2">{t('account.signInTitle')}</Link></p>
      : <form onSubmit={submit} className="space-y-3">
        <fieldset disabled={busy} className="space-y-3">
          {register && <label className="block"><span className="mb-1.5 block text-[15px] font-medium">{t('account.name')}</span><input name="name" required maxLength={160} autoComplete="name" className={field} /></label>}
          <label className="block"><span className="mb-1.5 block text-[15px] font-medium">{t('account.country')}</span>
            <select name="country" defaultValue="US" className={field}>
              <option value="US">{t('account.countryUs')}</option>
              <option value="PE">{t('account.countryPe')}</option>
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-[15px] font-medium">{t('account.phone')}</span><input name="phone" type="tel" required autoComplete="username" inputMode="tel" className={field} /></label>
          <label className="block"><span className="mb-1.5 block text-[15px] font-medium">{t('account.pin')}</span><input name="pin" type="password" required inputMode="numeric" autoComplete={register ? 'new-password' : 'current-password'} pattern="[0-9]{6}" minLength={6} maxLength={6} className={field} /></label>
        </fieldset>
        {error && <p role="alert" className="text-[14px] text-alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <><Spinner className="size-5" />{register ? t('account.creating') : t('account.signingIn')}</> : register ? t('account.create') : t('account.signInTitle')}</Button>
      </form>}
    {signupOpen && <p className="mt-5 text-center text-[15px] text-ink-2">{register ? `${t('account.haveAccount')} ` : `${t('account.newHere')} `}<Link href={register ? '/account/signin' : '/account/signup'} className="font-semibold text-ink underline underline-offset-2">{register ? t('account.signInTitle') : t('account.create')}</Link></p>}
    <ButtonLink href="/" tone="secondary" className="mt-4 w-full">{t('account.guest')}</ButtonLink>
  </RiderPage>
}
