# Android sender build guide

## Purpose

The native sender is the component that makes **whole-device Android screen capture possible**. The web page cannot silently or directly capture an Android device's entire display. The sender requires the Android OS MediaProjection authorization prompt.

## Toolchain

Open `android-sender/` in Android Studio.

- Language: Java
- Android target: SDK 35
- Minimum Android: API 26
- Screen capture: Android MediaProjection
- WebRTC: `com.infobip:google-webrtc:1.0.48246t`
- Signaling: OkHttp WebSocket
- Foreground service: mediaProjection type

The WebRTC artifact is a Google WebRTC Android distribution published by Infobip on Maven Central. Treat it as a third-party supply-chain dependency: pin it, generate an SBOM, review licensing/security advisories, and verify the artifact before production use.

## Build

1. Open `android-sender/` in Android Studio.
2. Let Gradle sync and download dependencies.
3. Use **Build > Make Project**.
4. Install the debug APK on a physical Android device.

This repository does not include a Gradle wrapper binary because the wrapper should be generated/managed by the Android Studio environment used for the build.

## Real test flow

Use two devices:

- Device A: laptop/desktop running the Phantom-Droid Viewer Console.
- Device B: Android phone running the Phantom-Droid Sender.

1. Start a host session on Device A.
2. Display the QR code.
3. Scan it with Device B.
4. The browser join page presents the **specific consent checklist**.
5. Confirm the purpose, scope, ability to withdraw, and second-device requirement.
6. Continue to pairing.
7. After pairing, tap **Open Phantom-Droid Sender**.
8. The native sender displays the same specific consent checklist.
9. Tap **Continue to OS permission**.
10. Android displays its own MediaProjection authorization dialog.
11. Approve the Android system dialog.
12. The sender starts the visible `mediaProjection` foreground service.
13. The sender creates a video-only WebRTC offer.
14. The Viewer Console answers and renders the remote screen.
15. Stop from the visible notification/app or end/leave the session.

A denied OS prompt results in no screen stream.

## Reconnect behavior

Only the same valid guest session credential can replace an existing guest socket. This prevents a stale socket from permanently occupying the session slot.

## Production App Links

The current demo intentionally uses a custom `phantomdroid://join` scheme for a deterministic portfolio test. For a production release, move to verified Android App Links on a domain you control, publish `/.well-known/assetlinks.json`, and bind the release signing certificate/package. Do not ship a placeholder domain.

## WebRTC network reliability

The demo starts with STUN. Some enterprise/carrier/NAT combinations require TURN. For production internet-wide reliability, configure a TURN service with short-lived credentials; never commit permanent TURN credentials into source control.

## Security boundary

The server is a signaling service. It does not record screen frames. The viewer is receive-only. There is no mouse, keyboard, shell, file-transfer, persistence, camera, or microphone feature.
