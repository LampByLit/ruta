/** Setup is still open until somebody has a phone. The email admin from before PIN login does not count. */
export async function phoneAccountCount(prisma: { user: { count: Function } }): Promise<number> {
  return prisma.user.count({ where: { phone: { not: null } } })
}

/** Drop leftover accounts that cannot sign in, and only when no phone account exists yet. */
export async function discardPhonelessAccounts(prisma: { user: { count: Function; deleteMany: Function } }): Promise<boolean> {
  if (await phoneAccountCount(prisma) > 0) return false
  await prisma.user.deleteMany({ where: { OR: [{ phone: null }, { phone: '' }] } })
  return true
}
