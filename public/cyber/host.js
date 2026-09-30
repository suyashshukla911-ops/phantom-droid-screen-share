const remoteVideo = document.querySelector('#remoteVideo');
const emptyState = document.querySelector('#emptyState');
const qrImage = document.querySelector('#qrImage');
const sessionCodeEl = document.querySelector('#sessionCode');
const statusText = document.querySelector('#statusText');
const statusDot = document.querySelector('#statusDot');
const viewerHint = document.querySelector('#viewerHint');
const peerBadge = document.querySelector('#peerBadge');
const copyButton = document.querySelector('#copyButton');
const newButton = document.querySelector('#newButton');

const room = createRoomId();
const joinUrl = `${window.location.origin}/cyber/join.html?room=${encodeURIComponent(room)}`;

let socket = null;
let pc = null;
let remoteStream = null;
let pageIsBeingUnloaded = false;
const pendingCandidates = [];

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

function createRoomId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function setStatus(text, kind = 'idle') {
  statusText.textContent = text;
  statusDot.className = `dot ${kind === 'live' ? 'live' : kind === 'warn' ? 'warn' : kind === 'bad' ? 'bad' : ''}`;
}

function setPeerBadge(text, kind = 'idle') {
  peerBadge.innerHTML = `<span class="dot ${kind === 'live' ? 'live' : kind === 'warn' ? 'warn' : kind === 'bad' ? 'bad' : ''}"></span><span>${text}</span>`;
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

async function setupViewerPeer() {
  if (pc) pc.close();

  pc = new RTCPeerConnection(rtcConfig);
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  pc.addTransceiver('video', { direction: 'recvonly' });

  pc.ontrack = (event) => {
    const tracks = event.streams?.[0]?.getTracks?.() || [event.track];
    for (const track of tracks) {
      if (!remoteStream.getTracks().some(existing => existing.id === track.id)) {
        remoteStream.addTrack(track);
      }
    }
    emptyState.hidden = true;
    setStatus('Screen stream live', 'live');
    setPeerBadge('STREAMING', 'live');
    viewerHint.textContent = 'Receiving the paired device screen.';
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) send({ type: 'candidate', candidate: event.candidate });
  };

  pc.onconnectionstatechange = () => {
    if (!pc) return;
    const state = pc.connectionState;
    if (state === 'connected') {
      setStatus('Peer connected', 'live');
      setPeerBadge('CONNECTED', 'live');
    } else if (state === 'disconnected') {
      setStatus('Peer disconnected', 'warn');
      setPeerBadge('DISCONNECTED', 'warn');
    } else if (state === 'failed' || state === 'closed') {
      setStatus('Connection ended', 'bad');
      setPeerBadge('OFFLINE', 'bad');
    }
  };

  await flushPendingCandidates();
}

async function flushPendingCandidates() {
  if (!pc?.remoteDescription) return;
  while (pendingCandidates.length) {
    const candidate = pendingCandidates.shift();
    try { await pc.addIceCandidate(candidate); } catch (error) { console.warn('ICE candidate rejected', error); }
  }
}

function connectSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/signal`);

  socket.addEventListener('open', () => {
    send({ type: 'join', room, role: 'host' });
  });

  socket.addEventListener('message', async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'joined') {
      setStatus(msg.hasPeer ? 'Device paired — waiting for consent' : 'Waiting for device', msg.hasPeer ? 'live' : 'warn');
      setPeerBadge(msg.hasPeer ? 'PAIRED' : 'NO PEER', msg.hasPeer ? 'live' : 'idle');
      viewerHint.textContent = msg.hasPeer
        ? 'The device joined. It must explicitly start screen sharing.'
        : 'Waiting for a device to scan the QR code.';
      return;
    }

    if (msg.type === 'peer-ready') {
      setStatus('Device paired — waiting for consent', 'live');
      setPeerBadge('PAIRED', 'live');
      viewerHint.textContent = 'The device joined. It must explicitly start screen sharing.';
      return;
    }

    if (msg.type === 'offer') {
      await setupViewerPeer();
      await pc.setRemoteDescription(msg.sdp);
      await flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: 'answer', sdp: pc.localDescription });
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

    if (msg.type === 'share-status') {
      viewerHint.textContent = msg.active
        ? 'Device has started sharing its screen.'
        : 'Device joined but screen sharing is stopped.';
      if (!msg.active) setStatus('Screen share stopped', 'warn');
      return;
    }

    if (msg.type === 'peer-left') {
      closePeer();
      setStatus('Device left session', 'warn');
      setPeerBadge('NO PEER', 'idle');
      viewerHint.textContent = 'Waiting for a device to scan the QR code.';
      emptyState.hidden = false;
      return;
    }

    if (msg.type === 'session-expired') {
      alert('This demo session expired. Create a new session.');
      location.reload();
      return;
    }

    if (msg.type === 'error' || msg.type === 'room-full') {
      setStatus(msg.message || 'Session error', 'bad');
    }
  });

  socket.addEventListener('close', () => {
    if (!pageIsBeingUnloaded) setStatus('Signaling disconnected', 'bad');
  });
}

function closePeer() {
  if (pc) {
    try { pc.close(); } catch {}
  }
  pc = null;
  pendingCandidates.length = 0;
  if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
  remoteStream = null;
  remoteVideo.srcObject = null;
}

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(joinUrl);
    copyButton.textContent = 'Copied';
    setTimeout(() => { copyButton.textContent = 'Copy join link'; }, 1400);
  } catch {
    prompt('Copy this join link:', joinUrl);
  }
});

newButton.addEventListener('click', () => {
  cleanup();
  location.href = '/cyber/host.html';
});

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  pageIsBeingUnloaded = true;
  try { send({ type: 'leave' }); } catch {}
  try { socket?.close(); } catch {}
  closePeer();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

sessionCodeEl.textContent = room.toUpperCase();
qrImage.src = `/api/qr?data=${encodeURIComponent(joinUrl)}`;
connectSocket();
