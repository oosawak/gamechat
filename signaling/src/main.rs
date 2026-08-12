use axum::{extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State}, response::Response, routing::get, Router};
use futures_util::{SinkExt, StreamExt};
use gamechat_protocol::SignalMessage;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{mpsc, RwLock};
use tracing::info;

type Tx = mpsc::UnboundedSender<Message>;
type Rooms = Arc<RwLock<HashMap<String, HashMap<String, Tx>>>>;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").init();
    let state: Rooms = Arc::new(RwLock::new(HashMap::new()));
    let app = Router::new().route("/ws", get(websocket)).with_state(state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8787").await.unwrap();
    info!("signaling server listening on ws://127.0.0.1:8787/ws");
    axum::serve(listener, app).await.unwrap();
}

async fn websocket(ws: WebSocketUpgrade, State(rooms): State<Rooms>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, rooms))
}

async fn handle_socket(socket: WebSocket, rooms: Rooms) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sender.send(message).await.is_err() { break; }
        }
    });
    let mut joined: Option<(String, String)> = None;

    while let Some(Ok(Message::Text(text))) = receiver.next().await {
        let Ok(signal) = serde_json::from_str::<SignalMessage>(&text) else {
            let _ = tx.send(json_message(&SignalMessage::Error { message: "invalid message".into() }));
            continue;
        };
        match signal {
            SignalMessage::Join { room_id, peer_id } => {
                let mut guard = rooms.write().await;
                let room = guard.entry(room_id.clone()).or_default();
                let peers: Vec<String> = room.keys().cloned().collect();
                room.insert(peer_id.clone(), tx.clone());
                joined = Some((room_id, peer_id.clone()));
                let _ = tx.send(json_message(&SignalMessage::Joined { room_id: joined.as_ref().unwrap().0.clone(), peer_id: peer_id.clone(), peers }));
                broadcast(room, &peer_id, &SignalMessage::PeerJoined { peer_id: peer_id.clone() });
            }
            SignalMessage::Offer { target_peer_id, payload } => relay(&rooms, &joined, target_peer_id, payload, "offer").await,
            SignalMessage::Answer { target_peer_id, payload } => relay(&rooms, &joined, target_peer_id, payload, "answer").await,
            SignalMessage::IceCandidate { target_peer_id, payload } => relay(&rooms, &joined, target_peer_id, payload, "ice_candidate").await,
            _ => {}
        }
    }
    if let Some((room_id, peer_id)) = joined {
        let mut guard = rooms.write().await;
        if let Some(room) = guard.get_mut(&room_id) {
            room.remove(&peer_id);
            broadcast(room, &peer_id, &SignalMessage::PeerLeft { peer_id: peer_id.clone() });
            if room.is_empty() { guard.remove(&room_id); }
        }
    }
    send_task.abort();
}

async fn relay(rooms: &Rooms, joined: &Option<(String, String)>, target: String, payload: serde_json::Value, kind: &str) {
    let Some((room_id, sender_id)) = joined else { return };
    let signal = match kind {
        "offer" => SignalMessage::Offer { target_peer_id: sender_id.clone(), payload },
        "answer" => SignalMessage::Answer { target_peer_id: sender_id.clone(), payload },
        _ => SignalMessage::IceCandidate { target_peer_id: sender_id.clone(), payload },
    };
    if let Some(tx) = rooms.read().await.get(room_id).and_then(|room| room.get(&target)) {
        let _ = tx.send(json_message(&signal));
    }
}

fn broadcast(room: &HashMap<String, Tx>, except: &str, signal: &SignalMessage) {
    for (peer_id, tx) in room {
        if peer_id != except { let _ = tx.send(json_message(signal)); }
    }
}

fn json_message(signal: &SignalMessage) -> Message {
    Message::Text(serde_json::to_string(signal).unwrap().into())
}
