# Operations Runbook

## Normal session

1. Viewer creates a temporary session.
2. QR code and join link are generated.
3. Sender browser opens the secure join link.
4. Sender completes the purpose stage.
5. Sender completes the scope stage.
6. Sender completes the data-handling stage.
7. Sender completes the withdrawal stage.
8. Sender completes pairing/authentication.
9. Viewer shows the sender as paired but unauthorized.
10. Sender clicks the browser screen-share button.
11. Browser shows the native screen-share chooser.
12. Sender explicitly chooses a capture surface and approves it.
13. Sender publishes one video track over WebRTC.
14. Viewer receives the screen.
15. Stop/leave/refresh/expiry tears down the session.

## If the viewer says "paired but no screen"

1. Confirm the four consent stages are complete.
2. Confirm the sender is using a browser exposing `navigator.mediaDevices.getDisplayMedia`.
3. Confirm the user actually clicked **Start browser screen sharing**.
4. Confirm the browser's own chooser was approved and a capture source was selected.
5. Confirm the sender preview is showing a live track.
6. Confirm the viewer shows a WebRTC connection.
7. If connection fails, add TURN because STUN-only connectivity is not guaranteed on restrictive networks.

## If the browser cannot screen-share

The UI intentionally explains the limitation. Do not attempt to bypass the browser or operating-system permission boundary. Use a supported desktop browser for the live portfolio demonstration.

## If the sender slot is occupied

Reopen the same short-lived join link. A valid guest credential replaces a stale guest socket. Refreshing the sender page also clears its media capture locally.
