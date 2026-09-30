# Threat Model

## Assets

- live browser display
- session credentials
- signaling metadata
- pairing integrity
- consent state

## Primary threats

### Unwanted screen disclosure
Mitigations: staged consent, native browser capture chooser, explicit start/stop, receive-only viewer, short TTL.

### Session credential leakage
Mitigations: high entropy, guest credential in URL fragment, no-store responses, short expiry and single sender slot.

### Unauthorized signaling
Mitigations: credential-authenticated WebSocket handshake, role allow-list, offer gating and generation-aware reconnects.

### WebSocket abuse
Mitigations: origin validation, authentication before signaling, message-size limit and per-socket rate limit.

### Stale connections
Mitigations: reconnect replacement, generation checks, explicit detach cleanup and session expiry.

### Malicious signaling input
Mitigations: strict message types, SDP/ICE size validation and directional authorization.

### Privacy over-collection
Mitigations: no camera/microphone, no recording, no storage, no remote input, explicit screen-surface choice.

## Residual risks

- Browser support varies by platform.
- TURN is required for some network topologies.
- A user can intentionally share sensitive content.
- Single-instance in-memory state is not HA.
- Public internet exposure still needs edge/DDoS protections and operational monitoring before unrestricted production use.
