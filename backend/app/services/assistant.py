"""qorgan AI — a deterministic, rule-based assistant.

It answers the questions the product suggests (repayment order, lowering payments,
"can I afford it", installment vs credit, term, fees, down payment, timing) from the
user's own numbers, in Russian or Kazakh.

TODO: Integration — replace `reply()` with an LLM call (system prompt + the user's
financial context below as tool/context data) once a provider is chosen; keep the
structured blocks/links in the response shape so the UI does not change.
"""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime

from app.models import Assessment, ChatBlock, ChatLink, ChatMessage, Credit, FinancialProfile, Lang
from app.services import finance as fin
from app.services import scenarios as sc

NBSP = " "
MINUS = "−"

TYPE_NAMES = {
    "ru": {"cash_loan": "кредит наличными", "installment": "рассрочка", "microloan": "микрокредит",
           "credit_card": "кредитная карта", "auto_loan": "автокредит", "mortgage": "ипотека", "other": "кредит"},
    "kk": {"cash_loan": "қолма-қол несие", "installment": "бөліп төлеу", "microloan": "микронесие",
           "credit_card": "несиелік карта", "auto_loan": "автонесие", "mortgage": "ипотека", "other": "несие"},
}
MONTHS_GEN = {
    "ru": ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    "kk": ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
}


def money(n: int | float) -> str:
    v = int(round(n))
    s = f"{abs(v):,}".replace(",", NBSP)
    return f"{MINUS if v < 0 else ''}{s}{NBSP}₸"


def pct(x: float) -> str:
    return f"{fin.pct(x)}%"


def day_month(d: date, lang: Lang) -> str:
    return f"{d.day} {MONTHS_GEN[lang][d.month - 1]}"


def label(c: Credit, lang: Lang) -> str:
    return f"{c.organization} · {TYPE_NAMES[lang][c.type]}"


SUGGESTIONS = {
    "ru": ["Можно ли мне взять рассрочку?", "Какой кредит лучше погасить первым?", "Как уменьшить ежемесячные платежи?",
           "Стоит ли покупать автомобиль в кредит?", "Когда я смогу позволить себе эту покупку?"],
    "kk": ["Маған бөліп төлеуге алуға бола ма?", "Қай несиені бірінші өтеген дұрыс?", "Ай сайынғы төлемді қалай азайтуға болады?",
           "Көлікті несиеге алған дұрыс па?", "Бұл сатып алуға қашан шамам жетеді?"],
}
PANEL_SUGGESTIONS = {
    "ru": ["Какой срок выбрать?", "Есть ли скрытые комиссии?", "А если внести 200 000 ₸?"],
    "kk": ["Қандай мерзім таңдаған дұрыс?", "Жасырын комиссиялар бар ма?", "Ал 200 000 ₸ салсам ше?"],
}

INTENTS: list[tuple[str, tuple[str, ...]]] = [
    ("why_data", ("зачем нужны", "зачем эти данные", "неге керек", "не үшін керек")),
    ("negotiate", ("договор", "просроч", "отсроч", "келіс", "кешік")),
    ("difference", ("отличает", "разница", "айырмашы")),
    ("repay_order", ("первым", "первую очередь", "бірінші", "алдымен")),
    ("reduce", ("уменьш", "снизить плат", "снизить ежемес", "азайт")),
    ("compare", ("или кредит", "что выгоднее", "выгоднее", "әлде несие", "тиімді")),
    ("term", ("срок", "мерзім", "если взять на", "если оформить на", "айға алсам")),
    ("fees", ("комисси", "скрыт", "страховк", "жасырын")),
    ("down_payment", ("внести", "взнос", "внесу", "бастапқы", "салсам")),
    ("when", ("когда", "смогу позволить", "қашан")),
    ("car", ("автомоб", "машин", "көлік")),
    ("afford", ("потяну", "можно ли", "стоит ли", "брать", "рассрочк", "бола ма", "ала ал", "бөліп")),
]


def detect_intent(text: str) -> str:
    t = text.lower()
    for intent, keys in INTENTS:
        if any(k in t for k in keys):
            return intent
    return "fallback"


def extract_amount(text: str) -> int | None:
    m = re.search(r"(\d[\d\s ]{2,})", text)
    if not m:
        return None
    digits = re.sub(r"\D", "", m.group(1))
    return int(digits) if digits else None


class Context:
    def __init__(self, profile: FinancialProfile, credits: list[Credit], last: Assessment | None, allowed: bool, today: date):
        self.profile, self.credits, self.last, self.allowed, self.today = profile, credits, last, allowed, today
        self.snap = fin.snapshot(profile, credits)
        self.has_data = self.snap.income > 0 and bool(credits or profile.no_credits)


def message(text: str, blocks: list[ChatBlock] | None = None, links: list[ChatLink] | None = None,
         suggestions: list[str] | None = None) -> ChatMessage:
    return ChatMessage(id=uuid.uuid4().hex[:10], role="assistant", text=text, blocks=blocks or [], links=links or [],
                       suggestions=suggestions or [], created_at=datetime.now())


def greeting(ctx: Context, lang: Lang) -> ChatMessage:
    if ctx.allowed and ctx.has_data:
        n = len(ctx.credits)
        text = {
            "ru": f"Привет! Я qorgan AI. Помогу разобраться с твоими финансами и принять более безопасное решение. Я учитываю твои доходы, расходы и {n} {_plural_ru(n, 'обязательство', 'обязательства', 'обязательств')}.",
            "kk": f"Сәлем! Мен qorgan AI. Қаржыңызды түсінуге және қауіпсіз шешім қабылдауға көмектесемін. Мен сіздің табысыңызды, шығыстарыңызды және {n} міндеттемеңізді ескеремін.",
        }[lang]
    else:
        text = {
            "ru": "Привет! Я qorgan AI. Отвечу на общие вопросы о кредитах, рассрочках и платежах простым языком.",
            "kk": "Сәлем! Мен qorgan AI. Несие, бөліп төлеу және төлемдер туралы жалпы сұрақтарға қарапайым тілмен жауап беремін.",
        }[lang]
    return message(text, suggestions=SUGGESTIONS[lang])


def _plural_ru(n: int, one: str, few: str, many: str) -> str:
    n100, n10 = n % 100, n % 10
    if 11 <= n100 <= 14:
        return many
    if n10 == 1:
        return one
    if 2 <= n10 <= 4:
        return few
    return many


def _no_access(lang: Lang) -> str:
    return {
        "ru": "Без согласия на анализ данных я не вижу твои доходы и кредиты, поэтому отвечаю в общем виде. Разрешить доступ можно в профиле.",
        "kk": "Деректерді талдауға келісім болмаса, мен табысыңыз бен несиелеріңізді көрмеймін, сондықтан жалпы жауап беремін. Рұқсатты профильде беруге болады.",
    }[lang]


def reply(text: str, ctx: Context, lang: Lang, panel_purchase: dict | None = None) -> ChatMessage:
    intent = detect_intent(text)
    personal = ctx.allowed and ctx.has_data
    handler = {
        "repay_order": _repay_order, "reduce": _reduce, "afford": _afford, "compare": _compare, "term": _term,
        "fees": _fees, "down_payment": _down_payment, "when": _when, "car": _car, "difference": _difference,
        "negotiate": _negotiate, "why_data": _why_data,
    }.get(intent)
    if handler is None:
        return _fallback(ctx, lang)
    if not personal and intent not in ("fees", "difference", "negotiate", "why_data"):
        general = _general(intent, lang)
        if not ctx.allowed:
            general.text = _no_access(lang) + "\n\n" + general.text
        return general
    return handler(ctx, lang, text, panel_purchase)


# ------------------------------------------------------------------ intents


def _ranked(ctx: Context) -> list[Credit]:
    return sorted(ctx.credits, key=lambda c: (fin.TYPE_COST_RANK[c.type], fin.cost_key(c)), reverse=True)


def _repay_order(ctx: Context, lang: Lang, *_):
    ranked = _ranked(ctx)
    if not ranked:
        return message({"ru": "У тебя нет активных кредитов — гасить нечего. Отличная позиция!",
                     "kk": "Сізде белсенді несие жоқ — өтейтін ештеңе жоқ. Тамаша!"}[lang])
    top = ranked[0]
    rate = fin.overpayment_rate(top)
    end = fin.end_date(top)
    if lang == "ru":
        text = f"Начни с **{top.organization}** ({TYPE_NAMES['ru'][top.type]})."
        if rate is not None:
            text += f" У него самая высокая переплата — {pct(rate)}"
            text += f" всего за {top.payments_total} мес." if top.payments_total else "."
        if end:
            text += f" Он закончится {day_month(end, 'ru')}. После этого освободится **{money(top.monthly_payment)}** в месяц."
    else:
        text = f"**{top.organization}** ({TYPE_NAMES['kk'][top.type]}) несиесінен бастаңыз."
        if rate is not None:
            text += f" Оның артық төлемі ең жоғары — {pct(rate)}."
        if end:
            text += f" Ол {day_month(end, 'kk')} аяқталады. Содан кейін айына **{money(top.monthly_payment)}** босайды."
    items = []
    for i, c in enumerate(ranked, start=1):
        hint = {
            "microloan": {"ru": f"закрыть до {day_month(end, 'ru')}" if (end and c.id == top.id) else "закрыть первым", "kk": "бірінші жабу"},
            "credit_card": {"ru": "платить больше минимума", "kk": "ең аз төлемнен көп төлеу"},
            "cash_loan": {"ru": "по графику", "kk": "кесте бойынша"},
        }.get(c.type, {"ru": "по графику, без досрочных", "kk": "кесте бойынша, мерзімінен бұрын емес"})[lang]
        items.append({"n": str(i), "title": label(c, lang), "hint": hint})
    block = ChatBlock(type="steps", data={
        "title": {"ru": "Порядок погашения: от самого дорогого долга", "kk": "Өтеу реті: ең қымбат қарыздан бастап"}[lang],
        "items": items,
    })
    links = [
        ChatLink(label={"ru": "Добавить в финансовый план", "kk": "Қаржылық жоспарға қосу"}[lang], to="/plan", primary=True),
        ChatLink(label={"ru": "Открыть кредит", "kk": "Несиені ашу"}[lang], to=f"/credits?id={top.id}"),
    ]
    return message(text, [block], links)


def _reduce(ctx: Context, lang: Lang, *_):
    closing = sc.closable_credit(ctx.credits)
    after = ctx.snap.payments - (closing.monthly_payment if closing else 0)
    if lang == "ru":
        items = []
        if closing:
            end = fin.end_date(closing)
            when = f"с {MONTHS_GEN['ru'][(end.month % 12)]}" if end else "после закрытия"
            items.append(f"**Закрыть {TYPE_NAMES['ru'][closing.type]} по графику** — {when} платежи станут {money(after)} вместо {money(ctx.snap.payments)}.")
        items.append("**Платить по карте больше минимума** — долг уменьшится быстрее, процентов будет меньше.")
        items.append("**Спросить банк об изменении графика** — платеж снизится, но общая переплата вырастет. Это крайний вариант.")
        text = "Вот способы, от самого надежного:"
    else:
        items = []
        if closing:
            items.append(f"**{TYPE_NAMES['kk'][closing.type].capitalize()} кесте бойынша жабу** — төлемдер {money(ctx.snap.payments)} орнына {money(after)} болады.")
        items.append("**Карта бойынша ең аз төлемнен көп төлеу** — қарыз тезірек азаяды, пайыз аз болады.")
        items.append("**Банктен кестені өзгертуді сұрау** — төлем азаяды, бірақ жалпы артық төлем өседі. Бұл соңғы нұсқа.")
        text = "Міне, ең сенімдісінен бастап тәсілдер:"
    return message(text, [ChatBlock(type="list", data={"ordered": True, "items": items})],
                [ChatLink(label={"ru": "Открыть финансовый план", "kk": "Қаржылық жоспарды ашу"}[lang], to="/plan")])


def _afford(ctx: Context, lang: Lang, text: str, panel_purchase: dict | None):
    a = ctx.last
    if a is None or a.after is None:
        return message({
            "ru": "Чтобы ответить точно, проверь покупку: укажи стоимость, срок и платеж — я сравню их с твоим бюджетом.",
            "kk": "Нақты жауап беру үшін сатып алуды тексеріңіз: құнын, мерзімін және төлемін көрсетіңіз — мен оларды бюджетіңізбен салыстырамын.",
        }[lang], links=[ChatLink(label={"ru": "Проверить покупку", "kk": "Сатып алуды тексеру"}[lang], to="/check", primary=True)])
    verdict = {"high": {"ru": "Сейчас не стоит", "kk": "Қазір тұрмайды"},
               "medium": {"ru": "Лучше подумать еще раз", "kk": "Тағы ойланған жөн"},
               "low": {"ru": "Выглядит посильно", "kk": "Шамаңыз жетеді"}}.get(a.risk, {"ru": "Мало данных", "kk": "Деректер аз"})[lang]
    if lang == "ru":
        body = f"Платежи вырастут до **{money(a.after.payments)}** — это {pct(a.after.load)} дохода, а свободных денег останется **{money(a.after.free)}** в месяц."
    else:
        body = f"Төлемдер **{money(a.after.payments)}** дейін өседі — бұл табыстың {pct(a.after.load)}, ал айына **{money(a.after.free)}** бос ақша қалады."
    block = ChatBlock(type="verdict", data={"risk": a.risk, "title": verdict, "text": body, "links": [
        {"label": {"ru": "Открыть полную оценку", "kk": "Толық бағалауды ашу"}[lang], "to": f"/result/{a.id}"},
        {"label": {"ru": "Найти альтернативу", "kk": "Балама табу"}[lang], "to": f"/scenarios?check={a.id}"},
    ]})
    extra = ""
    if a.risk == "high" and a.alternative:
        alt = a.alternative
        if lang == "ru":
            extra = f"Есть вариант мягче: покупка за {money(alt['price'])}"
            extra += f" через {alt['months_until_purchase']} мес. без нового долга" if not alt["new_debt"] else ""
            extra += f" — нагрузка {pct(alt['load'])}."
        else:
            extra = f"Жұмсақ нұсқа бар: {money(alt['price'])} сатып алу"
            extra += f", {alt['months_until_purchase']} айдан кейін, жаңа қарызсыз" if not alt["new_debt"] else ""
            extra += f" — жүктеме {pct(alt['load'])}."
    return message(extra, [block])


def _purchase(ctx: Context, panel_purchase: dict | None) -> dict | None:
    if panel_purchase:
        return panel_purchase
    if ctx.last:
        return ctx.last.purchase.model_dump()
    return None


def _compare(ctx: Context, lang: Lang, text: str, panel_purchase: dict | None):
    p = _purchase(ctx, panel_purchase)
    price = (p or {}).get("price") or 840_000
    term = (p or {}).get("term_months") or 12
    down = (p or {}).get("down_payment") or 0
    inst_m = sc.monthly_payment(price, down, term, "installment")
    cred_m = sc.monthly_payment(price, down, term, "credit")
    rows = [
        {"label": {"ru": "Рассрочка", "kk": "Бөліп төлеу"}[lang], "monthly": inst_m, "total": sc.total_cost(price, down, term, "installment"), "approx": False},
        {"label": {"ru": "Кредит", "kk": "Несие"}[lang], "monthly": cred_m, "total": sc.total_cost(price, down, term, "credit"), "approx": True},
    ]
    block = ChatBlock(type="compare", data={"term_months": term, "rows": rows})
    load_after = fin.share(ctx.snap.payments + min(inst_m, cred_m), ctx.snap.income)
    if lang == "ru":
        intro = "При той же цене рассрочка обычно дешевле: если в договоре нет комиссий и страховки, переплаты не будет."
        note = f"Переплата по кредиту условная — {pct(sc.markup('credit', 12))} за год. Точную ставку смотри в предложении банка."
        tail = f"Но для тебя важнее не способ, а размер платежа: любой из вариантов поднимет нагрузку до {pct(load_after)}."
    else:
        intro = "Бағасы бірдей болса, бөліп төлеу әдетте арзанырақ: шартта комиссия мен сақтандыру болмаса, артық төлем болмайды."
        note = f"Несие бойынша артық төлем шартты — жылына {pct(sc.markup('credit', 12))}. Нақты мөлшерлемені банк ұсынысынан қараңыз."
        tail = f"Бірақ сіз үшін тәсілден гөрі төлем мөлшері маңызды: кез келген нұсқа жүктемені {pct(load_after)} дейін көтереді."
    block.data["note"] = note
    return message(
        f"{intro}\n\n{tail}",
        [block],
        [ChatLink(label={"ru": "Посмотреть, что будет после покупки", "kk": "Сатып алғаннан кейін не болатынын көру"}[lang],
                  to=f"/result/{ctx.last.id}" if ctx.last else "/check")],
    )


def _term(ctx: Context, lang: Lang, text: str, panel_purchase: dict | None):
    p = _purchase(ctx, panel_purchase) or {"price": 840_000, "kind": "installment", "down_payment": 0}
    kind = p.get("kind") if p.get("kind") in ("installment", "credit") else "installment"
    rows = []
    for term in (6, 12, 24):
        m = sc.monthly_payment(p["price"], p.get("down_payment", 0), term, kind)
        load = fin.share(ctx.snap.payments + m, ctx.snap.income)
        rows.append({"label": {"ru": f"{term} мес", "kk": f"{term} ай"}[lang], "monthly": m,
                     "total": sc.total_cost(p["price"], p.get("down_payment", 0), term, kind), "load": load,
                     "risk": fin.risk_level(load, ctx.snap.income - ctx.snap.expenses - ctx.snap.payments - m, ctx.snap.income)})
    best = min(rows, key=lambda r: (sc.RISK_ORDER[r["risk"]], r["total"]))
    text_out = {
        "ru": f"Длинный срок снижает платеж, но увеличивает переплату. Для твоего бюджета разумнее всего — **{best['label']}**: нагрузка {pct(best['load'])}.",
        "kk": f"Ұзақ мерзім төлемді азайтады, бірақ артық төлемді арттырады. Сіздің бюджетіңізге ең қолайлысы — **{best['label']}**: жүктеме {pct(best['load'])}.",
    }[lang]
    return message(text_out, [ChatBlock(type="compare", data={"rows": rows, "show_load": True})])


def _fees(ctx: Context, lang: Lang, *_):
    items = {
        "ru": ["Страховка жизни или товара — часто включена по умолчанию, от нее можно отказаться.",
               "Комиссия за выдачу или обслуживание счёта — ищи в графике платежей.",
               "«0%» в рекламе бывает только при оплате в срок: за просрочку начисляют пеню.",
               "Проси у продавца полную стоимость и график до подписания."],
        "kk": ["Өмір немесе тауар сақтандыруы — жиі әдепкі бойынша қосылады, одан бас тартуға болады.",
               "Беру немесе шотқа қызмет көрсету комиссиясы — төлем кестесінен іздеңіз.",
               "Жарнамадағы «0%» тек уақытында төлегенде ғана: кешіктіргені үшін өсімпұл есептеледі.",
               "Қол қоймас бұрын сатушыдан толық құнын және кестесін сұраңыз."],
    }[lang]
    return message({"ru": "Проверь в договоре четыре вещи:", "kk": "Шарттан төрт нәрсені тексеріңіз:"}[lang],
                [ChatBlock(type="list", data={"ordered": True, "items": items})])


def _down_payment(ctx: Context, lang: Lang, text: str, panel_purchase: dict | None):
    p = _purchase(ctx, panel_purchase) or {"price": 840_000, "kind": "installment", "term_months": 12}
    down = extract_amount(text) or 200_000
    kind = p.get("kind") if p.get("kind") != "own" else "installment"
    term = p.get("term_months") or 12
    m = sc.monthly_payment(p["price"], down, term, kind)
    load = fin.share(ctx.snap.payments + m, ctx.snap.income)
    free = ctx.snap.income - ctx.snap.expenses - ctx.snap.payments - m
    risk = fin.risk_level(load, free, ctx.snap.income)
    if lang == "ru":
        t = f"С взносом {money(down)} платеж станет **{money(m)}** в месяц, нагрузка — {pct(load)}, свободно — {money(free)}."
    else:
        t = f"{money(down)} бастапқы жарнамен төлем айына **{money(m)}** болады, жүктеме — {pct(load)}, бос қаражат — {money(free)}."
    names = {"high": {"ru": "Всё ещё высокий риск", "kk": "Әлі де жоғары тәуекел"}, "medium": {"ru": "Средний риск", "kk": "Орташа тәуекел"},
             "low": {"ru": "Низкий риск", "kk": "Төмен тәуекел"}}
    return message(t, [ChatBlock(type="verdict", data={"risk": risk, "title": names[risk][lang], "text": "", "links": []})])


def _when(ctx: Context, lang: Lang, text: str, panel_purchase: dict | None):
    p = _purchase(ctx, panel_purchase)
    target = sc.cheaper_price(p["price"]) if p else 420_000
    plan = sc.save_plan(ctx.profile, ctx.credits, target, ctx.today)
    if not plan["feasible"]:
        return message({"ru": "Сейчас свободных денег не остается, поэтому накопить не получится. Начни с плана: что гасить первым.",
                     "kk": "Қазір бос ақша қалмайды, сондықтан жинау мүмкін емес. Жоспардан бастаңыз: алдымен нені өтеу керек."}[lang],
                    links=[ChatLink(label={"ru": "Открыть план", "kk": "Жоспарды ашу"}[lang], to="/plan", primary=True)])
    m = plan["purchase_month"]
    if lang == "ru":
        month = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"][m.month - 1]
        t = f"Если сначала закрыть дорогой долг, а потом откладывать по **{money(plan['saving_monthly'])}**, покупку за {money(target)} можно сделать в {month} {m.year} — через {plan['months_until_purchase']} мес. и без нового долга."
    else:
        t = f"Алдымен қымбат қарызды жауып, кейін айына **{money(plan['saving_monthly'])}** жинасаңыз, {money(target)} сатып алуды {m.year} жылғы {MONTHS_GEN['kk'][m.month - 1]} айында — {plan['months_until_purchase']} айдан кейін, жаңа қарызсыз жасауға болады."
    return message(t, links=[ChatLink(label={"ru": "Открыть финансовый план", "kk": "Қаржылық жоспарды ашу"}[lang], to="/plan", primary=True)])


def _car(ctx: Context, lang: Lang, *_):
    zone = fin.load_zone(ctx.snap.load)
    if lang == "ru":
        t = ("Автокредит — один из самых долгих долгов: обычно 3–7 лет. " +
             (f"Сейчас на кредиты уже уходит {pct(ctx.snap.load)} дохода, поэтому новый крупный платеж будет высоким риском." if zone != "stable"
              else "Твоя нагрузка в безопасной зоне — проверь конкретное предложение, чтобы увидеть последствия."))
    else:
        t = ("Автонесие — ең ұзақ қарыздардың бірі: әдетте 3–7 жыл. " +
             (f"Қазір несиеге табыстың {pct(ctx.snap.load)} кетеді, сондықтан жаңа ірі төлем жоғары тәуекел болады." if zone != "stable"
              else "Жүктемеңіз қауіпсіз аймақта — салдарын көру үшін нақты ұсынысты тексеріңіз."))
    return message(t, links=[ChatLink(label={"ru": "Сравнить сценарии", "kk": "Сценарийлерді салыстыру"}[lang], to="/scenarios")])


def _difference(ctx: Context, lang: Lang, *_):
    t = {
        "ru": "**Рассрочка** — цена делится на равные части, переплаты нет, если нет комиссий и страховки. **Кредит** — банк дает деньги под процент, поэтому итоговая сумма больше цены. В обоих случаях главное — посильный ежемесячный платеж.",
        "kk": "**Бөліп төлеу** — баға тең бөліктерге бөлінеді, комиссия мен сақтандыру болмаса, артық төлем жоқ. **Несие** — банк пайызбен ақша береді, сондықтан жалпы сома бағадан көп. Екі жағдайда да ең бастысы — ай сайынғы төлемнің шамаңызға сай болуы.",
    }[lang]
    return message(t)


def _negotiate(ctx: Context, lang: Lang, *_):
    items = {
        "ru": ["Позвони в организацию сам, до звонка коллекторов.", "Попроси отсрочку или изменение графика — объясни причину.",
               "Попроси письменное подтверждение новых условий.", "Не бери новый заем, чтобы закрыть этот: долг только вырастет."],
        "kk": ["Ұйымға өзіңіз хабарласыңыз, коллекторлар қоңырауынан бұрын.", "Мерзімін ұзартуды немесе кестені өзгертуді сұраңыз — себебін түсіндіріңіз.",
               "Жаңа шарттарды жазбаша растауды сұраңыз.", "Бұл қарызды жабу үшін жаңа қарыз алмаңыз: қарыз тек өседі."],
    }[lang]
    return message({"ru": "Что сделать, если платеж просрочен:", "kk": "Төлем кешіктірілсе не істеу керек:"}[lang],
                [ChatBlock(type="list", data={"ordered": True, "items": items})])


def _why_data(ctx: Context, lang: Lang, *_):
    items = {
        "ru": ["**Доход** — основа расчета: от него считаем, какая часть денег уходит на кредиты.",
               "**Обязательные расходы** показывают, сколько денег на самом деле остается каждый месяц.",
               "**Действующие кредиты** — главное в оценке: без них нельзя посчитать долговую нагрузку."],
        "kk": ["**Табыс** — есептің негізі: одан несиеге ақшаның қандай бөлігі кететінін есептейміз.",
               "**Міндетті шығыстар** ай сайын шын мәнінде қанша ақша қалатынын көрсетеді.",
               "**Қолданыстағы несиелер** — бағалаудың ең бастысы: оларсыз қарыз жүктемесін есептеу мүмкін емес."],
    }[lang]
    return message({"ru": "Без этих данных оценка могла бы ввести в заблуждение, поэтому мы её не показываем:",
                    "kk": "Бұл деректерсіз баға адастыруы мүмкін, сондықтан біз оны көрсетпейміз:"}[lang],
                   [ChatBlock(type="list", data={"ordered": False, "items": items})],
                   [ChatLink(label={"ru": "Дополнить данные", "kk": "Деректерді толықтыру"}[lang], to="/onboarding", primary=True)])


def _general(intent: str, lang: Lang) -> ChatMessage:
    t = {
        "ru": "В общем виде: безопасно, когда на все кредиты уходит не больше 30% дохода и после обязательных трат остается хотя бы 20%. Добавь доходы и кредиты в профиль — тогда я посчитаю для твоей ситуации.",
        "kk": "Жалпы алғанда: барлық несиеге табыстың 30%-ынан аспайтын бөлігі кетсе және міндетті шығыстардан кейін кемінде 20% қалса, қауіпсіз. Профильге табыс пен несиелерді қосыңыз — сонда жағдайыңызға есептеймін.",
    }[lang]
    return message(t, links=[ChatLink(label={"ru": "Заполнить профиль", "kk": "Профильді толтыру"}[lang], to="/onboarding")])


def _fallback(ctx: Context, lang: Lang) -> ChatMessage:
    t = {
        "ru": "Я пока лучше всего отвечаю на вопросы о твоих кредитах, платежах и покупках. Попробуй один из вопросов ниже.",
        "kk": "Мен әзірге несиелеріңіз, төлемдеріңіз және сатып алулар туралы сұрақтарға жақсы жауап беремін. Төмендегі сұрақтардың бірін көріңіз.",
    }[lang]
    return message(t, suggestions=SUGGESTIONS[lang][:3])
