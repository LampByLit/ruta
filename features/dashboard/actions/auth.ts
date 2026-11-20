'use server';

import { cookies } from 'next/headers';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { redirect } from 'next/navigation';
import { removeAuthToken } from '@/features/dashboard/lib/cookies';
import { revalidatePath } from 'next/cache';
import { PUBLIC_REQUEST_ERROR, safeErrorSummary, sanitizeDashboardRedirect } from '../lib/security';
import { canonicalPhone, type PhoneCountry } from '@/features/phones/parse';

function submittedPhone(formData: FormData) {
  const country = String(formData.get('country') || '')
  const chosen: PhoneCountry | null = country === 'PE' ? 'PE' : country === 'US' ? 'US' : null
  return canonicalPhone(String(formData.get('phone') || ''), chosen)
}

// Legacy storefront callers may pass a password in previous state; never return it.
type AuthState = { message: string | null; formData: { phone: string; country: string; password?: string } };
const SIGN_IN_ERROR = 'That phone number and PIN don’t match. Five wrong tries locks the number for 15 minutes.';
const INITIAL_USER_ERROR = 'Unable to create the initial user.';

// keystoneClient errors are already reduced to Keystone's user-facing validation text
function withReason(base: string, error: string | undefined) {
  return error && error !== PUBLIC_REQUEST_ERROR ? `${base} ${error}` : `${base} Please try again.`;
}

export async function signIn(prevState: AuthState, formData: FormData) {
  const country = String(formData.get('country') || 'US');
  const phone = submittedPhone(formData);
  const pin = String(formData.get('pin') || formData.get('password') || '');
  const from = sanitizeDashboardRedirect(formData.get('from'));
  if (!phone || !/^\d{6}$/.test(pin)) return { message: SIGN_IN_ERROR, formData: { phone: String(formData.get('phone') || ''), country } };

  try {
    const response = await keystoneClient(`
      mutation($phone: String!, $password: String!) {
        authenticate: authenticateUserWithPassword(phone: $phone, password: $password) {
          ... on UserAuthenticationWithPasswordSuccess { sessionToken }
          ... on UserAuthenticationWithPasswordFailure { message }
        }
      }
    `, { phone, password: pin });

    if (!response.success || response.data?.authenticate?.message || !response.data?.authenticate?.sessionToken) {
      return { message: SIGN_IN_ERROR, formData: { phone: String(formData.get('phone') || ''), country } };
    }

    const cookieStore = await cookies();
    cookieStore.set('keystonejs-session', response.data.authenticate.sessionToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch (error) {
    console.error('Sign-in failed:', safeErrorSummary(error));
    return { message: SIGN_IN_ERROR, formData: { phone: String(formData.get('phone') || ''), country } };
  }

  // Next.js redirects throw; keep this outside the catch.
  redirect(from);
}

export async function signUp(prevState: AuthState, formData: FormData) {
  const country = String(formData.get('country') || 'US');
  const phone = submittedPhone(formData);
  const pin = String(formData.get('pin') || formData.get('password') || '');
  const name = String(formData.get('name') || '').trim() || 'Driver';
  const kept = { phone: String(formData.get('phone') || ''), country };
  if (!phone || !/^\d{6}$/.test(pin)) return { message: 'Enter a US, Canada, or Peru mobile number and a 6-digit PIN.', formData: kept };
  try {
    const response = await keystoneClient(`
      mutation($phone: String!, $name: String!, $password: String!) {
        createUser(data: { phone: $phone, name: $name, password: $password }) { id }
      }
    `, { phone, name, password: pin });
    if (!response.success) {
      return { message: 'Unable to create an account. Please try again.', formData: kept };
    }
  } catch (error) {
    console.error('Sign-up failed:', safeErrorSummary(error));
    return { message: 'Unable to create an account. Please try again.', formData: kept };
  }
  return signIn({ message: null, formData: kept }, formData);
}

export async function signOut() {
  try {
    await keystoneClient('mutation { endSession }');
  } catch (error) {
    console.error('Logout failed:', safeErrorSummary(error));
  }
  await removeAuthToken();
  revalidatePath('/', 'layout');
  redirect('/dashboard/signin');
}

export async function createInitialUser(
  prevState: { message: string | null; formData: { name: string; phone: string; country: string } },
  formData: FormData
) {
  const name = String(formData.get('name') || '');
  const country = String(formData.get('country') || 'US');
  const phone = submittedPhone(formData);
  const pin = String(formData.get('pin') || formData.get('password') || '');
  const kept = { name, phone: String(formData.get('phone') || ''), country };
  if (!phone || !/^\d{6}$/.test(pin)) return { message: 'Enter a US, Canada, or Peru mobile number and a 6-digit PIN.', formData: kept };
  try {
    const response = await keystoneClient(`
      mutation($data: CreateInitialUserInput!) {
        authenticate: createInitialUser(data: $data) {
          ... on UserAuthenticationWithPasswordSuccess { item { id } }
        }
      }
    `, { data: { name, phone, password: pin } });
    if (!response.success) {
      return { message: withReason(INITIAL_USER_ERROR, response.error), formData: kept };
    }
    return { data: response.data, formData: kept };
  } catch (error) {
    console.error('Initial user creation failed:', safeErrorSummary(error));
    return { message: withReason(INITIAL_USER_ERROR, undefined), formData: kept };
  }
}

export async function resetPassword(
  prevState: { message: string | null; success: string | null; formData: { email: string } },
  formData: FormData,
  _mode: 'reset' | 'request'
) {
  void prevState
  return { message: 'Ask the owner to set a new PIN.', formData: { email: String(formData.get('email') || '') } };
}

export async function getAuthenticatedUser() {
  return keystoneClient(`
    query AuthenticatedUser {
      authenticatedItem {
        ... on User {
          id email name onboardingStatus
          role { canAccessDashboard canManageOnboarding }
        }
      }
      rideshareCapabilities
    }
  `);
}

export async function getAuthHeaders() {
  const cookieStore = await cookies();
  const keystoneCookie = cookieStore.get('keystonejs-session')?.value;
  return keystoneCookie ? { Cookie: `keystonejs-session=${keystoneCookie}` } : {};
}
