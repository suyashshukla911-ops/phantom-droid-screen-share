import asyncio
import hashlib
import hmac
import json
import os
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from io import BytesIO
from typing import Optional
from contextlib import asynccontextmanager

import qrcode
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, "web")

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "900"))
MESSAGE_LIMIT = 128 * 1024
CREATE_RATE_LIMIT = int(os.getenv("CREATE_RATE_LIMIT", "6"))
CREATE_RATE_WINDOW = 60

sessions = {}
create_buckets = defaultdict(deque)

def now() -> float:
    return time.time()

def new_token(nbytes: int) -> str:
    return secrets.token_urlsafe(nbytes)

def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def same_secret(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)

def origins_allowed() -> set[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    return {x.strip().rstrip("/") for x in raw.split(",") if x.strip()}

def origin_allowed(origin: Optional[str], host: Optional[str]) -> bool:
    if not origin:
        # Native Android WebSocket clients do not send Origin.
        return True
    origin = origin.rstrip("/")
    configured = origins_allowed()
    if configured:
        return origin in configured
    if not host:
        return False
    return origin in {f"https://{host}", f"http://{host}"}

@dataclass
class Session:
    session_id: str
    host_secret_hash: str
    guest_token_hash: str
    created_at: float
    expires_at: float
    host: Optional[WebSocket] = None
    guest: Optional[WebSocket] = None
    host_generation: str = ""
    guest_generation: str = ""
    share_active: bool = False
    consent_stage: str = "not-started"
    audit: deque = field(default_factory=lambda: deque(maxlen=60))

    def audit_event(self, event: str, role: str, metadata: Optional[dict] = None):
        self.audit.append({
            "ts": int(now()),
            "event": event,
            "role": role,
            "metadata": metadata or {},
        })

async def safe_send(ws: Optional[WebSocket], payload: dict):
    if not ws:
        return
    try:
        await ws.send_json(payload)
    except Exception:
        pass

async def close_session(session: Session, reason: str):
    sessions.pop(session.session_id, None)
    for ws in (session.host, session.guest):
        if ws:
            try:
                await ws.close(code=1000, reason=reason)
            except Exception:
                pass

async def detach(ws: WebSocket):
    sid = getattr(ws.state, "session_id", None)
    role = getattr(ws.state, "role", None)
    generation = getattr(ws.state, "generation", None)
    if not sid or not role:
        return

    session = sessions.get(sid)
    if not session:
        return

    current = session.host if role == "host" else session.guest
    current_generation = session.host_generation if role == "host" else session.guest_generation
    # A new connection with the same credential may have replaced this socket.
    if current is not ws or generation != current_generation:
        return

    if role == "host":
        session.host = None
        session.audit_event("host-disconnected", "host")
        await safe_send(session.guest, {"type": "peer-left", "reason": "host-disconnected"})
    else:
        session.guest = None
        session.share_active = False
        session.consent_stage = "revoked"
        session.audit_event("guest-disconnected", "guest")
        await safe_send(session.host, {"type": "peer-left", "reason": "guest-disconnected"})
        await safe_send(session.host, {"type": "consent-status", "stage": "revoked"})

    if not session.host and not session.guest:
        sessions.pop(sid, None)

def rate_limited(key: str) -> bool:
    bucket = create_buckets[key]
    cutoff = now() - CREATE_RATE_WINDOW
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= CREATE_RATE_LIMIT:
        return True
    bucket.append(now())
    return False

def public_origin(request: Request) -> str:
    configured = os.getenv("PUBLIC_ORIGIN", "").strip().rstrip("/")
    if configured:
        return configured
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}"

@asynccontextmanager
async def lifespan(_app):
    task = asyncio.create_task(expiry_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Phantom-Droid Secure Screen Share",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), display-capture=(self), "
        "payment=(), usb=(), serial=()"
    )
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Content-Security-Policy"] = (
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; "
    "form-action 'self'; img-src 'self' data: blob:; media-src 'self' blob:; "
    "script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:"
)
    if os.getenv("APP_ENV") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.get("/")
async def home():
    return FileResponse(os.path.join(PUBLIC_DIR, "index.html"))

@app.get("/health")
async def health():
    return {"ok": True, "service": "phantom-droid"}

@app.post("/api/sessions")
async def create_session(request: Request):
    ip = request.client.host if request.client else "unknown"
    if rate_limited(ip):
        return JSONResponse({"error": "Too many new sessions. Please wait."}, status_code=429)

    sid = new_token(18)
    host_secret = new_token(32)
    guest_token = new_token(32)
    session = Session(
        session_id=sid,
        host_secret_hash=sha256(host_secret),
        guest_token_hash=sha256(guest_token),
        created_at=now(),
        expires_at=now() + SESSION_TTL_SECONDS,
    )
    session.audit_event("session-created", "host")
    sessions[sid] = session

    join = f"{public_origin(request)}/cyber/join.html?session={sid}#token={guest_token}"
    response = JSONResponse({
        "session": sid,
        "host_secret": host_secret,
        "join_url": join,
        "expires_at": int(session.expires_at),
        "ttl_seconds": SESSION_TTL_SECONDS,
    })
    response.headers["Cache-Control"] = "no-store"
    return response

@app.post("/api/qr")
async def qr(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid request."}, status_code=400)
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, str) or not data or len(data) > 4096:
        return JSONResponse({"error": "Invalid QR payload."}, status_code=400)

    image = qrcode.make(data, box_size=10, border=2)
    buf = BytesIO()
    image.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )

ALLOWED = {
    "host": {"answer", "candidate", "leave", "end-session"},
    "guest": {
        "offer", "candidate", "leave",
        "consent-status", "share-status", "stop-share"
    },
}

def validate_message(role: str, message: dict) -> Optional[str]:
    mtype = message.get("type")
    if mtype not in ALLOWED[role]:
        return "Message type is not permitted for this role."

    if mtype in {"offer", "answer"}:
        sdp = message.get("sdp")
        if not isinstance(sdp, dict):
            return "Invalid SDP."
        if sdp.get("type") not in {"offer", "answer"}:
            return "Invalid SDP type."
        if not isinstance(sdp.get("sdp"), str) or len(sdp["sdp"]) > 100000:
            return "Invalid SDP payload."

    if mtype == "candidate":
        candidate = message.get("candidate")
        if not isinstance(candidate, dict) or len(json.dumps(candidate)) > 20000:
            return "Invalid ICE candidate."

    if mtype == "consent-status":
        if message.get("stage") not in {
            "notice-accepted",
            "consent-checklist-completed",
            "share-permission-granted",
            "share-permission-denied",
            "revoked",
        }:
            return "Invalid consent state."

    if mtype == "share-status" and not isinstance(message.get("active"), bool):
        return "Invalid share status."

    return None

async def forward(session: Session, role: str, message: dict):
    peer = session.guest if role == "host" else session.host
    await safe_send(peer, message)

@app.websocket("/signal")
async def signal(websocket: WebSocket):
    if not origin_allowed(websocket.headers.get("origin"), websocket.headers.get("host")):
        await websocket.close(code=1008, reason="Origin not allowed")
        return

    await websocket.accept()
    websocket.state.session_id = None
    websocket.state.role = None
    websocket.state.generation = None

    count = 0
    window_start = now()

    try:
        # Explicitly announce readiness synchronously so the client cannot race it.
        await websocket.send_json({"type": "server-ready"})

        while True:
            raw = await websocket.receive_text()
            if len(raw) > MESSAGE_LIMIT:
                await websocket.close(code=1009, reason="Message too large")
                return

            if now() - window_start >= 60:
                count = 0
                window_start = now()
            count += 1
            if count > 180:
                await websocket.close(code=1008, reason="Rate limit exceeded")
                return

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON."})
                continue

            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "message": "Malformed message."})
                continue

            # Authentication handshake.
            if websocket.state.session_id is None:
                if message.get("type") != "join":
                    await websocket.send_json({"type": "error", "message": "Authenticate before signaling."})
                    continue

                sid = message.get("session")
                role = message.get("role")
                credential = message.get("credential")
                if not isinstance(sid, str) or not isinstance(credential, str) or role not in {"host", "guest"}:
                    await websocket.send_json({"type": "error", "message": "Invalid session credentials."})
                    continue

                session = sessions.get(sid)
                if not session or session.expires_at <= now():
                    if session:
                        sessions.pop(sid, None)
                    await websocket.send_json({"type": "session-expired"})
                    continue

                expected = session.host_secret_hash if role == "host" else session.guest_token_hash
                if not same_secret(sha256(credential), expected):
                    await websocket.send_json({"type": "error", "message": "Authentication failed."})
                    continue

                old = session.host if role == "host" else session.guest
                if old and old is not websocket:
                    try:
                        await old.close(code=1000, reason="replaced-by-reconnect")
                    except Exception:
                        pass

                generation = new_token(12)
                websocket.state.session_id = sid
                websocket.state.role = role
                websocket.state.generation = generation
                if role == "host":
                    session.host = websocket
                    session.host_generation = generation
                else:
                    session.guest = websocket
                    session.guest_generation = generation

                session.audit_event("authenticated", role)
                await websocket.send_json({
                    "type": "authenticated",
                    "role": role,
                    "session": sid,
                    "expires_at": int(session.expires_at),
                })

                if session.host and session.guest:
                    session.audit_event("peer-paired", "system")
                    await safe_send(session.host, {"type": "peer-ready"})
                    await safe_send(session.guest, {"type": "peer-ready"})
                continue

            sid = websocket.state.session_id
            role = websocket.state.role
            session = sessions.get(sid)
            if not session:
                await websocket.send_json({"type": "session-expired"})
                return

            if session.expires_at <= now():
                await websocket.send_json({"type": "session-expired"})
                await close_session(session, "session-expired")
                return

            error = validate_message(role, message)
            if error:
                await websocket.send_json({"type": "error", "message": error})
                continue

            mtype = message["type"]
            if mtype == "leave":
                session.audit_event("leave", role)
                await detach(websocket)
                try:
                    await websocket.close(code=1000, reason="leave")
                except Exception:
                    pass
                return

            if mtype == "end-session":
                if role != "host":
                    await websocket.send_json({"type": "error", "message": "Only the host can end a session."})
                    continue
                session.audit_event("session-ended", "host")
                await safe_send(session.guest, {"type": "session-ended"})
                await close_session(session, "session-ended")
                return

            if mtype == "consent-status":
                session.consent_stage = message["stage"]
                session.audit_event("consent-status", role, {"stage": message["stage"]})
                await forward(session, role, {"type": "consent-status", "stage": message["stage"]})
                continue

            if mtype == "share-status":
                session.share_active = message["active"]
                session.audit_event("share-status", role, {"active": session.share_active})
                await forward(session, role, {"type": "share-status", "active": session.share_active})
                continue

            if mtype == "stop-share":
                session.share_active = False
                session.audit_event("share-stopped", role)
                await forward(session, role, {"type": "stop-share"})
                continue

            if mtype in {"offer", "answer", "candidate"}:
                # Guest is the media offerer; host is receive-only and may answer.
                if (mtype == "offer" and role != "guest") or (mtype == "answer" and role != "host"):
                    await websocket.send_json({"type": "error", "message": "Signaling direction rejected."})
                    continue
                payload = {"type": mtype}
                if "sdp" in message:
                    payload["sdp"] = message["sdp"]
                if "candidate" in message:
                    payload["candidate"] = message["candidate"]
                await forward(session, role, payload)

    except WebSocketDisconnect:
        await detach(websocket)
    except Exception:
        await detach(websocket)

async def expiry_loop():
    while True:
        await asyncio.sleep(10)
        current = now()
        for session in list(sessions.values()):
            if session.expires_at <= current:
                session.audit_event("session-expired", "system")
                await close_session(session, "session-expired")

app.mount("/cyber", StaticFiles(directory=os.path.join(PUBLIC_DIR, "cyber")), name="cyber")
