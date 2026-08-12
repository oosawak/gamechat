# GameChat 技術仕様書 v0.1

## 1. プロジェクト概要

GameChat は、Google Forms / Google Groups を参加・所属管理に使い、チャットと音声通話そのものは WebRTC でブラウザ同士を直接接続する、軽量なコミュニティ Web アプリを目指す。

### 1.1 基本方針

- 参加申請は Google Forms で受け付ける。
- Google Groups を参加資格・所属グループ・権限のマスターとして利用する。
- 公開クライアントは GitHub Pages で配信する。
- クライアントの通信・状態管理の中核は Rust/WASM で実装する。
- テキストチャットは WebRTC RTCDataChannel で P2P 送受信する。
- 音声通話は WebRTC MediaStream を利用し、MVP から含める。
- 常設サーバーは原則シグナリング用途に限定する。
- 履歴はまず各ブラウザの IndexedDB へ保存する。
- 規模拡大時に TURN、共有履歴、SFU 等を段階的に追加できる構造にする。

### 1.2 この構成を選ぶ理由

Firebase、Cloud Run 上の常設チャット API、PostgreSQL 等を MVP 必須要件にせず、静的ホスティングと P2P を中心にすることで、運用コストとサーバー管理を抑える。

Rust はシグナリングサーバーと WASM クライアントコアの共通言語として利用する。ただし、ブラウザの WebRTC API は標準 API の成熟度を優先し、WASM から呼び出す薄い境界を置く。

## 2. 全体アーキテクチャ

```text
Google Forms -> Google Apps Script -> Google Groups

GitHub Pages / PWA
  HTML / CSS / TypeScript
             |
             v
        Rust / WASM
  Room / Peer / Message / Signaling state
             |
             v
      Browser WebRTC API
  RTCPeerConnection / RTCDataChannel / MediaStream
             ^
             | WebSocket (connection establishment only)
             v
      Rust Axum signaling server

Browser A <==== WebRTC P2P ====> Browser B
```

シグナリングサーバーは join / leave、SDP offer / answer、ICE candidate と一時的な Peer 状態だけを扱う。チャット本文・音声・永続履歴は扱わない。

## 3. GitHub / 公開構成

現在のリポジトリは `https://github.com/oosawak/gamechat`。クライアントは GitHub Pages、シグナリングサーバーは別の HTTPS / WSS 対応実行環境へ配置する。

```text
gamechat/
├─ README.md
├─ LICENSE
├─ docs/
│  └─ GameChat_technical_spec_v0.1.md
├─ protocol/
├─ web/
├─ wasm/
└─ signaling/
```

## 4. Google Forms / Google Groups

Google 側はチャット本文の保存場所ではなく、参加受付と所属管理に集中させる。Google Forms の回答を Apps Script で処理し、community、game-dev、rust、wasm、3dcg、admin などの Google Groups へ登録する。Apps Script の初期実装は `apps-script/Code.gs` に保存する。

## 5. Rust/WASM クライアント設計

WASM は Room、Peer、Message、Signaling の状態管理とプロトコル処理を担当する。TypeScript は DOM、ユーザー操作、WebRTC API の薄いブラウザ境界を担当する。

## 6. WebRTC テキストチャット

テキストは RTCDataChannel で P2P 送受信する。最初の wire format は JSON とし、後で CBOR / MessagePack に置き換えられるよう protocol crate として分離する。

```json
{
  "id": "message-id",
  "room_id": "general",
  "sender_id": "peer-id",
  "timestamp": 0,
  "kind": "text",
  "content": "こんにちは"
}
```

## 7. 音声通話

MVP から getUserMedia による音声送受信、ミュート、退出、参加者表示を実装する。ビデオ、画面共有、録音、SFU は対象外とし、少人数のフルメッシュを前提にする。

## 8. Rust シグナリングサーバー

Rust、Axum、Tokio、WebSocket を使用する。サーバー状態は `room_id -> peer_id -> WebSocket` のインメモリ状態のみとし、DB は使用しない。再起動時はクライアントが再接続する。

## 9. STUN / TURN

音声通話自体は無料機能として提供し、無料ユーザーは Google の STUN (`stun:stun.l.google.com:19302`) による直接 P2P のみを利用する。TURN fallback は有料プランの接続安定機能として追加する。MVP は TURN を設定せず、少人数の検証で接続失敗が確認された段階で有料向け TURN を導入する。

## 10. UI

テキストチャンネル、ボイスルーム、メッセージ表示、マイクの mute / unmute、音声退出を持つ。モバイルではチャンネル一覧をドロワー化する。

## 11. MVP の完成条件

- GitHub Pages から画面を開ける。
- 2 つのブラウザが同じ `room_id` に参加できる。
- Rust シグナリングサーバー経由で WebRTC 接続が成立する。
- RTCDataChannel で双方向テキスト送受信できる。
- マイク音声を Peer 間で送受信できる。
- ミュート・退出ができる。
- ICE / Peer の接続状態を画面で確認できる。

IndexedDB の端末内履歴と Google Forms / Groups の申請・登録部分は実装済み。Group 所属の参加資格検証、TURN、大人数対応、ビデオ通話、SFU は今後追加する。

## 12. 実装フェーズ

1. Phase 0: GitHub 準備
2. Phase 1: シグナリング、WebRTC、DataChannel
3. Phase 2: 音声、mute / unmute、退出
4. Phase 3: UI とモバイル対応
5. Phase 4: IndexedDB 履歴
6. Phase 5: Google Forms / Groups 連携（申請・登録部分を実装済み）
7. Phase 6: TURN、自動再接続、レート制限、ログ

## 13. セキュリティ / プライバシー

WebRTC の暗号化を前提とし、シグナリングは本番で WSS を使う。room_id の自己申告だけを将来の認証として信用せず、短期トークンを導入する。マイク許可はユーザー操作時だけ要求する。IndexedDB は端末内データであることを UI に明示する。

## 14. 未決定事項

シグナリングサーバーのホスティング先、TURN 導入時期、Google Groups の具体名、認証トークン、推奨ルーム人数、ライセンス、共有履歴方式、SFU 方式は実装を進めながら決定する。現時点の ICE 構成は Google STUN のみとする。将来は契約状態に応じて TURN 資格情報を短期発行する。

## 15. 初回実装の制約

Firebase、Firestore、Supabase、シグナリング DB、常設チャットバックエンドは使用しない。Google Forms / Groups、IndexedDB、TURN、ビデオ、画面共有、SFU は初期通信コアに含めない。
