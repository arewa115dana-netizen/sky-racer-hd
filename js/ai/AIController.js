/*
  ファイル名 : AIController.js
  保存場所   : /js/ai
  役割       : CPUの思考。プレイヤーと同じ「入力状態」（旋回・上下・ドリフト・ブースト）を
               作るだけで、動きはプレイヤーと同じ物理（Racer）で行う（ズルをしない）
  バージョン : 0.4.1（Phase4 Step4-1）

  考え方
    ・少し先のコースの曲がり具合を見て、カーブの内側寄りの走行ラインを決める
    ・CPUごとに「好きな走行位置（左寄り・右寄り）」と「腕前」を持たせ、団子状態を防ぐ
    ・ゲージが満タンで、先がまっすぐなときにブーストを使う
    ・柵のない所では端に寄りすぎない（落ちにくくする）
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
    this.time = personality.seed || 0;   // ふらつきの位相をCPUごとにずらす
    this.boostWait = 0;                  // ブーストを使うまでの迷い時間
    this.input = { steer: 0, pitch: 0, drift: false, boost: false, brake: false };
  }

  // 1回の計算（1/60秒）ごとに呼ぶ。入力状態を返す
  think(dt) {
    const a = CONFIG.ai;
    const r = this.racer;
    const t = this.track;
    const input = this.input;
    this.time += dt;

    input.boost = false;
    input.pitch = 0;
    input.drift = false;
    input.brake = false;

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
}

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}
