/*
  ファイル名 : Link.js
  保存場所   : /js/net
  役割       : 相手のスマホ1台との直接の通り道（WebRTC）。通り道は2本：
                 c … 確実に届く（部屋の情報・スタート・ゴールなど、落としてはいけない知らせ）
                 u … 届かなくても待たない（1秒に何回も送る位置。古い位置を待つより次の位置を使う）
  バージョン : 1.21.0（Phase21：直接つながらないとき用の中継の通り道 RelayLink）
  メモ       : つなぎ始め（申し込み・返事・通り道の候補）は Signal.js（仲介サーバー）経由で運ぶ。
               参加する人が申し込み（offer）、部屋を作った人が返事（answer）をする
*/

import { CONFIG } from '../config.js';

export class Link {
  /**
   * @param {object} o
   * @param {Signal} o.signal    仲介サーバーとの連絡
   * @param {string} o.peerId    相手の名前
   * @param {string} o.connId    この通り道の番号（仲介サーバーの知らせを見分ける）
   * @param {boolean} o.caller   true = 自分から申し込む（参加する人）
   * @param {function} o.onOpen  2本とも使えるようになった
   * @param {function} o.onMessage 届いた（中身のオブジェクト）
   * @param {function} o.onClose 切れた
   */
  constructor(o) {
    this.signal = o.signal;
    this.peerId = o.peerId;
    this.connId = o.connId;
    this.onOpen = o.onOpen || (() => {});
    this.onMessage = o.onMessage || (() => {});
    this.onClose = o.onClose || (() => {});
    this.isOpen = false;
    this.closed = false;
    this.pendingCandidates = [];   // 相手の申し込みより先に届いた候補（あとで入れる）
    this.hasRemote = false;
    this.channels = {};

    const pc = new RTCPeerConnection({ iceServers: CONFIG.net.iceServers });
    this.pc = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate && this.signal) {
        this.signal.send('CANDIDATE', this.peerId, { connectionId: this.connId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'closed') this.close();
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') this.close();
    };

    if (o.caller) {
      this.setupChannel(pc.createDataChannel('c', { ordered: true }));
      this.setupChannel(pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 }));
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.signal.send('OFFER', this.peerId, { connectionId: this.connId, type: 'skyracer', sdp: pc.localDescription.toJSON() });
        })
        .catch(() => this.close());
    } else {
      pc.ondatachannel = (e) => this.setupChannel(e.channel);
    }

    // つながるまで待ちすぎない
    this.openTimer = setTimeout(() => {
      if (!this.isOpen) this.close();
    }, CONFIG.net.connectTimeout * 1000);
  }

  setupChannel(ch) {
    this.channels[ch.label] = ch;
    ch.onopen = () => this.checkOpen();
    ch.onclose = () => this.close();
    ch.onmessage = (e) => {
      // 大きすぎる・形の違う知らせは無視する（このゲームの知らせは小さい）
      if (typeof e.data !== 'string' || e.data.length > 8000) return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      this.onMessage(m);
    };
  }

  checkOpen() {
    const c = this.channels.c;
    const u = this.channels.u;
    if (this.isOpen || !c || !u || c.readyState !== 'open' || u.readyState !== 'open') return;
    this.isOpen = true;
    clearTimeout(this.openTimer);
    this.onOpen();
  }

  // ---- 仲介サーバーから届いた、この通り道あての知らせ ----
  handleSignal(type, payload) {
    const pc = this.pc;
    if (this.closed) return;
    if (type === 'OFFER') {
      pc.setRemoteDescription(payload.sdp)
        .then(() => this.flushCandidates())
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => {
          this.signal.send('ANSWER', this.peerId, { connectionId: this.connId, type: 'skyracer', sdp: pc.localDescription.toJSON() });
        })
        .catch(() => this.close());
    } else if (type === 'ANSWER') {
      pc.setRemoteDescription(payload.sdp)
        .then(() => this.flushCandidates())
        .catch(() => this.close());
    } else if (type === 'CANDIDATE') {
      if (this.hasRemote) {
        pc.addIceCandidate(payload.candidate).catch(() => {});
      } else {
        this.pendingCandidates.push(payload.candidate);
      }
    }
  }

  flushCandidates() {
    this.hasRemote = true;
    for (const c of this.pendingCandidates) {
      this.pc.addIceCandidate(c).catch(() => {});
    }
    this.pendingCandidates = [];
  }

  // 確実に届ける
  send(obj) {
    this.sendOn('c', obj);
  }

  // 届かなくてもよい（位置）
  sendFast(obj) {
    this.sendOn('u', obj);
  }

  sendOn(label, obj) {
    const ch = this.channels[label];
    if (!ch || ch.readyState !== 'open') return;
    // 送りきれずに溜まっているときは、位置は捨てる（古い位置を後から送っても意味がない）
    if (label === 'u' && ch.bufferedAmount > 16000) return;
    try {
      ch.send(JSON.stringify(obj));
    } catch (e) {
      // 送れなかった
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.isOpen = false;
    clearTimeout(this.openTimer);
    for (const ch of Object.values(this.channels)) {
      ch.onopen = null;
      ch.onclose = null;
      ch.onmessage = null;
      try { ch.close(); } catch (e) { /* もう閉じている */ }
    }
    try { this.pc.close(); } catch (e) { /* もう閉じている */ }
    this.onClose();
  }
}

// ==== 中継の通り道（直接つながらないとき用） ====
// つなぎ合わせに使っている公開の伝言板（MQTT）を、そのままやりとりの通り道にする。
// 直接より遅くなる（0.1〜0.3秒ほど）が、どんな回線の組み合わせでもつながりやすい。
// 中身は部屋の鍵で暗号化される（Signal.js）。位置は送りすぎないよう、1秒に約11回までにする
export class RelayLink {
  /**
   * @param {object} o
   * @param {Signal} o.signal  伝言板との連絡（MQTT）
   * @param {string} o.peerId  相手の名前
   * @param {function} o.onMessage 届いた（中身のオブジェクト）
   * @param {function} o.onClose   切れた
   */
  constructor(o) {
    this.isRelay = true;
    this.signal = o.signal;
    this.peerId = o.peerId;
    this.onMessage = o.onMessage || (() => {});
    this.onClose = o.onClose || (() => {});
    this.isOpen = true;
    this.closed = false;
    this.lastFast = 0;
  }

  // 伝言板から届いた中身（Link と同じ確認をしてから渡す）
  receive(m) {
    if (this.closed || !m || typeof m !== 'object' || typeof m.t !== 'string') return;
    this.onMessage(m);
  }

  send(obj) {
    if (!this.closed) this.signal.send('RELAY', this.peerId, obj);
  }

  sendFast(obj) {
    const now = performance.now();
    if (now - this.lastFast < 90) return;
    this.lastFast = now;
    this.send(obj);
  }

  handleSignal() {
    // 中継では使わない
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.isOpen = false;
    this.onClose();
  }
}
