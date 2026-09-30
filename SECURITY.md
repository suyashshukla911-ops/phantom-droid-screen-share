# Security model

This demo is intentionally scoped as a consent-based screen-sharing showcase.

### Data flow

1. Host creates a random, temporary room identifier in the browser.
2. QR encodes only the HTTPS join URL containing the room identifier.
3. WebSocket signaling exchanges SDP/ICE metadata through the Node server.
4. WebRTC carries the media stream between the peers.
5. On refresh, navigation, disconnect, or explicit stop, the capture stream and peer connection are torn down.

### Intentionally excluded

- Silent screen capture
- Hidden persistence
- Remote shell execution
- Keylogging
- Mouse/keyboard control
- File extraction
- Credential collection
- Microphone access
- Camera access
- Session recording

The purpose is to demonstrate security engineering concepts: secure pairing, explicit consent, least privilege, ephemeral sessions, browser permission boundaries, WebRTC signaling, and privacy-aware UX.
