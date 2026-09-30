# Phantom-Droid — Consent-First Browser Screen Mirror

A standalone cybersecurity portfolio project demonstrating **authorized, one-way remote browser screen mirroring** without requiring a native Android application.

## What the demo does

`Viewer creates session -> short-lived QR -> sender browser opens secure link -> staged consent -> browser-native screen-share prompt -> WebRTC -> receive-only viewer`

The live media path is browser-to-browser using WebRTC. The Python service handles temporary sessions, authentication, QR generation and signaling; it does not record the screen stream.

## No-download design

This version intentionally removes the Android APK/Android Studio requirement from the portfolio demo.

- The sender is a normal browser page.
- A supported desktop browser can call the Web Screen Capture API and show the browser's own permission chooser.
- The viewer is receive-only.
- Two browser sessions are required; for a self-demo, they can run on one computer in separate windows/tabs.
- Android/mobile browsers may open and participate in the consent/pairing flow, but a web page cannot be assumed to have whole-device capture capability there. The UI states the capability boundary instead of attempting to bypass the platform.

## Security model

1. **Purpose** — why the screen is being shared.
2. **Scope** — what the selected tab/window/display may expose.
3. **Data handling** — what is transmitted and what is not stored by the application.
4. **Withdrawal** — how the user stops/ends sharing.
5. **Browser authorization** — the browser's own screen-share chooser is the final technical permission gate.
6. **Protocol authorization** — the backend rejects WebRTC offers unless consent is complete and the sender has activated sharing.

### Controls

- high-entropy host and guest credentials
- guest credential in a URL fragment
- 15-minute session TTL by default
- one host / one sender per session
- reconnect generation checks
- staged consent state machine
- offer gating until share is active
- strict WebSocket message allow-list and size/rate limits
- no camera/microphone
- no mouse/keyboard/touch/shell/file-transfer channel
- no server-side screen-frame persistence
- CSP, HSTS in production, X-Frame-Options, Referrer-Policy, Permissions-Policy, CORP and COOP
- bounded in-memory audit trail
- explicit end/leave/expiry semantics

## Run locally

Python 3.11+ is recommended for the deployment target.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-dev.txt
$env:APP_ENV="development"
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

Open:

`http://localhost:8000/cyber/host.html`

## Simple desktop demo

1. Open the viewer page.
2. Click **Open sender here**.
3. In the new tab, complete all four consent stages.
4. Wait for **Viewer connected**.
5. Click **Start browser screen sharing**.
6. In the browser's native chooser, select a demo tab/window/screen and approve it.
7. The viewer receives the live surface.
8. Click **Stop sharing** to revoke the stream.

For the cleanest presentation, click **Open demo surface** on the viewer and share that tab. Its clock/counter/security state visibly changes, making the mirror easy to verify.

## Render

Use a Render **Web Service** with:

```text
Runtime: Python
Build: pip install -r requirements.txt
Start: uvicorn backend.app:app --host 0.0.0.0 --port $PORT
```

The included `render.yaml` keeps the existing public service URL configuration and is suitable for the current Render deployment.

Expected production URLs:

`https://phantom-droid-screen-share.onrender.com/health`

`https://phantom-droid-screen-share.onrender.com/cyber/host.html`

## Limitations and residual work

The current WebRTC configuration uses public STUN only. Some restrictive networks will require TURN for reliable media connectivity. For production-scale use, add short-lived TURN credentials, centralized monitoring, external secrets, SBOM/SCA, stronger edge rate limiting, scalable session state and independent security testing.

This project is a portfolio/security engineering demonstration. It is not a FedRAMP authorization, FISMA authorization, NASA/ISRO certification, or independent security assessment.
