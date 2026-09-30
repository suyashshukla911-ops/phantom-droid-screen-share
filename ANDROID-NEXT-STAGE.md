# Android sender: next stage

The real phone workflow needs a native Android sender because current Chrome for Android does not expose `getDisplayMedia()` for whole-device capture.

## Target flow

QR / HTTPS deep link → Android sender opens → session code is loaded → user taps **Start secure screen share** → Android system MediaProjection consent dialog → approved screen is fed to WebRTC → host browser displays the stream.

## Native components

- Kotlin Android app
- Android `MediaProjectionManager` for explicit system consent
- Foreground service with `mediaProjection` service type while capture is active
- WebRTC Android library (`org.webrtc:google-webrtc`) with `ScreenCapturerAndroid`
- The same `/signal` WebSocket endpoint used by the web prototype
- WebRTC STUN/TURN configuration shared with the host

## Why the native app is required

Android protects screen contents with MediaProjection. The OS displays a consent prompt, and modern Android versions require consent for each capture session. A foreground service is also required for long-running media projection on current Android versions.

## Deep linking

For a polished deployment, the QR should eventually use an HTTPS App Link such as:

`https://your-domain.example/cyber/join?room=<room>`

and the Android application should claim that path with Android App Links. The website fallback can remain available for devices without the app.

Do not attempt to bypass the MediaProjection dialog or hide the active sharing state.
