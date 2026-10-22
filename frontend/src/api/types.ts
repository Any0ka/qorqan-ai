/* Types of the qorgan API (backend/app). Dates arrive as ISO strings. */

export type ISODate = string; // "2026-10-21"
export type ISODateTime = string; // "2026-10-15T12:44:00"

export type RiskLevel = 'low' | 'medium' | 'high' | 'insufficient';
export type LoadZone = 'stable' | 'caution' | 'high';
export type CreditType = 'cash_loan' | 'installment' | 'microloan' | 'credit_card' | 'auto_loan' | 'mortgage' | 'other';
export type CreditSource = 'report' | 'manual';
export type FinancingKind = 'credit' | 'installment' | 'microloan' | 'credit_card' | 'own';
export type PurchaseCategory = 'smartphone' | 'appliances' | 'furniture' | 'car' | 'laptop' | 'other';
export type ExpenseCategory = 'rent' | 'utilities' | 'food' | 'transport' | 'telecom' | 'other';
export type IncomeFrequency = 'monthly' | 'irregular';
export type NotificationCategory = 'payment' | 'load' | 'data' | 'goal' | 'recommendation';
export type ConsentType = 'personal_data' | 'credit_report' | 'ai_analysis' | 'auto_update' | 'marketing_email' | 'terms';
export type Lang = 'ru' | 'kk';

// ------------------------------------------------------------------ auth

export interface Session {
  access_token: string;
  token_type: 'bearer';
  user_id: string;
}

export interface VerificationStarted {
  verification_id: string;
  phone_masked: string;
  resend_after: number;
  dev_code?: string; // only in dev builds of the API
}

// ------------------------------------------------------------------ me

export interface Me {
  id: string;
  name: string;
  surname: string | null;
  initials: string;
  phone: string;
  phone_masked: string;
  email: string | null;
  email_masked: string | null;
  language: Lang;
  avatar_color: string;
  created_at: ISODateTime;
  unread_notifications: number;
}

export interface Income {
  id: string;
  source: string;
  amount: number;
  frequency: IncomeFrequency;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  label: string | null;
  amount: number;
}

export interface Completeness {
  income: boolean;
  expenses: boolean;
  credits: boolean;
  percent: number;
  steps_done: number;
  missing: Array<'income' | 'expenses' | 'credits'>;
  state?: 'new' | 'partial' | 'complete';
}

export interface Financial {
  user_id: string;
  incomes: Income[];
  expenses: Expense[];
  expenses_set: boolean;
  no_credits: boolean;
  incomes_updated_at: ISODateTime | null;
  expenses_updated_at: ISODateTime | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  income_total: number;
  expenses_total: number;
  payments_total: number;
  free: number;
  load: number;
  zone: LoadZone;
  credits_count: number;
  credits_from_report: number;
  credits_manual: number;
  completeness: Completeness & { state: 'new' | 'partial' | 'complete' };
}

// ------------------------------------------------------------------ credits

export interface ScheduleItem {
  date: ISODate;
  amount: number;
  last: boolean;
}

export interface Credit {
  id: string;
  user_id: string;
  organization: string;
  type: CreditType;
  source: CreditSource;
  report_id: string | null;
  balance: number;
  monthly_payment: number;
  is_minimum_payment: boolean;
  original_amount: number | null;
  rate: number | null;
  payments_made: number;
  payments_total: number | null;
  next_payment_date: ISODate | null;
  last_payment_date: ISODate | null;
  last_payment_amount: number | null;
  overpayment: number | null;
  corrected_manually: boolean;
  corrected_fields: string[];
  report_values: Record<string, unknown>;
  data_as_of: ISODate;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  // derived
  status: 'active' | 'attention' | 'overdue' | 'closed';
  days_until_next: number | null;
  overdue_days: number;
  flags: Array<'most_expensive' | 'due_soon'>;
  stale: boolean;
  remaining_payments: number | null;
  overpayment_rate: number | null;
  end_date: ISODate | null;
  schedule: ScheduleItem[];
  recalculated?: { load: number };
}

export interface CreditsResponse {
  summary: {
    total_debt: number;
    count: number;
    monthly_payments: number;
    load: number;
    next_payment: {
      credit_id: string;
      organization: string;
      type: CreditType;
      amount: number;
      date: ISODate;
      days_until: number;
    } | null;
    counts_by_type: Partial<Record<CreditType, number>>;
    stale_count: number;
    oldest_data: ISODate | null;
  };
  items: Credit[];
  report: { id: string; filename: string; uploaded_at: ISODateTime } | null;
  no_credits: boolean;
}

export interface CreditInput {
  organization: string;
  type: CreditType;
  balance: number;
  monthly_payment: number;
  next_payment_date?: ISODate | null;
  last_payment_date?: ISODate | null;
  original_amount?: number | null;
  rate?: number | null;
  is_minimum_payment?: boolean;
  payments_total?: number | null;
  payments_made?: number;
}

export type CreditPatch = Partial<Omit<CreditInput, 'is_minimum_payment' | 'payments_total' | 'payments_made'>>;

// ------------------------------------------------------------------ reports

export interface ParsedObligation {
  id: string;
  organization: string;
  type: CreditType;
  balance: number;
  monthly_payment: number;
  original_amount: number | null;
  payments_made: number;
  payments_total: number | null;
  next_payment_date: ISODate | null;
  last_payment_date: ISODate | null;
  overpayment: number | null;
  is_minimum_payment: boolean;
  partial: boolean;
}

export interface CreditReport {
  id: string;
  user_id: string;
  filename: string;
  size_bytes: number;
  uploaded_at: ISODateTime;
  status: 'processed' | 'failed';
  error_code: 'no_text' | 'encrypted' | 'not_a_report' | 'not_pdf' | 'too_large' | null;
  obligations: ParsedObligation[];
  confirmed: boolean;
}

// ------------------------------------------------------------------ dashboard

export interface CreditRef {
  credit_id: string;
  organization: string;
  type: CreditType;
}

export interface Relief extends CreditRef {
  remaining: number | null;
  end_date: ISODate | null;
  load_after: number;
  freed: number;
}

export interface Dashboard {
  state: 'new' | 'partial' | 'complete';
  completeness: Completeness;
  no_credits: boolean;
  updated_at: ISODateTime | null;
  sources: { credits_from_report: boolean; credits_manual: boolean; incomes_manual: boolean };
  metrics: {
    income: number;
    expenses: number;
    monthly_payments: number;
    total_debt: number;
    load: number;
    free: number;
    credits_count: number;
    zone: LoadZone;
    free_before_credits: number;
  };
  load_change: { pp: number; since: ISODate } | null;
  recommendation:
    | { code: 'refrain_new_credit'; params: Partial<Relief> }
    | { code: 'careful_new_credit'; params: Partial<Relief> & { free: number } }
    | { code: 'stable_keep_reserve'; params: { free: number } }
    | null;
  relief: Relief | null;
  debt_series: Array<{
    month: ISODate;
    debt: number;
    kind: 'actual' | 'forecast';
    event: 'installment_added' | 'microloan_added' | string | null;
    event_amount: number | null;
  }>;
  load_series: Array<{ month: ISODate; load: number }>;
  upcoming: Array<CreditRef & { date: ISODate; amount: number; days_until: number; is_minimum: boolean }>;
  split: Array<CreditRef & { amount: number; share: number; most_expensive: boolean }>;
}

// ------------------------------------------------------------------ checks

export interface Purchase {
  title: string;
  category: PurchaseCategory;
  price: number;
  kind: FinancingKind;
  down_payment: number;
  term_months: number;
  monthly_payment: number | null;
  fees: number;
}

export interface FinanceSnapshot {
  income: number;
  expenses: number;
  payments: number;
  load: number;
  free: number;
  credits_count: number;
}

export type ReasonCode =
  | 'load_already_high'
  | 'load_becomes_high'
  | 'free_negative'
  | 'free_too_low'
  | 'borrow_to_pay'
  | 'long_commitment'
  | 'load_caution'
  | 'free_drop'
  | 'new_payment_share'
  | 'after_term';

export interface Reason {
  code: ReasonCode;
  params: Record<string, any>;
}

export type OptionCode = 'original' | 'longer_term' | 'cheaper' | 'wait' | 'down_payment' | 'save' | 'custom';

export interface Assessment {
  id: string;
  user_id: string;
  created_at: ISODateTime;
  purchase: Purchase;
  monthly_payment: number;
  monthly_auto: boolean;
  total_cost: number;
  risk: RiskLevel;
  before: FinanceSnapshot | null;
  after: FinanceSnapshot | null;
  reasons: Reason[];
  missing: Array<'income' | 'expenses' | 'credits'>;
  alternative: {
    code: OptionCode;
    months_until_purchase: number | null;
    load: number;
    free: number;
    price: number;
    term_months: number;
    saving_monthly: number | null;
    new_debt: boolean;
    closing_credit: { id: string; organization: string; type: CreditType; remaining_payments?: number; monthly_payment?: number } | null;
  } | null;
  softer_options: Array<{
    code: OptionCode;
    price: number;
    monthly_payment: number;
    load: number;
    free: number;
    total_cost: number;
    term_months: number;
    months_until_purchase: number | null;
    risk: RiskLevel;
    recommended: boolean;
  }>;
  tips: Array<'check_hidden_fees' | 'check_full_cost' | 'set_reminders' | 'no_new_credit_during_term'>;
  data_sources: {
    income_updated_at: ISODateTime | null;
    expenses_updated_at: ISODateTime | null;
    credits_from_report: number;
    credits_manual: number;
    report_date: ISODateTime | null;
  };
  saved: boolean;
}

export interface CheckPreview {
  monthly_payment: number;
  monthly_auto: boolean;
  total_cost: number;
  new_payment_share: number;
  before: FinanceSnapshot;
  after: FinanceSnapshot;
  complete: boolean;
  missing: Array<'income' | 'expenses' | 'credits'>;
}

export interface CheckListItem {
  id: string;
  created_at: ISODateTime;
  purchase: Purchase;
  risk: RiskLevel;
  monthly_payment: number;
  saved: boolean;
}

// ------------------------------------------------------------------ scenarios

export interface ScenarioOption {
  code: OptionCode;
  kind: FinancingKind;
  price: number;
  term_months: number;
  down_payment: number;
  monthly_payment: number;
  total_cost: number;
  payments: number;
  load: number;
  free: number;
  months_until_purchase: number | null;
  risk: RiskLevel;
  new_debt: boolean;
  recommended: boolean;
  // save option
  saving_monthly?: number;
  pre_saving_monthly?: number;
  feasible?: boolean;
  closing_credit?: { id: string; organization: string; type: CreditType; remaining_payments?: number; monthly_payment?: number } | null;
  close_month?: ISODate | null;
  purchase_month?: ISODate | null;
  saved_before_close?: number;
  extra_saving?: number;
  advice?: 'too_big' | 'ok_after_closing' | 'ok_small_reserve' | 'safe' | 'save_no_new_debt' | 'save_not_feasible';
}

export type PathStep =
  | { code: 'close_and_save'; until: ISODate; organization: string; credit_type: CreditType; saving: number; saved: number; saved_by: ISODate }
  | { code: 'save_more'; from: ISODate; load: number; freed: number; extra: number; saving: number }
  | { code: 'save_monthly'; saving: number }
  | { code: 'buy'; month: ISODate; price: number; free: number };

export interface ScenariosResponse {
  check: { id: string; risk: RiskLevel; purchase: Purchase } | null;
  updated_at?: ISODateTime | null;
  scenarios: {
    purchase: Purchase;
    base: { income: number; expenses: number; payments: number };
    options: ScenarioOption[];
    recommended: OptionCode | null;
    path: PathStep[] | null;
    assumptions: { installment_markup_24: number; credit_markup_min: number; credit_markup_max: number };
  } | null;
}

export interface CustomScenarioInput {
  price: number;
  method: 'installment' | 'credit' | 'save';
  term_months: number;
  down_payment: number;
  start: 'now' | 'later';
}

// ------------------------------------------------------------------ plan

export type GoalKind = 'close_credit' | 'reduce_load' | 'save_for' | 'reserve' | 'custom';

export interface Goal {
  id: string;
  user_id: string;
  kind: GoalKind;
  title: string | null;
  params: Record<string, any>;
  target_date: ISODate | null;
  current: number;
  target: number;
  status: 'active' | 'planned' | 'done';
  source: 'system' | 'scenario' | 'user';
  created_at: ISODateTime;
  progress: number;
}

export interface PlanRecommendation {
  id: string;
  user_id: string;
  code: 'no_new_credit_until' | 'card_extra_payment' | 'update_income_monthly' | string;
  params: Record<string, any>;
  status: 'pending' | 'accepted' | 'dismissed' | 'in_plan' | 'reminder_on';
  actions: Array<'accept' | 'dismiss' | 'remind'>;
  created_at: ISODateTime;
}

export interface Plan {
  started_at: ISODate | null;
  recalculated_at: ISODateTime | null;
  progress: {
    start_debt: number;
    debt: number;
    debt_change: number;
    months_since_start: number;
    load: number;
    target_load: number;
    target_month: ISODate | null;
    load_path: Array<{ month: ISODate; load: number }>;
    relief: Relief | null;
  };
  next_step: (CreditRef & { amount: number; date: ISODate; days_until: number }) | null;
  forecast: Array<{ month: ISODate; debt: number }>;
  priorities: Array<
    CreditRef & {
      rank: number;
      advice: 'pay_on_schedule_close' | 'pay_above_minimum' | 'early_repay_later' | 'keep_schedule';
      end_date: ISODate | null;
      remaining: number | null;
      extra: number | null;
      extra_from: ISODate | null;
    }
  >;
  goals: Goal[];
  recommendations: PlanRecommendation[];
}

// ------------------------------------------------------------------ AI

export interface ChatBlock {
  type: 'steps' | 'verdict' | 'compare' | 'list';
  data: Record<string, any>;
}

export interface ChatLink {
  label: string;
  to: string;
  primary: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  blocks: ChatBlock[];
  links: ChatLink[];
  suggestions: string[];
  created_at: ISODateTime;
  pending: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  created_at: ISODateTime;
  context: Record<string, any>;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  created_at: ISODateTime;
  title: string | null;
  messages: number;
  context: Record<string, any>;
}

export interface AiContext {
  allowed: boolean;
  income: number | null;
  expenses: number | null;
  credits_count: number | null;
  payments: number | null;
  load: number | null;
  zone: LoadZone;
  last_check: { id: string; title: string; risk: RiskLevel } | null;
}

// ------------------------------------------------------------------ notifications

export interface AppNotification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  code:
    | 'payment_due_soon'
    | 'payments_higher_next_month'
    | 'plan_recommendation_new'
    | 'load_high_streak'
    | 'confirm_irregular_income'
    | 'goal_progress'
    | 'report_processed'
    | string;
  params: Record<string, any>;
  created_at: ISODateTime;
  read: boolean;
  actions: Array<{ code: 'open_credit' | 'mark_paid' | 'view_budget' | 'open_plan' | 'update_income' | string; to: string }>;
}

export interface NotificationsResponse {
  items: AppNotification[];
  total: number;
  counts: Record<NotificationCategory, number>;
  unread: number;
}

export interface NotificationSettings {
  payment_reminders: boolean;
  load_changes: boolean;
  data_updates: boolean;
  goals_progress: boolean;
  recommendations: boolean;
  channel_app: boolean;
  channel_browser: boolean;
  channel_email: boolean;
}

// ------------------------------------------------------------------ consents

export interface Consent {
  type: ConsentType;
  required: boolean;
  status: 'active' | 'revoked' | 'not_connected' | 'off';
  since: ISODateTime | null;
  revoked_at: ISODateTime | null;
  details?: { credits_from_report: number; report_date: ISODateTime | null };
}

export interface ConsentEvent {
  user_id: string;
  type: ConsentType;
  action: 'granted' | 'revoked';
  at: ISODateTime;
}

export interface ConsentsResponse {
  items: Consent[];
  history: ConsentEvent[];
}

export interface RevokeResponse extends ConsentsResponse {
  summary: { changed: boolean; type?: ConsentType; deleted_credits?: number; deleted_reports?: number; remaining_manual?: number };
}

// ------------------------------------------------------------------ DSS (WSM + TOPSIS)

export type CriterionType = 'benefit' | 'cost';

export interface DssCriterion {
  key: string;
  type: CriterionType;
  weight: number;
  unit: string;
  label: string;
  hint: string;
}

export interface DssAlternative {
  code: string;
  title: string;
  bank: string;
  kind: 'installment' | 'credit';
  term: number;
  monthly_payment: number;
}

export type DssMatrix = Record<string, Record<string, number>>;

export interface DssProblem {
  base: { price: number; income: number; payments: number; source: 'profile' | 'demo'; load_now: number; max_load: number };
  alternatives: DssAlternative[];
  criteria: DssCriterion[];
  matrix: DssMatrix;
}

export interface DssRankInput {
  criteria: Array<{ key: string; type: CriterionType; weight: number }>;
  matrix: Record<string, Record<string, number | null>>;
}

export interface DssResult {
  normalized_linear: DssMatrix;
  normalized_vector: DssMatrix;
  weighted: DssMatrix;
  ideal_best: Record<string, number>;
  ideal_worst: Record<string, number>;
  wsm: Array<{ code: string; score: number; rank: number }>;
  topsis: Array<{ code: string; d_best: number; d_worst: number; closeness: number; rank: number }>;
  comparison: Array<{ code: string; wsm_score: number; wsm_rank: number; topsis_closeness: number; topsis_rank: number; rank_diff: number }>;
  summary: {
    wsm_winner: string;
    topsis_winner: string;
    same_winner: boolean;
    identical_ranking: boolean;
    differing: string[];
    spearman_rho: number;
  };
}
