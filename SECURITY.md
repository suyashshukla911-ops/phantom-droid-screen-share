# Security Architecture

## Trust boundaries

1. Viewer browser
2. FastAPI signaling service
3. Android sender
4. WebRTC media path

The signaling server routes SDP/ICE metadata and session state. It does not receive or persist screen frames.

## Authentication

- Host credential: 256-bit-equivalent random URL-safe secret generated server-side.
- Guest credential: separate high-entropy token embedded in the temporary QR/link.
- Credentials are hashed before being held in the server process.
- One host and one guest per session.
- Reconnect with the same valid credential replaces the old socket.
- Sessions expire automatically.

## Authorization

- Host may create/end a session and receive the media.
- Guest may offer video and change their own consent/share state.
- Host cannot request hidden capture.
- Signaling direction is enforced by role.
- No remote control channel exists.

## Privacy

The application intentionally excludes application-level recording, screen-frame storage, camera, microphone, file transfer, shell access, keylogging and persistence. Infrastructure providers may have their own operational/network logs; those are outside the application's in-memory storage model.

## Web security controls

- HTTPS/WSS in deployment
- CSP
- `frame-ancestors 'none'`
- `nosniff`
- `no-referrer`
- Permissions Policy
- click-driven Web APIs only
- no inline scripts
- no third-party runtime JavaScript
- no credentials in source control

## Threats addressed

- QR/session guessing: high-entropy tokens + TTL
- stale "room occupied": idempotent credential-based reconnect
- cross-site WebSocket abuse: origin validation
- oversized signaling: request/message limits
- unauthorized media direction: role-based signaling
- consent confusion: staged UI + OS permission
- same-device QR misuse: explicit second-device requirement
- accidental persistence: no database and no media recording
