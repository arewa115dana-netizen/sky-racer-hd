/*
  ファイル名 : Secure.js
  保存場所   : /js/net
  役割       : つなぎ合わせ（公開の伝言板）でのやりとりを、部屋番号を知っている人にしか読めなくする。
                 ・部屋の名前 … 部屋番号から作った、元に戻せない記号（伝言板で番号そのものが見えないように）
                 ・鍵         … 部屋番号から、わざと時間のかかる計算で作る（総当たりで番号を当てにくくする）
                 ・中身       … その鍵で暗号化（AES-GCM）。鍵の違う人が書いた中身は読めないので無視される
  バージョン : 1.20.0（Phase20 Step20-1）
  メモ       : ブラウザに入っている暗号の仕組み（crypto.subtle）を使う。https のページでだけ使える
*/

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * 部屋番号から、部屋の名前と鍵を作る
 * @returns {Promise<{ id: string, key: CryptoKey }>}
 */
export async function roomSecrets(code) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode('skyracerhd-room:' + code));
  const id = Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
  const base = await crypto.subtle.importKey('raw', enc.encode('skyracerhd-key:' + code), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('skyracerhd-salt-v1'), iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { id, key };
}

// 暗号化して文字にする（先頭12バイトは毎回変わる「ひと振りの塩」）
export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + data.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(data), 12);
  let s = '';
  for (let i = 0; i < out.length; i += 1) s += String.fromCharCode(out[i]);
  return btoa(s);
}

// 文字を元に戻す。鍵が違う・壊れているときは null
export async function unseal(key, text) {
  try {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
    return JSON.parse(dec.decode(data));
  } catch (e) {
    return null;
  }
}
