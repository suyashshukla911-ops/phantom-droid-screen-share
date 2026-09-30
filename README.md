# Phantom-Droid Screen Share Demo

A portfolio-safe, consent-based remote screen-sharing prototype inspired by the QR pairing flow shown in the reference video.

## What this prototype does

- Host opens `host.html` and receives a temporary QR code.
- A participant scans the QR code and joins a single ephemeral room.
- The participant explicitly taps **Start sharing my screen**.
- WebRTC transports the selected screen to the host browser.
- Reloading/leaving ends the session.
- The server stores only transient signaling state in memory; it does not record screen frames.
- The host is receive-only: there is no mouse control, keyboard control, shell access, file transfer, persistence, or hidden access.

## Important browser/platform limitation

The web Screen Capture API requires a secure context and a user gesture. Current browser-compatibility data lists `getDisplayMedia()` as unsupported on Chrome for Android, so this web-only sender cannot capture an Android phone's whole screen.

For a real-phone demonstration, keep this web host/signaling layer and add a native Android sender using Android `MediaProjection`. Android requires the user to approve each capture session. The QR can be used as a deep link into the app, but the app must still present a clear consent step.

## Requirements

- Node.js 20+
- A modern browser for the host
- HTTPS when using screen capture outside localhost
- WebRTC-compatible network path; a TURN server is recommended for production reliability

## Run in VS Code

Open a terminal in this project folder:

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000/
```

## Test the WebRTC flow before Android integration

Open the host page in one desktop browser window:

`http://localhost:3000/cyber/host.html`

Open the generated join link in a second desktop browser window/profile. Because localhost is secure for the local machine, the second desktop browser can request screen capture. This gives you a working end-to-end proof of the signaling and WebRTC flow.

## Testing on a real phone

A phone cannot use `localhost` to reach the desktop server, and screen capture also requires a secure context. Use a deployed HTTPS URL or a secure development tunnel such as Cloudflare Tunnel/ngrok for the web prototype. For Android whole-screen capture, use the native sender app described above.

## Integrating into an existing portfolio

Move `/public/cyber/*` into your site or route the cybersecurity section to `/cyber/host.html`.

The host can also be rendered as a modal or embedded panel. The QR should always point to the public HTTPS origin of the same deployment, e.g.

`https://your-domain.example/cyber/join.html?room=<temporary-room-id>`

Keep the signaling service and the portfolio web app on the same HTTPS origin or configure the appropriate CORS / proxy rules.

## Production hardening

1. Use HTTPS + WSS.
2. Put signaling behind a reverse proxy such as Nginx or a platform proxy.
3. Add rate limiting on WebSocket connections and QR creation.
4. Keep room IDs high entropy and ephemeral.
5. Add a short-lived session expiry and an explicit **End session** button.
6. Add a TURN server for peers that cannot establish a direct path.
7. Do not persist SDP, ICE candidates, screen frames, or user identifiers unless there is a clearly documented product requirement.
8. Add a visible consent screen and never attempt to bypass OS/browser permission prompts.


## Render deployment

This project is designed as a **Render Web Service**, not a static site. It serves the UI and QR endpoint and also terminates the WebSocket signaling endpoint at `/signal`. The server binds to `0.0.0.0` and the `PORT` environment variable.
