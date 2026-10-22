import type { Dict } from '@/i18n/I18nProvider';
import type { FinancingKind } from '@/api/types';
import { dayMonth, monthName, pluralRu, toDate } from '@/lib/format';

type Kind = FinancingKind;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const monthsRu = (n: number) => `${n} ${pluralRu(n, ['месяц', 'месяца', 'месяцев'])}`;

const afterRu: Record<Kind, string> = { installment: 'рассрочки', credit: 'кредита', microloan: 'микрокредита', credit_card: 'покупки по карте', own: 'покупки' };
const afterKk: Record<Kind, string> = {
  installment: 'бөліп төлеуден',
  credit: 'несиеден',
  microloan: 'микронесиеден',
  credit_card: 'карта арқылы сатып алғаннан',
  own: 'сатып алғаннан',
};

const ru = {
  title: 'Результат оценки',
  calculated: (created: string, data: string | null) =>
    data ? `Рассчитано ${dayMonth(created, 'ru')} по данным от ${dayMonth(data, 'ru')}` : `Рассчитано ${dayMonth(created, 'ru')}`,
  refresh: 'Обновить данные',
  profilePercent: (n: number) => `Профиль заполнен на ${n}%`,

  crumbs: { label: 'Путь', check: 'Проверить решение', result: 'Результат' },
  tags: {
    label: 'Параметры покупки',
    kind: {
      installment: (n: number) => `Рассрочка на ${n} мес`,
      credit: (n: number) => `Кредит на ${n} мес`,
      microloan: (n: number) => `Микрокредит на ${n} мес`,
      credit_card: (n: number) => `Кредитная карта · ${n} мес`,
      own: () => 'За свои деньги',
    } satisfies Record<Kind, (n: number) => string>,
    perMonth: (m: string) => `${m} в месяц`,
  },
  save: 'Сохранить результат',
  saved: 'Сохранено',
  savedToast: 'Результат сохранен в «Истории оценок».',
  unsavedToast: 'Результат убран из «Истории оценок».',
  open: 'Открыть',

  yours: 'твоя оценка',
  verdict: {
    high: {
      installment: 'qorgan не рекомендует брать эту рассрочку',
      credit: 'qorgan не рекомендует брать этот кредит',
      microloan: 'qorgan не рекомендует брать этот микрокредит',
      credit_card: 'qorgan не рекомендует покупать это по кредитной карте',
      own: 'qorgan не рекомендует эту покупку сейчас',
    } satisfies Record<Kind, string>,
    highLead: 'Новый платеж может существенно ухудшить твое финансовое положение.',
    medium: 'Лучше подумать еще раз',
    mediumLead: 'Новый платеж заметно увеличит нагрузку на бюджет. Это посильно, но запас прочности станет небольшим.',
    mediumOwnLead: 'Нового долга не будет, но после покупки запас на непредвиденные траты станет небольшим.',
    low: 'Покупка выглядит посильной',
    lowLead: 'По имеющимся данным новая покупка не создает критической нагрузки на твой бюджет.',
    insufficient: 'Для надежной оценки нужна дополнительная информация',
    insufficientLead: 'Пока не хватает ключевых данных, мы не показываем уровень риска: такая оценка могла бы ввести в заблуждение.',
    scaleNone: 'Уровень риска появится, когда данных будет достаточно',
    scaleNoneAria: 'Уровень риска не определен',
  },
  cta: {
    findAlt: 'Найти безопасную альтернативу',
    changeTerms: 'Изменить условия',
    seeCalc: 'Посмотреть расчеты',
    makePlan: 'Составить финансовый план',
    considerAlts: 'Рассмотреть альтернативы',
    seeDetails: 'Посмотреть подробности',
    compareScenarios: 'Сравнить сценарии',
    addData: 'Дополнить данные',
    changeParams: 'Изменить параметры покупки',
  },
  highNote: (kind: Kind) =>
    `Решение всегда за тобой. Если всё же оформишь ${{ installment: 'рассрочку', credit: 'кредит', microloan: 'микрокредит', credit_card: 'покупку по карте', own: 'покупку' }[kind]}, сверь в договоре полную стоимость и график платежей.`,
  lowNote: 'Это оценка твоего бюджета, а не решение банка: qorgan не гарантирует одобрение. Перед оформлением проверь полную стоимость покупки.',

  change: {
    title: (kind: Kind) => `Что изменится после ${afterRu[kind]}`,
    titleLow: 'Что изменится',
    freeLeft: 'Останется после всех платежей и расходов',
    loadGoes: 'На кредиты будет уходить',
    ofIncome: 'дохода',
    payments: 'Платежи по кредитам',
    perMonth: 'в месяц',
    now: (v: string) => `сейчас ${v}`,
    safeUpTo: 'безопасно до 30%',
    afterTermLabel: (n: number) => `Через ${monthsRu(n)}`,
    afterTermValue: {
      installment: 'рассрочка закончится',
      credit: 'кредит будет погашен',
      microloan: 'микрокредит будет погашен',
      credit_card: 'долг по карте будет погашен',
      own: 'платежей не будет',
    } satisfies Record<Kind, string>,
    afterTermSub: (load: string) => `нагрузка вернется к ${load}`,
  },

  why: 'Почему qorgan так считает',
  factors: 'Основные факторы риска',
  reasons: {
    load_already_high: {
      title: (load: string) => `На кредиты уже уходит ${load} дохода`,
      text: (safe: string) => `Это выше безопасного уровня в ${safe}. Каждый новый платеж делает бюджет уязвимее к неожиданным расходам.`,
      tag: (high: string) => `Высокая нагрузка — от ${high}`,
    },
    load_becomes_high: {
      title: (load: string) => `После покупки на кредиты будет уходить ${load} дохода`,
      text: (high: string) => `Это зона высокой нагрузки — она начинается с ${high}. Любой непредвиденный расход ударит по бюджету.`,
      tag: (high: string) => `Высокая нагрузка — от ${high}`,
    },
    free_negative: {
      title: 'Свободных денег станет недостаточно',
      text: (gap: string) => `После платежей и обязательных расходов будет не хватать ${gap} в месяц. На лекарства, ремонт или подарок придется занимать.`,
      tag: 'Резерв на жизнь: 0 ₸',
    },
    free_too_low: {
      title: 'Свободных денег почти не останется',
      text: (free: string) => `После всех платежей и расходов останется ${free} в месяц — меньше 10% дохода. Любая непредвиденная трата ударит по бюджету.`,
      tag: (share: string) => `Запас: ${share} дохода`,
    },
    borrow_to_pay: {
      title: 'Риск занимать, чтобы платить',
      text: (type: string) => `Когда денег не хватает, часто берут новый заем, чтобы закрыть старый. У тебя уже есть ${type} с самой высокой переплатой.`,
      tag: (org: string, n: number | null) =>
        n ? `${org} · ${n === 1 ? 'остался' : 'осталось'} ${n} ${pluralRu(n, ['платеж', 'платежа', 'платежей'])}` : org,
    },
    long_commitment: {
      title: (n: number) => (n === 12 ? 'Обязательство на целый год' : n === 24 ? 'Обязательство на два года' : `Обязательство на ${monthsRu(n)}`),
      text: (n: number, load: string) => `${cap(monthsRu(n))} с нагрузкой ${load}: любой новый кредит в это время станет высоким риском.`,
      tag: (n: number) => `Срок: ${monthsRu(n)}`,
    },
    load_caution: {
      title: 'Нагрузка перейдет в зону осторожности',
      text: (load: string, safe: string) => `${load} дохода будет уходить на кредиты — выше безопасных ${safe}.`,
    },
    free_drop: {
      title: (delta: string) => `Свободных денег станет меньше на ${delta}`,
      text: (free: string) => `${free} в месяц хватит на жизнь, но непредвиденные траты придется планировать.`,
    },
  },

  compare: {
    title: (kind: Kind) => `Сейчас и после ${afterRu[kind]}`,
    metric: 'Показатель',
    now: 'Сейчас',
    after: (kind: Kind) => `После ${afterRu[kind]}`,
    diff: 'Изменение',
    payments: 'Платежи в месяц',
    load: 'Долговая нагрузка',
    free: 'Свободные средства',
    paymentsShort: 'Платежи',
    loadShort: 'Нагрузка',
    freeShort: 'Свободно',
    nowShort: 'Сейчас',
    afterShort: 'После',
    loadTitle: 'Долговая нагрузка',
    threshold45: 'порог 45%',
    safe30: 'безопасно до 30%',
    loadAria: (now: string, after: string, high: boolean) =>
      `Долговая нагрузка: сейчас ${now}, после ${after}. ${high ? 'Высокая нагрузка начинается с 45%.' : 'Безопасно — до 30%.'}`,
    freeTitle: 'Свободные средства в месяц',
    freeAria: (now: string, after: string) => `Свободные средства: сейчас ${now}, после ${after}`,
    considered: (income: string, expenses: string, date: string | null, credits: string) =>
      `Учтено: доход ${income} и расходы ${expenses}${date ? ` (введены ${dayMonth(date, 'ru')})` : ''}, ${credits}.`,
    creditsSources: (report: number, manual: number) => {
      const credits = (n: number) => `${n} ${pluralRu(n, ['кредит', 'кредита', 'кредитов'])}`;
      if (report && manual) return `${credits(report)} из кредитного отчёта и ${manual} — вручную`;
      if (report) return `${credits(report)} из кредитного отчёта`;
      if (manual) return `${credits(manual)}, ${pluralRu(manual, ['добавленный', 'добавленных', 'добавленных'])} вручную`;
      return 'кредитов нет';
    },
  },

  alt: {
    badge: 'Безопасная альтернатива',
    title: {
      saveClosing: (acc: string, simpler: boolean) => `Сначала закрой ${acc}, потом накопи ${simpler ? 'на модель попроще' : 'на покупку'}`,
      save: (simpler: boolean): string => (simpler ? 'Накопи на модель попроще — без нового долга' : 'Накопи на покупку — без нового долга'),
      wait: (nom: string) => `Подожди, пока закроется ${nom}, и возьми модель попроще`,
      cheaper: (price: string) => `Выбери модель попроще — за ${price}`,
      longer: (n: number) => `Растяни платеж на ${monthsRu(n)}`,
      down: 'Внеси первоначальный взнос — платеж станет ниже',
    },
    inMonths: (n: number) => `Покупка через **${monthsRu(n)}**`,
    now: 'Покупка **сейчас**',
    noDebt: '**Без нового долга**',
    loadDown: (load: string) => `Нагрузка снизится до **${load}**`,
    loadIs: (load: string) => `Нагрузка — **${load}**`,
    text: {
      saveClosing: (n: number, acc: string, saving: string, item: string, price: string) =>
        `${cap(monthsRu(n))} гасишь ${acc} по графику, затем откладываешь по ${saving} — и покупаешь ${item} за ${price} без переплаты.`,
      save: (saving: string, n: number, item: string, price: string) =>
        `Откладываешь по ${saving} в месяц — и через ${monthsRu(n)} покупаешь ${item} за ${price} без переплаты.`,
      wait: (n: number, nom: string, org: string, price: string, load: string) =>
        `Через ${monthsRu(n)} закончится ${nom} ${org} — после этого покупка за ${price} не перегрузит бюджет: нагрузка будет ${load}.`,
      other: (load: string, free: string) => `Нагрузка составит ${load}, свободно останется ${free} в месяц.`,
      longerPrefix: 'Платеж станет ниже, но переплата вырастет. ',
    },
    compareAll: 'Сравнить все варианты',
    noneTitle: 'Безопасного варианта сейчас не нашлось',
    noneText: 'Даже покупка попроще перегрузит бюджет. Начни с плана: что гасить первым.',
    noneCta: 'Открыть финансовый план',
  },

  ask: {
    title: 'Разобрать вместе с qorgan AI',
    why: {
      installment: 'Почему мне не стоит брать рассрочку?',
      credit: 'Почему мне не стоит брать кредит?',
      microloan: 'Почему мне не стоит брать микрокредит?',
      credit_card: 'Почему мне не стоит покупать по кредитной карте?',
      own: 'Почему мне не стоит делать эту покупку сейчас?',
    } satisfies Record<Kind, string>,
    longer: 'А если взять на 24 месяца?',
    down: 'А если внести первоначальный взнос?',
    when: 'Когда я смогу позволить себе покупку?',
  },

  calc: {
    summary: 'Как мы считали',
    data: 'Данные, которые использованы',
    income: 'Доход в месяц',
    incomeSrc: (d: string) => `введен тобой ${d}`,
    expenses: 'Обязательные расходы',
    expensesSrc: (d: string) => `введены тобой ${d}`,
    noDate: 'дата неизвестна',
    payments: (n: number) => (n ? `Платежи по ${n} ${pluralRu(n, ['кредиту', 'кредитам', 'кредитам'])}` : 'Платежи по кредитам'),
    creditsSrc: (report: string | null, nReport: number, nManual: number) => {
      const manual = `${nManual} ${pluralRu(nManual, ['запись', 'записи', 'записей'])} вручную`;
      const rep = `кредитный отчёт${report ? ` от ${report}` : ''}`;
      if (nReport && nManual) return `${rep} и ${manual}`;
      if (nReport) return rep;
      if (nManual) return manual;
      return 'кредитов нет';
    },
    newPayment: 'Новый платеж',
    newAuto: (financed: string, term: number) => `${financed} ÷ ${term} мес`,
    extras: (down: string | null, fees: string | null) =>
      !down && !fees ? ', без взноса и комиссий' : `, ${down ? `взнос ${down}` : 'без взноса'}, ${fees ? `комиссии ${fees}` : 'без комиссий'}`,
    markup: (pct: string) => `, с условной переплатой ${pct}`,
    newManual: 'по условиям договора',
    newOwn: 'за свои деньги — без нового платежа',
    fix: 'Исправить данные',
    formulas: 'Формулы и шкала',
    loadFormula: 'Долговая нагрузка = платежи ÷ доход',
    freeFormula: 'Свободные средства = доход − расходы − платежи',
    legend: {
      low: 'Низкий риск — нагрузка до 30% и свободно от 20% дохода',
      medium: 'Средний — нагрузка 30–45% или свободно 10–20% дохода',
      high: 'Высокий — нагрузка от 45% или свободно меньше 10% дохода',
    },
  },

  softer: {
    title: 'Варианты мягче',
    recommended: 'Рекомендуем',
    kindName: { installment: 'Рассрочка', credit: 'Кредит', microloan: 'Микрокредит', credit_card: 'Кредитная карта', own: 'Рассрочка' } satisfies Record<
      Kind,
      string
    >,
    longer: (kind: string, n: number) => `${kind} на ${monthsRu(n)}`,
    cheaper: (price: string) => `Модель попроще за ${price}`,
    wait: (n: number) => `Подождать ${monthsRu(n)} и взять модель попроще`,
    down: 'С первоначальным взносом',
    save: (n: number | null) => (n ? `Накопить за ${monthsRu(n)} без долга` : 'Накопить без долга'),
    payment: (m: string) => `Платеж ${m}`,
    noPayment: 'Без нового платежа',
    load: (l: string) => `нагрузка ${l}`,
    overpay: (o: string) => `переплата ${o}`,
    free: (f: string) => `свободно ${f}`,
  },

  tips: {
    title: 'Перед оформлением',
    check_hidden_fees: 'Убедись, что в договоре нет страховки и комиссий — иначе «0%» станет платным.',
    check_full_cost: 'Сверь в договоре полную стоимость и ставку — итоговая сумма может оказаться больше цены.',
    set_reminders: (kind: Kind) =>
      `Поставь напоминание о платежах — ${{ installment: 'просрочка рассрочки', credit: 'просрочка по кредиту', microloan: 'просрочка по микрокредиту', credit_card: 'просрочка по карте', own: 'просрочка' }[kind]} обычно платная.`,
    no_new_credit_during_term: (n: number) => `Не планируй новых кредитов ${n === 1 ? 'в этот месяц' : `в эти ${monthsRu(n)}`} — запас стоит сохранить.`,
  },

  noData: {
    needTitle: 'Что нужно для оценки',
    income: 'Доход',
    incomeSet: (m: string | null) => (m ? `${m} в месяц — указан` : 'Указан'),
    incomeMissing: 'Не указан — без него не посчитать, какую часть бюджета займет платеж',
    addIncome: 'Добавить доход',
    expenses: 'Обязательные расходы',
    expensesSet: (m: string | null) => (m ? `${m} в месяц — указаны` : 'Указаны'),
    expensesMissing: 'Не указаны — без них не понять, сколько денег остается',
    addExpenses: 'Добавить расходы',
    credits: 'Действующие кредиты',
    creditsSet: (n: number) => (n ? `${n} ${pluralRu(n, ['кредит', 'кредита', 'кредитов'])} — добавлены` : 'Кредитов нет — отмечено'),
    creditsMissing: 'Не добавлены — нельзя посчитать долговую нагрузку',
    upload: 'Загрузить отчёт',
    manual: 'Добавить вручную',
    purchase: 'Параметры покупки',
    purchaseValue: (title: string, price: string, term: number | null) => `${title}, ${price}, ${term ? monthsRu(term) : 'за свои деньги'}`,
    canSay: 'Что уже можно сказать',
    canSayText: (monthly: string, share: string, missing: Array<'expenses' | 'credits'>) =>
      `Новый платеж **${monthly}** — это ${share} твоего дохода. Но без ${missing.map((m) => (m === 'expenses' ? 'расходов' : 'текущих кредитов')).join(' и ')} мы не знаем, сколько у тебя остается каждый месяц, поэтому не оцениваем риск.`,
    noIncomeText: (monthly: string) => `Без дохода мы не можем сравнить платеж **${monthly}** с твоим бюджетом, поэтому не оцениваем риск.`,
    whyData: 'Зачем нужны эти данные?',
    whyQuestion: 'Зачем qorgan нужны мои доходы, расходы и кредиты для оценки?',
  },

  notFound: {
    title: 'Оценка не найдена',
    text: 'Возможно, ссылка устарела. Проверь покупку заново — это займет пару минут.',
    cta: 'Проверить покупку',
  },
};

const kk: typeof ru = {
  title: 'Бағалау нәтижесі',
  calculated: (created: string, data: string | null) => {
    const c = `${toDate(created).getDate()} ${monthName(created, 'kk', 'prep')} есептелді`;
    return data ? `${toDate(data).getDate()} ${monthName(data, 'kk', 'attr')} деректер бойынша ${c}` : c;
  },
  refresh: 'Деректерді жаңарту',
  profilePercent: (n: number) => `Профиль ${n}% толтырылды`,

  crumbs: { label: 'Навигация жолы', check: 'Шешімді тексеру', result: 'Нәтиже' },
  tags: {
    label: 'Сатып алу параметрлері',
    kind: {
      installment: (n: number) => `${n} айға бөліп төлеу`,
      credit: (n: number) => `${n} айға несие`,
      microloan: (n: number) => `${n} айға микронесие`,
      credit_card: (n: number) => `Кредит картасы · ${n} ай`,
      own: () => 'Өз ақшасына',
    },
    perMonth: (m: string) => `айына ${m}`,
  },
  save: 'Нәтижені сақтау',
  saved: 'Сақталды',
  savedToast: 'Нәтиже «Бағалау тарихына» сақталды.',
  unsavedToast: 'Нәтиже «Бағалау тарихынан» алынды.',
  open: 'Ашу',

  yours: 'сіздің бағаңыз',
  verdict: {
    high: {
      installment: 'qorgan бұл бөліп төлеуді алуды ұсынбайды',
      credit: 'qorgan бұл несиені алуды ұсынбайды',
      microloan: 'qorgan бұл микронесиені алуды ұсынбайды',
      credit_card: 'qorgan мұны кредит картасымен сатып алуды ұсынбайды',
      own: 'qorgan бұл сатып алуды қазір ұсынбайды',
    },
    highLead: 'Жаңа төлем қаржылық жағдайыңызды айтарлықтай нашарлатуы мүмкін.',
    medium: 'Тағы ойланған жөн',
    mediumLead: 'Жаңа төлем бюджетке түсетін жүктемені едәуір арттырады. Бұл шамаңыз жетерлік, бірақ қауіпсіздік қоры аз қалады.',
    mediumOwnLead: 'Жаңа қарыз болмайды, бірақ сатып алғаннан кейін күтпеген шығыстарға қор аз қалады.',
    low: 'Сатып алу шамаңызға сай көрінеді',
    lowLead: 'Қолда бар деректер бойынша жаңа сатып алу бюджетіңізге аса ауыр жүктеме түсірмейді.',
    insufficient: 'Сенімді бағалау үшін қосымша ақпарат керек',
    insufficientLead: 'Негізгі деректер жетіспегендіктен, тәуекел деңгейін көрсетпейміз: мұндай баға адастыруы мүмкін.',
    scaleNone: 'Деректер жеткілікті болғанда тәуекел деңгейі пайда болады',
    scaleNoneAria: 'Тәуекел деңгейі анықталмады',
  },
  cta: {
    findAlt: 'Қауіпсіз балама табу',
    changeTerms: 'Шарттарды өзгерту',
    seeCalc: 'Есептеулерді көру',
    makePlan: 'Қаржылық жоспар құру',
    considerAlts: 'Баламаларды қарау',
    seeDetails: 'Толығырақ көру',
    compareScenarios: 'Сценарийлерді салыстыру',
    addData: 'Деректерді толықтыру',
    changeParams: 'Сатып алу параметрлерін өзгерту',
  },
  highNote: (kind: Kind) =>
    `Шешім әрқашан сізде. ${{ installment: 'Бөліп төлеуді', credit: 'Несиені', microloan: 'Микронесиені', credit_card: 'Карта арқылы сатып алуды', own: 'Сатып алуды' }[kind]} бәрібір рәсімдесеңіз, шарттағы толық құн мен төлем кестесін тексеріңіз.`,
  lowNote: 'Бұл — банктің шешімі емес, бюджетіңіздің бағасы: qorgan мақұлдауға кепілдік бермейді. Рәсімдеу алдында сатып алудың толық құнын тексеріңіз.',

  change: {
    title: (kind: Kind) => `${cap(afterKk[kind])} кейін не өзгереді`,
    titleLow: 'Не өзгереді',
    freeLeft: 'Барлық төлем мен шығыстан кейін қалады',
    loadGoes: 'Табыстың несиеге кететін бөлігі',
    ofIncome: '',
    payments: 'Несие бойынша төлемдер',
    perMonth: 'айына',
    now: (v: string) => `қазір ${v}`,
    safeUpTo: '30%-ға дейін қауіпсіз',
    afterTermLabel: (n: number) => `${n} айдан кейін`,
    afterTermValue: {
      installment: 'бөліп төлеу аяқталады',
      credit: 'несие өтеледі',
      microloan: 'микронесие өтеледі',
      credit_card: 'карта бойынша қарыз өтеледі',
      own: 'төлем болмайды',
    },
    afterTermSub: (load: string) => `жүктеме ${load} деңгейіне оралады`,
  },

  why: 'qorgan неге осылай есептейді',
  factors: 'Тәуекелдің негізгі факторлары',
  reasons: {
    load_already_high: {
      title: (load: string) => `Несиелерге табыстың ${load}-ы кетіп жатыр`,
      text: (safe: string) => `Бұл ${safe}-дық қауіпсіз деңгейден жоғары. Әр жаңа төлем бюджетті күтпеген шығыстар алдында осал етеді.`,
      tag: (high: string) => `Жоғары жүктеме — ${high}-дан`,
    },
    load_becomes_high: {
      title: (load: string) => `Сатып алғаннан кейін несиелерге табыстың ${load}-ы кетеді`,
      text: (high: string) => `Бұл — жоғары жүктеме аймағы, ол ${high}-дан басталады. Кез келген күтпеген шығыс бюджетке ауыр тиеді.`,
      tag: (high: string) => `Жоғары жүктеме — ${high}-дан`,
    },
    free_negative: {
      title: 'Бос ақша жетпей қалады',
      text: (gap: string) => `Төлемдер мен міндетті шығыстардан кейін айына ${gap} жетпейді. Дәріге, жөндеуге немесе сыйлыққа қарыз алуға тура келеді.`,
      tag: 'Күнделікті қор: 0 ₸',
    },
    free_too_low: {
      title: 'Бос ақша дерлік қалмайды',
      text: (free: string) => `Барлық төлем мен шығыстан кейін айына ${free} қалады — табыстың 10%-ынан аз. Кез келген күтпеген шығыс бюджетке ауыр тиеді.`,
      tag: (share: string) => `Қор: табыстың ${share}-ы`,
    },
    borrow_to_pay: {
      title: 'Төлеу үшін қарыз алу қаупі',
      text: (type: string) => `Ақша жетпегенде, ескі қарызды жабу үшін жиі жаңа қарыз алады. Сізде артық төлемі ең жоғары ${type} бар.`,
      tag: (org: string, n: number | null) => (n ? `${org} · ${n} төлем қалды` : org),
    },
    long_commitment: {
      title: (n: number) => (n === 12 ? 'Бір жылға міндеттеме' : n === 24 ? 'Екі жылға міндеттеме' : `${n} айға міндеттеме`),
      text: (n: number, load: string) => `${n} ай бойы жүктеме ${load} болады: осы уақытта кез келген жаңа несие жоғары тәуекелге айналады.`,
      tag: (n: number) => `Мерзімі: ${n} ай`,
    },
    load_caution: {
      title: 'Жүктеме абайлау аймағына өтеді',
      text: (load: string, safe: string) => `Табыстың ${load}-ы несиелерге кетеді — бұл қауіпсіз ${safe} деңгейінен жоғары.`,
    },
    free_drop: {
      title: (delta: string) => `Бос ақша ${delta} азаяды`,
      text: (free: string) => `Айына ${free} күнделікті өмірге жетеді, бірақ күтпеген шығыстарды жоспарлауға тура келеді.`,
    },
  },

  compare: {
    title: (kind: Kind) => `Қазір және ${afterKk[kind]} кейін`,
    metric: 'Көрсеткіш',
    now: 'Қазір',
    after: (kind: Kind) => `${cap(afterKk[kind])} кейін`,
    diff: 'Өзгеріс',
    payments: 'Айлық төлемдер',
    load: 'Қарыз жүктемесі',
    free: 'Бос қаражат',
    paymentsShort: 'Төлемдер',
    loadShort: 'Жүктеме',
    freeShort: 'Бос',
    nowShort: 'Қазір',
    afterShort: 'Кейін',
    loadTitle: 'Қарыз жүктемесі',
    threshold45: 'шегі 45%',
    safe30: '30%-ға дейін қауіпсіз',
    loadAria: (now: string, after: string, high: boolean) =>
      `Қарыз жүктемесі: қазір ${now}, кейін ${after}. ${high ? 'Жоғары жүктеме 45%-дан басталады.' : '30%-ға дейін қауіпсіз.'}`,
    freeTitle: 'Айлық бос қаражат',
    freeAria: (now: string, after: string) => `Бос қаражат: қазір ${now}, кейін ${after}`,
    considered: (income: string, expenses: string, date: string | null, credits: string) =>
      `Ескерілді: табыс ${income} және шығыстар ${expenses}${date ? ` (${dayMonth(date, 'kk')} енгізілді)` : ''}, ${credits}.`,
    creditsSources: (report: number, manual: number) => {
      if (report && manual) return `кредиттік есептен ${report} несие және қолмен ${manual}`;
      if (report) return `кредиттік есептен ${report} несие`;
      if (manual) return `қолмен енгізілген ${manual} несие`;
      return 'несие жоқ';
    },
  },

  alt: {
    badge: 'Қауіпсіз балама',
    title: {
      saveClosing: (acc: string, simpler: boolean) => `Алдымен ${acc} жабыңыз, содан кейін ${simpler ? 'қарапайым модельге' : 'сатып алуға'} жинаңыз`,
      save: (simpler: boolean) => (simpler ? 'Қарапайым модельге жаңа қарызсыз жинаңыз' : 'Сатып алуға жаңа қарызсыз жинаңыз'),
      wait: (nom: string) => `${cap(nom)} жабылғанша күтіп, қарапайым модельді алыңыз`,
      cheaper: (price: string) => `Қарапайым модельді таңдаңыз — ${price}`,
      longer: (n: number) => `Төлемді ${n} айға созыңыз`,
      down: 'Бастапқы жарна салыңыз — төлем азаяды',
    },
    inMonths: (n: number) => `Сатып алу **${n} айдан кейін**`,
    now: 'Сатып алу **қазір**',
    noDebt: '**Жаңа қарызсыз**',
    loadDown: (load: string) => `Жүктеме **${load}-ға** дейін төмендейді`,
    loadIs: (load: string) => `Жүктеме — **${load}**`,
    text: {
      saveClosing: (n: number, acc: string, saving: string, _item: string, price: string) =>
        `${n} ай бойы ${acc} кесте бойынша өтейсіз, содан кейін айына ${saving} жинайсыз — және ${price} тұратын затты артық төлемсіз сатып аласыз.`,
      save: (saving: string, n: number, _item: string, price: string) =>
        `Айына ${saving} жинайсыз — және ${n} айдан кейін ${price} тұратын затты артық төлемсіз сатып аласыз.`,
      wait: (n: number, nom: string, org: string, price: string, load: string) =>
        `${n} айдан кейін ${org} ${nom} аяқталады — содан кейін ${price} тұратын сатып алу бюджетке ауыр тимейді: жүктеме ${load} болады.`,
      other: (load: string, free: string) => `Жүктеме ${load} болады, айына ${free} бос қалады.`,
      longerPrefix: 'Төлем азаяды, бірақ артық төлем өседі. ',
    },
    compareAll: 'Барлық нұсқаны салыстыру',
    noneTitle: 'Қазір қауіпсіз нұсқа табылмады',
    noneText: 'Тіпті қарапайым сатып алу да бюджетке ауыр тиеді. Жоспардан бастаңыз: алдымен нені өтеу керек.',
    noneCta: 'Қаржылық жоспарды ашу',
  },

  ask: {
    title: 'qorgan AI-мен бірге талдау',
    why: {
      installment: 'Неге маған бөліп төлеу алмаған жөн?',
      credit: 'Неге маған несие алмаған жөн?',
      microloan: 'Неге маған микронесие алмаған жөн?',
      credit_card: 'Неге маған кредит картасымен сатып алмаған жөн?',
      own: 'Неге маған бұл затты қазір алмаған жөн?',
    },
    longer: 'Ал 24 айға алсам ше?',
    down: 'Ал бастапқы жарна салсам ше?',
    when: 'Бұл затты қашан ала аламын?',
  },

  calc: {
    summary: 'Қалай есептедік',
    data: 'Пайдаланылған деректер',
    income: 'Айлық табыс',
    incomeSrc: (d: string) => `${d} өзіңіз енгіздіңіз`,
    expenses: 'Міндетті шығыстар',
    expensesSrc: (d: string) => `${d} өзіңіз енгіздіңіз`,
    noDate: 'күні белгісіз',
    payments: (n: number) => (n ? `${n} несие бойынша төлемдер` : 'Несие бойынша төлемдер'),
    creditsSrc: (report: string | null, nReport: number, nManual: number) => {
      const manual = `қолмен енгізілген ${nManual} жазба`;
      const rep = `${report ? `${report} ` : ''}кредиттік есеп`;
      if (nReport && nManual) return `${rep} және ${manual}`;
      if (nReport) return rep;
      if (nManual) return manual;
      return 'несие жоқ';
    },
    newPayment: 'Жаңа төлем',
    newAuto: (financed: string, term: number) => `${financed} ÷ ${term} ай`,
    extras: (down: string | null, fees: string | null) =>
      !down && !fees ? ', бастапқы жарнасыз және комиссиясыз' : `, ${down ? `бастапқы жарна ${down}` : 'бастапқы жарнасыз'}, ${fees ? `комиссия ${fees}` : 'комиссиясыз'}`,
    markup: (pct: string) => `, шартты артық төлем ${pct}`,
    newManual: 'шарт талаптары бойынша',
    newOwn: 'өз ақшасына — жаңа төлемсіз',
    fix: 'Деректерді түзету',
    formulas: 'Формулалар мен шкала',
    loadFormula: 'Қарыз жүктемесі = төлемдер ÷ табыс',
    freeFormula: 'Бос қаражат = табыс − шығыстар − төлемдер',
    legend: {
      low: 'Төмен тәуекел — жүктеме 30%-ға дейін және бос қаражат табыстың кемінде 20%-ы',
      medium: 'Орташа — жүктеме 30–45% немесе бос қаражат табыстың 10–20%-ы',
      high: 'Жоғары — жүктеме 45%-дан бастап немесе бос қаражат табыстың 10%-ынан аз',
    },
  },

  softer: {
    title: 'Жұмсағырақ нұсқалар',
    recommended: 'Ұсынамыз',
    kindName: { installment: 'бөліп төлеу', credit: 'несие', microloan: 'микронесие', credit_card: 'кредит картасы', own: 'бөліп төлеу' },
    longer: (kind: string, n: number) => `${n} айға ${kind}`,
    cheaper: (price: string) => `${price} тұратын қарапайым модель`,
    wait: (n: number) => `${n} ай күтіп, қарапайым модельді алу`,
    down: 'Бастапқы жарнамен',
    save: (n: number | null) => (n ? `${n} айда қарызсыз жинау` : 'Қарызсыз жинау'),
    payment: (m: string) => `Төлем ${m}`,
    noPayment: 'Жаңа төлемсіз',
    load: (l: string) => `жүктеме ${l}`,
    overpay: (o: string) => `артық төлем ${o}`,
    free: (f: string) => `бос ${f}`,
  },

  tips: {
    title: 'Рәсімдеу алдында',
    check_hidden_fees: 'Шартта сақтандыру мен комиссия жоқ екенін тексеріңіз — әйтпесе «0%» ақылы болып шығады.',
    check_full_cost: 'Шарттағы толық құн мен мөлшерлемені тексеріңіз — жалпы сома бағадан көп болуы мүмкін.',
    set_reminders: () => 'Төлемдер туралы еске салғышты қосыңыз — кешіктіру әдетте ақылы.',
    no_new_credit_during_term: (n: number) => `Осы ${n} ай ішінде жаңа несие жоспарламаңыз — қорды сақтаған жөн.`,
  },

  noData: {
    needTitle: 'Бағалау үшін не керек',
    income: 'Табыс',
    incomeSet: (m: string | null) => (m ? `Айына ${m} — көрсетілген` : 'Көрсетілген'),
    incomeMissing: 'Көрсетілмеген — онсыз төлем бюджеттің қандай бөлігін алатынын есептеу мүмкін емес',
    addIncome: 'Табыс қосу',
    expenses: 'Міндетті шығыстар',
    expensesSet: (m: string | null) => (m ? `Айына ${m} — көрсетілген` : 'Көрсетілген'),
    expensesMissing: 'Көрсетілмеген — оларсыз қанша ақша қалатынын түсіну мүмкін емес',
    addExpenses: 'Шығыс қосу',
    credits: 'Қолданыстағы несиелер',
    creditsSet: (n: number) => (n ? `${n} несие — қосылған` : 'Несие жоқ — белгіленген'),
    creditsMissing: 'Қосылмаған — қарыз жүктемесін есептеу мүмкін емес',
    upload: 'Есепті жүктеу',
    manual: 'Қолмен қосу',
    purchase: 'Сатып алу параметрлері',
    purchaseValue: (title: string, price: string, term: number | null) => `${title}, ${price}, ${term ? `${term} ай` : 'өз ақшасына'}`,
    canSay: 'Қазір не айтуға болады',
    canSayText: (monthly: string, share: string, missing: Array<'expenses' | 'credits'>) =>
      `Жаңа төлем **${monthly}** — бұл табысыңыздың ${share}-ы. Бірақ ${missing.map((m) => (m === 'expenses' ? 'шығыстарсыз' : 'қолданыстағы несиелерсіз')).join(' және ')} сізде ай сайын қанша қалатынын білмейміз, сондықтан тәуекелді бағаламаймыз.`,
    noIncomeText: (monthly: string) => `Табыссыз **${monthly}** төлемді бюджетіңізбен салыстыра алмаймыз, сондықтан тәуекелді бағаламаймыз.`,
    whyData: 'Бұл деректер не үшін керек?',
    whyQuestion: 'Бағалау үшін qorgan-ға табыс, шығыс және несие деректері не үшін керек?',
  },

  notFound: {
    title: 'Бағалау табылмады',
    text: 'Сілтеме ескірген болуы мүмкін. Сатып алуды қайта тексеріңіз — бұл бірнеше минут алады.',
    cta: 'Сатып алуды тексеру',
  },
};

export const dict: Dict<typeof ru> = { ru, kk };
