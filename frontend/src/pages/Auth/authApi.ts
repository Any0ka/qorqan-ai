/* Auth endpoints (not wrapped in @/api/hooks): register → verify, login, recover → confirm, resend. */

import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { Session, VerificationStarted } from '@/api/types';
import type { Lang } from '@/i18n/I18nProvider';

export interface RegisterBody {
  name: string;
  phone: string;
  password: string;
  consents: { terms: boolean; personal_data: boolean; marketing: boolean };
  language: Lang;
}

export const useRegister = () =>
  useMutation({ mutationFn: (body: RegisterBody) => api<VerificationStarted>('/auth/register', { method: 'POST', body }) });

export const useVerify = () =>
  useMutation({ mutationFn: (body: { verification_id: string; code: string }) => api<Session>('/auth/verify', { method: 'POST', body }) });

export const useResend = () =>
  useMutation({ mutationFn: (body: { verification_id: string }) => api<VerificationStarted>('/auth/resend', { method: 'POST', body }) });

export const useLogin = () =>
  useMutation({ mutationFn: (body: { login: string; password: string }) => api<Session>('/auth/login', { method: 'POST', body }) });

export const useRecover = () =>
  useMutation({ mutationFn: (body: { phone: string }) => api<VerificationStarted>('/auth/recover', { method: 'POST', body }) });

export const useRecoverConfirm = () =>
  useMutation({
    mutationFn: (body: { verification_id: string; code: string; new_password: string }) =>
      api<Session>('/auth/recover/confirm', { method: 'POST', body }),
  });

/** Client-side mirror of the backend rule (security.password_ok). */
export const passwordOk = (p: string) => p.length >= 8 && /\d/.test(p);

/** Only same-origin paths are accepted as a post-login destination. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export const errorCode = (err: unknown): string => (err instanceof ApiError ? err.code : 'unknown');
