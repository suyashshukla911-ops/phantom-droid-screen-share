# Portfolio integration plan

The portfolio should treat this as a cybersecurity demonstration module, not as a generic remote-control tool.

## UI trigger

When the visitor opens the **Cybersecurity** section, show a clean panel with:

- `Launch QR Screen Share Demo`
- A visible security warning: scanning a QR code can be risky; only scan trusted codes.
- A generated QR code and a short-lived session indicator.
- A receive-only remote screen panel.
- `End session` control.

## Behaviour

1. Host view creates an ephemeral session.
2. QR contains only the temporary join URL.
3. Phone joins the session.
4. Phone shows explicit consent before capture.
5. Host displays the WebRTC stream.
6. Refresh / page exit / explicit stop tears down the connection.

## Important UX rule

Do not make the QR look like an anonymous or unexplained credential. Label exactly what it does and show the same warning on both the host and sender surfaces.

## Later native Android integration

The host UI can stay almost unchanged. Only the sender changes from the web `getDisplayMedia()` implementation to the Android MediaProjection/WebRTC sender.
