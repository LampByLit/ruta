import type { Context } from '.keystone/types';
import { phoneAccountCount } from '../domain/freshAdmin';

async function redirectToInit(root: any, args: any, context: Context) {
  // A leftover email account has no phone and cannot sign in. Treat that as not set up.
  return await phoneAccountCount(context.prisma) === 0
}

export default redirectToInit;