const statusEl = document.querySelector('#status');
const qrImage = document.querySelector('#qrImage');
const sessionCode = document.querySelector('#sessionCode');
const expiryText = document.querySelector('#expiryText');
const copyButton = document.querySelector('#copyButton');
const senderButton = document.querySelector('#senderButton');
const surfaceButton = document.querySelector('#surfaceButton');
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

function escapeHtml(v) {
  return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function setStatus(text, kind='idle') {
  statusEl.innerHTML = `<span class="dot ${kind}"></span><span>${escapeHtml(text)}</span>`;
}
function setPeer(text, kind='') {
  peerBadge.innerHTML = `<span class="dot ${kind}"></span><span>${escapeHtml(text)}</span>`;
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
  const res = await fetch('/api/sessions', {method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store'});
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'Session creation failed.');
  return res.json();
}
function wsUrl() {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/signal`;
}
async function renderQr(joinUrl) {
  const res = await fetch('/api/qr', {
    method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store', body:JSON.stringify({data:joinUrl})
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
  pc.ontrack = event => {
    const tracks = event.streams?.[0]?.getTracks?.() || [event.track];
    for (const track of tracks) if (!remoteStream.getTracks().some(t=>t.id===track.id)) remoteStream.addTrack(track);
    emptyState.hidden = true;
    remoteVideo.play().catch(()=>{});
    setStatus('Live browser mirror','live');
    setPeer('STREAMING','live');
    viewerHint.textContent = 'Receiving the authorized browser surface over WebRTC.';
    logEvent('screen-stream-live','sender');
  };
  pc.onicecandidate = e => { if (e.candidate) send({type:'candidate',candidate:e.candidate}); };
  pc.onconnectionstatechange = () => {
    const state = pc?.connectionState;
    if (state === 'connected') { setStatus('WebRTC peer connected','live'); setPeer('CONNECTED','live'); }
    if (state === 'disconnected') { setStatus('Peer temporarily disconnected','warn'); setPeer('DISCONNECTED','warn'); }
    if (state === 'failed') { setStatus('WebRTC connection failed — TURN may be required on some networks','bad'); setPeer('FAILED','bad'); }
    if (state === 'closed') { setStatus('Peer connection closed','warn'); setPeer('OFFLINE','warn'); }
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
  socket.onopen = () => send({type:'join',role:'host',session:session.session,credential:session.host_secret});
  socket.onmessage = async event => {
    let msg; try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === 'authenticated') {
      setStatus('Viewer waiting for sender','warn');
      logEvent('viewer-authenticated','host');
      return;
    }
    if (msg.type === 'peer-ready') {
      setStatus('Sender paired — awaiting consent','live');
      setPeer('PAIRED','live');
      viewerHint.textContent = 'The sender is paired. Pairing does not authorize screen capture.';
      consentStatus.textContent = 'Sender paired. Waiting for staged consent.';
      logEvent('sender-paired','system');
      return;
    }
    if (msg.type === 'consent-status') {
      const labels = {
        'purpose-confirmed':'Purpose confirmed.',
        'scope-confirmed':'Screen-scope acknowledgement confirmed.',
        'data-handling-confirmed':'Data-handling acknowledgement confirmed.',
        'withdrawal-confirmed':'Withdrawal control acknowledged.',
        'consent-complete':'Web consent sequence completed.',
        'share-permission-granted':'Browser screen-share permission granted.',
        'share-permission-denied':'Browser screen-share permission denied or cancelled.',
        'revoked':'Consent/share withdrawn.'
      };
      consentStatus.textContent = labels[msg.stage] || 'Consent state updated.';
      logEvent(`consent-${msg.stage}`,'guest');
      if (msg.stage === 'share-permission-granted') viewerHint.textContent = 'Capture permission granted. Waiting for the WebRTC video track.';
      if (msg.stage === 'share-permission-denied') viewerHint.textContent = 'Browser capture was denied. The sender can try again.';
      if (msg.stage === 'revoked') {
        closePeer(); setPeer('PAIRED','live'); setStatus('Share stopped — awaiting new authorization','warn');
      }
      return;
    }
    if (msg.type === 'offer') {
      await setupPeer();
      await pc.setRemoteDescription(msg.sdp);
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({type:'answer',sdp:pc.localDescription});
      logEvent('offer-accepted','sender');
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
        viewerHint.textContent = 'Sender has started its authorized screen stream.';
        logEvent('share-active','sender');
      } else {
        closePeer(); setPeer('PAIRED','live'); setStatus('Share stopped — awaiting new authorization','warn');
        viewerHint.textContent = 'The sender remains paired, but no screen is currently shared.';
        logEvent('share-inactive','sender');
      }
      return;
    }
    if (msg.type === 'stop-share') {
      closePeer(); setPeer('PAIRED','live'); setStatus('Share stopped','warn');
      return;
    }
    if (msg.type === 'peer-left') {
      closePeer(); setPeer('NO SENDER',''); setStatus('Sender left the session','warn');
      viewerHint.textContent = 'Waiting for another browser session to join.';
      logEvent('sender-left','guest');
      return;
    }
    if (msg.type === 'session-expired' || msg.type === 'session-ended') {
      closePeer(); setStatus('Session ended','bad'); setPeer('OFFLINE','bad'); logEvent('session-ended','system');
      setTimeout(()=>location.href='/cyber/host.html',900);
      return;
    }
    if (msg.type === 'error') {
      setStatus(msg.message || 'Session error','bad'); logEvent('error','server',msg.message || '');
    }
  };
  socket.onclose = () => { if (!shuttingDown) setStatus('Signaling connection closed','bad'); };
}
function updateExpiry() {
  if (!session) return;
  const left = Math.max(0, session.expires_at*1000 - Date.now());
  const seconds = Math.floor(left/1000);
  expiryText.textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if (left > 0) setTimeout(updateExpiry,1000);
}
copyButton.onclick = async () => {
  try { await navigator.clipboard.writeText(session.join_url); copyButton.textContent='Copied'; setTimeout(()=>copyButton.textContent='Copy join link',1200); }
  catch { window.prompt('Copy the join link:', session.join_url); }
};
senderButton.onclick = () => {
  if (!session?.join_url) return;
  window.open(session.join_url, '_blank', 'noopener,noreferrer');
};
surfaceButton.onclick = () => window.open('/cyber/surface.html', '_blank', 'noopener,noreferrer');
endButton.onclick = () => {
  if (!confirm('End this temporary screen-sharing session now?')) return;
  shuttingDown = true; send({type:'end-session'}); try { socket?.close(); } catch {} closePeer(); location.href='/cyber/host.html';
};
window.addEventListener('beforeunload',()=>{ if(!shuttingDown) { try { send({type:'leave'}); } catch {} } closePeer(); });

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
