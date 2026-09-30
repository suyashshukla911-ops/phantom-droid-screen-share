# Deployment Runbook

## Source of truth

GitHub repository: `suyashshukla911-ops/phantom-droid-screen-share`
Branch: `main`

## Render

Keep the existing service:

`phantom-droid-screen-share`

Public URL:

`https://phantom-droid-screen-share.onrender.com`

Settings:

```text
Runtime: Python
Root Directory: blank
Build Command: pip install -r requirements.txt
Start Command: uvicorn backend.app:app --host 0.0.0.0 --port $PORT
```

Recommended environment values:

```text
APP_ENV=production
PUBLIC_ORIGIN=https://phantom-droid-screen-share.onrender.com
ALLOWED_ORIGINS=https://phantom-droid-screen-share.onrender.com
SESSION_TTL_SECONDS=900
CREATE_RATE_LIMIT=6
MAX_ACTIVE_SESSIONS=250
```

## Post-deploy checks

1. Open `/health` and confirm `ok: true`.
2. Open `/cyber/host.html` and confirm QR renders.
3. Use **Open sender here** for a no-install desktop test.
4. Complete all consent stages.
5. Confirm the browser screen-share chooser appears after the explicit button click.
6. Select a demo tab/window/screen and approve it.
7. Confirm the viewer shows `STREAMING` and the remote video.
8. Stop sharing and confirm the viewer returns to the offline state.
9. End the session and confirm the sender is disconnected.

## Render troubleshooting

If Render logs show `npm start`, `node server.js`, or a missing `package.json`, the service is still configured as the old Node runtime. Change the service runtime to Python and use the two commands shown above.

Render's FastAPI pattern is a Python web service with `pip install -r requirements.txt` and `uvicorn ... --host 0.0.0.0 --port $PORT`.
