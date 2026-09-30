import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Render terminates TLS at the edge and forwards HTTP/WebSocket traffic to the
// service. Binding explicitly to 0.0.0.0 also makes the app work on Render's
// public interface rather than only on loopback.
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;

const wss = new WebSocketServer({ server, path: '/signal' });

const PORT = Number(process.env.PORT || 3000);
const ROOMS = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'display-capture=(self)');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/api/qr', async (req, res) => {
  const data = String(req.query.data || '');
  if (!data || data.length > 2048) {
    return res.status(400).json({ error: 'Invalid QR payload.' });
  }

  try {
    const png = await QRCode.toBuffer(data, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 420,
      color: {
        dark: '#111111',
        light: '#ffffff'
      }
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(png);
  } catch (error) {
    return res.status(500).json({ error: 'QR generation failed.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: ROOMS.size });
});

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

function isValidRoom(room) {
  return typeof room === 'string' && /^[A-Za-z0-9_-]{18,64}$/.test(room);
}

function send(ws, message) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function getOrCreateRoom(room) {
  let record = ROOMS.get(room);
  if (!record) {
    record = {
      host: null,
      guest: null,
      createdAt: Date.now()
    };
    ROOMS.set(room, record);
  }
  return record;
}

function removeSocketFromRoom(ws) {
  const room = ws.room;
  if (!room) return;

  const record = ROOMS.get(room);
  if (!record) return;

  if (record.host === ws) {
    record.host = null;
    send(record.guest, { type: 'peer-left', reason: 'host-disconnected' });
  }

  if (record.guest === ws) {
    record.guest = null;
    send(record.host, { type: 'peer-left', reason: 'guest-disconnected' });
  }

  if (!record.host && !record.guest) {
    ROOMS.delete(room);
  }
}

wss.on('connection', (ws) => {
  ws.room = null;
  ws.role = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  send(ws, { type: 'server-ready' });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', message: 'Invalid signaling message.' });
      return;
    }

    if (!message || typeof message.type !== 'string') {
      send(ws, { type: 'error', message: 'Malformed signaling message.' });
      return;
    }

    if (message.type === 'join') {
      const room = String(message.room || '');
      const role = message.role === 'host' ? 'host' : 'guest';

      if (!isValidRoom(room)) {
        send(ws, { type: 'error', message: 'Invalid session code.' });
        return;
      }

      removeSocketFromRoom(ws);

      const record = getOrCreateRoom(room);
      const slot = role === 'host' ? 'host' : 'guest';

      if (record[slot] && record[slot] !== ws) {
        send(ws, { type: 'room-full', message: `${role} slot is already occupied.` });
        return;
      }

      ws.room = room;
      ws.role = role;
      record[slot] = ws;

      send(ws, {
        type: 'joined',
        room,
        role,
        hasPeer: Boolean(role === 'host' ? record.guest : record.host)
      });

      if (role === 'guest' && record.host) {
        send(record.host, { type: 'peer-ready' });
        send(ws, { type: 'peer-ready' });
      }

      return;
    }

    if (!ws.room || !ws.role) {
      send(ws, { type: 'error', message: 'Join a session first.' });
      return;
    }

    const record = ROOMS.get(ws.room);
    if (!record) {
      send(ws, { type: 'error', message: 'Session no longer exists.' });
      return;
    }

    const peer = ws.role === 'host' ? record.guest : record.host;
    if (!peer) {
      send(ws, { type: 'peer-missing' });
      return;
    }

    switch (message.type) {
      case 'offer':
      case 'answer':
      case 'candidate':
      case 'share-status':
      case 'stop-share':
        send(peer, { ...message, from: ws.role });
        break;
      case 'leave':
        send(peer, { type: 'peer-left', reason: 'peer-left' });
        ws.close(1000, 'peer-left');
        break;
      default:
        send(ws, { type: 'error', message: 'Unsupported message type.' });
    }
  });

  ws.on('close', () => {
    removeSocketFromRoom(ws);
  });

  ws.on('error', () => {
    removeSocketFromRoom(ws);
  });
});

// Keep ephemeral rooms from lingering if a client crashes without closing cleanly.
setInterval(() => {
  const now = Date.now();
  for (const [room, record] of ROOMS.entries()) {
    if (!record.host && !record.guest) {
      ROOMS.delete(room);
      continue;
    }
    if (now - record.createdAt > 1000 * 60 * 30) {
      send(record.host, { type: 'session-expired' });
      send(record.guest, { type: 'session-expired' });
      try { record.host?.close(1000, 'session-expired'); } catch {}
      try { record.guest?.close(1000, 'session-expired'); } catch {}
      ROOMS.delete(room);
    }
  }
}, 60_000).unref();

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch {}
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 25_000);
heartbeat.unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cybersecurity demo running on http://localhost:${PORT}`);
  console.log(`WebSocket signaling: ws://localhost:${PORT}/signal`);
});
