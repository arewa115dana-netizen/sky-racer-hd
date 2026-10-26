/*
  ファイル名 : Signal.js
  保存場所   : /js/net
  役割       : 「つなぎ合わせ係」との連絡。スマホ同士が直接つながる前に、
               お互いの連絡先（接続の申し込み・返事・通り道の候補）を、公開の仲介サーバーに運んでもらう。
               自分でサーバーを持たずにすむよう、無料の公開サーバーを使う。1つがだめでも遊べるよう、2種類ある
                 peerjs … PeerJS の公開サーバー（0.peerjs.com）
                 mqtt   … 誰でも使える公開の伝言板（MQTT）。自分あての「掲示板」を見張り、相手の掲示板に書き込む
  バージョン : 1.20.0（Phase20：やりとりの中身を部屋の鍵で暗号化）
  メモ       : どちらも使い方は同じ（createSignal で作る）。知らせの種類は
                 OPEN（登録できた）・ID-TAKEN（その部屋番号は使用中）・OFFER / ANSWER / CANDIDATE（相手へ運ぶ中身）・
                 EXPIRE（相手が見つからない）
               つながった後のレースの通信は、仲介サーバーを通らない（Link.js）
*/

import { CONFIG } from '../config.js';
import { seal, unseal } from './Secure.js';

/**
 * つなぎ合わせ係を1つ作る
 * @param {object} route CONFIG.net.routes の1つ
 * @param {string} id このスマホの名前
 * @param {object} h 知らせを受け取る関数 { onOpen, onTaken, onMessage(type, src, payload), onError(理由) }
 *                   と、部屋の鍵 key（あれば中身を暗号化する。鍵で開けられない知らせは無視）
 */
export function createSignal(route, id, h) {
  return route.kind === 'mqtt' ? new MqttSignal(route, id, h) : new PeerSignal(route, id, h);
}

// ---- 共通の部分（接続・待ち時間・片付け） ----
class BaseSignal {
  constructor(route, id, h) {
    this.route = route;
    this.id = id;
    this.h = h;
    this.open = false;
    this.closed = false;
    this.key = h.key || null;
    this.inQueue = Promise.resolve();    // 届いた順・送る順を守るための待ち行列（暗号の計算は少し時間がかかる）
    this.outQueue = Promise.resolve();
    this.openTimer = setTimeout(() => {
      if (!this.open) this.fail('返事がありません');
    }, CONFIG.net.signalTimeout * 1000);
  }

  connect(url, protocols) {
    try {
      this.ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
    } catch (e) {
      setTimeout(() => this.fail('接続できません'), 0);
      return;
    }
    this.ws.onerror = () => {};   // 理由は onclose で分かる
    this.ws.onclose = (e) => {
      const code = e && e.code ? '（コード ' + e.code + '）' : '';
      this.fail((this.open ? '接続が切れました' : '接続できません') + code);
    };
  }

  rawSend(data) {
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(data);
      } catch (e) {
        // 送れなかった分は、相手の待ち時間切れで分かる
      }
    }
  }

  // 相手（dst）へ運んでもらう（鍵があれば暗号化してから）
  send(type, dst, payload) {
    this.outQueue = this.outQueue.then(async () => {
      const body = this.key ? { e: await seal(this.key, payload) } : payload;
      if (!this.closed) this.sendNow(type, dst, body);
    }).catch(() => {});
  }

  // 届いた知らせを渡す（鍵があれば開けてから。開けられなければ無視）
  deliver(type, src, payload) {
    this.inQueue = this.inQueue.then(async () => {
      let body = payload;
      if (this.key && type !== 'EXPIRE') {
        if (!body || typeof body.e !== 'string' || body.e.length > 20000) return;
        body = await unseal(this.key, body.e);
        if (!body) return;
      }
      if (!this.closed && this.h.onMessage) this.h.onMessage(type, src, body);
    }).catch(() => {});
  }

  opened() {
    if (this.open || this.closed) return;
    this.open = true;
    clearTimeout(this.openTimer);
    if (this.h.onOpen) this.h.onOpen();
  }

  fail(reason) {
    if (this.closed) return;
    this.closed = true;
    this.cleanup();
    if (this.h.onError) this.h.onError(this.route.name + '：' + reason);
  }

  cleanup() {
    clearInterval(this.heartbeat);
    clearTimeout(this.openTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      try { this.ws.close(); } catch (e) { /* もう閉じている */ }
    }
  }

  // 自分から閉じる（知らせは出さない）
  close() {
    if (this.closed) return;
    this.closed = true;
    this.cleanup();
  }
}

// ==== PeerJS の公開サーバー ====
class PeerSignal extends BaseSignal {
  constructor(route, id, h) {
    super(route, id, h);
    const token = Math.random().toString(36).slice(2, 12);
    const url = (route.secure ? 'wss://' : 'ws://') + route.host + ':' + route.port + route.path + 'peerjs?key=' + route.key +
      '&id=' + encodeURIComponent(id) + '&token=' + token + '&version=1.5.4';
    this.connect(url);
    if (!this.ws) return;
    this.ws.onmessage = (e) => this.receive(e.data);
    // 何も送らないと切られるので、ときどき「生きてるよ」を送る
    this.heartbeat = setInterval(() => this.rawSend(JSON.stringify({ type: 'HEARTBEAT' })), 5000);
  }

  receive(text) {
    let m;
    try {
      m = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (m.type === 'OPEN') {
      this.opened();
    } else if (m.type === 'ID-TAKEN') {
      this.closed = true;
      this.cleanup();
      if (this.h.onTaken) this.h.onTaken();
    } else if (m.type === 'ERROR') {
      this.fail('エラー ' + (m.payload && m.payload.msg ? m.payload.msg : '不明'));
    } else if (m.type === 'OFFER' || m.type === 'ANSWER' || m.type === 'CANDIDATE' || m.type === 'EXPIRE') {
      this.deliver(m.type, m.src, m.payload);
    }
  }

  sendNow(type, dst, payload) {
    this.rawSend(JSON.stringify({ type, dst, payload }));
  }
}

// ==== MQTT の公開の伝言板 ====
// 決まり（MQTT 3.1.1）のうち、使う分だけを自分で行う：
//   CONNECT（つなぐ）→ CONNACK（OK）→ SUBSCRIBE（自分の掲示板を見張る）→ SUBACK（OK）
//   PUBLISH（相手の掲示板に書く／自分の掲示板に書かれた）、PINGREQ（生きてるよ）
class MqttSignal extends BaseSignal {
  constructor(route, id, h) {
    super(route, id, h);
    this.topic = CONFIG.net.mqttTopic + id;
    this.buf = new Uint8Array(0);
    this.connect(route.url, ['mqtt']);
    if (!this.ws) return;
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => {
      const clientId = 'sr' + Math.random().toString(36).slice(2, 14);
      // CONNECT：決まりの名前 "MQTT"・版 4・まっさらで始める・60秒ごとに確認
      const body = concat([str('MQTT'), [4, 0x02, 0, 60], str(clientId)]);
      this.rawSend(packet(0x10, body));
    };
    this.ws.onmessage = (e) => this.receive(new Uint8Array(e.data));
    this.heartbeat = setInterval(() => this.rawSend(new Uint8Array([0xc0, 0])), 30000);
  }

  receive(data) {
    this.buf = concat([this.buf, data]);
    // 届いた分から、まとまった知らせを1つずつ取り出す
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      let len = 0;
      let mul = 1;
      let k = 1;
      for (;;) {
        if (k >= b.length) return;
        const d = b[k];
        len += (d & 127) * mul;
        mul *= 128;
        k += 1;
        if (!(d & 128)) break;
        if (k > 4) { this.fail('変な知らせ'); return; }
      }
      if (b.length < k + len) return;
      const type = b[0] >> 4;
      const body = b.subarray(k, k + len);
      this.buf = b.slice(k + len);
      this.handle(type, body);
    }
  }

  handle(type, body) {
    if (type === 2) {
      // CONNACK：OKなら自分の掲示板を見張る
      if (body[1] !== 0) {
        this.fail('断られました（' + body[1] + '）');
        return;
      }
      this.rawSend(packet(0x82, concat([[0, 1], str(this.topic), [0]])));
    } else if (type === 9) {
      // SUBACK：見張り始めた
      if (body[2] === 0x80) this.fail('掲示板を使えません');
      else this.opened();
    } else if (type === 3) {
      // PUBLISH：自分の掲示板に書かれた
      const tlen = (body[0] << 8) | body[1];
      const text = new TextDecoder().decode(body.subarray(2 + tlen));
      let m;
      try {
        m = JSON.parse(text);
      } catch (e) {
        return;
      }
      if (m && typeof m.type === 'string' && typeof m.src === 'string') this.deliver(m.type, m.src, m.payload);
    }
  }

  // 相手（dst）の掲示板に書く
  sendNow(type, dst, payload) {
    const msg = new TextEncoder().encode(JSON.stringify({ type, src: this.id, payload }));
    this.rawSend(packet(0x30, concat([str(CONFIG.net.mqttTopic + dst), msg])));
  }
}

// ---- MQTT の知らせを作る道具 ----
function str(s) {
  const b = new TextEncoder().encode(s);
  return concat([[b.length >> 8, b.length & 255], b]);
}

function packet(head, body) {
  const len = [];
  let n = body.length;
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) d |= 128;
    len.push(d);
  } while (n > 0);
  return concat([[head], len, body]);
}

function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
