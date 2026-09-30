import WebSocket from 'ws';

const port = Number(process.env.PORT || 3000);
const url = `ws://127.0.0.1:${port}/signal`;
const room = 'TEST' + Math.random().toString(36).slice(2).padEnd(20, '0').slice(0, 20);

function connect(role) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages = [];
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', room, role })));
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
      if (msg.type === 'joined') resolve({ ws, messages });
    });
    ws.on('error', reject);
  });
}

const host = await connect('host');
const guest = await connect('guest');

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('peer-ready not received')), 2500);
  const check = () => {
    const hostReady = host.messages.some(m => m.type === 'peer-ready');
    const guestReady = guest.messages.some(m => m.type === 'peer-ready');
    if (hostReady && guestReady) {
      clearTimeout(timeout);
      resolve();
    } else {
      setTimeout(check, 50);
    }
  };
  check();
});

host.ws.close();
guest.ws.close();
console.log('Signaling smoke test passed.');
