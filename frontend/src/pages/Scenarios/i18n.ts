import type { CreditType, FinancingKind, PurchaseCategory, ScenarioOption } from '@/api/types';
import { common } from '@/i18n/common';
import type { Dict } from '@/i18n/I18nProvider';
import { money, pluralRu } from '@/lib/format';

export type Advice = NonNullable<ScenarioOption['advice']>;
/** Grammatical forms of the purchase name. Kazakh uses the bare form everywhere (`nom`). */
export type Noun = { nom: string; acc: string; gen: string };

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ruMonths = (n: number) => `${n} ${pluralRu(n, ['месяц', 'месяца', 'месяцев'])}`;
/** Markup over the financed sum, whole percent: 924 000 for 840 000 → 10. */
const markupPct = (o: ScenarioOption) => {
  const base = o.price - o.down_payment;
  return base > 0 ? Math.round(((o.total_cost - o.down_payment) / base - 1) * 100) : 0;
};
const same = (s: string): Noun => ({ nom: s, acc: s, gen: s });

const ruKind: Record<FinancingKind, string> = {
  credit: 'Кредит',
  installment: 'Рассрочка',
  microloan: 'Микрокредит',
  credit_card: 'Кредитная карта',
  own: 'Свои деньги',
};
const ruGen: Record<CreditType, string> = {
  cash_loan: 'кредита наличными',
  installment: 'рассрочки',
  microloan: 'микрокредита',
  credit_card: 'кредитной карты',
  auto_loan: 'автокредита',
  mortgage: 'ипотеки',
  other: 'кредита',
};
const kkKind: Record<FinancingKind, string> = {
  credit: 'несие',
  installment: 'бөліп төлеу',
  microloan: 'микронесие',
  credit_card: 'кредит картасы',
  own: 'өз қаражаты',
};

const ru = {
  title: 'А если выбрать другой вариант?',
  updated: (date: string) => `Данные обновлены ${date}`,
  refresh: 'Обновить',

  empty: {
    title: 'Сначала проверь покупку',
    text: 'Сценарии строятся на основе проверки: укажи, что хочешь купить и на каких условиях, — и qorgan подберет более безопасные варианты.',
    cta: 'Проверить покупку',
  },
  insufficient: {
    title: 'Расчет приблизительный',
    text: 'Не хватает данных о доходах, расходах или кредитах — уровень риска может быть неточным.',
    cta: 'Дополнить данные',
  },

  nouns: {
    smartphone: { nom: 'смартфон', acc: 'смартфон', gen: 'смартфона' },
    appliances: { nom: 'техника', acc: 'технику', gen: 'техники' },
    furniture: { nom: 'мебель', acc: 'мебель', gen: 'мебели' },
    car: { nom: 'автомобиль', acc: 'автомобиль', gen: 'автомобиля' },
    laptop: { nom: 'ноутбук', acc: 'ноутбук', gen: 'ноутбука' },
    other: { nom: 'покупка', acc: 'покупку', gen: 'покупки' },
  } satisfies Record<PurchaseCategory, Noun>,
  ownNoun: same,

  goal: {
    title: (noun: string) => `Цель: ${noun}`,
    original: (kind: FinancingKind, term: number, price: number) => {
      const what =
        kind === 'own'
          ? `покупка за ${money(price)} своими деньгами`
          : kind === 'credit_card'
            ? `кредитная карта на ${ruMonths(term)}, ${money(price)}`
            : `${ruKind[kind].toLowerCase()} на ${ruMonths(term)} за ${money(price)}`;
      return `Исходный вариант — ${what}`;
    },
    change: 'Изменить цель',
  },

  table: {
    title: (n: number, noun: Noun) => `${n} ${pluralRu(n, ['способ', 'способа', 'способов'])} получить ${noun.acc}`,
    base: (income: string, expenses: string, payments: string) => `Доход ${income} · расходы ${expenses} · платежи сейчас ${payments}`,
    caption: 'Сравнение вариантов покупки',
    recommended: 'Рекомендуем',
    rows: {
      total: 'Полная стоимость',
      monthly: 'Платеж в месяц',
      load: 'Долговая нагрузка',
      free: 'Свободные средства',
      when: 'Когда покупка',
      risk: 'Риск решения',
    },
    saving: (amount: string) => `откладываешь ${amount}`,
    afterSaving: 'после накоплений',
    now: 'Сразу',
    inMonths: (n: number) => `Через ${ruMonths(n)}`,
    notFeasible: 'Не выйдет накопить',
    more: 'Подробнее',
    moreAbout: (title: string) => `Подробнее: ${title}`,
    choose: 'Выбрать и добавить в план',
    addToPlan: 'Добавить в план',
    allPayments: 'Все платежи по кредитам',
    newDebt: 'Новый долг',
    yes: 'Да',
    no: 'Нет',
  },

  option: {
    title: (o: ScenarioOption) =>
      ({
        original: 'Исходный вариант',
        longer_term: `Срок ${ruMonths(o.term_months)}`,
        cheaper: 'Модель дешевле',
        wait: `Подождать ${ruMonths(o.months_until_purchase ?? 0)}`,
        down_payment: 'С первым взносом',
        save: 'Накопить',
        custom: 'Твой вариант',
      })[o.code],
    desc: (o: ScenarioOption) => {
      const kind = ruKind[o.kind];
      const lower = kind.toLowerCase();
      const acc = o.closing_credit ? common.ru.creditTypeAcc[o.closing_credit.type] : null;
      switch (o.code) {
        case 'original':
          return o.kind === 'own' ? `Своими деньгами, ${money(o.price)}` : `${kind} ${o.term_months} мес, ${money(o.price)}`;
        case 'longer_term': {
          const m = markupPct(o);
          if (o.kind === 'installment') return m > 0 ? `Рассрочка с наценкой ${m}%` : 'Рассрочка без наценки';
          return `${kind} с переплатой ${m}%`;
        }
        case 'cheaper':
          return `${money(o.price)}, ${lower} ${o.term_months} мес`;
        case 'wait':
          return acc ? `Закрыть ${acc}, потом ${lower}` : `Потом ${lower}`;
        case 'down_payment':
          return `Взнос ${money(o.down_payment)}, ${lower} ${o.term_months} мес`;
        case 'save':
          return o.feasible === false ? 'Свободных денег не хватает' : acc ? `Закрыть ${acc} и откладывать` : 'Откладывать каждый месяц';
        default:
          return '';
      }
    },
    /** Longer explanation in the «Подробнее» dialog; `base` is the original option. */
    explain: (o: ScenarioOption, base: ScenarioOption) => {
      const cc = o.closing_credit;
      switch (o.code) {
        case 'longer_term':
          return `Платеж ${money(o.monthly_payment)} вместо ${money(base.monthly_payment)}, но переплата — ${money(o.total_cost - o.price)}: покупка обойдется в ${money(o.total_cost)}.`;
        case 'cheaper':
          return `Модель за ${money(o.price)} вместо ${money(base.price)} — платеж ${money(o.monthly_payment)} вместо ${money(base.monthly_payment)} в месяц.`;
        case 'wait':
          return cc
            ? `Сначала закрываешь ${common.ru.creditTypeAcc[cc.type]} ${cc.organization}. Через ${ruMonths(o.months_until_purchase ?? 0)} платежи по кредитам станут меньше, и новый платеж ${money(o.monthly_payment)} будет легче потянуть.`
            : `Через ${ruMonths(o.months_until_purchase ?? 0)} платежи по кредитам станут меньше, и новый платеж ${money(o.monthly_payment)} будет легче потянуть.`;
        case 'down_payment':
          return `Взнос ${money(o.down_payment)} сразу уменьшает сумму долга — платеж ${money(o.monthly_payment)} в месяц.`;
        case 'save':
          if (o.feasible === false) return 'Сейчас накопить не получится: после платежей и обязательных расходов свободных денег почти не остается.';
          return `${cc ? `Сначала закрываешь ${common.ru.creditTypeAcc[cc.type]}, затем откладываешь` : 'Каждый месяц откладываешь'} по ${money(o.saving_monthly ?? 0)}. Новый долг не появляется.`;
        default:
          return '';
      }
    },
  },

  builder: {
    title: 'Собери свой вариант',
    subtitle: 'Меняй условия — оценка пересчитывается сразу.',
    price: 'Стоимость покупки',
    cheaperOption: (price: string) => `${price} — модель попроще`,
    originalOption: (price: string) => `${price} — исходная`,
    method: 'Способ',
    methods: { installment: 'Рассрочка', credit: 'Кредит в банке', save: 'Накопить' },
    term: 'Срок',
    termOption: ruMonths,
    down: 'Первоначальный взнос',
    noDown: 'Без взноса',
    start: 'Когда оформлять',
    startNow: 'Сейчас',
    startLater: (n: number) => `Через ${ruMonths(n)}`,
    result: 'Твой вариант',
    pay: 'Платеж в месяц',
    saveMonthly: 'Откладываешь в месяц',
    load: 'Долговая нагрузка',
    free: 'Свободные средства',
    total: 'Полная стоимость',
    purchase: 'Покупка',
    now: 'Сразу',
    inMonths: (n: number) => `Через ${n} мес.`,
    never: 'Не получится',
    pending: 'Пересчитываем…',
    failed: 'Не удалось пересчитать вариант.',
  },

  /** `closing` — type of the debt that is closed first, when there is one. */
  advice: (code: Advice, closing: CreditType | null) => {
    switch (code) {
      case 'too_big':
        return 'Платеж слишком велик для твоего бюджета. Попробуй модель дешевле, взнос или отложить оформление.';
      case 'ok_after_closing':
        return closing
          ? `Посильно, но запас небольшой. Оформляй только после закрытия ${ruGen[closing]}.`
          : 'Посильно, но запас небольшой. Подожди, пока текущие платежи уменьшатся.';
      case 'ok_small_reserve':
        return 'Посильно, но запас небольшой. Взнос или модель дешевле снизят риск.';
      case 'safe':
        return 'Нагрузка остается в безопасной зоне.';
      case 'save_no_new_debt':
        return closing
          ? `Новый долг не появляется: сначала закрывается ${common.ru.creditTypeLower[closing]}, затем ты копишь.`
          : 'Новый долг не появляется: ты откладываешь часть свободных денег каждый месяц.';
      case 'save_not_feasible':
        return 'Накопить пока не получится: после платежей и расходов свободных денег почти не остается. Начни с самых дорогих долгов.';
    }
  },

  path: {
    eyebrow: 'Рекомендуемый путь',
    title: (noun: Noun) => `${cap(noun.nom)} без нового долга`,
    period: (from: string, to: string) => (from === to ? cap(from) : `${cap(from)} — ${to}`),
    closeTitle: (type: CreditType) => `Гасишь ${common.ru.creditTypeAcc[type]} по графику`,
    /** `by` — month in the `dat` form («к январю»). */
    closeText: (saving: string, by: string, saved: string) => `Откладываешь по ${saving} — к ${by} ${saved}.`,
    closeTextNoSaving: 'Пока все свободные деньги уходят на платежи.',
    /** `from` — month in the `abl` form («с января»). */
    moreWhen: (from: string) => `С ${from}`,
    moreTitle: (load: string) => `Нагрузка падает до ${load}`,
    moreText: (freed: string, extra: number, saving: string) =>
      extra > 0 ? `Освободившиеся ${freed} плюс ${money(extra)} — откладываешь по ${saving}.` : `Освободившиеся ${freed} — откладываешь по ${saving}.`,
    monthlyWhen: 'Каждый месяц',
    monthlyTitle: (saving: string) => `Откладываешь по ${saving}`,
    monthlyText: 'Без новых кредитов — часть свободных денег идет в копилку.',
    buyTitle: (price: string) => `Накоплено ${price} — покупка без кредита`,
    buyText: (free: string) => `И в бюджете остается запас ${free} в месяц.`,
    add: 'Добавить в финансовый план',
  },

  added: 'Вариант добавлен в финансовый план',
  footnote: (installment: string, min: number, max: string) =>
    `Расчеты условные: наценка рассрочки на 24 месяца — ${installment}, переплата по кредиту — ${min}–${max} в зависимости от срока. Проверяй точные условия в договоре.`,
};

const kk: typeof ru = {
  title: 'Басқа нұсқаны таңдасаңыз ше?',
  updated: (date: string) => `Деректер ${date} жаңартылды`,
  refresh: 'Жаңарту',

  empty: {
    title: 'Алдымен сатып алуды тексеріңіз',
    text: 'Сценарийлер тексеру негізінде құрылады: не сатып алғыңыз келетінін және қандай шартпен екенін көрсетіңіз — qorgan қауіпсіздеу нұсқаларды ұсынады.',
    cta: 'Сатып алуды тексеру',
  },
  insufficient: {
    title: 'Есеп шамамен жасалған',
    text: 'Табыс, шығыс немесе несие туралы деректер жетіспейді — тәуекел деңгейі дәл болмауы мүмкін.',
    cta: 'Деректерді толықтыру',
  },

  nouns: {
    smartphone: same('смартфон'),
    appliances: same('техника'),
    furniture: same('жиһаз'),
    car: same('көлік'),
    laptop: same('ноутбук'),
    other: same('зат'),
  },
  ownNoun: same,

  goal: {
    title: (noun: string) => `Мақсат: ${noun}`,
    original: (kind: FinancingKind, term: number, price: number) =>
      `Бастапқы нұсқа — ${kind === 'own' ? `${money(price)}, өз қаражатыңызбен` : `${term} айға ${kkKind[kind]}, ${money(price)}`}`,
    change: 'Мақсатты өзгерту',
  },

  table: {
    title: (n: number, noun: Noun) => `${cap(noun.nom)} алудың ${n} тәсілі`,
    base: (income: string, expenses: string, payments: string) => `Табыс ${income} · шығыстар ${expenses} · қазіргі төлемдер ${payments}`,
    caption: 'Сатып алу нұсқаларын салыстыру',
    recommended: 'Ұсынамыз',
    rows: {
      total: 'Толық құны',
      monthly: 'Айлық төлем',
      load: 'Қарыз жүктемесі',
      free: 'Бос қаражат',
      when: 'Қашан сатып аласыз',
      risk: 'Шешім тәуекелі',
    },
    saving: (amount: string) => `${amount} жинайсыз`,
    afterSaving: 'жинақтан кейін',
    now: 'Бірден',
    inMonths: (n: number) => `${n} айдан кейін`,
    notFeasible: 'Жинау мүмкін емес',
    more: 'Толығырақ',
    moreAbout: (title: string) => `Толығырақ: ${title}`,
    choose: 'Таңдап, жоспарға қосу',
    addToPlan: 'Жоспарға қосу',
    allPayments: 'Барлық несие төлемдері',
    newDebt: 'Жаңа қарыз',
    yes: 'Иә',
    no: 'Жоқ',
  },

  option: {
    title: (o: ScenarioOption) =>
      ({
        original: 'Бастапқы нұсқа',
        longer_term: `Мерзімі ${o.term_months} ай`,
        cheaper: 'Арзанырақ модель',
        wait: `${o.months_until_purchase ?? 0} ай күту`,
        down_payment: 'Бастапқы жарнамен',
        save: 'Жинау',
        custom: 'Сіздің нұсқаңыз',
      })[o.code],
    desc: (o: ScenarioOption) => {
      const kind = kkKind[o.kind];
      const acc = o.closing_credit ? common.kk.creditTypeAcc[o.closing_credit.type] : null;
      switch (o.code) {
        case 'original':
          return o.kind === 'own' ? `Өз қаражатыңызбен, ${money(o.price)}` : `${o.term_months} айға ${kind}, ${money(o.price)}`;
        case 'longer_term': {
          const m = markupPct(o);
          if (o.kind === 'installment') return m > 0 ? `${m}% үстемемен бөліп төлеу` : 'Үстемесіз бөліп төлеу';
          return `${m}% артық төлеммен ${kind}`;
        }
        case 'cheaper':
          return `${money(o.price)}, ${o.term_months} айға ${kind}`;
        case 'wait':
          return acc ? `Алдымен ${acc} жабу, содан кейін ${kind}` : `Содан кейін ${kind}`;
        case 'down_payment':
          return `${money(o.down_payment)} жарна, ${o.term_months} айға ${kind}`;
        case 'save':
          return o.feasible === false ? 'Бос ақша жетпейді' : acc ? `${cap(acc)} жауып, ақша жинау` : 'Ай сайын ақша жинау';
        default:
          return '';
      }
    },
    explain: (o: ScenarioOption, base: ScenarioOption) => {
      const cc = o.closing_credit;
      const n = o.months_until_purchase ?? 0;
      switch (o.code) {
        case 'longer_term':
          return `Айлық төлем ${money(base.monthly_payment)} орнына ${money(o.monthly_payment)}, бірақ артық төлем — ${money(o.total_cost - o.price)}: сатып алу ${money(o.total_cost)} тұрады.`;
        case 'cheaper':
          return `${money(base.price)} орнына ${money(o.price)} тұратын модель — айлық төлем ${money(base.monthly_payment)} орнына ${money(o.monthly_payment)}.`;
        case 'wait':
          return `${cc ? `Алдымен ${common.kk.creditTypeAcc[cc.type]} жабасыз (${cc.organization}). ` : ''}${n} айдан кейін несие төлемдері азаяды — ${money(o.monthly_payment)} жаңа төлемді көтеру жеңілдейді.`;
        case 'down_payment':
          return `${money(o.down_payment)} жарна қарыз сомасын бірден азайтады — айлық төлем ${money(o.monthly_payment)}.`;
        case 'save':
          if (o.feasible === false) return 'Қазір жинау мүмкін емес: төлемдер мен міндетті шығыстардан кейін бос ақша қалмайды дерлік.';
          return `${cc ? `Алдымен ${common.kk.creditTypeAcc[cc.type]} жабасыз, содан кейін айына` : 'Ай сайын'} ${money(o.saving_monthly ?? 0)} жинайсыз. Жаңа қарыз пайда болмайды.`;
        default:
          return '';
      }
    },
  },

  builder: {
    title: 'Өз нұсқаңызды құрастырыңыз',
    subtitle: 'Шарттарды өзгертіңіз — баға бірден қайта есептеледі.',
    price: 'Сатып алу құны',
    cheaperOption: (price: string) => `${price} — қарапайым модель`,
    originalOption: (price: string) => `${price} — бастапқы`,
    method: 'Тәсіл',
    methods: { installment: 'Бөліп төлеу', credit: 'Банк несиесі', save: 'Жинау' },
    term: 'Мерзімі',
    termOption: (n: number) => `${n} ай`,
    down: 'Бастапқы жарна',
    noDown: 'Жарнасыз',
    start: 'Қашан рәсімдеу',
    startNow: 'Қазір',
    startLater: (n: number) => `${n} айдан кейін`,
    result: 'Сіздің нұсқаңыз',
    pay: 'Айлық төлем',
    saveMonthly: 'Айына жинайсыз',
    load: 'Қарыз жүктемесі',
    free: 'Бос қаражат',
    total: 'Толық құны',
    purchase: 'Сатып алу',
    now: 'Бірден',
    inMonths: (n: number) => `${n} айдан кейін`,
    never: 'Мүмкін емес',
    pending: 'Қайта есептеп жатырмыз…',
    failed: 'Нұсқаны қайта есептеу мүмкін болмады.',
  },

  advice: (code: Advice, closing: CreditType | null) => {
    switch (code) {
      case 'too_big':
        return 'Төлем бюджетіңіз үшін тым үлкен. Арзанырақ модельді, жарнаны немесе рәсімдеуді кейінге қалдыруды қарастырыңыз.';
      case 'ok_after_closing':
        return closing
          ? `Көтеруге болады, бірақ қор аз. ${cap(common.kk.creditTypeAcc[closing])} жапқаннан кейін ғана рәсімдеңіз.`
          : 'Көтеруге болады, бірақ қор аз. Қазіргі төлемдер азайғанша күте тұрыңыз.';
      case 'ok_small_reserve':
        return 'Көтеруге болады, бірақ қор аз. Жарна немесе арзанырақ модель тәуекелді азайтады.';
      case 'safe':
        return 'Жүктеме қауіпсіз аймақта қалады.';
      case 'save_no_new_debt':
        return closing
          ? `Жаңа қарыз пайда болмайды: алдымен ${common.kk.creditTypeLower[closing]} жабылады, содан кейін ақша жинайсыз.`
          : 'Жаңа қарыз пайда болмайды: ай сайын бос ақшаның бір бөлігін жинайсыз.';
      case 'save_not_feasible':
        return 'Қазір жинау мүмкін емес: төлемдер мен шығыстардан кейін бос ақша қалмайды дерлік. Алдымен ең қымбат қарыздарды өтеңіз.';
    }
  },

  path: {
    eyebrow: 'Ұсынылатын жол',
    title: (noun: Noun) => `Жаңа қарызсыз ${noun.nom}`,
    period: (from: string, to: string) => (from === to ? cap(from) : `${cap(from)} — ${to}`),
    closeTitle: (type: CreditType) => `${cap(common.kk.creditTypeAcc[type])} кесте бойынша өтейсіз`,
    closeText: (saving: string, by: string, saved: string) => `Айына ${saving} жинайсыз — ${by} қарай ${saved} болады.`,
    closeTextNoSaving: 'Әзірге бос ақшаның бәрі төлемдерге кетеді.',
    moreWhen: (from: string) => `${cap(from)} бастап`,
    moreTitle: (load: string) => `Жүктеме ${load}-ға дейін төмендейді`,
    moreText: (freed: string, extra: number, saving: string) =>
      extra > 0 ? `Босаған ${freed} және тағы ${money(extra)} — айына ${saving} жинайсыз.` : `Босаған ${freed} — айына ${saving} жинайсыз.`,
    monthlyWhen: 'Ай сайын',
    monthlyTitle: (saving: string) => `Айына ${saving} жинайсыз`,
    monthlyText: 'Жаңа несиесіз — бос ақшаның бір бөлігі жинаққа кетеді.',
    buyTitle: (price: string) => `${price} жиналды — несиесіз сатып аласыз`,
    buyText: (free: string) => `Бюджетте айына ${free} қор қалады.`,
    add: 'Қаржылық жоспарға қосу',
  },

  added: 'Нұсқа қаржылық жоспарға қосылды',
  footnote: (installment: string, min: number, max: string) =>
    `Есептеулер шартты: 24 айлық бөліп төлеудің үстемесі — ${installment}, несие бойынша артық төлем — мерзімге қарай ${min}–${max}. Нақты шарттарды келісімшарттан тексеріңіз.`,
};

export const dict: Dict<typeof ru> = { ru, kk };
export type Strings = typeof ru;

/** Words people type for a category («Смартфон», «Техника»…) — those read better as the category noun. */
const GENERIC_TITLES = new Set([
  'смартфон', 'телефон', 'техника', 'бытовая техника', 'мебель', 'авто', 'автомобиль', 'машина', 'ноутбук', 'покупка', 'другое',
  'жиһаз', 'көлік', 'басқа', 'сатып алу',
]);

export function purchaseNoun(t: Strings, p: { title?: string | null; category: PurchaseCategory }): Noun {
  const title = (p.title ?? '').trim();
  if (!title || GENERIC_TITLES.has(title.toLowerCase())) return t.nouns[p.category] ?? t.nouns.other;
  return t.ownNoun(title);
}
