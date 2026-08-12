use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SignalMessage {
    Join { room_id: String, peer_id: String },
    Joined { room_id: String, peer_id: String, peers: Vec<String> },
    PeerJoined { peer_id: String },
    PeerLeft { peer_id: String },
    Offer { target_peer_id: String, payload: serde_json::Value },
    Answer { target_peer_id: String, payload: serde_json::Value },
    IceCandidate { target_peer_id: String, payload: serde_json::Value },
    Error { message: String },
}
