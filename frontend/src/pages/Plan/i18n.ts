import type { CreditType, PurchaseCategory } from '@/api/types';
import { common } from '@/i18n/common';
import type { Dict } from '@/i18n/I18nProvider';
import { dayMonth, money, monthName, num, percent, pluralRu, toDate } from '@/lib/format';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const thisYear = () => new Date().getFullYear();
const year = (d: string) => toDate(d).getFullYear();
const half = (m: number) => String(Math.round(m * 2) / 2).replace('.', ',');

/** Russian purchase-name forms for goal titles (accusative «на смартфон», genitive «покупки смартфона»). */
type Noun = { acc: string; gen: string };

const ruDat: Record<CreditType, string> = {
  cash_loan: 'кредиту наличными',
  installment: 'рассрочке',
  microloan: 'микрокредиту',
  credit_card: 'кредитной карте',
  auto_loan: 'автокредиту',
  mortgage: 'ипотеке',
  other: 'кредиту',
};
const ruGenFull: Record<CreditType, string> = {
  cash_loan: 'кредита наличными',
  installment: 'рассрочки',
  microloan: 'микрокредита',
  credit_card: 'кредитной карты',
  auto_loan: 'автокредита',
  mortgage: 'ипотеки',
  other: 'кредита',
};
/** Short genitive used after «после»: «после карты». */
const ruGen: Record<CreditType, string> = {
  cash_loan: 'кредита наличными',
  installment: 'рассрочки',
  microloan: 'микрокредита',
  credit_card: 'карты',
  auto_loan: 'автокредита',
  mortgage: 'ипотеки',
  other: 'кредита',
};
const kkAbl: Record<CreditType, string> = {
  cash_loan: 'несиеден',
  installment: 'бөліп төлеуден',
  microloan: 'микронесиеден',
  credit_card: 'картадан',
  auto_loan: 'автонесиеден',
  mortgage: 'ипотекадан',
  other: 'несиеден',
};
const kkLoc: Record<CreditType, string> = {
  cash_loan: 'несиеде',
  installment: 'бөліп төлеуде',
  microloan: 'микронесиеде',
  credit_card: 'картада',
  auto_loan: 'автонесиеде',
  mortgage: 'ипотекада',
  other: 'несиеде',
};
/** «4–5 Рассрочка и автокредит» — installments first, then the cheapest debts. */
export const KEEP_ORDER: CreditType[] = ['installment', 'auto_loan', 'mortgage', 'other', 'cash_loan', 'credit_card', 'microloan'];

const joinRu = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} и ${xs[xs.length - 1]}`);
const joinKk = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} және ${xs[xs.length - 1]}`);

/** Month in a sentence with the year when it is not the current one: «в апреле 2027». */
const ruIn = (d: string) => `в ${monthName(d, 'ru', 'prep')}${year(d) !== thisYear() ? ` ${year(d)}` : ''}`;
const kkIn = (d: string) => `${year(d) !== thisYear() ? `${year(d)} жылғы ` : ''}${monthName(d, 'kk', 'prep')}`;

export interface ExplainInput {
  notYet: boolean;
  within: boolean;
  target: number;
  relief: { type: CreditType; end: string; load: number } | null;
  reach: { month: string; load: number } | null;
}

const ru = {
  title: 'Мой план финансовой устойчивости',
  subtitle: (started: string | null, recalculated: string | null) =>
    [started && `План начат ${dayMonth(started, 'ru')}`, recalculated && `${started ? 'пересчитан' : 'Пересчитан'} ${dayMonth(recalculated, 'ru')} по новым данным`]
      .filter(Boolean)
      .join(' · '),

  empty: {
    noDataTitle: 'План появится, когда будут данные',
    noDataText: 'Добавь доходы, расходы и кредиты — qorgan составит порядок погашения, прогноз долга и цели.',
    fill: 'Заполнить профиль',
    noDebtTitle: 'Кредитов нет — гасить нечего',
    noDebtText: 'Хорошая позиция. Поставь цель — например, резерв на 3 месяца расходов — и проверяй крупные покупки заранее.',
    check: 'Проверить покупку',
    addGoal: 'Добавить цель',
  },

  progress: {
    title: 'Общий прогресс',
    debtDown: 'Долг снизился с начала плана',
    debtUp: 'Долг вырос с начала плана',
    debtSame: 'Долг с начала плана не изменился',
    /** months since the plan started → «2,5 месяца» / «9 дней» */
    period: (m: number) => {
      if (m <= 0) return null;
      if (m < 1) {
        const d = Math.max(1, Math.round(m * 30.4));
        return `${d} ${pluralRu(d, ['день', 'дня', 'дней'])}`;
      }
      const h = Math.round(m * 2) / 2;
      return Number.isInteger(h) ? `${h} ${pluralRu(h, ['месяц', 'месяца', 'месяцев'])}` : `${half(m)} месяца`;
    },
    debtNote: (from: number, to: number, period: string | null) => `${num(from)} → ${money(to)}${period ? ` за ${period}` : ''}`,
    load: 'Долговая нагрузка',
    target: (pct: string) => `цель — ${pct} и ниже`,
    targetMark: (pct: string) => `цель ${pct}`,
    nowMark: (pct: string) => `сейчас ${pct}`,
    /** points: [first = now, …changes] */
    pathAria: (points: Array<{ month: string; load: number }>, target: number, reach: string | null, reachedNow: boolean) =>
      `Путь нагрузки: ${points.map((p, i) => `${i === 0 ? 'сейчас' : monthName(p.month, 'ru')} ${percent(p.load)}`).join(', ')}. ` +
      (reachedNow
        ? `Цель ${percent(target)} уже достигнута.`
        : reach
          ? `Цель ${percent(target)} будет достигнута ${ruIn(reach)}.`
          : `Цель ${percent(target)} в ближайший год не достигается.`),
    explain: ({ notYet, within, target, relief, reach }: ExplainInput) => {
      if (within) return 'Нагрузка уже в пределах цели — плати по графику и не бери новых кредитов.';
      const parts: string[] = [];
      if (notYet) parts.push('Нагрузка пока не снизилась.');
      if (relief) {
        let s = `После закрытия ${ruGenFull[relief.type]} ${ruIn(relief.end)} ${notYet ? 'она' : 'нагрузка'} упадет до ${percent(relief.load)}`;
        if (reach && reach.load < relief.load - 0.005) s += `, а ${ruIn(reach.month)} — до ${percent(reach.load)}`;
        parts.push(`${s}.`);
        if (!reach) parts.push(`До цели ${percent(target)} — дольше года по текущему графику.`);
      } else if (reach) {
        parts.push(`Нагрузка снизится до ${percent(reach.load)} ${ruIn(reach.month)} — это в пределах цели ${percent(target)}.`);
      } else {
        parts.push(`По текущему графику нагрузка не опустится до ${percent(target)} в ближайший год. Начни с самых дорогих долгов.`);
      }
      return parts.join(' ');
    },
  },

  next: {
    eyebrow: 'Следующий шаг',
    title: (type: CreditType, org: string) => `Платеж по ${ruDat[type]} ${org}`,
    overdue: (n: number) => `просрочка ${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`,
    markPaid: 'Отметить как оплачено',
    paid: 'Платеж отмечен — план пересчитан',
    noneTitle: 'Ближайших платежей нет',
    noneText: 'Когда появится дата следующего платежа, она будет здесь.',
  },

  forecast: {
    title: 'Прогноз задолженности по плану',
    period: (from: string, to: string) => `${cap(from)} — ${to} · без новых долгов`,
    actual: 'Факт',
    forecast: 'Прогноз по плану',
    today: 'сегодня',
    closed: {
      cash_loan: 'Кредит закрыт',
      installment: 'Рассрочка закрыта',
      microloan: 'Микрокредит закрыт',
      credit_card: 'Карта погашена',
      auto_loan: 'Автокредит закрыт',
      mortgage: 'Ипотека закрыта',
      other: 'Кредит закрыт',
    } satisfies Record<CreditType, string>,
    aria: (now: string, last: string, lastMonth: string, events: Array<{ month: string; label: string }>) =>
      `Задолженность по плану: сейчас ${now}, ${ruIn(lastMonth)} — ${last}.` +
      (events.length ? ` ${cap(events.map((e) => `${monthName(e.month, 'ru')} — ${e.label.toLowerCase()}`).join(', '))}.` : ''),
  },

  prio: {
    title: 'Что гасить в первую очередь',
    subtitle: 'Сначала самые дорогие долги',
    until: (d: string) => `до ${dayMonth(d, 'ru')}`,
    untilMonth: (d: string) => `до ${monthName(d, 'ru', 'gen')}`,
    onSchedule: 'по графику',
    name: (org: string, type: CreditType) => `${org} · ${common.ru.creditTypeLower[type]}`,
    group: (types: CreditType[]) => cap(joinRu(types.map((x) => common.ru.creditTypeLower[x]))),
    closeFirst: (left: number | null) =>
      `Самая высокая переплата. ${left ? `${left === 1 ? 'Остался' : 'Осталось'} ${left} ${pluralRu(left, ['платеж', 'платежа', 'платежей'])} — плати` : 'Плати'} строго по графику.`,
    aboveMin: (extra: string, from: string | null) =>
      `Минимальный платеж почти не уменьшает долг. ${from ? `С ${monthName(from, 'ru', 'abl')} — плюс ${extra} сверх минимума.` : `Плати хотя бы на ${extra} больше минимума.`}`,
    earlyLater: (after: CreditType | null) => `Досрочное погашение — ${after ? `после ${ruGen[after]}, ` : ''}если появятся свободные деньги.`,
    keep: (types: CreditType[]) => {
      const others = types.filter((x) => x !== 'installment');
      if (!types.includes('installment')) return 'Переплата здесь самая низкая — гасить досрочно невыгодно.';
      if (!others.length) return 'У рассрочки нет переплаты — гасить досрочно невыгодно.';
      return `У рассрочки нет переплаты, у ${joinRu(others.map((x) => ruGen[x]))} — самая низкая. Гасить досрочно невыгодно.`;
    },
  },

  goals: {
    title: 'Финансовые цели',
    add: 'Цель',
    addLabel: 'Добавить цель',
    nouns: {
      smartphone: { acc: 'смартфон', gen: 'смартфона' },
      appliances: { acc: 'технику', gen: 'техники' },
      furniture: { acc: 'мебель', gen: 'мебели' },
      car: { acc: 'автомобиль', gen: 'автомобиля' },
      laptop: { acc: 'ноутбук', gen: 'ноутбука' },
      other: { acc: 'покупку', gen: 'покупки' },
    } satisfies Record<PurchaseCategory, Noun>,
    closeCredit: (type: CreditType) => `Погасить ${common.ru.creditTypeAcc[type]}`,
    reduceLoad: (pct: string) => `Сократить нагрузку до ${pct}`,
    saveFor: (noun: Noun) => `Накопить на ${noun.acc} без кредита`,
    reserve: (amount: string) => `Резерв ${amount}`,
    planned: 'запланировано',
    noDate: 'без срока',
    done: 'Выполнено',
    payments: (done: number, total: number) => `${done} из ${total} ${pluralRu(total, ['платежа', 'платежей', 'платежей'])}`,
    loadAria: (now: string, target: string) => `Сейчас ${now}, цель ${target}`,
    loadStarts: (now: string, starts: string) => `${now} сейчас — начнет снижаться в ${monthName(starts, 'ru', 'prep')}`,
    loadNow: (now: string, target: string) => `${now} сейчас — цель ${target}`,
    loadReached: (now: string) => `${now} сейчас — цель достигнута`,
    amountOf: (current: number, target: number) => `${num(current)} из ${money(target)}`,
    monthly: (amount: string) => `начинаешь с ${amount} в месяц`,
    fromScenarios: 'добавлено из сценариев',
    reserveAfter: (noun: Noun) => `Начнем после покупки ${noun.gen} — так цели не мешают друг другу.`,
    reserveLater: 'Начнем, когда закроются текущие цели.',
    remove: (title: string) => `Удалить цель «${title}»`,
    confirmTitle: 'Удалить цель?',
    confirmText: (title: string) => `Цель «${title}» и ее прогресс пропадут из плана.`,
    confirm: 'Удалить цель',
    removed: 'Цель удалена',
    empty: 'Целей пока нет. Добавь свою — например, резерв на непредвиденные расходы.',
  },

  dialog: {
    title: 'Новая цель',
    description: 'Например, резерв на 3 месяца расходов или ремонт.',
    name: 'Название',
    namePlaceholder: 'Резерв на ремонт',
    amount: 'Сколько нужно',
    date: 'Срок',
    nameRequired: 'Назови цель',
    amountRequired: 'Укажи сумму больше нуля',
    submit: 'Добавить цель',
    added: 'Цель добавлена в план',
  },

  reco: {
    title: 'Рекомендации qorgan AI',
    noNewCredit: (month: string) => `Не оформляй новые кредиты до ${monthName(month, 'ru', 'gen')}`,
    noNewCreditHigh: 'Пока нагрузка выше 45%, любой новый платеж — высокий риск для бюджета.',
    noNewCreditText: 'Пока текущие долги не закрыты, новый платеж сократит запас в бюджете.',
    cardExtra: (from: string, amount: string) => `С ${monthName(from, 'ru', 'abl')} — ${amount} сверх минимума по карте`,
    cardExtraText: (after: CreditType | null, until: string) =>
      `${after ? `Освободившиеся после ${ruGen[after]} деньги` : 'Дополнительные платежи'} закроют карту к ${monthName(until, 'ru', 'dat')}.`,
    updateIncome: 'Обновляй доход раз в месяц',
    updateIncomeText: 'Подработка нерегулярная. Если доход изменится, план пересчитается.',
    actions: { accept: 'Принять', dismiss: 'Не сейчас', remind: 'Напоминать' },
    status: { in_plan: 'В плане', accepted: 'Принято', reminder_on: 'Напоминание включено', dismissed: 'Скрыто' },
    done: { accept: 'Рекомендация добавлена в план', dismiss: 'Рекомендация скрыта', remind: 'Будем напоминать раз в месяц' },
  },
};

const kk: typeof ru = {
  title: 'Қаржылық тұрақтылық жоспарым',
  subtitle: (started: string | null, recalculated: string | null) => {
    const on = (d: string) => `${toDate(d).getDate()} ${monthName(d, 'kk', 'prep')}`;
    return [started && `Жоспар ${on(started)} басталды`, recalculated && `${on(recalculated)} жаңа деректер бойынша қайта есептелді`]
      .filter(Boolean)
      .join(' · ');
  },

  empty: {
    noDataTitle: 'Деректер болғанда жоспар пайда болады',
    noDataText: 'Табысты, шығыстарды және несиелерді қосыңыз — qorgan өтеу ретін, қарыз болжамын және мақсаттарды құрады.',
    fill: 'Профильді толтыру',
    noDebtTitle: 'Несие жоқ — өтейтін ештеңе жоқ',
    noDebtText: 'Жақсы жағдай. Мақсат қойыңыз — мысалы, 3 айлық шығысқа қор — және ірі сатып алуларды алдын ала тексеріңіз.',
    check: 'Сатып алуды тексеру',
    addGoal: 'Мақсат қосу',
  },

  progress: {
    title: 'Жалпы прогресс',
    debtDown: 'Жоспар басталғаннан бері қарыз азайды',
    debtUp: 'Жоспар басталғаннан бері қарыз өсті',
    debtSame: 'Жоспар басталғаннан бері қарыз өзгерген жоқ',
    period: (m: number) => {
      if (m <= 0) return null;
      if (m < 1) return `${Math.max(1, Math.round(m * 30.4))} күнде`;
      return `${half(m)} айда`;
    },
    debtNote: (from: number, to: number, period: string | null) => `${num(from)} → ${money(to)}${period ? ` · ${period}` : ''}`,
    load: 'Қарыз жүктемесі',
    target: (pct: string) => `мақсат — ${pct} және одан төмен`,
    targetMark: (pct: string) => `мақсат ${pct}`,
    nowMark: (pct: string) => `қазір ${pct}`,
    pathAria: (points: Array<{ month: string; load: number }>, target: number, reach: string | null, reachedNow: boolean) =>
      `Жүктеме жолы: ${points.map((p, i) => `${i === 0 ? 'қазір' : monthName(p.month, 'kk')} ${percent(p.load)}`).join(', ')}. ` +
      (reachedNow
        ? `${percent(target)} мақсатына жеттіңіз.`
        : reach
          ? `${percent(target)} мақсатына ${kkIn(reach)} жетеді.`
          : `${percent(target)} мақсатына жақын бір жылда жетпейді.`),
    explain: ({ notYet, within, target, relief, reach }: ExplainInput) => {
      if (within) return 'Жүктеме мақсат шегінде — кесте бойынша төлеп, жаңа несие алмаңыз.';
      const parts: string[] = [];
      if (notYet) parts.push('Жүктеме әзірге төмендеген жоқ.');
      if (relief) {
        let s = `${cap(common.kk.creditTypeLower[relief.type])} ${kkIn(relief.end)} жабылғаннан кейін жүктеме ${percent(relief.load)}-ға дейін түседі`;
        if (reach && reach.load < relief.load - 0.005) s += `, ал ${kkIn(reach.month)} — ${percent(reach.load)}-ға дейін`;
        parts.push(`${s}.`);
        if (!reach) parts.push(`${percent(target)} мақсатына жету қазіргі кесте бойынша бір жылдан асады.`);
      } else if (reach) {
        parts.push(`Жүктеме ${kkIn(reach.month)} ${percent(reach.load)}-ға дейін төмендейді — бұл ${percent(target)} мақсаты шегінде.`);
      } else {
        parts.push(`Қазіргі кесте бойынша жүктеме жақын бір жылда ${percent(target)}-ға дейін түспейді. Ең қымбат қарыздардан бастаңыз.`);
      }
      return parts.join(' ');
    },
  },

  next: {
    eyebrow: 'Келесі қадам',
    title: (type: CreditType, org: string) => `${org} ${common.kk.creditTypePoss[type]} бойынша төлем`,
    overdue: (n: number) => `${n} күн кешікті`,
    markPaid: 'Төленді деп белгілеу',
    paid: 'Төлем белгіленді — жоспар қайта есептелді',
    noneTitle: 'Жақын төлемдер жоқ',
    noneText: 'Келесі төлем күні белгілі болғанда, ол осында көрінеді.',
  },

  forecast: {
    title: 'Жоспар бойынша берешек болжамы',
    period: (from: string, to: string) => `${cap(from)} — ${to} · жаңа қарызсыз`,
    actual: 'Нақты',
    forecast: 'Жоспар бойынша болжам',
    today: 'бүгін',
    closed: {
      cash_loan: 'Несие жабылды',
      installment: 'Бөліп төлеу жабылды',
      microloan: 'Микронесие жабылды',
      credit_card: 'Карта өтелді',
      auto_loan: 'Автонесие жабылды',
      mortgage: 'Ипотека жабылды',
      other: 'Несие жабылды',
    },
    aria: (now: string, last: string, lastMonth: string, events: Array<{ month: string; label: string }>) =>
      `Жоспар бойынша берешек: қазір ${now}, ${kkIn(lastMonth)} — ${last}.` +
      (events.length ? ` ${cap(events.map((e) => `${monthName(e.month, 'kk')} — ${e.label.toLowerCase()}`).join(', '))}.` : ''),
  },

  prio: {
    title: 'Алдымен нені өтеу керек',
    subtitle: 'Алдымен ең қымбат қарыздар',
    until: (d: string) => `${toDate(d).getDate()} ${monthName(d, 'kk', 'dat')} дейін`,
    untilMonth: (d: string) => `${monthName(d, 'kk', 'dat')} дейін`,
    onSchedule: 'кесте бойынша',
    name: (org: string, type: CreditType) => `${org} · ${common.kk.creditTypeLower[type]}`,
    group: (types: CreditType[]) => cap(joinKk(types.map((x) => common.kk.creditTypeLower[x]))),
    closeFirst: (left: number | null) => `Артық төлем ең жоғары. ${left ? `${left} төлем қалды — кестені` : 'Кестені'} қатаң сақтаңыз.`,
    aboveMin: (extra: string, from: string | null) =>
      `Ең төменгі төлем қарызды азайтпайды дерлік. ${from ? `${cap(monthName(from, 'kk', 'abl'))} бастап — ең төменгі төлемнен бөлек тағы ${extra}.` : `Ең төменгі төлемнен кемінде ${extra} артық төлеңіз.`}`,
    earlyLater: (after: CreditType | null) => `Мерзімінен бұрын өтеу — ${after ? `${kkAbl[after]} кейін, ` : ''}бос ақша пайда болса.`,
    keep: (types: CreditType[]) => {
      const others = types.filter((x) => x !== 'installment');
      if (!types.includes('installment')) return 'Мұнда артық төлем ең төмен — мерзімінен бұрын өтеу тиімсіз.';
      if (!others.length) return 'Бөліп төлеуде артық төлем жоқ — мерзімінен бұрын өтеу тиімсіз.';
      return `Бөліп төлеуде артық төлем жоқ, ${joinKk(others.map((x) => kkLoc[x]))} — ең төмені. Мерзімінен бұрын өтеу тиімсіз.`;
    },
  },

  goals: {
    title: 'Қаржылық мақсаттар',
    add: 'Мақсат',
    addLabel: 'Мақсат қосу',
    nouns: {
      smartphone: { acc: 'смартфон', gen: 'смартфон' },
      appliances: { acc: 'техника', gen: 'техника' },
      furniture: { acc: 'жиһаз', gen: 'жиһаз' },
      car: { acc: 'көлік', gen: 'көлік' },
      laptop: { acc: 'ноутбук', gen: 'ноутбук' },
      other: { acc: 'зат', gen: 'зат' },
    },
    closeCredit: (type: CreditType) => `${cap(common.kk.creditTypeAcc[type])} өтеу`,
    reduceLoad: (pct: string) => `Жүктемені ${pct}-ға дейін азайту`,
    saveFor: (noun: Noun) => `${cap(noun.acc)} үшін несиесіз жинау`,
    reserve: (amount: string) => `Қор — ${amount}`,
    planned: 'жоспарланған',
    noDate: 'мерзімсіз',
    done: 'Орындалды',
    payments: (done: number, total: number) => `${total} төлемнен ${done} төленді`,
    loadAria: (now: string, target: string) => `Қазір ${now}, мақсат ${target}`,
    loadStarts: (now: string, starts: string) => `Қазір ${now} — ${monthName(starts, 'kk', 'prep')} төмендей бастайды`,
    loadNow: (now: string, target: string) => `Қазір ${now} — мақсат ${target}`,
    loadReached: (now: string) => `Қазір ${now} — мақсатқа жеттіңіз`,
    amountOf: (current: number, target: number) => `${money(target)} ішінен ${money(current)} жиналды`,
    monthly: (amount: string) => `бастапқыда айына ${amount}`,
    fromScenarios: 'сценарийлерден қосылды',
    reserveAfter: (noun: Noun) => `${cap(noun.gen)} сатып алғаннан кейін бастаймыз — осылай мақсаттар бір-біріне кедергі болмайды.`,
    reserveLater: 'Қазіргі мақсаттар орындалғанда бастаймыз.',
    remove: (title: string) => `«${title}» мақсатын жою`,
    confirmTitle: 'Мақсатты жою керек пе?',
    confirmText: (title: string) => `«${title}» мақсаты мен оның прогресі жоспардан өшеді.`,
    confirm: 'Мақсатты жою',
    removed: 'Мақсат жойылды',
    empty: 'Әзірге мақсат жоқ. Өз мақсатыңызды қосыңыз — мысалы, күтпеген шығыстарға арналған қор.',
  },

  dialog: {
    title: 'Жаңа мақсат',
    description: 'Мысалы, 3 айлық шығысқа қор немесе жөндеу.',
    name: 'Атауы',
    namePlaceholder: 'Жөндеуге қор',
    amount: 'Қанша керек',
    date: 'Мерзімі',
    nameRequired: 'Мақсатқа атау беріңіз',
    amountRequired: 'Нөлден үлкен соманы көрсетіңіз',
    submit: 'Мақсат қосу',
    added: 'Мақсат жоспарға қосылды',
  },

  reco: {
    title: 'qorgan AI ұсыныстары',
    noNewCredit: (month: string) => `${cap(monthName(month, 'kk', 'dat'))} дейін жаңа несие рәсімдемеңіз`,
    noNewCreditHigh: 'Жүктеме 45%-дан жоғары болғанда, кез келген жаңа төлем бюджет үшін жоғары тәуекел.',
    noNewCreditText: 'Қазіргі қарыздар жабылмайынша, жаңа төлем бюджеттегі қорды азайтады.',
    cardExtra: (from: string, amount: string) => `${cap(monthName(from, 'kk', 'abl'))} бастап — картаға ең төменгі төлемнен бөлек ${amount}`,
    cardExtraText: (after: CreditType | null, until: string) =>
      `${after ? `${cap(kkAbl[after])} кейін босаған ақша` : 'Қосымша төлемдер'} картаны ${monthName(until, 'kk', 'dat')} дейін жабады.`,
    updateIncome: 'Табысты айына бір рет жаңартыңыз',
    updateIncomeText: 'Қосымша табыс тұрақсыз. Табыс өзгерсе, жоспар қайта есептеледі.',
    actions: { accept: 'Қабылдау', dismiss: 'Қазір емес', remind: 'Еске салу' },
    status: { in_plan: 'Жоспарда', accepted: 'Қабылданды', reminder_on: 'Еске салу қосулы', dismissed: 'Жасырылды' },
    done: { accept: 'Ұсыныс жоспарға қосылды', dismiss: 'Ұсыныс жасырылды', remind: 'Айына бір рет еске саламыз' },
  },
};

export const dict: Dict<typeof ru> = { ru, kk };
export type Strings = typeof ru;
export type { Noun };

const GENERIC_TITLES = new Set([
  'смартфон', 'телефон', 'техника', 'бытовая техника', 'мебель', 'авто', 'автомобиль', 'машина', 'ноутбук', 'покупка', 'другое',
  'жиһаз', 'көлік', 'басқа', 'сатып алу',
]);

/** Name of the thing a save-up goal is for: the category noun, or the title the user typed. */
export function goalNoun(t: Strings, item: unknown, title: unknown): Noun {
  const category = (typeof item === 'string' && item in t.goals.nouns ? item : 'other') as PurchaseCategory;
  const text = typeof title === 'string' ? title.trim() : '';
  if (!text || GENERIC_TITLES.has(text.toLowerCase())) return t.goals.nouns[category];
  return { acc: text, gen: text };
}
