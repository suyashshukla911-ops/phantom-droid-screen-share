# Start here

## 1. Open this folder in VS Code

Open the `phantom-droid-screen-share` folder.

## 2. Open the VS Code terminal

Run:

```powershell
node -v
npm -v
npm install
npm start
```

## 3. Open the demo

Go to:

`http://localhost:3000/`

Then select **Create Host Session**.

## 4. Test the complete web flow

Use two desktop browser windows/profiles on the same computer:

- Window A: host page with the QR code.
- Window B: open the QR join URL.
- In Window B, press **Start sharing my screen** and approve the browser prompt.
- Window A should show the remote screen.

This verifies the signaling + WebRTC core without requiring the Android sender.

## 5. Real Android phone

The web sender will show a clear unsupported message on current Chrome-for-Android builds because the Screen Capture API is not available there. Do not try to work around that by hiding permissions.

The correct next step is a native Android sender using `MediaProjection` + `ScreenCapturerAndroid`, paired through the same session/signaling endpoint.

## 6. No terminal for portfolio visitors

The terminal is only for you during local development/server operation. After deployment, visitors interact only with the webpage/app.


## 7. Deploy this standalone demo to Render

Push this folder to its own GitHub repository. In Render, create **New → Web Service**, connect that repository, and use:

- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Plan:** Free is fine for a portfolio prototype

Render web services provide a public HTTPS `onrender.com` URL and support WebSockets. Use the generated HTTPS URL for the host page so the QR link points back to Render automatically.

Example:

`https://YOUR-SERVICE.onrender.com/cyber/host.html`

Do not hard-code the Render URL into the QR logic. The host page already builds its join URL from `window.location.origin`, so the QR code automatically follows the deployed domain.

### Important Android limitation

Deploying the web server makes the **join page** reachable from a phone, but a normal Android browser cannot currently provide whole-device screen capture through this website alone. The next stage is a small Android sender app using Android's screen-capture permission flow and the same signaling server.
