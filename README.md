# GameChat

WebRTC を使った P2P テキストチャットと音声通話の最小実装です。接続確立に必要な SDP / ICE だけを Rust 製シグナリングサーバーが中継し、チャット本文と音声はブラウザ間で直接送受信します。

仕様書は [docs/GameChat_technical_spec_v0.1.md](docs/GameChat_technical_spec_v0.1.md) に保存しています。

## 必要なツール

- Rust / Cargo
- `wasm-pack`
- Node.js / npm
- マイクを利用できる HTTPS または `localhost` のブラウザ

## ビルド

リポジトリのルートで実行します。

```sh
cargo check
wasm-pack build wasm --target web --out-dir ../web/src/wasm
cd web
npm install
npm run build
```

## 起動

ターミナルを 2 つ使います。

```sh
# ターミナル 1: シグナリングサーバー
cargo run -p gamechat-signaling
```

```sh
# ターミナル 2: Web クライアント
cd web
npm run dev
```

表示された Vite の URL をブラウザで開きます。ローカルでは `http://127.0.0.1:5173` を使用できます。

## 2 ブラウザでの確認

1. 2 つのブラウザタブで同じ URL を開く。
2. 両方で同じ Room ID（初期値は `general`）を指定する。
3. 表示名を別々に設定する。
4. 両方で `Join room` を押し、マイク許可を与える。
5. 片方から送信したメッセージがもう片方に表示されることを確認する。
6. `Mute` で音声を停止・再開し、`Leave` で退出する。

## 現時点の制約

MVP の通信検証を優先しているため、Google Forms / Groups、IndexedDB 履歴、TURN、ビデオ、SFU、認証トークンは未実装です。シグナリングサーバーも永続 DB を持ちません。
