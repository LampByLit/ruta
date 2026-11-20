import { canonicalPhone } from '../../phones/parse'

export const PIN_ATTEMPTS = 5
export const PIN_LOCK_MS = 15 * 60 * 1000

export function nextPinState(failures: number, success: boolean, now = Date.now()) {
  if (success) return { pinFailures: 0, pinLockedUntil: null as Date | null }
  const fails = failures + 1
  if (fails >= PIN_ATTEMPTS) return { pinFailures: 0, pinLockedUntil: new Date(now + PIN_LOCK_MS) }
  return { pinFailures: fails, pinLockedUntil: null as Date | null }
}

export { canonicalPhone }

type PinRow = { id: string; pinFailures: number | null; pinLockedUntil: Date | null }

export async function pinLocked(prisma: { user: { findUnique: Function } }, phone: string, now = Date.now()): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { phone }, select: { pinLockedUntil: true } }) as PinRow | null
  return Boolean(user?.pinLockedUntil && user.pinLockedUntil.getTime() > now)
}

export async function recordPinAttempt(prisma: { user: { findUnique: Function; update: Function } }, phone: string, success: boolean, now = Date.now()) {
  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, pinFailures: true } }) as PinRow | null
  if (!user) return
  const next = nextPinState(user.pinFailures || 0, success, now)
  await prisma.user.update({ where: { id: user.id }, data: next })
}
