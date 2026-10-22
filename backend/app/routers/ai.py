"""qorgan AI chat: conversations, messages, availability."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.deps import CurrentUser, Repos, RequestLang, not_found
from app.models import ChatMessage, Conversation
from app.services import assistant
from app.services import consents as consent_svc
from app.services import finance as fin

router = APIRouter(prefix="/ai", tags=["ai"])


def _context(repos: Repos, user_id: str) -> assistant.Context:
    profile = repos.profiles.get(user_id)
    credits = repos.credits.list(user_id)
    last = next(iter(repos.assessments.list(user_id)), None)
    allowed = consent_svc.is_active(repos, user_id, "ai_analysis")
    return assistant.Context(profile, credits, last, allowed, date.today())


@router.get("/status")
def ai_status():
    # TODO: Integration — report the real health of the LLM provider.
    return {"available": not settings.ai_offline}


@router.get("/context")
def ai_context(user: CurrentUser, repos: Repos):
    """«Что учитывает qorgan AI» — what the assistant can see."""
    ctx = _context(repos, user.id)
    return {
        "allowed": ctx.allowed,
        "income": ctx.snap.income if ctx.allowed else None,
        "expenses": ctx.snap.expenses if ctx.allowed else None,
        "credits_count": ctx.snap.credits_count if ctx.allowed else None,
        "payments": ctx.snap.payments if ctx.allowed else None,
        "load": ctx.snap.load if ctx.allowed else None,
        "zone": fin.load_zone(ctx.snap.load),
        "last_check": {"id": ctx.last.id, "title": ctx.last.purchase.title, "risk": ctx.last.risk} if (ctx.last and ctx.allowed) else None,
    }


def _summary(c: Conversation) -> dict:
    first_q = next((m.text for m in c.messages if m.role == "user"), None)
    return {"id": c.id, "created_at": c.created_at, "title": first_q, "messages": len(c.messages), "context": c.context}


@router.get("/conversations")
def list_conversations(user: CurrentUser, repos: Repos):
    return [_summary(c) for c in repos.conversations.list(user.id) if not c.context.get("check_panel")]


class NewConversationIn(BaseModel):
    check_panel: bool = False
    purchase: dict | None = None


@router.post("/conversations", status_code=201)
def new_conversation(body: NewConversationIn, user: CurrentUser, repos: Repos, lang: RequestLang):
    ctx = _context(repos, user.id)
    convo = Conversation(id=uuid.uuid4().hex[:12], user_id=user.id, created_at=datetime.now(),
                         context={"check_panel": body.check_panel, "purchase": body.purchase} if body.check_panel else {})
    if body.check_panel:
        convo.messages.append(assistant.message("", suggestions=assistant.PANEL_SUGGESTIONS[lang]))
    else:
        convo.messages.append(assistant.greeting(ctx, lang))
    # TODO: Database — insert conversation + first message.
    return repos.conversations.save(convo)


@router.get("/conversations/latest")
def latest_conversation(user: CurrentUser, repos: Repos, lang: RequestLang):
    items = [c for c in repos.conversations.list(user.id) if not c.context.get("check_panel")]
    if items:
        return items[0]
    return new_conversation(NewConversationIn(), user, repos, lang)


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, user: CurrentUser, repos: Repos):
    c = repos.conversations.get(user.id, conversation_id)
    if c is None:
        raise not_found("conversation_not_found")
    return c


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    purchase: dict | None = None  # purchase being edited on the check screen (AI panel)


@router.post("/conversations/{conversation_id}/messages")
def send_message(conversation_id: str, body: MessageIn, user: CurrentUser, repos: Repos, lang: RequestLang):
    convo = repos.conversations.get(user.id, conversation_id)
    if convo is None:
        raise not_found("conversation_not_found")
    question = ChatMessage(id=uuid.uuid4().hex[:10], role="user", text=body.text.strip(), created_at=datetime.now())
    if settings.ai_offline:
        question.pending = True
        convo.messages.append(question)
        repos.conversations.save(convo)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "ai_unavailable", "saved": True})
    answer = assistant.reply(body.text, _context(repos, user.id), lang, body.purchase or convo.context.get("purchase"))
    convo.messages.extend([question, answer])
    # TODO: Database — insert both chat_messages rows.
    repos.conversations.save(convo)
    return {"question": question, "answer": answer}
