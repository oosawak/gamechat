declare module './wasm/gamechat_wasm.js' {
  export default function init(): Promise<unknown>;
  export function make_join(room_id: string, peer_id: string): string;
}
