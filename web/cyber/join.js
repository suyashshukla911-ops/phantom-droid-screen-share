const stepNumber = document.querySelector('#stepNumber');
const stepTitle = document.querySelector('#stepTitle');
const stepBody = document.querySelector('#stepBody');
const stepCalloutTitle = document.querySelector('#stepCalloutTitle');
const stepCalloutText = document.querySelector('#stepCalloutText');
const stepContinue = document.querySelector('#stepContinue');
const progressDots = [1,2,3,4].map(i=>document.querySelector(`#p${i}`));
const consentFlow = document.querySelector('#consentFlow');
const pairingArea = document.querySelector('#pairingArea');
const pairStatus = document.querySelector('#pairStatus');
const unsupportedBox = document.querySelector('#unsupportedBox');
const supportedActions = document.querySelector('#supportedActions');
const shareButton = document.querySelector('#shareButton');
const stopButton = document.querySelector('#stopButton');
const preview = document.querySelector('#preview');
const shareStatus = document.querySelector('#shareStatus');
const leaveButton = document.querySelector('#leaveButton');
const preStatus = document.querySelector('#preStatus');

let socket = null;
let pc = null;
let localStream = null;
let session = null;
let paired = false;
let shuttingDown = false;
const pendingCandidates = [];
const outbox = [];

const rtcConfig = { iceServers: [{urls:'stun:stun.l.google.com:19302'}] };
const isScreenShareSupported = Boolean(window.isSecureContext && navigator.mediaDevices?.getDisplayMedia);

const steps = [
  {
    title:'Purpose',
    body:'This session exists only to demonstrate consent-controlled remote screen viewing. It is temporary and can be ended by leaving, refreshing or by the viewer.',
    callout:'Specific purpose',
    text:'I understand that my live display is being shared only for this session and this demonstration.'
  },
  {
    title:'Scope',
    body:'The browser may share a tab, window or display surface that you explicitly choose. Anything visible on the selected surface may be seen by the remote viewer.',
    callout:'Specific scope',
    text:'I understand that notifications, private information and other visible content on my selected surface may be exposed.'
  },
  {
    title:'Data handling',
    body:'The application does not record the screen at the signaling server, and this viewer has no camera, microphone, keyboard, touch, shell or file-transfer channel.',
    callout:'Data minimization',
    text:'I understand what is transmitted for this demonstration and that the application does not intentionally persist the live screen stream.'
  },
  {
    title:'Withdrawal',
    body:"Sharing is voluntary. The browser's own permission prompt is the final technical gate. You can stop sharing from the browser/session at any time.",
    callout:'Control remains with you',
    text:'I understand how to stop sharing and that stopping/refreshing/leaving ends the active share.'
  }
];
let stepIndex = 0;

function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function status(text,good=false){ shareStatus.innerHTML=good?`<strong>${escapeHtml(text)}</strong>`:escapeHtml(text); }
function wsUrl(){return `${location.protocol==='https:'?'wss':'ws'}://${location.host}/signal`;}
function send(payload){
  if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify(payload));
  else outbox.push(payload);
}
function flushOutbox(){
  while(socket?.readyState===WebSocket.OPEN && outbox.length) socket.send(JSON.stringify(outbox.shift()));
}
function parseJoinData(input=''){
  let url; try{url=new URL(input||location.href)}catch{return null}
  const sid=url.searchParams.get('session')||'';
  const token=new URLSearchParams((url.hash||'').replace(/^#/, '')).get('token')||'';
  if(!/^[A-Za-z0-9_-]{20,80}$/.test(sid)||!/^[A-Za-z0-9_-]{32,120}$/.test(token))return null;
  return {sid,tok:token};
}
function renderStep(){
  const s=steps[stepIndex];
  stepNumber.textContent=String(stepIndex+1).padStart(2,'0');
  stepTitle.textContent=s.title;
  stepBody.textContent=s.body;
  stepCalloutTitle.textContent=s.callout;
  stepCalloutText.textContent=s.text;
  progressDots.forEach((dot,i)=>dot.classList.toggle('active',i===stepIndex));
  stepContinue.textContent=stepIndex===steps.length-1?'Complete consent and pair':'I understand — continue';
}
function connect(){
  if(socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) return;
  socket=new WebSocket(wsUrl());
  socket.onopen=()=>{
    socket.send(JSON.stringify({type:'join',role:'guest',session:session.sid,credential:session.tok}));
    flushOutbox();
  };
  socket.onmessage=async event=>{
    let msg;try{msg=JSON.parse(event.data)}catch{return}
    if(msg.type==='authenticated'){preStatus.textContent='Authenticated to the short-lived session. Capture is still OFF.';return;}
    if(msg.type==='peer-ready'){
      paired=true;
      pairStatus.innerHTML='<span class="dot live"></span><strong>Viewer connected. Capture remains OFF.</strong>';
      status('Pairing complete. Complete the final browser permission step when ready.');
      if(isScreenShareSupported){unsupportedBox.hidden=true;supportedActions.hidden=false;shareButton.disabled=false;}
      else {unsupportedBox.hidden=false;supportedActions.hidden=true;status('This browser cannot initiate web screen capture. No application is required; use a supported desktop browser for the live mirror.');}
      return;
    }
    if(msg.type==='answer'){
      if(!pc)return;
      await pc.setRemoteDescription(msg.sdp);await flushCandidates();status('WebRTC peer connection established. The authorized browser surface is being shared.',true);return;
    }
    if(msg.type==='candidate'){
      if(!pc?.remoteDescription)pendingCandidates.push(msg.candidate);else try{await pc.addIceCandidate(msg.candidate)}catch{}
      return;
    }
    if(msg.type==='stop-share'){stopSharing(false);status('The viewer closed the share.');return;}
    if(msg.type==='peer-left'){paired=false;stopSharing(false);pairStatus.innerHTML='<span class="dot warn"></span><strong>Viewer left. Capture is stopped.</strong>';return;}
    if(msg.type==='session-expired'||msg.type==='session-ended'){stopSharing(false);status('The temporary session has ended.');setTimeout(()=>location.href='/cyber/join.html',900);return;}
    if(msg.type==='error'){status(msg.message||'Session error.');}
  };
  socket.onclose=()=>{if(!shuttingDown)status('Signaling connection closed.');};
}
function sendConsent(stage){send({type:'consent-status',stage});}
stepContinue.onclick=()=>{
  const data=parseJoinData();
  if(!data){preStatus.textContent='Invalid or incomplete secure join link.';return;}
  if(!session) session=data;
  if(stepIndex<steps.length-1){
    const stage=['purpose-confirmed','scope-confirmed','data-handling-confirmed','withdrawal-confirmed'][stepIndex];
    connect();
    sendConsent(stage);
    stepIndex+=1;
    renderStep();
    preStatus.textContent='Consent recorded for this stage. Capture is still OFF.';
    return;
  }
  connect();
  sendConsent('consent-complete');
  consentFlow.hidden=true;
  pairingArea.hidden=false;
  preStatus.textContent='Consent sequence completed. Waiting for the viewer and the browser capture permission step.';
};

async function createPeer(){
  if(pc)pc.close();
  pc=new RTCPeerConnection(rtcConfig);
  pc.onicecandidate=e=>{if(e.candidate)send({type:'candidate',candidate:e.candidate})};
  pc.onconnectionstatechange=()=>{
    if(pc?.connectionState==='connected')status('WebRTC connected. Live screen is being shared.',true);
    if(pc?.connectionState==='failed')status('WebRTC connection failed. The networks may require TURN relay configuration.');
  };
  for(const track of localStream?.getTracks()||[])pc.addTrack(track,localStream);
}
async function flushCandidates(){
  if(!pc?.remoteDescription)return;
  while(pendingCandidates.length){const c=pendingCandidates.shift();try{await pc.addIceCandidate(c)}catch{}}
}
async function startWebShare(){
  if(!paired)return status('Wait until the viewer is connected.');
  if(!isScreenShareSupported)return status('This browser does not support browser screen sharing.');
  try{
    // The actual browser permission must resolve before the application records a granted state.
    localStream=await navigator.mediaDevices.getDisplayMedia({
      video:{frameRate:{ideal:20,max:30},width:{ideal:1920},height:{ideal:1080}},
      audio:false
    });
    preview.srcObject=localStream;
    stopButton.disabled=false;
    shareButton.disabled=true;
    sendConsent('share-permission-granted');
    await createPeer();
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({type:'offer',sdp:pc.localDescription});
    send({type:'share-status',active:true});
    status('Browser permission granted. Connecting the live mirror…',true);
    const track=localStream.getVideoTracks()[0];
    track?.addEventListener('ended',()=>stopSharing(true),{once:true});
  }catch(error){
    send({type:'consent-status',stage:'share-permission-denied'});
    status(error?.name==='NotAllowedError'?'Screen sharing was cancelled or denied. Nothing was shared.':`Screen sharing failed: ${error?.message||error}`);
  }
}
function stopSharing(notify=true){
  if(notify){send({type:'stop-share'});}
  localStream?.getTracks().forEach(t=>t.stop());
  localStream=null;
  preview.srcObject=null;
  if(pc)try{pc.close()}catch{}
  pc=null;
  pendingCandidates.length=0;
  stopButton.disabled=true;
  shareButton.disabled=!paired||!isScreenShareSupported;
  status('Screen sharing is OFF.');
}
shareButton.addEventListener('click',startWebShare);
stopButton.addEventListener('click',()=>stopSharing(true));
leaveButton.addEventListener('click',()=>{shuttingDown=true;try{send({type:'leave'})}catch{};stopSharing(false);try{socket?.close()}catch{};location.href='/cyber/join.html';});
window.addEventListener('beforeunload',()=>{if(!shuttingDown){try{send({type:'leave'})}catch{}}stopSharing(false);});
const initial=parseJoinData();
if(!initial){preStatus.textContent='Open this page from a current QR code or a valid copied join link.';stepContinue.disabled=true;}
renderStep();
