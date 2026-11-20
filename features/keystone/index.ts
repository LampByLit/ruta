import { s3ForcePathStyle } from "./lib/s3-storage";
import { createAuth } from '@keystone-6/auth'
import { config } from '@keystone-6/core'
import { statelessSessions } from '@keystone-6/core/session'
import 'dotenv/config'
import { models } from './models'
import { withCreateAwareUi, withDeleteAwareUi, withItemViewAwareUi } from './ui-create-access'
import { extendGraphqlSchema } from './mutations'
import { sendPasswordResetEmail } from './lib/mail'
import { permissionNames, permissions } from './access'
import { pooledDatabaseUrl } from './database-url';
// Keystone returns failed queries as values; this makes them throw so transactions roll back.
import { throwKeystonePrismaErrors } from './lib/keystonePrismaErrors'

const production = process.env.NODE_ENV === 'production'
// Railway sets NODE_ENV=production for `keystone build` and `next build`.
// The image build cannot reach the private database, and it does not need secrets
// to compile. Next's page-data workers do not keep "build" in process.argv, so
// also treat NEXT_PHASE=phase-production-build as a build. The running server still requires the secrets.
const building = process.argv.includes('build') || process.env.NEXT_PHASE === 'phase-production-build'
const databaseURL = process.env.DATABASE_URL || 'postgresql://localhost/openfront_rideshare'
const sessionSecret = process.env.SESSION_SECRET || 'development-only-session-secret-change-me-now'
if (production && !building) {
  const missing: string[] = []
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) missing.push('SESSION_SECRET of at least 32 characters')
  if (missing.length) throw new Error(`${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} required in production.`)
}

const session = statelessSessions({ maxAge: 60 * 60 * 24 * 30, secret: sessionSecret })
const { withAuth } = createAuth({
  listKey: 'User', identityField: 'email', secretField: 'password',
  // The first user's Admin role is assigned by the User resolveInput hook (see models/User.ts).
  initFirstItem: { fields: ['name', 'email', 'password'] },
  passwordResetLink: { async sendToken(args) { await sendPasswordResetEmail(args.token, args.identity) } },
  sessionData: `id name email role { id name ${permissionNames.join(' ')} }`,
})

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}

// Photos work without a bucket. Set S3_BUCKET_NAME (and the keys below) when
// uploads should live in object storage instead of the app disk.
const s3Bucket = optionalEnv('S3_BUCKET_NAME')
const s3Endpoint = optionalEnv('S3_ENDPOINT')
if (production && !building && s3Bucket) {
  const missingS3 = ['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter(name => !optionalEnv(name))
  if (missingS3.length) throw new Error(`${missingS3.join(', ')} ${missingS3.length === 1 ? 'is' : 'are'} required in production when S3_BUCKET_NAME is set.`)
}
const storage = s3Bucket
  ? {
      my_images: {
        kind: 's3' as const, type: 'image' as const, bucketName: s3Bucket,
        region: optionalEnv('S3_REGION') || 'auto', accessKeyId: optionalEnv('S3_ACCESS_KEY_ID'), secretAccessKey: optionalEnv('S3_SECRET_ACCESS_KEY'),
        endpoint: s3Endpoint, forcePathStyle: s3ForcePathStyle(s3Endpoint), signed: { expiry: 5000 },
      },
    }
  : {
      my_images: {
        kind: 'local' as const, type: 'image' as const, storagePath: 'public/images',
        generateUrl: (path: string) => `/images${path}`, serverRoute: { path: '/images' },
      },
    }

export default withAuth(config({
  db: { provider: 'postgresql', url: pooledDatabaseUrl(databaseURL), extendPrismaClient: throwKeystonePrismaErrors }, lists: withItemViewAwareUi(withDeleteAwareUi(withCreateAwareUi(models))), session,
  graphql: { extendGraphqlSchema }, storage,
  ui: { isAccessAllowed: context => permissions.canAccessDashboard({ context, session: context.session }) },
}))
