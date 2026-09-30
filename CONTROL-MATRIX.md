# Security Control Evidence Matrix

Engineering mapping only; this is not a certification or authorization claim.

| Domain | Control intent | Evidence |
|---|---|---|
| Identification / Authentication | IA | High-entropy host/sender secrets; credential hashing; authenticated WebSocket join |
| Access Control | AC | One host/one sender; role-specific signaling; viewer receive-only |
| Audit / Accountability | AU | Bounded in-memory session event trail for authentication, pairing, consent, share and teardown |
| Configuration Management | CM | Environment-driven deployment values; versioned `render.yaml` |
| Contingency / Availability | CP | TTL expiry, stale-socket cleanup, explicit teardown |
| Incident Response | IR | Session end/leave/revocation and deterministic state transitions |
| Risk Assessment | RA | Threat model, risk register and residual-risk documentation |
| System & Communications Protection | SC | HTTPS/WSS, WebRTC media path, CSP, permissions policy, no remote control plane |
| System & Information Integrity | SI | Message allow-list, size limits, rate limits, consent/share-state enforcement |
| Privacy / Transparency | PT | Four staged consent steps; data-handling notice; withdrawal control; no application-level screen storage |
| Supply Chain | SA | Pinned Python dependencies and explicit production residual work |
