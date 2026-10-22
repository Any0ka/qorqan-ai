import type { CreditType, NotificationCategory } from '@/api/types';
import type { Dict } from '@/i18n/I18nProvider';
import { pluralRu } from '@/lib/format';

export type Tab = 'all' | NotificationCategory;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const payments = (n: number) => pluralRu(n, ['платеж', 'платежа', 'платежей']);
const NUM_RU = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];
const ORD_RU = ['', '', 'второй', 'третий', 'четвертый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый', 'десятый', 'одиннадцатый', 'двенадцатый'];

/** Texts of notification codes (backend `seed.py`, `routers/reports.py`): titles and bodies are built from `params`. */
const ru = {
  title: 'Уведомления',
  unreadCount: (n: number) => `${n} ${pluralRu(n, ['новое', 'новых', 'новых'])}`,
  noUnread: 'Новых нет',
  updated: (date: string) => `данные обновлены ${date}`,
  readAll: 'Прочитать все',
  listLabel: 'Список уведомлений',
  tabsLabel: 'Тип уведомлений',
  tabs: { all: 'Все', payment: 'Платежи', load: 'Нагрузка', data: 'Данные', goal: 'Цели', recommendation: 'Рекомендации' } satisfies Record<Tab, string>,
  groups: { today: 'Сегодня', week: 'На этой неделе', earlier: 'Ранее' },
  unread: 'Новое',
  markRead: 'Отметить прочитанным',
  loadError: 'Не удалось загрузить уведомления',
  emptyAll: 'Уведомлений пока нет',
  emptyAllText: 'Здесь появятся напоминания о платежах, изменения нагрузки и новые рекомендации.',
  emptyAllCta: 'Открыть обзор',
  emptyCategory: 'В этой категории пока ничего нет',
  emptyCategoryText: 'Мы напишем, когда появится что-то важное.',
  showAll: 'Показать все',
  actions: {
    open_credit: 'Открыть кредит',
    mark_paid: 'Уже оплачено',
    view_budget: 'Посмотреть бюджет',
    open_plan: 'Открыть план',
    update_income: 'Обновить доход',
    other: 'Открыть',
  } as Record<string, string>,
  paidDone: 'Оплата отмечена',
  paidToast: (org: string) => `Платеж по «${org}» отмечен как оплаченный.`,

  settings: {
    title: 'Что присылать',
    payment_reminders: 'Напоминания о платежах',
    paymentHint: 'за 3 дня до даты',
    load_changes: 'Изменение долговой нагрузки',
    data_updates: 'Нужно обновить данные',
    goals_progress: 'Цели и прогресс',
    recommendations: 'Новые рекомендации',
    where: 'Куда',
    app: 'В qorgan',
    browser: 'Уведомления в браузере',
    email: (masked: string) => `Email · ${masked}`,
    browserBlocked: 'Браузер запретил уведомления. Разреши их в настройках сайта и включи снова.',
    browserUnsupported: 'Этот браузер не поддерживает уведомления.',
    noAds: 'Мы не присылаем рекламу кредитов и предложения займов.',
    loadError: 'Не удалось загрузить настройки',
  },

  fallbackTitle: 'Уведомление',

  paymentDue: {
    /** when: `common.inDays` («через 3 дня»), type: dative («микрокредиту») */
    title: (when: string, type: string) => `${cap(when)} — платеж по ${type}`,
    body: (org: string, amount: string, date: string) =>
      `${org} · ${amount} · ${date}. Платеж уже учтен в бюджете месяца — просрочка увеличит переплату.`,
  },
  paymentsHigher: {
    /** month: prepositional («ноябре») */
    title: (month: string) => `В ${month} выплаты будут выше обычного`,
    bodyInsurance: (extra: string, total: string, usual: string) =>
      `К платежам добавится ежегодная страховка автокредита — ${extra}. Всего ${total} вместо ${usual}. Проверь свободные средства.`,
    body: (extra: string, total: string, usual: string) => `К платежам добавится ${extra}. Всего ${total} вместо ${usual}. Проверь свободные средства.`,
  },
  planReco: {
    title: 'Новая рекомендация в плане',
    /** type: accusative, until: dative month («апрелю»), from: genitive month («января») */
    body: (type: string, until: string, amount: string, from: string) => `Как закрыть ${type} к ${until}: ${amount} сверх минимума с ${from}.`,
    bodyGeneric: 'Открой план, чтобы посмотреть, что изменилось.',
  },
  loadStreak: {
    title: (months: number) =>
      months < 2 ? 'Нагрузка выше 45%' : ORD_RU[months] ? `Нагрузка выше 45% уже ${ORD_RU[months]} месяц` : `Нагрузка выше 45% уже ${months} месяцев подряд`,
    body: (load: string) => `Сейчас ${load}. Новые кредиты лучше отложить, пока нагрузка не снизится.`,
  },
  irregularIncome: {
    title: (source: string) => (source.trim().toLowerCase() === 'подработка' ? 'Подтверди доход от подработки' : `Подтверди доход «${source}»`),
    /** month: nominative («октябрь») */
    body: (month: string) => `Доход нерегулярный: укажи сумму за ${month}, чтобы оценки оставались точными.`,
  },
  goal: {
    /** type: accusative («микрокредит») or null when unknown */
    closeTitle: (type: string | null, org: string, done: number, total: number) =>
      `Цель «${type ? `Погасить ${type}` : `Погасить долг в ${org}`}»: ${done} из ${total} ${pluralRu(total, ['платежа', 'платежей', 'платежей'])}`,
    title: (done: number, total: number) => `Прогресс по цели: ${done} из ${total}`,
    left: (n: number) => (n === 1 ? 'Остался один платеж' : `Осталось ${NUM_RU[n] ?? n} ${payments(n)}`),
    body: (left: string, date: string | null) => (date ? `${left} — последний ${date}.` : `${left}.`),
    done: 'Все платежи внесены — цель достигнута.',
  },
  report: {
    title: 'Кредитный отчёт обработан',
    found: (n: number) =>
      n === 0 ? 'Обязательств в отчёте не найдено.' : `Найдено ${n} ${pluralRu(n, ['обязательство', 'обязательства', 'обязательств'])}, все подтверждены.`,
    manual: (n: number) => `Еще ${n} ${pluralRu(n, ['обязательство добавлено', 'обязательства добавлены', 'обязательств добавлено'])} вручную.`,
  },

  typeDat: {
    cash_loan: 'кредиту наличными',
    installment: 'рассрочке',
    microloan: 'микрокредиту',
    credit_card: 'кредитной карте',
    auto_loan: 'автокредиту',
    mortgage: 'ипотеке',
    other: 'кредиту',
  } satisfies Record<CreditType, string>,
};

const kk: typeof ru = {
  title: 'Хабарландырулар',
  unreadCount: (n: number) => `${n} жаңа`,
  noUnread: 'Жаңасы жоқ',
  updated: (date: string) => `деректер ${date} жаңартылды`,
  readAll: 'Барлығын оқылды деп белгілеу',
  listLabel: 'Хабарландырулар тізімі',
  tabsLabel: 'Хабарландыру түрі',
  tabs: { all: 'Барлығы', payment: 'Төлемдер', load: 'Жүктеме', data: 'Деректер', goal: 'Мақсаттар', recommendation: 'Ұсыныстар' },
  groups: { today: 'Бүгін', week: 'Осы аптада', earlier: 'Бұрынырақ' },
  unread: 'Жаңа',
  markRead: 'Оқылды деп белгілеу',
  loadError: 'Хабарландыруларды жүктеу мүмкін болмады',
  emptyAll: 'Әзірге хабарландырулар жоқ',
  emptyAllText: 'Мұнда төлем туралы еске салғыштар, жүктеменің өзгерістері және жаңа ұсыныстар пайда болады.',
  emptyAllCta: 'Шолуды ашу',
  emptyCategory: 'Бұл санатта әзірге ештеңе жоқ',
  emptyCategoryText: 'Маңызды бірдеңе болғанда хабарлаймыз.',
  showAll: 'Барлығын көрсету',
  actions: {
    open_credit: 'Несиені ашу',
    mark_paid: 'Төлеп қойдым',
    view_budget: 'Бюджетті көру',
    open_plan: 'Жоспарды ашу',
    update_income: 'Табысты жаңарту',
    other: 'Ашу',
  },
  paidDone: 'Төлем белгіленді',
  paidToast: (org: string) => `«${org}» бойынша төлем төленді деп белгіленді.`,

  settings: {
    title: 'Не жіберу керек',
    payment_reminders: 'Төлемдер туралы еске салу',
    paymentHint: 'төлем күніне 3 күн қалғанда',
    load_changes: 'Қарыз жүктемесінің өзгеруі',
    data_updates: 'Деректерді жаңарту қажет',
    goals_progress: 'Мақсаттар және прогресс',
    recommendations: 'Жаңа ұсыныстар',
    where: 'Қайда',
    app: 'qorgan ішінде',
    browser: 'Браузердегі хабарландырулар',
    email: (masked: string) => `Email · ${masked}`,
    browserBlocked: 'Браузер хабарландыруларға тыйым салды. Оларды сайт баптауларында рұқсат етіп, қайта қосыңыз.',
    browserUnsupported: 'Бұл браузер хабарландыруларды қолдамайды.',
    noAds: 'Біз несие жарнамасын және қарыз ұсыныстарын жібермейміз.',
    loadError: 'Баптауларды жүктеу мүмкін болмады',
  },

  fallbackTitle: 'Хабарландыру',

  paymentDue: {
    title: (when: string, type: string) => `${cap(when)} — ${type} бойынша төлем`,
    body: (org: string, amount: string, date: string) =>
      `${org} · ${amount} · ${date}. Төлем айлық бюджетте ескерілген — мерзімін өткізсеңіз, артық төлем көбейеді.`,
  },
  paymentsHigher: {
    title: (month: string) => `${cap(month)} төлемдер әдеттегіден жоғары болады`,
    bodyInsurance: (extra: string, total: string, usual: string) =>
      `Төлемдерге автонесиенің жылдық сақтандыруы қосылады — ${extra}. Барлығы ${usual} орнына ${total}. Бос қаражатыңызды тексеріңіз.`,
    body: (extra: string, total: string, usual: string) => `Төлемдерге ${extra} қосылады. Барлығы ${usual} орнына ${total}. Бос қаражатыңызды тексеріңіз.`,
  },
  planReco: {
    title: 'Жоспарда жаңа ұсыныс',
    body: (type: string, until: string, amount: string, from: string) =>
      `${cap(type)} ${until} дейін қалай жабуға болады: ${from} бастап ең аз төлемнен бөлек ${amount}.`,
    bodyGeneric: 'Не өзгергенін көру үшін жоспарды ашыңыз.',
  },
  loadStreak: {
    title: (months: number) => (months < 2 ? 'Жүктеме 45%-дан жоғары' : `Жүктеме ${months} ай қатарынан 45%-дан жоғары`),
    body: (load: string) => `Қазір ${load}. Жүктеме төмендегенше жаңа несиелерді кейінге қалдырған дұрыс.`,
  },
  irregularIncome: {
    title: (source: string) => `«${source}» табысын растаңыз`,
    body: (month: string) => `Табыс тұрақты емес: бағалар дәл болуы үшін ${month} айындағы сомасын көрсетіңіз.`,
  },
  goal: {
    closeTitle: (type: string | null, org: string, done: number, total: number) =>
      `«${type ? `${cap(type)} өтеу` : `${org} алдындағы қарызды өтеу`}» мақсаты: ${done}/${total} төлем`,
    title: (done: number, total: number) => `Мақсат бойынша прогресс: ${done}/${total}`,
    left: (n: number) => `${n} төлем қалды`,
    body: (left: string, date: string | null) => (date ? `${left} — соңғысы ${date}.` : `${left}.`),
    done: 'Барлық төлем енгізілді — мақсатқа жеттіңіз.',
  },
  report: {
    title: 'Несие есебі өңделді',
    found: (n: number) => (n === 0 ? 'Есептен міндеттемелер табылмады.' : `${n} міндеттеме табылды, барлығы расталды.`),
    manual: (n: number) => `Тағы ${n} міндеттеме қолмен қосылды.`,
  },

  typeDat: {
    cash_loan: 'қолма-қол ақшаға несие',
    installment: 'бөліп төлеу',
    microloan: 'микронесие',
    credit_card: 'кредит картасы',
    auto_loan: 'автонесие',
    mortgage: 'ипотека',
    other: 'несие',
  },
};

export const dict: Dict<typeof ru> = { ru, kk };
export type NotificationStrings = typeof ru;
