# GameChat
（開発中です、少々お待ちください）

WebRTC を使った P2P テキストチャットと音声通話の最小実装です。接続確立に必要な SDP / ICE だけを Rust 製シグナリングサーバーが中継し、チャット本文と音声はブラウザ間で直接送受信します。

仕様書は [docs/GameChat_technical_spec_v0.1.md](docs/GameChat_technical_spec_v0.1.md) に保存しています。

Google Forms / Groups の設定手順は [docs/google-integration.md](docs/google-integration.md) にあります。Apps Script のコードは [apps-script/Code.gs](apps-script/Code.gs) に保存しています。

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

## ローカル履歴

テキストメッセージはブラウザの IndexedDB に保存されます。同じ Room ID で再参加すると、その端末に保存された履歴を表示します。サーバーには履歴を保存しません。

## Google 連携の現状

参加申請の Google Form 送信を Apps Script で受け、Google Groups に `community` と選択カテゴリーのメンバーを追加できます。GameChat クライアントやシグナリングサーバーから Google API を直接呼び出しません。

## 音声接続の方針

音声通話そのものは無料機能として利用できるようにします。無料ユーザーは Google の STUN (`stun:stun.l.google.com:19302`) を使った直接 P2P 接続のみです。接続できないネットワーク向けの TURN fallback は、有料プランの接続安定機能として後から追加します。

```text
無料: テキスト + STUN 直接音声
有料: テキスト + STUN 直接音声 + TURN fallback
```

現在は認証・決済・TURN を未実装です。クライアントのボタン表示だけで有料制限を実装せず、将来はサーバー側で契約状態を確認して短期 TURN 資格情報を発行します。

## 現時点の制約

Google Groups 所属をシグナリング参加資格として検証する短期トークン、TURN、ビデオ、SFU、認証トークンは未実装です。シグナリングサーバーも永続 DB を持ちません。
