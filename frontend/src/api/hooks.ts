/* React Query hooks for every qorgan endpoint. Pages import from here — not from `api()` directly. */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useLang } from '@/i18n/I18nProvider';
import type {
  AiContext, AppNotification, Assessment, CheckListItem, CheckPreview, ConsentType, ConsentsResponse, Conversation,
  ConversationSummary, Credit, CreditInput, CreditPatch, CreditReport, CreditsResponse, CreditType, CustomScenarioInput,
  Dashboard, ExpenseCategory, Financial, Goal, IncomeFrequency, Lang, Me, NotificationCategory, NotificationSettings,
  NotificationsResponse, Plan, PlanRecommendation, Purchase, RevokeResponse, ScenarioOption, ScenariosResponse,
  ChatMessage, DssProblem, DssRankInput, DssResult,
} from './types';

export const keys = {
  me: ['me'] as const,
  financial: ['financial'] as const,
  dashboard: ['dashboard'] as const,
  credits: (p?: object) => ['credits', p ?? {}] as const,
  credit: (id: string) => ['credit', id] as const,
  checks: ['checks'] as const,
  check: (id: string) => ['check', id] as const,
  latestCheck: ['check', 'latest'] as const,
  scenarios: (checkId?: string) => ['scenarios', checkId ?? 'latest'] as const,
  plan: ['plan'] as const,
  notifications: (c?: NotificationCategory) => ['notifications', c ?? 'all'] as const,
  notificationSettings: ['notification-settings'] as const,
  consents: ['consents'] as const,
  aiStatus: ['ai', 'status'] as const,
  aiContext: ['ai', 'context'] as const,
  conversations: ['ai', 'conversations'] as const,
  conversation: (id: string) => ['ai', 'conversation', id] as const,
  latestConversation: ['ai', 'conversation', 'latest'] as const,
  latestReport: ['report', 'latest'] as const,
  dssProblem: (price: number) => ['dss', 'problem', price] as const,
};

/** Anything that changes incomes, expenses or credits changes most derived screens. */
export function invalidateFinance(qc: QueryClient) {
  for (const k of [['financial'], ['dashboard'], ['credits'], ['credit'], ['plan'], ['scenarios'], ['ai', 'context'], ['me'], ['report']]) {
    qc.invalidateQueries({ queryKey: k });
  }
}

// ------------------------------------------------------------------ me / profile

export const useMe = (enabled = true) => useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/me'), enabled });

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<Me, 'name' | 'surname' | 'email'>> & { language?: Lang }) =>
      api<Me>('/me', { method: 'PATCH', body }),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export const useFinancial = () => useQuery({ queryKey: keys.financial, queryFn: () => api<Financial>('/me/financial') });

export function useSaveIncomes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incomes: Array<{ id?: string; source: string; amount: number; frequency: IncomeFrequency }>) =>
      api<Financial>('/me/incomes', { method: 'PUT', body: { incomes } }),
    onSuccess: (f) => {
      qc.setQueryData(keys.financial, f);
      invalidateFinance(qc);
    },
  });
}

export function useSaveExpenses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenses: Array<{ category: ExpenseCategory; label?: string | null; amount: number }>) =>
      api<Financial>('/me/expenses', { method: 'PUT', body: { expenses } }),
    onSuccess: (f) => {
      qc.setQueryData(keys.financial, f);
      invalidateFinance(qc);
    },
  });
}

export function useSetNoCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (no_credits: boolean) => api<Financial>('/me/no-credits', { method: 'POST', body: { no_credits } }),
    onSuccess: () => invalidateFinance(qc),
  });
}

export function useOnboardingStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { step: number; completed?: boolean }) => api<Financial>('/me/onboarding', { method: 'PATCH', body }),
    onSuccess: (f) => {
      qc.setQueryData(keys.financial, f);
      invalidateFinance(qc);
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => api<void>('/me/delete', { method: 'POST', body: { confirm: 'DELETE' } }) });
}

// ------------------------------------------------------------------ dashboard

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>('/dashboard') });

// ------------------------------------------------------------------ credits

export interface CreditsQuery {
  type?: CreditType;
  q?: string;
  sort?: 'next_payment' | 'balance' | 'payment';
}

export const useCredits = (params: CreditsQuery = {}) =>
  useQuery({
    queryKey: keys.credits(params),
    queryFn: () => api<CreditsResponse>('/credits', { query: { ...params } }),
    placeholderData: (prev) => prev,
  });

export const useCredit = (id: string | null | undefined) =>
  useQuery({ queryKey: keys.credit(id ?? ''), queryFn: () => api<Credit>(`/credits/${id}`), enabled: !!id });

export function useAddCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreditInput) => api<Credit>('/credits', { method: 'POST', body }),
    onSuccess: () => invalidateFinance(qc),
  });
}

export function useUpdateCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: CreditPatch & { id: string }) => api<Credit>(`/credits/${id}`, { method: 'PATCH', body }),
    onSuccess: () => invalidateFinance(qc),
  });
}

export function useDeleteCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/credits/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinance(qc),
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Credit>(`/credits/${id}/paid`, { method: 'POST' }),
    onSuccess: () => {
      invalidateFinance(qc);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkClosed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Credit>(`/credits/${id}/close`, { method: 'POST' }),
    onSuccess: () => invalidateFinance(qc),
  });
}

// ------------------------------------------------------------------ reports

export const useLatestReport = () =>
  useQuery({ queryKey: keys.latestReport, queryFn: () => api<CreditReport | null>('/reports/latest') });

export function useUploadReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api<CreditReport>('/reports', { method: 'POST', form });
    },
    onSuccess: (r) => {
      if (r.status !== 'processed') return;
      // A processed upload grants the credit-report consent on the server.
      qc.invalidateQueries({ queryKey: keys.latestReport });
      qc.invalidateQueries({ queryKey: keys.consents });
    },
  });
}

export function useConfirmReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, obligationIds }: { id: string; obligationIds: string[] }) =>
      api<{ added: number; credits: number }>(`/reports/${id}/confirm`, { method: 'POST', body: { obligation_ids: obligationIds } }),
    onSuccess: () => {
      invalidateFinance(qc);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: keys.consents });
    },
  });
}

// ------------------------------------------------------------------ checks

export function useCheckPreview() {
  return useMutation({ mutationFn: (p: Purchase) => api<CheckPreview>('/checks/preview', { method: 'POST', body: p }) });
}

export function useCreateCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Purchase) => api<Assessment>('/checks', { method: 'POST', body: p }),
    onSuccess: (a) => {
      qc.setQueryData(keys.check(a.id), a);
      qc.invalidateQueries({ queryKey: keys.checks });
      qc.invalidateQueries({ queryKey: ['scenarios'] });
      qc.invalidateQueries({ queryKey: keys.aiContext });
      qc.setQueryData(keys.latestCheck, a);
    },
  });
}

export const useChecks = (saved = false) =>
  useQuery({ queryKey: [...keys.checks, saved], queryFn: () => api<CheckListItem[]>('/checks', { query: { saved } }) });

export const useCheck = (id: string | undefined) =>
  useQuery({ queryKey: keys.check(id ?? ''), queryFn: () => api<Assessment>(`/checks/${id}`), enabled: !!id });

export const useLatestCheck = () =>
  useQuery({ queryKey: keys.latestCheck, queryFn: () => api<Assessment | null>('/checks/latest') });

export function useSaveCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) =>
      api<Assessment>(`/checks/${id}/save`, { method: 'POST', body: { saved } }),
    onSuccess: (a) => {
      qc.setQueryData(keys.check(a.id), a);
      qc.invalidateQueries({ queryKey: keys.checks });
    },
  });
}

// ------------------------------------------------------------------ scenarios

export const useScenarios = (checkId?: string) =>
  useQuery({
    queryKey: keys.scenarios(checkId),
    queryFn: () => api<ScenariosResponse>('/scenarios', { query: { check: checkId } }),
  });

export function useCustomScenario() {
  return useMutation({
    mutationFn: (body: CustomScenarioInput) => api<ScenarioOption>('/scenarios/custom', { method: 'POST', body }),
  });
}

export function useAddScenarioToPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { check_id: string; option?: string }) => api<Goal>('/scenarios/add-to-plan', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan }),
  });
}

// ------------------------------------------------------------------ plan

export const usePlan = () => useQuery({ queryKey: keys.plan, queryFn: () => api<Plan>('/plan') });

export function useAddGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; target: number; current?: number; target_date?: string | null }) =>
      api<Goal>('/plan/goals', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; target?: number; current?: number; target_date?: string | null; status?: Goal['status'] }) =>
      api<Goal>(`/plan/goals/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/plan/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan }),
  });
}

export function useRecommendationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'dismiss' | 'remind' }) =>
      api<PlanRecommendation>(`/plan/recommendations/${id}`, { method: 'POST', body: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan }),
  });
}

// ------------------------------------------------------------------ notifications

export const useNotifications = (category?: NotificationCategory) =>
  useQuery({
    queryKey: keys.notifications(category),
    queryFn: () => api<NotificationsResponse>('/notifications', { query: { category } }),
    placeholderData: (prev) => prev,
  });

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<AppNotification>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export const useNotificationSettings = () =>
  useQuery({ queryKey: keys.notificationSettings, queryFn: () => api<NotificationSettings>('/notifications/settings') });

export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: NotificationSettings) => api<NotificationSettings>('/notifications/settings', { method: 'PUT', body: s }),
    onMutate: (s) => qc.setQueryData(keys.notificationSettings, s),
    onSuccess: (s) => qc.setQueryData(keys.notificationSettings, s),
  });
}

// ------------------------------------------------------------------ consents

export const useConsents = () => useQuery({ queryKey: keys.consents, queryFn: () => api<ConsentsResponse>('/consents') });

export const useConsentImpact = (type: ConsentType | null) =>
  useQuery({
    queryKey: ['consent-impact', type],
    queryFn: () => api<{ credits_to_delete?: number; manual_left?: number }>(`/consents/${type}/impact`),
    enabled: !!type,
  });

export function useRevokeConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: ConsentType) => api<RevokeResponse>(`/consents/${type}/revoke`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.setQueryData(keys.consents, { items: r.items, history: r.history });
      qc.invalidateQueries({ queryKey: ['consent-impact'] });
      invalidateFinance(qc);
    },
  });
}

export function useGrantConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: ConsentType) => api<ConsentsResponse>(`/consents/${type}/grant`, { method: 'POST' }),
    onSuccess: (r) => {
      qc.setQueryData(keys.consents, r);
      qc.invalidateQueries({ queryKey: ['consent-impact'] });
      qc.invalidateQueries({ queryKey: keys.aiContext });
    },
  });
}

// ------------------------------------------------------------------ AI

export const useAiStatus = (opts: { refetchInterval?: number | false; enabled?: boolean } = {}) =>
  useQuery({ queryKey: keys.aiStatus, queryFn: () => api<{ available: boolean }>('/ai/status'), staleTime: 30_000, ...opts });

export const useAiContext = () => useQuery({ queryKey: keys.aiContext, queryFn: () => api<AiContext>('/ai/context') });

export const useConversations = () =>
  useQuery({ queryKey: keys.conversations, queryFn: () => api<ConversationSummary[]>('/ai/conversations') });

export function useLatestConversation() {
  const { lang } = useLang();
  return useQuery({
    queryKey: keys.latestConversation,
    queryFn: () => api<Conversation>('/ai/conversations/latest', { query: { lang } }),
  });
}

export const useConversation = (id: string | null | undefined) =>
  useQuery({ queryKey: keys.conversation(id ?? ''), queryFn: () => api<Conversation>(`/ai/conversations/${id}`), enabled: !!id });

export function useNewConversation() {
  const qc = useQueryClient();
  const { lang } = useLang();
  return useMutation({
    mutationFn: (body: { check_panel?: boolean; purchase?: Partial<Purchase> | null } = {}) =>
      api<Conversation>('/ai/conversations', { method: 'POST', body, query: { lang } }),
    onSuccess: (c) => {
      qc.setQueryData(keys.conversation(c.id), c);
      if (!c.context?.check_panel) qc.setQueryData(keys.latestConversation, c);
      qc.invalidateQueries({ queryKey: keys.conversations });
    },
  });
}

export function useSendMessage(conversationId: string | null | undefined) {
  const qc = useQueryClient();
  const { lang } = useLang();
  return useMutation({
    mutationFn: (body: { text: string; purchase?: Partial<Purchase> | null }) =>
      api<{ question: ChatMessage; answer: ChatMessage }>(`/ai/conversations/${conversationId}/messages`, {
        method: 'POST',
        body,
        query: { lang },
      }),
    onSuccess: ({ question, answer }) => {
      const update = (c: Conversation | undefined) => (c ? { ...c, messages: [...c.messages, question, answer] } : c);
      qc.setQueryData<Conversation>(keys.conversation(conversationId ?? ''), update);
      qc.setQueryData<Conversation>(keys.latestConversation, (c) => (c && c.id === conversationId ? update(c) : c));
      qc.invalidateQueries({ queryKey: keys.conversations });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: keys.aiStatus });
      qc.invalidateQueries({ queryKey: keys.conversation(conversationId ?? '') });
      qc.invalidateQueries({ queryKey: keys.latestConversation });
    },
  });
}

// ------------------------------------------------------------------ DSS (WSM + TOPSIS)

export function useDssProblem(price: number) {
  const { lang } = useLang();
  return useQuery({
    queryKey: [...keys.dssProblem(price), lang],
    queryFn: () => api<DssProblem>('/dss/problem', { query: { price, lang } }),
    placeholderData: (prev) => prev,
  });
}

export const useDssRank = () => useMutation({ mutationFn: (body: DssRankInput) => api<DssResult>('/dss/rank', { method: 'POST', body }) });
