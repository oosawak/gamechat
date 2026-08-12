import './style.css';
import initWasm, { make_join } from './wasm/gamechat_wasm.js';
import { loadMessages, saveMessage } from './storage';

type Signal = { type: string; room_id?: string; peer_id?: string; peers?: string[]; target_peer_id?: string; payload?: RTCSessionDescriptionInit | RTCIceCandidateInit };
type ChatMessage = { sender_id: string; content: string; timestamp: number };
type IceCandidate = RTCIceCandidateInit;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const roomInput = $('room') as HTMLInputElement, nameInput = $('name') as HTMLInputElement, signalingInput = $('signaling') as HTMLInputElement;
const joinButton = $('join') as HTMLButtonElement, muteButton = $('mute') as HTMLButtonElement, leaveButton = $('leave') as HTMLButtonElement;
const messageInput = $('message') as HTMLInputElement, composer = $('composer') as HTMLFormElement, messages = $('messages'), connection = $('connection'), peersLabel = $('peers'), audio = $('audio');
const peerId = crypto.randomUUID();
const peers = new Map<string, RTCPeerConnection>();
const channels = new Map<string, RTCDataChannel>();
const pendingCandidates = new Map<string, IceCandidate[]>();
let socket: WebSocket | undefined, stream: MediaStream | undefined, muted = false, roomId = '';

const sendSignal = (message: Signal) => socket?.send(JSON.stringify(message));
const show = (message: ChatMessage) => { if (messages.querySelector('.empty')) messages.innerHTML = ''; const item = document.createElement('p'); item.className = 'message'; item.innerHTML = `<strong>${escapeHtml(message.sender_id)}</strong><small>${new Date(message.timestamp).toLocaleTimeString()}</small><br>${escapeHtml(message.content)}`; messages.append(item); item.scrollIntoView({ behavior: 'smooth' }); };
const persist = (message: ChatMessage) => saveMessage({ ...message, id: `${message.sender_id}-${message.timestamp}-${message.content}` , room_id: roomId }).catch(() => undefined);
const restoreHistory = async () => { try { for (const message of await loadMessages(roomId)) show(message); } catch { /* IndexedDB may be unavailable in private browsing. */ } };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
const updatePeers = () => { peersLabel.textContent = `Peers: ${peers.size}`; };

async function connectPeer(remoteId: string, initiator: boolean) {
  if (peers.has(remoteId)) return peers.get(remoteId)!;
  // TURN is intentionally disabled for the current small-scale MVP.
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  peers.set(remoteId, pc); updatePeers();
  stream?.getTracks().forEach(track => pc.addTrack(track, stream!));
  pc.onicecandidate = event => { if (event.candidate) sendSignal({ type: 'ice_candidate', target_peer_id: remoteId, payload: event.candidate.toJSON() }); };
  pc.ondatachannel = event => configureChannel(event.channel, remoteId);
  pc.ontrack = event => { const element = document.createElement('audio'); element.autoplay = true; element.srcObject = event.streams[0]; audio.append(element); };
  pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { peers.delete(remoteId); updatePeers(); } };
  if (initiator) { const channel = pc.createDataChannel('chat'); configureChannel(channel, remoteId); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); sendSignal({ type: 'offer', target_peer_id: remoteId, payload: offer }); }
  return pc;
}

function configureChannel(channel: RTCDataChannel, remoteId?: string) { if (remoteId) channels.set(remoteId, channel); channel.onmessage = event => { try { const message = JSON.parse(event.data) as ChatMessage; show(message); persist(message); } catch { /* Ignore malformed peer data. */ } }; }
async function onSignal(signal: Signal) {
  if (signal.type === 'joined') { for (const id of signal.peers ?? []) await connectPeer(id, true); return; }
  if (signal.type === 'peer_left') { peers.get(signal.peer_id!)?.close(); peers.delete(signal.peer_id!); updatePeers(); return; }
  if (!signal.target_peer_id || !signal.payload) return;
  if (signal.type === 'offer') { const pc = await connectPeer(signal.target_peer_id, false); await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit); for (const candidate of pendingCandidates.get(signal.target_peer_id) ?? []) await pc.addIceCandidate(candidate); pendingCandidates.delete(signal.target_peer_id); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); sendSignal({ type: 'answer', target_peer_id: signal.target_peer_id, payload: answer }); }
  if (signal.type === 'answer') { const pc = peers.get(signal.target_peer_id); if (pc) { await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit); for (const candidate of pendingCandidates.get(signal.target_peer_id) ?? []) await pc.addIceCandidate(candidate); pendingCandidates.delete(signal.target_peer_id); } }
  if (signal.type === 'ice_candidate') { const pc = peers.get(signal.target_peer_id); if (!pc || !pc.remoteDescription) pendingCandidates.set(signal.target_peer_id, [...(pendingCandidates.get(signal.target_peer_id) ?? []), signal.payload as RTCIceCandidateInit]); else await pc.addIceCandidate(signal.payload as RTCIceCandidateInit); }
}

joinButton.onclick = async () => { joinButton.disabled = true; roomInput.disabled = true; nameInput.disabled = true; roomId = roomInput.value.trim() || 'general'; try { await restoreHistory(); await initWasm(); stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); socket = new WebSocket(signalingInput.value.trim()); socket.onopen = () => { connection.textContent = 'connected'; socket?.send(make_join(roomId, peerId)); }; socket.onmessage = event => onSignal(JSON.parse(event.data)); socket.onclose = () => { connection.textContent = 'offline'; }; messageInput.disabled = false; (composer.querySelector('button') as HTMLButtonElement).disabled = false; muteButton.disabled = false; leaveButton.disabled = false; } catch (error) { connection.textContent = error instanceof Error ? error.message : 'failed'; joinButton.disabled = false; } };
composer.onsubmit = event => { event.preventDefault(); const content = messageInput.value.trim(); if (!content) return; const message: ChatMessage = { sender_id: nameInput.value || peerId, content, timestamp: Date.now() }; for (const channel of channels.values()) if (channel.readyState === 'open') channel.send(JSON.stringify(message)); show(message); persist(message); messageInput.value = ''; };
muteButton.onclick = () => { muted = !muted; stream?.getAudioTracks().forEach(track => track.enabled = !muted); muteButton.textContent = muted ? '🔇 Unmute' : '🎤 Mute'; };
leaveButton.onclick = () => { peers.forEach(pc => pc.close()); peers.clear(); stream?.getTracks().forEach(track => track.stop()); socket?.close(); location.reload(); };
