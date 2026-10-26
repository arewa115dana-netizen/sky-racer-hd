/*
  ファイル名 : Signal.js
  保存場所   : /js/net
  役割       : 「つなぎ合わせ係」との連絡。スマホ同士が直接つながる前に、
               お互いの連絡先（接続の申し込み・返事・通り道の候補）を、公開の仲介サーバーに運んでもらう。
               仲介サーバーは PeerJS の無料の公開サーバー（0.peerjs.com）を使う（自分でサーバーを持たなくてよい）
  バージョン : 1.18.0（Phase18 Step18-1）
  メモ       : PeerJS のライブラリは使わず、仲介サーバーとのやり取りの決まり（下の4種類）だけを自分で行う。
                 OPEN      … 登録できた
                 ID-TAKEN  … その名前（部屋番号）はもう使われている
                 OFFER / ANSWER / CANDIDATE … 相手へ運んでもらう中身（中身はこちらで自由に決める）
                 EXPIRE    … 相手が見つからなかった
               つながった後のレースの通信は、仲介サーバーを通らない（Link.js）
*/

import { CONFIG } from '../config.js';

export class Signal {
  /**
   * @param {string} id このスマホの名前（部屋を作る人は部屋番号から作る）
   * @param {object} h 知らせを受け取る関数
   * @param {function} h.onOpen      登録できた
   * @param {function} h.onTaken     名前が使われていた
   * @param {function} h.onMessage   相手から届いた（type, src, payload）
   * @param {function} h.onError     つながらない・切れた（理由の文字）
   */
  constructor(id, h) {
    this.id = id;
    this.h = h;
    this.open = false;
    this.closed = false;
    const n = CONFIG.net.signal;
    const token = Math.random().toString(36).slice(2, 12);
    const url = (n.secure ? 'wss://' : 'ws://') + n.host + ':' + n.port + n.path + 'peerjs?key=' + n.key +
      '&id=' + encodeURIComponent(id) + '&token=' + token + '&version=1.5.4';
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      setTimeout(() => this.fail('仲介サーバーに接続できません'), 0);
      return;
    }
    this.ws.onmessage = (e) => this.receive(e.data);
    this.ws.onerror = () => this.fail('仲介サーバーに接続できません');
    this.ws.onclose = () => this.fail(this.open ? '仲介サーバーとの接続が切れました' : '仲介サーバーに接続できません');
    // 何も送らないと切られるので、ときどき「生きてるよ」を送る
    this.heartbeat = setInterval(() => this.sendRaw({ type: 'HEARTBEAT' }), 5000);
    // 返事がないまま待ち続けないように
    this.openTimer = setTimeout(() => {
      if (!this.open) this.fail('仲介サーバーから返事がありません');
    }, CONFIG.net.signalTimeout * 1000);
  }

  receive(text) {
    let m;
    try {
      m = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (m.type === 'OPEN') {
      this.open = true;
      clearTimeout(this.openTimer);
      if (this.h.onOpen) this.h.onOpen();
    } else if (m.type === 'ID-TAKEN') {
      this.closed = true;
      this.cleanup();
      if (this.h.onTaken) this.h.onTaken();
    } else if (m.type === 'ERROR') {
      this.fail('仲介サーバーのエラー：' + (m.payload && m.payload.msg ? m.payload.msg : '不明'));
    } else if (m.type === 'OFFER' || m.type === 'ANSWER' || m.type === 'CANDIDATE' || m.type === 'EXPIRE' || m.type === 'LEAVE') {
      if (this.h.onMessage) this.h.onMessage(m.type, m.src, m.payload);
    }
  }

  // 相手（dst）へ運んでもらう
  send(type, dst, payload) {
    this.sendRaw({ type, dst, payload });
  }

  sendRaw(obj) {
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(JSON.stringify(obj));
      } catch (e) {
        // 送れなかった分は、相手の待ち時間切れで分かる
      }
    }
  }

  fail(reason) {
    if (this.closed) return;
    this.closed = true;
    this.cleanup();
    if (this.h.onError) this.h.onError(reason);
  }

  cleanup() {
    clearInterval(this.heartbeat);
    clearTimeout(this.openTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
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
