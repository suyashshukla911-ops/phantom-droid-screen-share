# Operations Runbook

## Normal session

1. Viewer creates temporary session.
2. QR is generated.
3. Device owner scans QR.
4. Device owner reviews the notice and completes each consent choice.
5. Device owner confirms a second device is present.
6. WebSocket authenticates the device.
7. Host sees "PAIRED".
8. Android sender asks the OS for MediaProjection permission.
9. After approval, WebRTC offer/answer negotiation starts.
10. Host sees the live screen.
11. Stop/leave/refresh/expiry terminates capture.

## If the host says "device paired but no screen"

Check, in order:
1. Device owner completed the separate consent step.
2. Native Android sender app is installed.
3. OS MediaProjection prompt was displayed and approved.
4. Android notification shows the sharing service is active.
5. The viewer console is online.
6. TURN is configured if the networks cannot establish a direct ICE path.

## If "guest slot is occupied"

The server now supports credential-based reconnect. Reopen the original QR link. A valid guest token replaces a stale socket rather than remaining permanently occupied.

## Production controls to add before public scale

- managed TURN with ephemeral credentials
- centralized structured logs with a documented retention policy
- external secret management
- SCA/SBOM and signed release process
- Redis-backed signaling for horizontal scale
- DDoS/rate-limit edge protection
- CI security gates
- formal privacy/legal review
- independent penetration testing
- incident response and breach-notification procedures
