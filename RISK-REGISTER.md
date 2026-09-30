# Security Risk Register

| ID | Risk | Likelihood | Impact | Treatment | Status |
|---|---|---|---|---|---|
| R-01 | QR token disclosed | Medium | High | High entropy, URL fragment, 15-minute expiry, single guest | Mitigated |
| R-02 | Same-device self-share confusion | Medium | Medium | Explicit second-device acknowledgement | Mitigated |
| R-03 | Unauthorized screen sharing | Low | High | Specific consent + OS MediaProjection authorization + no hidden capture | Mitigated by design |
| R-04 | WebSocket spam | Medium | Medium | Auth-before-signaling, message limits, creation rate limit | Mitigated |
| R-05 | Stale socket blocks guest slot | Medium | Medium | Credential-based reconnect + heartbeat + generation checks | Mitigated |
| R-06 | Restrictive network blocks WebRTC | Medium | High | TURN configuration hook | Residual |
| R-07 | Single-instance failure | Low | High | Stateless media + ephemeral memory; future Redis/multi-region | Residual |
| R-08 | Dependency vulnerability | Medium | High | Pin/scan/SBOM before release | Required |
| R-09 | User voluntarily shares confidential content | Medium | High | Pre-share warning; stop control; viewer is receive-only | Residual |
| R-10 | False compliance claim | Low | High | Explicit compliance-boundary document | Mitigated |
