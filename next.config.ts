import type { NextConfig } from 'next';
import { s3ForcePathStyle } from './features/keystone/lib/s3-storage';

const s3Endpoint = process.env.S3_ENDPOINT
const s3Bucket = process.env.S3_BUCKET_NAME
const s3Hostname = s3Endpoint ? s3Endpoint.replace(/^https?:\/\//, '').replace(/:\d+$/, '') : ''
const imageHost = s3Endpoint && s3Bucket && s3Hostname
  ? (s3ForcePathStyle(s3Endpoint) ? s3Hostname : `${s3Bucket}.${s3Hostname}`)
  : ''

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['graphql'],
  // Workaround since we diverged from Keystone reltionship and document views
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: imageHost ? [
      {
        protocol: 'https',
        // Virtual-hosted buckets serve images from <bucket>.<endpoint host>
        hostname: imageHost,
        port: '',
        pathname: '/**',
      },
    ] : [],
  },
};

export default nextConfig;