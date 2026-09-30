const purposeCheck = document.querySelector('#purposeCheck');
const scopeCheck = document.querySelector('#scopeCheck');
const withdrawCheck = document.querySelector('#withdrawCheck');
const twoDeviceCheck = document.querySelector('#twoDeviceCheck');
const continueButton = document.querySelector('#continueButton');
const preStatus = document.querySelector('#preStatus');
const stepConsent = document.querySelector('#stepConsent');
const stepShare = document.querySelector('#stepShare');
const joinLinkInput = document.querySelector('#joinLinkInput');
const pairText = document.querySelector('#pairText');
const shareStatus = document.querySelector('#shareStatus');
const androidActions = document.querySelector('#androidActions');
const webActions = document.querySelector('#webActions');
const openAppButton = document.querySelector('#openAppButton');
const shareButton = document.querySelector('#shareButton');
const stopButton = document.querySelector('#stopButton');
const preview = document.querySelector('#preview');
const leaveButton = document.querySelector('#leaveButton');

let socket = null;
let pc = null;
let localStream = null;
let session = null;
let paired = false;
let hostReady = false;
let closing = false;
const pendingCandidates = [];
const isAndroid = /Android/i.test(navigator.userAgent);

const rtcConfig = { iceServers: [{urls:'stun:stun.l.google.com:19302'}] };

function status(text, good=false){ shareStatus.innerHTML=good ? `<strong>${escapeHtml(text)}</strong>` : escapeHtml(text); }
function escapeHtml(v){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function wsUrl(){ return `${location.protocol==='https:'?'wss':'ws'}://${location.host}/signal`; }
function send(payload){ if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
function hasConsent(){ return purposeCheck.checked && scopeCheck.checked && withdrawCheck.checked && twoDeviceCheck.checked; }
function refreshContinue(){ continueButton.disabled = !hasConsent(); }
[purposeCheck,scopeCheck,withdrawCheck,twoDeviceCheck].forEach(x=>x.addEventListener('change',refreshContinue));

function parseJoinData(input=''){
  let url;
  try { url = new URL(input || location.href); } catch { return null; }
  const sid = url.searchParams.get('session') || '';
  const tokenFromHash = new URLSearchParams((url.hash || '').replace(/^#/, '')).get('token') || '';
  const tokenFromQuery = url.searchParams.get('token') || '';
  const tok = tokenFromHash || tokenFromQuery;
  if (/^[A-Za-z0-9_-]{20,80}$/.test(sid) && tok.length >= 32) return {sid,tok};
  return null;
}
function isScreenShareSupported(){ return Boolean(window.isSecureContext && navigator.mediaDevices?.getDisplayMedia); }

continueButton.onclick = () => {
  const data = parseJoinData(joinLinkInput.value.trim() || '');
  if (!data) {
    preStatus.textContent = 'Invalid or incomplete secure join link. Re-scan the QR code or paste the full link.';
    return;
  }
  session = data;
  stepConsent.hidden = true;
  stepShare.hidden = false;
  status('Specific consent recorded. Connecting to the session…', true);
  sendConsent('notice-accepted');
  sendConsent('consent-checklist-completed');
  connect();
};

function sendConsent(stage){ send({type:'consent-status', stage}); }

function connect(){
  socket = new WebSocket(wsUrl());
  socket.onopen = () => send({type:'join',role:'guest',session:session.sid,credential:session.tok});
  socket.onmessage = async event => {
    let msg; try{msg=JSON.parse(event.data)}catch{return}

    if(msg.type==='authenticated'){
      status('Authenticated to the temporary session.', true);
      return;
    }
    if(msg.type==='peer-ready'){
      paired = true; hostReady = true;
      pairText.textContent = 'Viewer connected. Screen sharing is still OFF.';
      status('Pairing complete. Awaiting the separate screen-share authorization step.');
      if(isAndroid){
        androidActions.hidden = false;
        webActions.hidden = true;
      }else{
        androidActions.hidden = true;
        webActions.hidden = false;
        shareButton.disabled = !isScreenShareSupported();
        if(!isScreenShareSupported()) status('This browser cannot start web screen capture. Use the native Android sender for an Android whole-device demo.');
      }
      return;
    }
    if(msg.type==='answer'){
      if(!pc) return;
      await pc.setRemoteDescription(msg.sdp);
      await flushCandidates();
      status('Secure peer connection established. Your authorized screen is being shared.', true);
      return;
    }
    if(msg.type==='candidate'){
      if(!pc?.remoteDescription) pendingCandidates.push(msg.candidate);
      else try{await pc.addIceCandidate(msg.candidate)}catch{}
      return;
    }
    if(msg.type==='stop-share'){
      stopSharing(false);
      status('Screen sharing stopped.', false);
      return;
    }
    if(msg.type==='peer-left'){
      paired=false; hostReady=false;
      stopSharing(false);
      status('The viewer ended or left the session.');
      return;
    }
    if(msg.type==='session-expired'||msg.type==='session-ended'){
      stopSharing(false);
      status('The temporary session has ended.');
      return;
    }
    if(msg.type==='error'){
      status(msg.message || 'Session error.');
    }
  };
  socket.onclose = () => { if(!closing) status('Session connection closed.'); };
}
async function createPeer(){
  if(pc) pc.close();
  pc=new RTCPeerConnection(rtcConfig);
  pc.onicecandidate=e=>{if(e.candidate)send({type:'candidate',candidate:e.candidate})};
  pc.onconnectionstatechange=()=>{
    if(pc?.connectionState==='connected')status('Secure peer connection established. Your screen is being shared.',true);
    if(pc?.connectionState==='failed')status('WebRTC connection failed. A TURN service may be required on restrictive networks.');
  };
  for(const t of localStream?.getTracks()||[]) pc.addTrack(t,localStream);
}
async function flushCandidates(){
  if(!pc?.remoteDescription)return;
  while(pendingCandidates.length){
    const c=pendingCandidates.shift();
    try{await pc.addIceCandidate(c)}catch{}
  }
}
async function startWebShare(){
  if(!paired||!hostReady)return status('Wait for the viewer to finish pairing.');
  if(!isScreenShareSupported())return status('This browser cannot capture its device screen.');
  try{
    localStream=await navigator.mediaDevices.getDisplayMedia({
      video:{frameRate:{ideal:15,max:24},width:{ideal:1280},height:{ideal:720}},
      audio:false
    });
    preview.srcObject=localStream;
    stopButton.disabled=false; shareButton.disabled=true;
    sendConsent('share-permission-granted');
    await createPeer();
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({type:'offer',sdp:pc.localDescription});
    send({type:'share-status',active:true});
    status('Screen capture authorized and connecting to viewer.',true);
    const track=localStream.getVideoTracks()[0];
    track?.addEventListener('ended',()=>stopSharing(true),{once:true});
  }catch(error){
    sendConsent('share-permission-denied');
    status(error?.name==='NotAllowedError'?'Screen sharing was denied or cancelled. Nothing was shared.':`Screen sharing failed: ${error?.message||error}`);
  }
}
function stopSharing(notify=true){
  if(notify){send({type:'stop-share'});send({type:'share-status',active:false});sendConsent('revoked');}
  localStream?.getTracks().forEach(t=>t.stop());
  localStream=null;
  preview.srcObject=null;
  if(pc)try{pc.close()}catch{}
  pc=null;
  pendingCandidates.length=0;
  stopButton.disabled=true;
  shareButton.disabled=!paired||!hostReady||!isScreenShareSupported();
}
shareButton?.addEventListener('click',startWebShare);
stopButton?.addEventListener('click',()=>stopSharing(true));
leaveButton?.addEventListener('click',()=>{
  closing=true; try{send({type:'leave'})}catch{}; stopSharing(false); try{socket?.close()}catch{}; location.href='/cyber/join.html';
});

openAppButton?.addEventListener('click',()=>{
  if(!session) return status('No secure session is loaded.');
  const server=encodeURIComponent(location.origin);
  const fallback=`${location.origin}/cyber/join.html?session=${encodeURIComponent(session.sid)}#token=${encodeURIComponent(session.tok)}`;
  const intent=`intent://join?server=${server}&session=${encodeURIComponent(session.sid)}&token=${encodeURIComponent(session.tok)}#Intent;scheme=phantomdroid;package=com.suyashshukla.phantomdroid;end`;

  status('Handing the guest session to the native sender app…');
  closing=true;
  try { send({type:'leave'}); } catch {}
  try { socket?.close(); } catch {}

  // Give the signaling server a moment to release the guest slot before
  // the native sender reconnects with the same credential.
  setTimeout(()=>{
    window.location.href=intent;
    setTimeout(()=>{
      status(`If the sender app did not open, install it and reopen the secure link: ${fallback}`);
    },1400);
  },160);
});

const initial=parseJoinData();
if(initial){
  // Do not auto-consent or auto-join. The visitor must make the consent choices.
}
joinLinkInput.addEventListener('change', () => {
  const data = parseJoinData(joinLinkInput.value.trim());
  if (data) preStatus.textContent = 'Secure join link recognized. Complete the consent choices above.';
});
