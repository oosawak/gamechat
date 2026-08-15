import { WebSocketServer, WebSocket } from 'ws';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? '8787');
const path = process.env.PATHNAME ?? '/ws';

/** @type {Map<string, Map<string, WebSocket>>} */
const rooms = new Map();
/** @type {Map<WebSocket, { roomId: string, peerId: string } | null>} */
const joined = new Map();

const wss = new WebSocketServer({ host, port, path });

console.log(`GameChat signaling server listening on ws://${host}:${port}${path}`);

wss.on('connection', socket => {
  joined.set(socket, null);

  socket.on('message', raw => {
    let signal;
    try {
      signal = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: 'error', message: 'invalid message' });
      return;
    }

    switch (signal.type) {
      case 'join':
        handleJoin(socket, signal);
        break;
      case 'offer':
      case 'answer':
      case 'ice_candidate':
        relay(socket, signal);
        break;
      default:
        break;
    }
  });

  socket.on('close', () => {
    leave(socket);
    joined.delete(socket);
  });

  socket.on('error', () => {
    leave(socket);
    joined.delete(socket);
  });
});

function handleJoin(socket, signal) {
  const roomId = String(signal.room_id ?? '').trim();
  const peerId = String(signal.peer_id ?? '').trim();
  if (!roomId || !peerId) {
    send(socket, { type: 'error', message: 'room_id and peer_id are required' });
    return;
  }

  leave(socket);

  const room = rooms.get(roomId) ?? new Map();
  const existing = room.get(peerId);
  if (existing && existing !== socket) {
    leave(existing);
    existing.close();
  }
  const peers = [...room.keys()].filter(id => id !== peerId);
  room.set(peerId, socket);
  rooms.set(roomId, room);
  joined.set(socket, { roomId, peerId });

  send(socket, { type: 'joined', room_id: roomId, peer_id: peerId, peers });
  broadcast(room, peerId, { type: 'peer_joined', peer_id: peerId });
}

function relay(socket, signal) {
  const current = joined.get(socket);
  if (!current) {
    send(socket, { type: 'error', message: 'join a room first' });
    return;
  }

  const room = rooms.get(current.roomId);
  if (!room) return;

  const targetId = String(signal.target_peer_id ?? '').trim();
  const target = room.get(targetId);
  if (!target || target.readyState !== WebSocket.OPEN) return;

  const forwarded =
    signal.type === 'offer'
      ? { type: 'offer', target_peer_id: current.peerId, payload: signal.payload }
      : signal.type === 'answer'
        ? { type: 'answer', target_peer_id: current.peerId, payload: signal.payload }
        : { type: 'ice_candidate', target_peer_id: current.peerId, payload: signal.payload };

  send(target, forwarded);
}

function leave(socket) {
  const current = joined.get(socket);
  if (!current) return;

  const room = rooms.get(current.roomId);
  if (!room) {
    joined.set(socket, null);
    return;
  }

  room.delete(current.peerId);
  broadcast(room, current.peerId, { type: 'peer_left', peer_id: current.peerId });

  if (room.size === 0) {
    rooms.delete(current.roomId);
  }

  joined.set(socket, null);
}

function broadcast(room, exceptPeerId, message) {
  for (const [peerId, peerSocket] of room) {
    if (peerId === exceptPeerId) continue;
    send(peerSocket, message);
  }
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
