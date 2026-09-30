const roomInput = document.querySelector('#roomInput');
const joinButton = document.querySelector('#joinButton');
const shareButton = document.querySelector('#shareButton');
const stopButton = document.querySelector('#stopButton');
const preview = document.querySelector('#preview');
const statusEl = document.querySelector('#status');

let socket = null;
let pc = null;
let localStream = null;
let joined = false;
let hostReady = false;
let pageIsBeingUnloaded = false;
const pendingCandidates = [];

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

function setStatus(message, good = false) {
  statusEl.innerHTML = good ? `<strong>${escapeHtml(message)}</strong>` : escapeHtml(message);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function getRoomFromUrl() {
  const room = new URLSearchParams(location.search).get('room');
  return room && /^[A-Za-z0-9_-]{18,64}$/.test(room) ? room : '';
}

async function createSenderPeer() {
  if (pc) pc.close();

  pc = new RTCPeerConnection(rtcConfig);
  pc.onicecandidate = (event) => {
    if (event.candidate) send({ type: 'candidate', candidate: event.candidate });
  };

  pc.onconnectionstatechange = () => {
    if (!pc) return;
    if (pc.connectionState === 'connected') {
      setStatus('Secure peer connection established. Your selected screen is being shared.', true);
    }
    if (pc.connectionState === 'failed') {
      setStatus('Connection failed. Try joining again on a supported HTTPS environment.');
    }
  };

  for (const track of localStream?.getTracks() || []) {
    pc.addTrack(track, localStream);
  }

  await flushPendingCandidates();
}

async function flushPendingCandidates() {
  if (!pc?.remoteDescription) return;
  while (pendingCandidates.length) {
    const candidate = pendingCandidates.shift();
    try { await pc.addIceCandidate(candidate); } catch (error) { console.warn('ICE candidate rejected', error); }
  }
}

function connectSocket(room) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/signal`);

  socket.addEventListener('open', () => {
    send({ type: 'join', room, role: 'guest' });
  });

  socket.addEventListener('message', async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'joined') {
      joined = true;
      hostReady = msg.hasPeer;
      shareButton.disabled = !msg.hasPeer || !isScreenShareSupported();
      setStatus(msg.hasPeer ? 'Connected to the host. You may start sharing.' : 'Waiting for the host to be ready.');
      return;
    }

    if (msg.type === 'peer-ready') {
      hostReady = true;
      shareButton.disabled = !isScreenShareSupported();
      setStatus(isScreenShareSupported()
        ? 'Host is ready. Tap “Start sharing my screen” to continue.'
        : unsupportedMessage());
      return;
    }

    if (msg.type === 'answer') {
      if (!pc) return;
      await pc.setRemoteDescription(msg.sdp);
      await flushPendingCandidates();
      return;
    }

    if (msg.type === 'candidate') {
      if (!pc?.remoteDescription) {
        pendingCandidates.push(msg.candidate);
      } else {
        try { await pc.addIceCandidate(msg.candidate); } catch (error) { console.warn('ICE candidate rejected', error); }
      }
      return;
    }

    if (msg.type === 'peer-left') {
      setStatus('Host ended or left the session.');
      stopSharing(false);
      shareButton.disabled = true;
      return;
    }

    if (msg.type === 'session-expired') {
      setStatus('This session expired. Reload to create/join a new session.');
      stopSharing(false);
      return;
    }

    if (msg.type === 'room-full' || msg.type === 'error') setStatus(msg.message || 'Session error.');
  });

  socket.addEventListener('close', () => {
    if (!pageIsBeingUnloaded) setStatus('Session connection closed.');
  });
}

function isScreenShareSupported() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getDisplayMedia);
}

function unsupportedMessage() {
  return 'This browser cannot capture device screens from the web. For Android whole-screen sharing, use the native sender app in the next stage of this project.';
}

async function startSharing() {
  if (!joined || !hostReady) {
    setStatus('The host is not ready yet.');
    return;
  }

  if (!isScreenShareSupported()) {
    setStatus(unsupportedMessage());
    return;
  }

  try {
    // This call stays directly inside the click handler. The browser/OS must show its permission UI.
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 15, max: 24 },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    preview.srcObject = localStream;
    stopButton.disabled = false;
    shareButton.disabled = true;
    setStatus('Screen capture approved. Connecting to the host…', true);

    await createSenderPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'offer', sdp: pc.localDescription });
    send({ type: 'share-status', active: true });

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => stopSharing(true), { once: true });
    }
  } catch (error) {
    console.error(error);
    setStatus(error.name === 'NotAllowedError'
      ? 'Screen sharing was cancelled or denied. Nothing was shared.'
      : `Screen sharing failed: ${error.message || error.name}`);
  }
}

function stopSharing(notify = true) {
  if (notify) send({ type: 'stop-share' });
  send({ type: 'share-status', active: false });

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  preview.srcObject = null;
  if (pc) {
    try { pc.close(); } catch {}
  }
  pc = null;
  pendingCandidates.length = 0;
  stopButton.disabled = true;
  shareButton.disabled = !joined || !hostReady || !isScreenShareSupported();

  if (!pageIsBeingUnloaded) setStatus('Screen sharing stopped.');
}

function leaveSession() {
  if (pageIsBeingUnloaded) return;
  pageIsBeingUnloaded = true;
  try { send({ type: 'leave' }); } catch {}
  try { stopSharing(false); } catch {}
  try { socket?.close(); } catch {}
}

joinButton.addEventListener('click', () => {
  const room = roomInput.value.trim();
  if (!/^[A-Za-z0-9_-]{18,64}$/.test(room)) {
    setStatus('Enter a valid session code or open the QR link again.');
    return;
  }
  joinButton.disabled = true;
  roomInput.disabled = true;
  setStatus('Connecting to host…');
  connectSocket(room);
});

shareButton.addEventListener('click', startSharing);
stopButton.addEventListener('click', () => stopSharing(true));
window.addEventListener('beforeunload', leaveSession);
window.addEventListener('pagehide', leaveSession);

const initialRoom = getRoomFromUrl();
if (initialRoom) {
  roomInput.value = initialRoom;
  joinButton.click();
} else if (!isScreenShareSupported()) {
  setStatus(unsupportedMessage());
}
