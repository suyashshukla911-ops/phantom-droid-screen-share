# Security Test Plan

## Authentication
- Invalid host credential is rejected.
- Invalid guest token is rejected.
- Guest cannot send host-only messages.
- Host cannot send guest-offer messages.
- Expired sessions cannot authenticate.

## Authorization
- No screen stream exists before OS authorization.
- Guest can stop its own stream.
- Host cannot trigger capture.
- No input/control channel exists.

## Session lifecycle
- Host refresh creates a fresh session.
- Guest refresh releases/reclaims its slot using the same token.
- Host end-session closes the guest.
- Session expires automatically.
- Stale socket cannot displace a newer authenticated connection.

## Web security
- CSP blocks inline scripts and third-party runtime JS.
- Clickjacking protection verified.
- Referrer is suppressed.
- Camera and microphone are denied by Permissions Policy.
- Oversized signaling frames are rejected.
- WebSocket rate limits are enforced.

## Android
- Denying MediaProjection produces no media.
- Stopping from OS notification stops capture.
- Closing the app stops capture.
- Revoking projection permission stops the stream.
- Screen capture foreground-service notification remains visible.

## Privacy
- No database writes.
- No SDP/ICE persistence.
- No screen-frame persistence.
- No application-level recording.
- No camera/microphone permissions.
