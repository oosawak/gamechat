use gamechat_protocol::SignalMessage;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn make_join(room_id: &str, peer_id: &str) -> String {
    serde_json::to_string(&SignalMessage::Join { room_id: room_id.into(), peer_id: peer_id.into() }).unwrap()
}

#[wasm_bindgen]
pub fn make_chat_message(room_id: &str, sender_id: &str, content: &str) -> String {
    serde_json::json!({
        "id": format!("{}-{}", sender_id, js_sys::Date::now()),
        "room_id": room_id,
        "sender_id": sender_id,
        "timestamp": js_sys::Date::now(),
        "kind": "text",
        "content": content
    }).to_string()
}
