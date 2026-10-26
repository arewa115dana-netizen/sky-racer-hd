/*
  ファイル名 : Room.js
  保存場所   : /js/net
  役割       : みんなで対戦の「部屋」。部屋を作った人（ホスト）がまとめ役になり、
               参加した人（ゲスト）はホストとだけつながる（ゲスト同士の知らせはホストが中継する）。
                 ホスト … 4桁の部屋番号で仲介サーバーに登録し、来た人を迎え入れる。メンバーとコースを全員に知らせる
                 ゲスト … 部屋番号のホストに申し込み、迎え入れてもらう
  バージョン : 1.18.1（Phase18：つなぎ合わせ係を3ルートに。ホストは全部で待ち、ゲストは順に試す）
  メモ       : 知らせは { t: 種類, ... } の形。部屋の中の知らせ（hello / welcome / reject / room / prof /
               ping / pong / bye）はここで処理し、それ以外（レースの知らせ）は on() で登録した関数に渡す。
               メンバーの番号（pid）：ホストは 0、ゲストは来た順に 1, 2, 3 …
*/

import { CONFIG } from '../config.js';
import { createSignal } from './Signal.js';
import { Link } from './Link.js';

export class Room {
  /**
   * @param {object} o
   * @param {string} o.name   自分の名前
   * @param {number} o.char   自分のキャラ番号
   * @param {function} o.onChange 部屋の様子（メンバー・コース）が変わった
   * @param {function} o.onClosed 部屋がなくなった・切れた（理由の文字）
   */
  constructor(o) {
    this.name = o.name;
    this.char = o.char;
    this.onChange = o.onChange || (() => {});
    this.onClosed = o.onClosed || (() => {});
    this.onProgress = o.onProgress || null;   // 部屋に入る途中の様子（「ルート2で試しています…」）
    this.handlers = {};
    this.isHost = false;
    this.code = '';
    this.myPid = -1;
    this.members = [];       // [{ pid, name, char, host }]
    this.course = 0;
    this.locked = false;     // レース中は新しい人を入れない
    this.links = new Map();  // ホスト：相手の名前 → { link, pid, rtt }
    this.hostLink = null;    // ゲスト：ホストとの通り道
    this.signals = [];       // つなぎ合わせ係（ホストは全ルート、ゲストは今試しているルート）
    this.closed = false;
    this.rtt = 0;
  }

  // ---- レースの知らせの受け取り先を登録する（同じ種類は上書き） ----
  on(type, fn) {
    this.handlers[type] = fn;
  }

  off(type) {
    delete this.handlers[type];
  }

  // ==== ホスト：部屋を作る ====
  // 全部のルートで同じ部屋番号を登録して待つ（ゲストはどのルートから来てもよい）
  create(course) {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      this.myPid = 0;
      this.course = course;
      this.members = [{ pid: 0, name: this.name, char: this.char, host: true }];
      let tries = 0;
      let settled = false;
      const attempt = () => {
        tries += 1;
        this.code = String(1000 + Math.floor(Math.random() * 9000));
        const state = CONFIG.net.routes.map(() => 'wait');   // wait / open / fail
        const errors = [];
        const signals = [];
        this.signals = signals;
        const check = () => {
          if (settled || this.signals !== signals) return;
          // PeerJS（部屋番号が使用中か分かる）の結果が出て、どれか1つでも使えたら部屋ができた
          const peerDone = CONFIG.net.routes.every((r, k) => r.kind !== 'peerjs' || state[k] !== 'wait');
          if (state.includes('open') && peerDone) {
            settled = true;
            this.pingTimer = setInterval(() => this.pingAll(), 2000);
            resolve(this.code);
          } else if (state.every((x) => x === 'fail')) {
            settled = true;
            reject(new Error('部屋を作れませんでした（' + errors.join(' / ') + '）'));
          }
        };
        CONFIG.net.routes.forEach((route, k) => {
          const sig = createSignal(route, CONFIG.net.idPrefix + this.code, {
            onOpen: () => {
              state[k] = 'open';
              check();
              if (settled) this.onChange();
            },
            onTaken: () => {
              // 同じ部屋番号がもう使われていた：番号を変えてやり直す
              for (const x of signals) x.close();
              if (tries < 6) attempt();
              else if (!settled) { settled = true; reject(new Error('部屋番号を決められませんでした')); }
            },
            onMessage: (type, src, payload) => this.hostSignal(type, src, payload, sig),
            onError: (reason) => {
              state[k] = 'fail';
              errors.push(reason);
              check();
              if (settled) this.onChange();   // 部屋の画面の「つなぎ合わせ ○×」を書き直す
            }
          });
          signals.push(sig);
        });
      };
      attempt();
    });
  }

  // どのルートが使えているか（部屋の画面に小さく出す）
  routeStatus() {
    return this.signals.map((x) => (x.open && !x.closed ? '○' : '×')).join('');
  }

  // 仲介サーバーから届いた知らせ（ホスト）
  hostSignal(type, src, payload, sig) {
    if (!payload || this.closed) return;
    let entry = this.links.get(src);
    if (type === 'OFFER') {
      if (entry) return;
      const link = new Link({
        signal: sig,
        peerId: src,
        connId: payload.connectionId,
        caller: false,
        onMessage: (m) => this.hostReceive(src, m),
        onClose: () => this.dropGuest(src)
      });
      entry = { link, pid: -1, rtt: 0 };
      this.links.set(src, entry);
      link.handleSignal('OFFER', payload);
    } else if (entry && (type === 'CANDIDATE' || type === 'ANSWER')) {
      entry.link.handleSignal(type, payload);
    }
  }

  // ゲストから届いた（ホスト）
  hostReceive(src, m) {
    const entry = this.links.get(src);
    if (!entry) return;
    if (m.t === 'hello') {
      let reason = null;
      if (m.v !== CONFIG.VERSION) reason = 'version';
      else if (this.locked) reason = 'racing';
      else if (this.members.length >= CONFIG.net.maxPlayers) reason = 'full';
      if (reason) {
        entry.link.send({ t: 'reject', reason, v: CONFIG.VERSION });
        setTimeout(() => entry.link.close(), 500);
        return;
      }
      const pid = Math.max(0, ...this.members.map((x) => x.pid)) + 1;
      entry.pid = pid;
      this.members.push({ pid, name: cleanName(m.name), char: clampChar(m.char), host: false });
      entry.link.send({ t: 'welcome', pid, code: this.code });
      this.broadcastRoom();
      return;
    }
    if (entry.pid < 0) return;   // まだ迎え入れていない人の知らせは無視
    if (m.t === 'pong') {
      const rtt = (performance.now() - m.a) / 1000;
      entry.rtt = entry.rtt ? entry.rtt * 0.7 + rtt * 0.3 : rtt;
    } else if (m.t === 'prof') {
      const me = this.members.find((x) => x.pid === entry.pid);
      if (me) {
        me.name = cleanName(m.name);
        me.char = clampChar(m.char);
        this.broadcastRoom();
      }
    } else if (m.t === 'bye') {
      entry.link.close();
    } else {
      this.dispatch(m, entry.pid);
    }
  }

  pingAll() {
    for (const entry of this.links.values()) {
      if (entry.pid >= 0) entry.link.send({ t: 'ping', a: performance.now() });
    }
  }

  // ゲストが抜けた（ホスト）
  dropGuest(src) {
    const entry = this.links.get(src);
    if (!entry) return;
    this.links.delete(src);
    if (entry.pid < 0 || this.closed) return;
    this.members = this.members.filter((x) => x.pid !== entry.pid);
    this.broadcastRoom();
    this.dispatch({ t: 'left', pid: entry.pid }, entry.pid);
  }

  broadcastRoom() {
    this.broadcast({ t: 'room', members: this.members, course: this.course, locked: this.locked });
    this.onChange();
  }

  // コースを変える（ホスト）
  setCourse(index) {
    if (!this.isHost) return;
    this.course = index;
    this.broadcastRoom();
  }

  setLocked(locked) {
    if (!this.isHost) return;
    this.locked = locked;
    this.broadcastRoom();
  }

  // 全員へ（ホスト）。fast = true なら届かなくてもよい通り道で
  broadcast(m, fast) {
    for (const entry of this.links.values()) {
      if (entry.pid < 0) continue;
      if (fast) entry.link.sendFast(m);
      else entry.link.send(m);
    }
  }

  // 1人へ（ホスト）
  sendTo(pid, m, fast) {
    for (const entry of this.links.values()) {
      if (entry.pid !== pid) continue;
      if (fast) entry.link.sendFast(m);
      else entry.link.send(m);
    }
  }

  // ゲストとのやりとりの遅れ（往復の秒数）の一番大きい値（ホスト）
  maxRtt() {
    let max = 0;
    for (const entry of this.links.values()) {
      if (entry.pid >= 0) max = Math.max(max, entry.rtt);
    }
    return max;
  }

  // ==== ゲスト：部屋に入る ====
  // ルートを上から順に試す。つなぎ合わせ係とつながらないときだけ次のルートへ
  join(code) {
    this.isHost = false;
    this.code = code;
    const routes = CONFIG.net.routes;
    const errors = [];
    const tryRoute = (k) => {
      if (k >= routes.length || this.closed) {
        const notFound = errors.filter((e) => e.notFound).length;
        const detail = errors.map((e) => e.message).join(' / ');
        const text = notFound > 0
          ? '部屋 ' + code + ' が見つかりません。番号を確かめるか、ホストに部屋を作り直してもらってください'
          : '部屋に入れませんでした。通信の状態を確認してください';
        this.close(true);
        return Promise.reject(new Error(text + '（' + detail + '）'));
      }
      if (k > 0 && this.onProgress) this.onProgress(routes[k].name + 'で試しています…');
      return this.joinVia(routes[k], code).catch((err) => {
        if (err.final) {
          this.close(true);
          throw err;
        }
        errors.push(err);
        return tryRoute(k + 1);
      });
    };
    return tryRoute(0);
  }

  // 1つのルートで部屋に入ってみる
  joinVia(route, code) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let link = null;
      const hostId = CONFIG.net.idPrefix + code;
      const myId = CONFIG.net.idPrefix + 'g' + Math.random().toString(36).slice(2, 12);
      const done = (err, opts) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          if (link) {
            link.onClose = () => {};
            link.close();
          }
          sig.close();
          const e = new Error(err);
          Object.assign(e, opts || {});
          reject(e);
        } else {
          resolve();
        }
      };
      const timer = setTimeout(() => {
        // 返事が来ない：部屋がない（MQTT では「いない」と教えてもらえない）か、届かない
        done(route.name + '：' + (link && link.answered ? '時間切れ' : '部屋の返事なし'), { notFound: !(link && link.answered) });
      }, CONFIG.net.routeTimeout * 1000);
      const sig = createSignal(route, myId, {
        onOpen: () => {
          link = new Link({
            signal: sig,
            peerId: hostId,
            connId: 'c' + Math.random().toString(36).slice(2, 10),
            caller: true,
            onOpen: () => {
              link.send({ t: 'hello', v: CONFIG.VERSION, name: this.name, char: this.char });
            },
            onMessage: (m) => {
              if (m.t === 'welcome') {
                this.myPid = m.pid;
                this.hostLink = link;
                // つながったので、つなぎ合わせ係はもういらない
                sig.close();
                link.onClose = () => this.lost('ホストとの接続が切れました');
                done(null);
              } else if (m.t === 'reject') {
                done(REJECT_TEXT[m.reason] || '部屋に入れませんでした', { final: true });
              } else if (settled) {
                this.guestReceive(m);
              }
            },
            onClose: () => {
              // 返事は来たのに直接つながらない（回線の組み合わせの問題。ルートを変えても同じ）
              done('ホストと直接つながりませんでした。同じWi-Fiどうしなどで試してください（' + route.name + '）', { final: !!link.answered });
            }
          });
          this.signals = [sig];
        },
        onTaken: () => done(route.name + '：名前が重なりました'),
        onMessage: (type, src, payload) => {
          if (src !== hostId) return;
          if (type === 'EXPIRE') {
            done(route.name + '：部屋なし', { notFound: true });
          } else if (link) {
            if (type === 'ANSWER') link.answered = true;
            link.handleSignal(type, payload);
          }
        },
        onError: (reason) => {
          // つながった後や、もう返事をもらっていれば、つなぎ合わせ係が切れても続けられる
          if (!settled && !(link && link.answered)) done(reason);
        }
      });
    });
  }

  // ホストから届いた（ゲスト）
  guestReceive(m) {
    if (m.t === 'room') {
      this.members = m.members;
      this.course = m.course;
      this.locked = m.locked;
      this.onChange();
    } else if (m.t === 'ping') {
      this.hostLink.send({ t: 'pong', a: m.a });
    } else if (m.t === 'bye') {
      this.lost('ホストが部屋を閉じました');
    } else {
      this.dispatch(m, 0);
    }
  }

  // 自分の名前・キャラを変えた（ゲストはホストへ知らせる）
  setProfile(name, char) {
    this.name = name;
    this.char = char;
    if (this.isHost) {
      const me = this.members.find((x) => x.pid === 0);
      if (me) {
        me.name = name;
        me.char = char;
      }
      this.broadcastRoom();
    } else if (this.hostLink) {
      this.hostLink.send({ t: 'prof', name, char });
    }
  }

  // ホストへ（ゲスト）
  toHost(m, fast) {
    if (!this.hostLink) return;
    if (fast) this.hostLink.sendFast(m);
    else this.hostLink.send(m);
  }

  // ==== 共通 ====
  dispatch(m, fromPid) {
    const fn = this.handlers[m.t];
    if (fn) fn(m, fromPid);
  }

  memberOf(pid) {
    return this.members.find((x) => x.pid === pid) || null;
  }

  lost(reason) {
    if (this.closed) return;
    this.close(true);
    this.onClosed(reason);
  }

  // 部屋を出る（silent = 知らせを出さない）
  close(silent) {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.pingTimer);
    if (this.isHost) {
      for (const entry of this.links.values()) {
        entry.link.send({ t: 'bye' });
      }
    } else if (this.hostLink) {
      this.hostLink.send({ t: 'bye' });
    }
    // 「さよなら」が届くよう、少し待ってから切る
    const links = Array.from(this.links.values()).map((e) => e.link);
    const hostLink = this.hostLink;
    setTimeout(() => {
      for (const l of links) {
        l.onClose = () => {};
        l.close();
      }
      if (hostLink) {
        hostLink.onClose = () => {};
        hostLink.close();
      }
    }, 300);
    this.links.clear();
    for (const x of this.signals) x.close();
    this.handlers = {};
    if (!silent) this.onClosed(null);
  }
}

const REJECT_TEXT = {
  version: 'ゲームのバージョンが違います。両方ともアプリを開き直して、同じバージョンにしてください',
  racing: 'いまレース中です。終わってから入ってください',
  full: '部屋がいっぱいです（最大4人）'
};

function cleanName(name) {
  const s = String(name || '').replace(/[<>&"']/g, '').trim().slice(0, 8);
  return s || 'プレイヤー';
}

function clampChar(c) {
  const n = Number(c);
  return Number.isInteger(n) && n >= 0 && n < 6 ? n : 0;
}

export { cleanName };
