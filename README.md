# Phantom-Droid — Consent-First Remote Android Screen Share

A standalone cybersecurity portfolio project demonstrating **authorized, one-way remote Android screen sharing**.

## Architecture

- **Python + FastAPI** — session management, authentication, authorization, QR generation and WebSocket signaling.
- **HTML/CSS + minimal JavaScript** — viewer/device UX and browser WebRTC integration. Browser code is unavoidable for a web client.
- **Java Android sender** — Android MediaProjection + WebRTC video capture.
- **WebRTC** — media path between the sender and receive-only viewer.
- **Render Web Service** — hosts the Python application and WebSocket signaling endpoint.

## Core workflow

`Viewer creates session -> short-lived QR -> phone opens join page -> explicit consent checklist -> phone pairs -> native sender -> Android OS MediaProjection prompt -> user approves -> live screen appears in viewer`

Pairing is deliberately **not** authorization.

## Consent model

There are separate stages:

1. **Specific purpose consent** — share the live device screen for this session.
2. **Scope acknowledgement** — the whole visible display can be shared, including visible notifications/private content.
3. **Withdrawal acknowledgement** — the owner can stop at any time; leaving/refreshing ends the web session.
4. **Second-device acknowledgement** — the phone is the sender and a separate device is the viewer.
5. **Operating-system authorization** — Android's MediaProjection dialog is a separate technical permission step.
6. **Visible ongoing status** — the Android sender uses a foreground-service notification with a stop action.

No screen is captured until the owner completes the consent flow and approves the Android OS prompt.

## Security controls implemented

- high-entropy host and guest credentials
- credential hashes held in memory
- credential in QR URL fragment rather than ordinary query logs
- 15-minute session TTL by default
- one host/one guest
- credential-aware reconnect for stale socket replacement
- role-enforced signaling direction
- WebSocket origin validation
- message size/rate limits
- no server-side media recording
- no camera/microphone
- no mouse/keyboard/touch control plane
- no shell/file transfer/persistence
- CSP, HSTS in production, X-Frame-Options, Referrer-Policy, Permissions-Policy, CORP and COOP
- in-memory, bounded security event trail
- explicit session end/expiry/leave behavior
- Android foreground-service screen-share indicator

## Run locally

Python 3.11+:

For development/test dependencies:
`pip install -r requirements-dev.txt`


```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:APP_ENV="development"
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

Open:

`http://localhost:8000/cyber/host.html`

## Render

Use a Render **Web Service**:

```text
Build command: pip install -r requirements.txt
Start command: uvicorn backend.app:app --host 0.0.0.0 --port $PORT
Runtime: Python
```

Set:

```text
APP_ENV=production
PUBLIC_ORIGIN=https://YOUR-SERVICE.onrender.com
ALLOWED_ORIGINS=https://YOUR-SERVICE.onrender.com
SESSION_TTL_SECONDS=900
```

Do not commit secrets.

## Android test

Two devices are required:

- Device A: viewer console.
- Device B: Android sender.

Scan the QR on Device B, complete the specific consent checklist, open the native sender, and approve Android's MediaProjection prompt.

## Important compliance boundary

This is a portfolio/security engineering demonstration. It is **not** a FedRAMP authorization, FISMA authorization, NASA/ISRO certification, or independent security assessment.

The repository contains a threat model, control matrix, security test plan, runbook, risk register, privacy notice, legal/framework notes and demo script so the implementation can be discussed with a CISO in terms of evidence, residual risk and future controls.

## Residual production work

Before calling the service production-grade for unrestricted internet use, add:

- TURN with short-lived credentials
- centralized monitoring/alerting
- SBOM/SCA and dependency provenance
- external secret management
- scalable shared session state
- release-signing and Android App Links
- penetration testing and independent assessment
- documented incident response and retention policy
- formal legal review for the exact deployment and user population

## Verification

Run `pytest -q` after installing the development dependencies. The suite covers session creation, credential-authenticated WebSocket pairing, consent event forwarding and enforcement of guest/host signaling direction.
