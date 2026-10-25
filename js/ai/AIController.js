/*
  ファイル名 : AIController.js
  保存場所   : /js/ai
  役割       : CPUの思考。プレイヤーと同じ「入力状態」（旋回・上下・ドリフト・ブースト）を
               作るだけで、動きはプレイヤーと同じ物理（Racer）で行う（ズルをしない）
  バージョン : 0.7.1（Phase7 Step7-1）

  考え方
    ・少し先のコースの曲がり具合を見て、カーブの内側寄りの走行ラインを決める
    ・CPUごとに「好きな走行位置（左寄り・右寄り）」と「腕前」を持たせ、団子状態を防ぐ
    ・ゲージが満タンで、先がまっすぐなときにブーストを使う
    ・柵のない所では端に寄りすぎない（落ちにくくする）
    ・空中では、CPUごとに好きな高さを保つ
    ・前方のリングを狙う。高く飛ぶのが好きなCPUは高いルート（金）、低いのが好きなCPUは低いルート（青）。
      狙うかどうかはリングごとに腕前で決める（毎回全部は取らない）
    ・地上の急なカーブではドリフトする。カーブが終わるか、向きが変わったら離してミニターボ
*/

import { CONFIG } from '../config.js';

export class AIController {
  /**
   * @param {Racer} racer 操作するレーサー
   * @param {Track} track コース
   * @param {object} personality { lineOffset: -1〜1, skill: 0〜1, seed: 数 }
   */
  constructor(racer, track, personality) {
    this.racer = racer;
    this.track = track;
    this.lineOffset = personality.lineOffset;
    this.skill = personality.skill;
    this.heightBias = personality.heightBias || 0;   // 空中で好きな高さ（メートル）
    this.time = personality.seed || 0;   // ふらつきの位相をCPUごとにずらす
    this.boostWait = 0;                  // ブーストを使うまでの迷い時間
    this.rings = null;                   // コースのリング（setRings で受け取る）
    this.ringDecisions = new Map();      // リングごとに「狙う／狙わない」を一度だけ決めて覚える
    this.ringTarget = null;              // 今狙っているリング
    this.driftSign = 0;                  // ドリフト中の向き（0 = していない）
    this.curveDecision = null;           // 今のカーブでドリフトするか（カーブごとに一度決める）
    this.input = { steer: 0, pitch: 0, drift: false, boost: false, brake: false };
  }

  // コースのリングを教える（RaceSession が呼ぶ）
  setRings(rings) {
    this.rings = rings;
  }

  // 1回の計算（1/60秒）ごとに呼ぶ。入力状態を返す
  think(dt) {
    const a = CONFIG.ai;
    const r = this.racer;
    const t = this.track;
    const input = this.input;
    this.time += dt;

    input.boost = false;
    this.ringTarget = this.pickRing();
    input.pitch = this.thinkHeight();
    input.drift = false;
    input.brake = false;
    input.drift = this.thinkDrift();

    if (r.state === 'respawn') {
      input.steer = 0;
      return input;
    }

    // 少し先（速いほど遠く）のコースを見る
    const look = a.lookAheadBase + r.speed * a.lookAheadTime;
    const curvAhead = t.curvatureAt(r.s + look);
    const half = t.widthAt(r.s + look) / 2;

    // 走行ライン：好きな位置 ＋ カーブの内側へ寄る（左カーブなら左＝マイナス）
    let targetX = this.lineOffset * half * a.lineSpread;
    const inside = -Math.sign(curvAhead) * Math.min(1, Math.abs(curvAhead) * a.insideGain);
    targetX += inside * half * a.insideAmount;

    // 狙っているリングがあれば、その左右の位置へ向かう
    if (this.ringTarget) {
      targetX = this.ringTarget.x;
    }

    // 柵のない所では端に寄りすぎない
    const openEdge = t.zoneAt(r.s + look) === 'ground' && t.edgeAt(r.s + look) === 'open';
    const margin = openEdge ? a.openEdgeMargin : a.wallEdgeMargin;
    targetX = clamp(targetX, -(half - margin), half - margin);

    // 腕前が低いほど、ゆらゆらとふらつく
    const wobble = Math.sin(this.time * 1.7) * (1 - this.skill) * a.wobble;

    // かじ取り：目標ラインとのずれ・向きのずれ・先のカーブから決める
    const steer =
      -(r.x - targetX - wobble) * a.steerToLine
      - r.angle * a.steerToAngle
      - curvAhead * a.steerToCurve;
    input.steer = clamp(steer, -1, 1);

    // ブースト：ゲージ満タンで、先がまっすぐなときに少し迷ってから使う
    const straight = Math.abs(t.curvatureAt(r.s + look * 2)) < a.straightCurvature;
    if (r.gauge >= 1 && straight && r.boostTime <= 0) {
      this.boostWait += dt;
      if (this.boostWait > a.boostDelay * (1.5 - this.skill)) {
        input.boost = true;
        this.boostWait = 0;
      }
    } else {
      this.boostWait = 0;
    }

    return input;
  }

  // ドリフトするか（地上の急なカーブで押し続け、カーブが終わる・向きが変わると離す）
  thinkDrift() {
    const a = CONFIG.ai;
    const r = this.racer;
    const t = this.track;
    if (t.zoneAt(r.s) !== 'ground' || r.state === 'respawn') {
      this.driftSign = 0;
      this.curveDecision = null;
      return false;
    }
    const k = t.curvatureAt(r.s + a.lookAheadBase);
    const sign = k > 0 ? -1 : 1;   // 左カーブ（k > 0）なら左（-1）へドリフト

    if (this.driftSign !== 0) {
      // カーブがゆるくなった、または向きが変わったら離す
      if (Math.abs(k) < a.driftCurvature * 0.4 || sign !== this.driftSign) {
        this.driftSign = 0;
        this.curveDecision = null;
        return false;
      }
      return true;
    }

    if (Math.abs(k) >= a.driftCurvature) {
      // このカーブでドリフトするかを一度だけ決める
      if (this.curveDecision === null) {
        this.curveDecision = pseudoRandom(r.distance * 0.013 + this.time) < this.skill * a.driftChance;
      }
      if (this.curveDecision && r.speed > CONFIG.racer.driftMinSpeed) {
        this.driftSign = sign;
        return true;
      }
    } else {
      this.curveDecision = null;
    }
    return false;
  }

  // 空中で目標の高さに近づける上下の入力（地上では 0）。リングを狙っていればその高さ
  thinkHeight() {
    const r = this.racer;
    if (this.track.zoneAt(r.s) !== 'air') return 0;
    const a = CONFIG.ai;
    const targetY = this.ringTarget ? this.ringTarget.y : this.heightBias;
    const error = targetY - r.y;
    return clamp(error * a.pitchToHeight - r.vy * a.pitchDamping, -1, 1);
  }

  // 前方の、狙うと決めたリングのうち一番近いものを選ぶ（なければ null）
  pickRing() {
    if (!this.rings) return null;
    const a = CONFIG.ai;
    const r = this.racer;
    const len = this.track.length;
    const prefersHigh = this.heightBias >= 0;
    let best = null;
    let bestDist = Infinity;
    const list = this.rings.list;

    for (let i = 0; i < list.length; i += 1) {
      const ring = list[i];
      // 好きなルートのリングだけを候補にする
      if ((ring.y > 0) !== prefersHigh) continue;
      let ahead = ring.s - r.s;
      if (ahead < 0) ahead += len;
      if (ahead < 2 || ahead > a.ringLookAhead) continue;

      // このリングを狙うかどうかは、周回ごとに一度だけ決める
      const lap = Math.floor((r.distance + ahead) / len);
      const key = i + ':' + lap;
      if (!this.ringDecisions.has(key)) {
        const roll = pseudoRandom(i * 7.3 + lap * 13.1 + this.time * 0.01);
        this.ringDecisions.set(key, roll < this.skill * a.ringAimChance);
      }
      if (!this.ringDecisions.get(key)) continue;

      if (ahead < bestDist) {
        bestDist = ahead;
        best = ring;
      }
    }
    return best;
  }
}

// 0〜1 の疑似乱数（同じ数を入れると同じ結果）
function pseudoRandom(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}
