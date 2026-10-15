/**
 * Minimal WebRTC signaling server.
 *
 * Purpose: introduce the broadcaster (your phone) and the viewer (her phone/browser)
 * to each other so they can establish a DIRECT peer-to-peer connection.
 * This server never sees, stores, or touches the actual screen video — it only
 * relays small JSON handshake messages (SDP offer/answer + ICE candidates).
 *
 * Protocol (rooms):
 *  - A "room" = a shared secret code (e.g. "heer-shivani-9471") you choose.
 *  - Both devices connect to the same room.
 *  - Any message one peer sends is relayed verbatim to the other peer(s) in the room.
 *
 * Run:
 *   npm install
 *   node server.js
 *
 * Deploy for free on Render.com / Railway.app / Fly.io, or any $3/mo VPS.
 * Use wss:// (TLS) in production — most hosts give you this automatically.
 */

const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// roomCode -> Set of ws connections
const rooms = new Map();

function joinRoom(roomCode, ws) {
  if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
  rooms.get(roomCode).add(ws);
  ws.roomCode = roomCode;
}

function leaveRoom(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) rooms.delete(ws.roomCode);
}

function broadcastToRoom(ws, data) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  for (const peer of room) {
    if (peer !== ws && peer.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify(data));
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (msg.type === 'join') {
      // { type: 'join', room: 'heer-shivani-9471', role: 'broadcaster' | 'viewer' }
      joinRoom(msg.room, ws);
      ws.role = msg.role;
      broadcastToRoom(ws, { type: 'peer-joined', role: msg.role });
      return;
    }

    // Anything else (offer, answer, ice-candidate, etc.) just gets relayed
    // as-is to the other peer in the same room.
    if (ws.roomCode) {
      broadcastToRoom(ws, msg);
    }
  });

  ws.on('close', () => {
    leaveRoom(ws);
  });
});

console.log(`Signaling server listening on port ${PORT}`);
