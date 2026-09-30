# Security Control Evidence Matrix

This matrix is an engineering mapping, not a FedRAMP certification claim.

| Domain | Example NIST/FedRAMP-aligned control intent | Evidence in this project |
|---|---|---|
| Identification / Authentication | IA family | High-entropy host/guest secrets; credential hashing; role-aware WebSocket authentication |
| Access Control | AC family | One host/one guest; role-specific signaling; no remote control plane |
| Audit / Accountability | AU family | In-memory event trail for create/auth/pair/consent/share/leave/expiry; no screen-content logging |
| Configuration Management | CM family | Environment-driven deployment settings; no hard-coded production credential |
| Contingency / Availability | CP family | Session expiry; stale-socket cleanup; explicit teardown |
| Incident Response | IR family | Explicit end-session, peer-left and expiry state transitions |
| Planning / Governance | PL / PM families | Security boundary, threat model, control matrix and privacy documents |
| Risk Assessment | RA family | Threats and limitations documented; TURN dependency explicitly identified |
| System & Communications Protection | SC family | HTTPS/WSS, WebRTC encryption, CSP, permissions policy, receive-only media |
| System & Information Integrity | SI family | Message validation, size limits, rate limits, strict signaling direction |
| PII Processing / Transparency | PT family | Specific notice and consent stages; data minimization; no application-level screen-frame storage |
| Supply Chain | SA family | Dependencies listed in lockable package manifests; external Android WebRTC binary clearly identified |
