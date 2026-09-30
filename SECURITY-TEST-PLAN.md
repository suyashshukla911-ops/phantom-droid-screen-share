# Security Test Plan

## Authentication
- Invalid host credential is rejected.
- Invalid sender token is rejected.
- Expired sessions are rejected.
- Stale sender reconnect can replace its prior socket.

## Consent / Authorization
- Consent stages must be completed in order.
- Screen-share offer is rejected before share activation.
- Viewer cannot create a media offer.
- Sender cannot create the viewer answer.
- Browser capture is requested only from an explicit click handler.

## Session lifecycle
- Host creates a fresh session on refresh.
- Sender leave releases the slot.
- Host end-session closes the sender.
- Session expiration tears down both peers.
- Stop-sharing clears active media state.

## Web security
- CSP blocks inline runtime scripts and third-party execution.
- Clickjacking protection is present.
- Referrer is suppressed.
- Camera/microphone are denied by Permissions Policy.
- Oversized signaling frames are rejected.
- WebSocket message rate limits are enforced.

## Browser capture
- Supported desktop browser shows its native screen-share chooser.
- Cancelling the chooser creates no active media stream.
- Stopping the browser's capture track revokes the session share.
- Unsupported browsers receive a clear platform-capability message.

## Privacy
- No database writes.
- No screen-frame persistence.
- No application-level recording.
- No camera/microphone permissions.
