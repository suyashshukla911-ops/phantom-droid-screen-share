# Security Architecture

## Trust boundaries

1. Viewer browser
2. FastAPI signaling service
3. Sender browser
4. WebRTC media path

The signaling service handles session state and signaling metadata. It does not receive or persist the screen media stream at the application layer.

## Authentication

- High-entropy host and guest secrets are generated server-side.
- Credentials are hashed before being held in memory.
- The guest credential is embedded in the URL fragment, not the query string.
- One host and one sender are allowed per session.
- Valid reconnects replace stale sockets using a generation token.
- Sessions expire automatically.

## Authorization

- Pairing does not authorize capture.
- Consent is a staged protocol, not a single blanket dialog.
- The backend rejects screen-share offers until the consent and share-state prerequisites are satisfied.
- The viewer is receive-only.
- No remote control plane exists.

## Browser capture boundary

The web client uses `getDisplayMedia()` only from the explicit sender button. The browser remains responsible for the final capture-source chooser and permission prompt. The application cannot silently create a screen track.

## Privacy

The application intentionally excludes application-level recording, screen-frame storage, camera, microphone, contacts, location, file transfer, shell access, keylogging and persistence.

## Web security

- HTTPS/WSS in deployment
- CSP with no inline runtime scripts
- `frame-ancestors 'none'`
- `nosniff`
- `no-referrer`
- Permissions Policy
- no third-party runtime JavaScript
- `Cache-Control: no-store`
- no credentials in source control

## Threats addressed

- QR/session guessing: high-entropy token + TTL
- stale guest slot: generation-aware reconnect
- cross-site WebSocket abuse: origin validation
- oversized signaling: message-size and rate limits
- unauthorized media direction: role + share-state enforcement
- consent confusion: staged consent with explicit purpose/scope/handling/withdrawal
- accidental persistence: no database and no screen-frame recording

## Residual risks

- STUN-only WebRTC can fail on restrictive NATs; TURN is the next production network control.
- The sender may voluntarily reveal sensitive information by selecting or exposing it in the captured surface.
- Render/infrastructure providers have their own operational logs outside this application's in-memory model.
- The current in-memory session model is intentionally single-instance and is not a multi-region high-availability design.
