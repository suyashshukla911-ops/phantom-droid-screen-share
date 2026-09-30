const statusEl = document.querySelector('#status');
const qrImage = document.querySelector('#qrImage');
const sessionCode = document.querySelector('#sessionCode');
const expiryText = document.querySelector('#expiryText');
const copyButton = document.querySelector('#copyButton');
const endButton = document.querySelector('#endButton');
const consentStatus = document.querySelector('#consentStatus');
const auditTrail = document.querySelector('#auditTrail');
const peerBadge = document.querySelector('#peerBadge');
const viewerHint = document.querySelector('#viewerHint');
const remoteVideo = document.querySelector('#remoteVideo');
const emptyState = document.querySelector('#emptyState');

let socket = null;
let pc = null;
let remoteStream = null;
let session = null;
let shuttingDown = false;
const pendingCandidates = [];

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function setStatus(text, kind='idle') {
  statusEl.innerHTML = `<span class="dot ${kind}"></span><span>${escapeHtml(text)}</span>`;
}
function setPeer(text, kind='') {
  peerBadge.innerHTML = `<span class="dot ${kind}"></span><span>${escapeHtml(text)}</span>`;
}
function escapeHtml(v) {
  return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function logEvent(event, role='system', metadata='') {
  const row = document.createElement('div');
  row.className = 'audit-item';
  const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  row.innerHTML = `<time>${time}</time><span>${escapeHtml(role)} · ${escapeHtml(event)}${metadata ? ` · ${escapeHtml(metadata)}` : ''}</span>`;
  auditTrail.prepend(row);
}
function send(payload) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
async function createSession() {
  const res = await fetch('/api/sessions', {method:'POST', headers:{'Content-Type':'application/json'}});
  if (!res.ok) throw new Error('Session creation failed.');
  return res.json();
}
function wsUrl() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/signal`;
}
async function renderQr(joinUrl) {
  const res = await fetch('/api/qr', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    cache: 'no-store',
    body: JSON.stringify({data: joinUrl})
  });
  if (!res.ok) throw new Error('QR generation failed.');
  const blob = await res.blob();
  if (qrImage.dataset.objectUrl) URL.revokeObjectURL(qrImage.dataset.objectUrl);
  const objectUrl = URL.createObjectURL(blob);
  qrImage.dataset.objectUrl = objectUrl;
  qrImage.src = objectUrl;
}
async function setupPeer() {
  closePeer();
  pc = new RTCPeerConnection(rtcConfig);
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;
  pc.addTransceiver('video', {direction:'recvonly'});
  pc.ontrack = (event) => {
    const tracks = event.streams?.[0]?.getTracks?.() || [event.track];
    for (const track of tracks) if (!remoteStream.getTracks().some(t => t.id === track.id)) remoteStream.addTrack(track);
    emptyState.hidden = true;
    remoteVideo.play().catch(()=>{});
    setStatus('Live screen stream', 'live');
    setPeer('STREAMING', 'live');
    viewerHint.textContent = 'Receiving the authorized device screen over WebRTC.';
    logEvent('screen-stream-live','guest');
  };
  pc.onicecandidate = e => { if (e.candidate) send({type:'candidate', candidate:e.candidate}); };
  pc.onconnectionstatechange = () => {
    const state = pc?.connectionState;
    if (state === 'connected') { setStatus('Peer connected','live'); setPeer('CONNECTED','live'); }
    if (state === 'disconnected') { setStatus('Peer disconnected','warn'); setPeer('DISCONNECTED','warn'); }
    if (state === 'failed' || state === 'closed') { setStatus('Connection ended','bad'); setPeer('OFFLINE','bad'); }
  };
}
async function flushCandidates() {
  if (!pc?.remoteDescription) return;
  while (pendingCandidates.length) {
    const c = pendingCandidates.shift();
    try { await pc.addIceCandidate(c); } catch {}
  }
}
function closePeer() {
  if (pc) try { pc.close(); } catch {}
  pc = null;
  pendingCandidates.length = 0;
  if (remoteStream) remoteStream.getTracks().forEach(t=>t.stop());
  remoteStream = null;
  remoteVideo.srcObject = null;
  emptyState.hidden = false;
}
function connect() {
  socket = new WebSocket(wsUrl());
  socket.onopen = () => send({type:'join', role:'host', session:session.session, credential:session.host_secret});
  socket.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === 'authenticated') {
      setStatus('Viewer waiting for a device','warn');
      logEvent('host-authenticated','host');
      return;
    }
    if (msg.type === 'peer-ready') {
      setStatus('Device paired — awaiting consent','live');
      setPeer('PAIRED','live');
      viewerHint.textContent = 'The device paired. No screen is visible until the owner grants separate screen-share authorization.';
      consentStatus.textContent = 'Device paired. Waiting for specific consent.';
      logEvent('device-paired','system');
      return;
    }
    if (msg.type === 'consent-status') {
      const labels = {
        'notice-accepted':'Consent notice acknowledged.',
        'consent-checklist-completed':'All specific consent checklist items completed.',
        'share-permission-granted':'Operating-system screen-share permission granted.',
        'share-permission-denied':'Operating-system screen-share permission denied.',
        'revoked':'Consent/share withdrawn.'
      };
      consentStatus.textContent = labels[msg.stage] || 'Consent state updated.';
      logEvent(`consent-${msg.stage}`,'guest');
      if (msg.stage === 'share-permission-granted') {
        viewerHint.textContent = 'Permission granted. Waiting for the WebRTC video track.';
      }
      if (msg.stage === 'revoked') {
        closePeer();
        setPeer('PAIRED','live');
        setStatus('Share stopped — awaiting new authorization','warn');
      }
      return;
    }
    if (msg.type === 'offer') {
      await setupPeer();
      await pc.setRemoteDescription(msg.sdp);
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({type:'answer', sdp:pc.localDescription});
      logEvent('offer-accepted','guest');
      return;
    }
    if (msg.type === 'candidate') {
      if (!pc?.remoteDescription) pendingCandidates.push(msg.candidate);
      else try { await pc.addIceCandidate(msg.candidate); } catch {}
      return;
    }
    if (msg.type === 'share-status') {
      if (msg.active) {
        setStatus('Authorized stream in progress','live');
        viewerHint.textContent = 'Device has started its authorized screen stream.';
        logEvent('share-active','guest');
      } else {
        closePeer();
        setPeer('PAIRED','live');
        setStatus('Share stopped — awaiting new authorization','warn');
        viewerHint.textContent = 'The device is still paired, but no screen is currently shared.';
        logEvent('share-inactive','guest');
      }
      return;
    }
    if (msg.type === 'stop-share') {
      closePeer();
      setPeer('PAIRED','live');
      setStatus('Share stopped','warn');
      return;
    }
    if (msg.type === 'peer-left') {
      closePeer();
      setPeer('NO DEVICE','');
      setStatus('Device left the session','warn');
      consentStatus.textContent = 'Waiting for the device owner.';
      viewerHint.textContent = 'Waiting for another device to join.';
      logEvent('device-left','guest');
      return;
    }
    if (msg.type === 'session-expired' || msg.type === 'session-ended') {
      closePeer();
      setStatus('Session ended','bad');
      setPeer('OFFLINE','bad');
      logEvent('session-ended','system');
      setTimeout(()=>location.href='/cyber/host.html',1200);
      return;
    }
    if (msg.type === 'error') {
      setStatus(msg.message || 'Session error','bad');
      logEvent('error','server',msg.message || '');
    }
  };
  socket.onclose = () => {
    if (!shuttingDown) setStatus('Signaling connection closed','bad');
  };
}
function updateExpiry() {
  if (!session) return;
  const left = Math.max(0, session.expires_at * 1000 - Date.now());
  const seconds = Math.floor(left/1000);
  expiryText.textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if (left === 0) return;
  setTimeout(updateExpiry,1000);
}
copyButton.onclick = async () => {
  try { await navigator.clipboard.writeText(session.join_url); copyButton.textContent='Copied'; setTimeout(()=>copyButton.textContent='Copy join link',1200); }
  catch { window.prompt('Copy the join link:', session.join_url); }
};
endButton.onclick = () => {
  if (!confirm('End this temporary screen-sharing session now?')) return;
  shuttingDown = true;
  send({type:'end-session'});
  try { socket?.close(); } catch {}
  closePeer();
  location.href='/cyber/host.html';
};
window.addEventListener('beforeunload',()=> {
  if (!shuttingDown) { try { send({type:'leave'}); } catch {} }
  closePeer();
});

(async function init(){
  try {
    session = await createSession();
    sessionCode.textContent = session.session.toUpperCase();
    await renderQr(session.join_url);
    logEvent('session-created','host');
    updateExpiry();
    connect();
  } catch (e) {
    setStatus(e.message || 'Unable to create session','bad');
  }
})();
