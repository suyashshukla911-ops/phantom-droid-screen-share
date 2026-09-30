# Security Risk Register

| ID | Risk | Likelihood | Impact | Treatment | Status |
|---|---|---|---|---|---|
| R-01 | QR credential disclosed | Medium | High | High entropy, URL fragment, short TTL, single sender | Mitigated by design |
| R-02 | Unintended screen disclosure | Medium | High | Staged consent + browser-native capture chooser + stop control | Mitigated by design |
| R-03 | Unauthorized media offer | Low | High | Server blocks offers unless share state is active | Mitigated by design |
| R-04 | WebSocket abuse | Medium | Medium | Authentication, allow-list, message limits, rate limiting | Mitigated |
| R-05 | Stale sender connection | Medium | Medium | Generation-aware reconnect and cleanup | Mitigated |
| R-06 | Network cannot establish WebRTC | Medium | High | TURN is the next production control | Residual |
| R-07 | Single-instance failure | Low | High | Ephemeral service now; Redis/HA later | Residual |
| R-08 | Dependency vulnerability | Medium | High | Pin, scan and SBOM before release | Required |
| R-09 | User shares confidential content | Medium | High | Scope warning and explicit surface selection | Residual |
| R-10 | Unsupported platform capability | Medium | Medium | Capability detection and honest UI boundary | Mitigated |
