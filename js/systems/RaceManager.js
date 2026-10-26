/*
  ファイル名 : RaceManager.js
  保存場所   : /js/systems
  役割       : レースの進行。カウントダウン → レース → ゴールの流れ、
               周回数・順位・タイム・ゴール順を管理する
  バージョン : 1.18.0（Phase19：みんなで対戦。届いた位置で動く人のゴールは、ホストの表で決める）

  レースの段階（phase）
    'countdown' : 3・2・1 のあいだ。レーサーは止まって待つ
    'racing'    : レース中
    'finished'  : プレイヤーがゴールした後（CPUはそのまま走り続ける）

  周回の数え方
    スタートグリッドはスタートラインの後ろなので、最初にラインを越えた時点で1周目が始まる。
    走った距離 ÷ コース全長（切り捨て）＝ 走り終えた周回数
*/

import { CONFIG } from '../config.js';

export class RaceManager {
  constructor(racers, track) {
    this.racers = racers;
    this.track = track;
    this.laps = CONFIG.race.laps;
    this.listeners = {};
    this.reset();
  }

  // レースを最初からにする（レーサーの位置は Game が並べ直す）
  reset() {
    this.phase = 'countdown';
    this.hold = false;             // true の間はカウントダウンを始めない（みんなで対戦で、全員の準備を待つ）
    this.countdown = CONFIG.race.countdownTime;
    this.lastCount = Math.ceil(this.countdown) + 1;
    this.time = 0;                 // GO からの経過時間（秒）
    this.afterFinish = 0;          // プレイヤーがゴールしてからの時間
    this.finishOrder = [];         // ゴールした順のレーサー
    this.lapsDone = new Map();     // レーサー → 走り終えた周回数
    this.finishTimes = new Map();  // レーサー → ゴールタイム
    this.ranking = this.racers.slice();
    for (const r of this.racers) {
      this.lapsDone.set(r, 0);
    }
  }

  // ---- 合図の登録 ----
  // 'count'(残り数字) / 'go' / 'lap'(racer, 周回番号) / 'finalLap'(racer) / 'finish'(racer, 順位)
  on(name, callback) {
    (this.listeners[name] = this.listeners[name] || []).push(callback);
  }

  emit(name, ...args) {
    const list = this.listeners[name];
    if (!list) return;
    for (const cb of list) cb(...args);
  }

  // レーサーが動いてよいか
  isRunning() {
    return this.phase !== 'countdown';
  }

  // ---- 1回の計算（1/60秒）ごとに呼ぶ。レーサーを動かした後に呼ぶこと ----
  step(dt) {
    if (this.phase === 'countdown') {
      if (this.hold) return;
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount && n > 0) {
        this.lastCount = n;
        this.emit('count', n);
      }
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.emit('go');
      }
      return;
    }

    this.time += dt;
    if (this.phase === 'finished') {
      this.afterFinish += dt;
    }

    // 周回とゴールの判定
    for (const r of this.racers) {
      if (this.finishTimes.has(r)) continue;
      const done = Math.max(0, Math.floor(r.distance / this.track.length));
      const before = this.lapsDone.get(r);
      if (done <= before) continue;

      // 届いた位置で動く人（みんなで対戦の相手）：周回だけ数え、ゴールはホストの表（setFinish）で決める
      if (r.remote) {
        this.lapsDone.set(r, Math.min(done, this.laps - 1));
        continue;
      }
      this.lapsDone.set(r, done);
      if (done >= this.laps) {
        this.finishTimes.set(r, this.time);
        this.addFinished(r);
        this.emit('finish', r, this.finishOrder.indexOf(r) + 1);
        if (r.isPlayer) {
          this.phase = 'finished';
        }
      } else {
        const lapNumber = done + 1;
        this.emit('lap', r, lapNumber);
        if (lapNumber === this.laps) {
          this.emit('finalLap', r);
        }
      }
    }

    this.updateRanking();
  }

  // ゴールした人の列に入れる（タイムの早い順に並べる）
  addFinished(r) {
    this.finishOrder.push(r);
    this.finishOrder.sort((a, b) => this.finishTimes.get(a) - this.finishTimes.get(b));
  }

  // 外から決まったゴール（みんなで対戦：ホストの表）
  setFinish(r, time) {
    if (this.finishTimes.has(r)) return;
    this.finishTimes.set(r, time);
    this.lapsDone.set(r, this.laps);
    this.addFinished(r);
    this.emit('finish', r, this.finishOrder.indexOf(r) + 1);
    this.updateRanking();
  }

  // 順位：ゴールした人はゴール順、まだの人は走った距離が長い順
  updateRanking() {
    const finished = this.finishOrder;
    const running = this.racers.filter((r) => !this.finishTimes.has(r));
    running.sort((a, b) => b.distance - a.distance);
    this.ranking = finished.concat(running);
  }

  getRanking() {
    return this.ranking;
  }

  rankOf(racer) {
    return this.ranking.indexOf(racer) + 1;
  }

  // 今走っている周回（1〜laps）
  currentLap(racer) {
    return Math.min(this.laps, this.lapsDone.get(racer) + 1);
  }

  finishTimeOf(racer) {
    return this.finishTimes.has(racer) ? this.finishTimes.get(racer) : null;
  }

  // カウントダウン中に画面へ出す文字（3・2・1）。それ以外は null
  countdownText() {
    if (this.phase !== 'countdown' || this.hold) return null;
    return String(Math.max(1, Math.ceil(this.countdown)));
  }
}
