/*
  ファイル名 : NetRace.js
  保存場所   : /js/net
  役割       : みんなで対戦のレース中の通信。RaceSession が1つ持つ。
                 ・自分が動かしているレーサーの位置を、1秒に15回送る
                     ゲスト … 自分の機体だけをホストへ
                     ホスト … 全員分（自分・CPU・ゲストから届いた位置）をまとめて全員へ
                 ・届いた位置を少し遅らせて（0.12秒）前後の位置の間をなめらかにつなぎ、相手の機体を動かす
                 ・ゴールのタイムはホストがまとめて、全員に同じ表を配る（全員の結果が同じになる）
  バージョン : 1.20.0（Phase20：届いた中身の確認・通信が止まったかの確認）
  メモ       : 「自分で動かす」レーサー … 普通の物理で動く（ホストはCPUも）
               「届いた位置で動かす」レーサー（racer.remote = true）… 物理は計算せず、位置を写すだけ
*/

import { CONFIG } from '../config.js';

// 状態の名前を短い番号にして送る
const STATES = ['drive', 'drift', 'air', 'respawn'];

export class NetRace {
  /**
   * @param {object} o
   * @param {Room} o.room
   * @param {Racer[]} o.racers 全レーサー（スタート位置の順）
   * @param {RaceManager} o.race
   * @param {Array} o.slots    [{ pid（CPUは -1）, char, name }]（racers と同じ順）
   */
  constructor(o) {
    this.room = o.room;
    this.racers = o.racers;
    this.race = o.race;
    this.slots = o.slots;
    this.isHost = o.room.isHost;
    this.sendTimer = 0;
    this.clock = performance.now() / 1000;   // 自分の時計（秒）
    this.senders = new Map();     // 送り主（pid）→ { off: 相手の時計とのずれ, jit: 届くまでの時間のゆらぎ,
                                  //                   view: 今その相手の時計で何秒の位置を見せるか（なめらかに変える） }
    this.senderOf = new Map();    // レーサー → その位置を送ってくる相手（pid）
    this.buffers = new Map();     // レーサー → 届いた位置の列
    this.latest = new Map();      // ホスト：ゲストのレーサー → 最後に届いた位置と、届いた時刻
    this.turbos = new Map();      // レーサー → 送ったミニターボの回数
    this.finishTable = new Map(); // ホスト：レーサー → ゴールタイム（全員に配る表）
    this.onLeft = null;
    this.lastHeard = this.clock;  // 最後に位置が届いた時刻（ホストの通信が止まったかを見る）           // ゲストが抜けたときに RaceSession が呼んでほしい関数

    for (const r of this.racers) {
      this.buffers.set(r, []);
      this.turbos.set(r, 0);
      r.turboCount = 0;
    }

    const room = this.room;
    if (this.isHost) {
      room.on('s', (m, pid) => this.receive(m, pid));
      // ゴールの知らせは、本人の分だけ受け付ける
      room.on('fin', (m, pid) => {
        if (this.slots[m.slot] && this.slots[m.slot].pid === pid) this.receiveFinish(m.slot, m.time);
      });
      room.on('left', (m) => this.guestLeft(m.pid));
    } else {
      room.on('S', (m) => this.receive(m, 0));
      room.on('fins', (m) => this.receiveFinishes(m.l));
    }

    // 自分で動かしているレーサーがゴールしたら、ホストに知らせる（ホストは表に書いて配る）
    this.race.on('finish', (racer) => {
      if (racer.remote) return;
      const time = this.race.finishTimeOf(racer);
      const slot = this.racers.indexOf(racer);
      if (this.isHost) this.receiveFinish(slot, time);
      else this.room.toHost({ t: 'fin', slot, time });
    });
  }

  // ---- 1回の計算（1/60秒）ごと ----
  update(dt) {
    // 時計は本当の時刻（秒）。端末ごとに計算の速さが違っても、届いた位置の時刻とそろう
    const last = this.clock;
    this.clock = performance.now() / 1000;
    const step = Math.max(0, Math.min(0.25, this.clock - last));   // 本当に経った時間
    // 送り主ごとに「見せる時刻」を進める。ずれ・ゆらぎが変わっても、急に変えずに少しずつ合わせる
    const n = CONFIG.net;
    for (const sd of this.senders.values()) {
      const delay = Math.min(n.maxInterpDelay, n.interpDelay + sd.jit * 2.5);
      const target = this.clock - sd.off - delay;
      if (sd.view === null) {
        sd.view = target;
      } else {
        sd.view += step;
        const diff = target - sd.view;
        // 大きくずれたら（裏に回っていた等）すぐ合わせ、少しなら1秒に5％の速さで合わせる（ごく少しなら合わせない）
        if (Math.abs(diff) > 0.5) sd.view = target;
        else if (Math.abs(diff) > 0.015) sd.view += Math.max(-0.05 * step, Math.min(0.05 * step, diff));
      }
    }
    // 届いた位置で、相手のレーサーを動かす
    for (const r of this.racers) {
      if (r.remote) this.applyRemote(r);
    }
    // 決まった間隔で送る
    this.sendTimer += dt;
    const interval = 1 / CONFIG.net.sendRate;
    if (this.sendTimer >= interval) {
      this.sendTimer -= interval;
      if (this.sendTimer > interval) this.sendTimer = 0;
      this.send();
    }
  }

  // 1人分の位置を、送る形（数字の列）にする
  pack(r, age) {
    // ミニターボを出した回数（相手の画面でも火花を散らすため）
    if (!r.remote && r.lastTurboSeen) {
      r.turboCount += 1;
      r.turboLevel = r.lastTurboSeen;
      r.lastTurboSeen = 0;
    }
    return [
      this.racers.indexOf(r),
      round(r.distance, 100), round(r.x, 100), round(r.y, 100), round(r.angle, 1000),
      round(r.speed, 100), STATES.indexOf(r.state), round(r.boostTime, 100), r.driftLevel,
      round(r.input.steer, 100), round(r.invincibleTime, 100), round(r.respawnTimer, 100),
      r.turboCount || 0, r.turboLevel || 0, round(age, 1000)
    ];
  }

  send() {
    const tm = round(this.clock, 1000);
    if (this.isHost) {
      const list = [];
      for (const r of this.racers) {
        if (!r.remote) {
          list.push(this.pack(r, 0));
        } else {
          // ゲストのレーサーは、最後に届いた位置をそのまま中継する（届いてからの時間を添える）
          const l = this.latest.get(r);
          if (l) {
            const e = l.entry.slice();
            e[14] = round(this.clock - l.at, 1000);
            list.push(e);
          }
        }
      }
      this.room.broadcast({ t: 'S', tm, l: list }, true);
    } else {
      const mine = this.racers.find((r) => !r.remote);
      if (mine) this.room.toHost({ t: 's', tm, l: [this.pack(mine, 0)] }, true);
    }
  }

  // ---- 位置が届いた ----
  receive(m, fromPid) {
    // 形の確認：時刻は数、位置は最大6人分で、1人分は15個の数
    if (!Array.isArray(m.l) || m.l.length > 6 || !Number.isFinite(m.tm)) return;
    // 相手の時計とのずれ：速く届いたときの値に合わせ、ゆっくり遅い方へ戻す（通信のゆらぎに強くする）
    const now = performance.now() / 1000;
    this.lastHeard = now;
    const off = now - m.tm;
    let sd = this.senders.get(fromPid);
    if (!sd) {
      sd = { off, jit: 0, view: null };
      this.senders.set(fromPid, sd);
    }
    sd.off = off < sd.off ? off : sd.off + (off - sd.off) * 0.01;
    // ゆらぎ：いちばん速く届いたときより、どれだけ遅れて届いたか（の平均）
    sd.jit = sd.jit * 0.95 + Math.max(0, off - sd.off) * 0.05;
    for (const e of m.l) {
      if (!Array.isArray(e) || e.length !== 15 || !e.every(Number.isFinite)) continue;
      const r = this.racers[e[0]];
      if (!r || !r.remote) continue;
      // ゲストは、自分の位置を相手に動かされないようにする（自分は remote ではないので上で除かれる）
      if (this.isHost) {
        // ホストに届くのは、そのゲスト本人の位置だけ
        if (this.slots[e[0]].pid !== fromPid) continue;
        this.latest.set(r, { entry: e, at: now });
      }
      this.senderOf.set(r, fromPid);
      const t = m.tm - (e[14] || 0);   // 送り主の時計での、その位置の時刻
      const buf = this.buffers.get(r);
      if (buf.length && t <= buf[buf.length - 1].t) continue;   // 古い・同じ知らせ
      buf.push({ t, e });
      if (buf.length > 30) buf.shift();
    }
  }

  // 届いた位置の間をなめらかにつないで、レーサーを動かす
  applyRemote(r) {
    const buf = this.buffers.get(r);
    if (!buf.length) return;
    const n = CONFIG.net;
    const sd = this.senders.get(this.senderOf.get(r));
    if (!sd || sd.view === null) return;
    const t = sd.view;   // 送り主の時計で、この時刻の位置を見せる
    // t の前後の2つを探す
    let a = buf[0];
    let b = null;
    for (let k = 0; k < buf.length; k += 1) {
      if (buf[k].t <= t) a = buf[k];
      else { b = buf[k]; break; }
    }
    // 使い終わった古い位置を捨てる（1つ前までは残す）
    while (buf.length > 2 && buf[1].t <= t) buf.shift();

    r.prevDistance = r.distance;
    r.prevX = r.x;
    r.prevY = r.y;
    r.prevAngle = r.angle;

    const ea = a.e;
    let dist;
    let x;
    let y;
    let angle;
    if (b && t >= a.t) {
      const eb = b.e;
      const k = (t - a.t) / Math.max(1e-4, b.t - a.t);
      if (Math.abs(eb[1] - ea[1]) > n.snapDistance) {
        // 落ちて戻ったなど、大きく飛んだ：なめらかにせず切り替える
        const use = k < 0.5 ? ea : eb;
        dist = use[1]; x = use[2]; y = use[3]; angle = use[4];
      } else {
        dist = ea[1] + (eb[1] - ea[1]) * k;
        x = ea[2] + (eb[2] - ea[2]) * k;
        y = ea[3] + (eb[3] - ea[3]) * k;
        angle = ea[4] + (eb[4] - ea[4]) * k;
      }
    } else {
      // 次の位置がまだ届いていない：少しの間だけ、今の速さで進んでいると予想する
      const ahead = Math.max(0, Math.min(n.maxExtrapolate, t - a.t));
      dist = ea[1] + ea[5] * Math.cos(ea[4]) * ahead;
      x = ea[2] + ea[5] * Math.sin(ea[4]) * ahead * 0.5;
      y = ea[3];
      angle = ea[4];
    }
    const jumped = Math.abs(dist - r.distance) > n.snapDistance;
    r.distance = dist;
    r.s = r.wrap(dist);
    r.lap = Math.floor(dist / r.track.length);
    r.x = x;
    r.y = y;
    r.angle = angle;
    r.speed = ea[5];
    r.state = STATES[ea[6]] || 'drive';
    r.boostTime = ea[7];
    r.driftLevel = ea[8];
    r.input.steer = ea[9];
    r.invincibleTime = ea[10];
    r.respawnTimer = ea[11];
    // ミニターボの火花（回数が増えていたら1回散らす）
    if (ea[12] > this.turbos.get(r)) {
      this.turbos.set(r, ea[12]);
      r.lastTurbo = ea[13] || 1;
    }
    if (jumped) {
      r.prevDistance = r.distance;
      r.prevX = r.x;
      r.prevY = r.y;
      r.prevAngle = r.angle;
    }
  }

  // ---- ゴール ----
  // ホスト：表に書いて全員に配る
  receiveFinish(slot, time) {
    if (!this.isHost) return;
    const r = this.racers[slot];
    if (!r || this.finishTable.has(r) || !Number.isFinite(time) || time <= 0) return;
    this.finishTable.set(r, time);
    if (r.remote) this.race.setFinish(r, time);
    this.room.broadcast({ t: 'fins', l: Array.from(this.finishTable, ([racer, t]) => [this.racers.indexOf(racer), t]) });
  }

  // ゲスト：ホストから表が届いた
  receiveFinishes(list) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!Array.isArray(item)) continue;
      const [slot, time] = item;
      if (!Number.isFinite(time)) continue;
      const r = this.racers[slot];
      if (r && r.remote && this.race.finishTimeOf(r) === null) this.race.setFinish(r, time);
    }
  }

  // ホスト：ゲストが抜けた → そのレーサーはCPUが引き継ぐ
  guestLeft(pid) {
    const slot = this.slots.findIndex((s) => s.pid === pid);
    if (slot < 0) return;
    const r = this.racers[slot];
    this.slots[slot] = { ...this.slots[slot], pid: -1 };
    if (r.remote && this.onLeft) this.onLeft(r, slot);
  }

  // 最後に位置が届いてから何秒たったか
  silence() {
    return performance.now() / 1000 - this.lastHeard;
  }

  dispose() {
    const room = this.room;
    for (const t of ['s', 'S', 'fin', 'fins', 'left']) room.off(t);
  }
}

function round(v, k) {
  return Math.round((v || 0) * k) / k;
}
