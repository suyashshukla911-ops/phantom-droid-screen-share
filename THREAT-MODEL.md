# Threat Model

## Assets

- live device display
- session authorization credentials
- signaling metadata
- viewer availability
- integrity of the pairing flow

## Primary threats

### Unwanted screen disclosure
Mitigations: staged consent, OS MediaProjection permission, explicit start/stop controls, short TTL.

### Session token leakage
Mitigations: high-entropy credentials, QR contains no personal data, no-store headers, short expiry, single guest slot, no server persistence.

### WebSocket abuse
Mitigations: origin checking, authentication before signaling, rate limits, message size limits.

### Stale connections
Mitigations: heartbeat, idempotent reconnect, generation checks, explicit detach cleanup.

### Malicious input through signaling
Mitigations: strict message allow-list, role-based message direction, bounded SDP/ICE size.

### Privacy over-collection
Mitigations: no app-level recording, camera/mic disabled by Permissions Policy, no remote input or shell capabilities.

## Known residual risks

- Browser/Android media APIs and OEM behavior vary.
- WebRTC may require TURN on restrictive networks.
- Render or TURN providers have their own infrastructure logs and controls.
- A user can voluntarily share confidential information by leaving it visible on the screen.
- A single-instance in-memory deployment is not a multi-region HA architecture.

## Security testing plan

Before production exposure:
- SAST
- dependency scanning
- WebSocket fuzzing
- authorization tests
- abuse/rate-limit tests
- Android permission/revocation tests
- network failure / ICE failure tests
- browser compatibility tests
- privacy review
- independent penetration test
