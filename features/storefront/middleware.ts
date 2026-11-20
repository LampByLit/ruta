import { NextResponse, type NextRequest } from 'next/server'

// The storefront does not rewrite requests. Every request passes through.
export async function handleStorefrontRoutes(_request: NextRequest, _user: unknown) {
  return NextResponse.next()
}
