import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const SESSION_KEY = 'checkout_session_id';
const PLAN_SLUG_KEY = 'checkout_plan_slug';

export function getBillingRedirectUrls(apiUrl: string) {
  const apiBase = apiUrl.replace(/\/+$/, '');
  return {
    successUrl: `${apiBase}/billing/checkout/success`,
    cancelUrl: `${apiBase}/billing/checkout/cancel`,
  };
}

export function extractCheckoutUrl(body: any): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return (
    body?.data?.checkout_url ||
    body?.checkout_url ||
    body?.data?.url ||
    body?.url
  );
}

export function extractSessionId(body: any): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const id =
    body?.data?.session_id ||
    body?.session_id ||
    body?.data?.checkout_session_id;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

export async function saveCheckoutSession(sessionId: string, planSlug?: string) {
  await AsyncStorage.setItem(SESSION_KEY, sessionId);
  if (planSlug) await AsyncStorage.setItem(PLAN_SLUG_KEY, planSlug);
}

export async function loadCheckoutSession() {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function loadCheckoutPlanSlug() {
  return AsyncStorage.getItem(PLAN_SLUG_KEY);
}

export async function clearCheckoutSession() {
  await AsyncStorage.multiRemove([SESSION_KEY, PLAN_SLUG_KEY]);
}

export type PaymentStatus = 'paid' | 'unpaid' | 'no_payment_required' | 'unknown';

export async function verifyCheckoutSession(
  apiUrl: string,
  token: string,
  sessionId: string,
): Promise<PaymentStatus> {
  const res = await axios.get(`${apiUrl}/user/billing/verify-session`, {
    params: { session_id: sessionId },
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const status =
    res.data?.data?.payment_status ||
    res.data?.payment_status;
  if (status === 'paid' || status === 'unpaid' || status === 'no_payment_required') {
    return status;
  }
  return 'unknown';
}

const GENERIC_ERRORS = /^(stripe error|error|server error|failed|exception)$/i;

function laravelFieldErrors(errors: unknown): string | undefined {
  if (!errors || typeof errors !== 'object') {
    return typeof errors === 'string' && errors.trim() ? errors.trim() : undefined;
  }
  const lines: string[] = [];
  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string' && item.trim()) lines.push(item.trim());
      });
    } else if (typeof value === 'string' && value.trim()) {
      lines.push(value.trim());
    } else if (value && typeof value === 'object' && 'message' in (value as object)) {
      const msg = (value as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) lines.push(msg.trim());
    }
  }
  return lines.length ? lines.join('\n') : undefined;
}

/** Pull the most specific message from a Laravel / Stripe error payload. */
export function extractApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const ax = err as {
    message?: string;
    response?: { status?: number; data?: any };
    data?: any;
  };
  const data = ax?.response?.data ?? ax?.data ?? (typeof err === 'object' ? err : undefined);
  const status = ax?.response?.status;

  if (__DEV__) {
    console.log('[add-plan] HTTP', status ?? '(none)');
    console.log('[add-plan] body', JSON.stringify(data, null, 2) || ax?.message);
  }

  const candidates = [
    data?.data?.error?.message,
    data?.data?.message,
    data?.error?.message,
    laravelFieldErrors(data?.errors),
    laravelFieldErrors(data?.data?.errors),
    typeof data?.error === 'string' ? data.error : undefined,
    data?.stripe_error,
    data?.data?.stripe_error,
    data?.exception,
    data?.message,
    ax?.message,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const specific = candidates.find((value) => !GENERIC_ERRORS.test(value.trim()));
  let picked = (specific || candidates[0] || fallback).trim();

  if (GENERIC_ERRORS.test(picked) && data && typeof data === 'object') {
    try {
      const raw = JSON.stringify(data);
      if (raw && raw !== '{}' && raw !== 'null') {
        picked = `${picked}${status ? ` (${status})` : ''}\n${raw.slice(0, 600)}`;
      }
    } catch {
      /* ignore */
    }
  }

  return picked;
}

export function openStripeCheckout(checkoutUrl: string) {
  return Linking.openURL(checkoutUrl);
}
