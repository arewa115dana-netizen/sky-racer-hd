/*
  ファイル名 : Racer.js
  保存場所   : /js/entities
  役割       : レーサー1人の状態と物理。プレイヤーもCPUも同じ計算で走る
  バージョン : 0.2.4（Phase2 Step2-4）
  メモ       : このステップでは「走行」状態のみ。
               空中はPhase6、ドリフトはPhase7、コースアウト復帰はPhase3で追加する

  位置はコース基準座標で持つ
    distance : スタートからの合計走行距離（周回をまたいで増え続ける）
    s        : コース上の位置（0〜コース全長）
    x        : 中心線から右へのずれ（メートル）
    y        : 高さ（メートル）
    angle    : コースの向きに対する自分の向きのずれ（右向きがプラス）
*/

import { CONFIG } from '../config.js';

export class Racer {
  constructor({ id, character, track, isPlayer = false }) {
    this.id = id;
    this.track = track;
    this.isPlayer = isPlayer;
    this.setCharacter(character);

    // 位置と動き
    this.distance = 0;
    this.s = 0;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.speed = 0;
    this.vy = 0;

    // 前回の計算結果（描画で滑らかにつなぐため）
    this.prevDistance = 0;
    this.prevX = 0;
    this.prevY = 0;
    this.prevAngle = 0;

    // 状態
    this.state = 'drive';
    this.lap = 0;
    this.gauge = 1;
    this.boostTime = 0;
    this.boostRequested = false;
    this.wallHit = false;

    // 受け取った入力
    this.input = { steer: 0, pitch: 0, drift: false, boost: false, brake: false };

    // 描画用の位置と向き（computeRenderPose で更新）
    this.renderPos = { x: 0, y: 0, z: 0 };
    this.renderYaw = 0;
  }

  // ---- キャラクターと能力値 ----
  setCharacter(character) {
    this.character = character;
    const st = character.stats;
    const r = CONFIG.racer;
    this.maxSpeed = r.baseMaxSpeed + (st.speed - 3) * r.maxSpeedPerStat;
    this.accel = r.baseAccel + (st.accel - 3) * r.accelPerStat;
    this.turnRate = r.baseTurnRate + (st.handling - 3) * r.turnPerStat;
  }

  // 指定の位置に置く（スタート時・復帰時）
  placeAt(distance, x) {
    this.distance = distance;
    this.s = this.wrap(distance);
    this.x = x;
    this.y = 0;
    this.angle = 0;
    this.speed = 0;
    this.prevDistance = distance;
    this.prevX = x;
    this.prevY = 0;
    this.prevAngle = 0;
    this.lap = Math.floor(distance / this.track.length);
  }

  // ---- 入力を受け取る ----
  applyInput(input) {
    const i = this.input;
    i.steer = input.steer;
    i.pitch = input.pitch;
    i.drift = input.drift;
    i.brake = input.brake;
    if (input.boost) {
      this.boostRequested = true;
    }
  }

  // ---- 1回分の計算（1/60秒） ----
  step(dt) {
    const r = CONFIG.racer;
    const input = this.input;
    const track = this.track;

    this.prevDistance = this.distance;
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevAngle = this.angle;

    // ブーストゲージ（試走用の自然回復）
    this.gauge = Math.min(1, this.gauge + r.gaugeRegen * dt);
    if (this.boostRequested) {
      this.boostRequested = false;
      if (this.gauge >= r.gaugeCost && this.boostTime <= 0) {
        this.gauge -= r.gaugeCost;
        this.startBoost(r.buttonBoostTime);
      }
    }
    if (this.boostTime > 0) {
      this.boostTime = Math.max(0, this.boostTime - dt);
    }
    const boosting = this.boostTime > 0;

    // 速さ：自動アクセルで目標の速さへ近づける
    let target = boosting ? this.maxSpeed * r.boostMultiplier : this.maxSpeed;
    if (input.brake) target = 0;
    if (this.speed < target) {
      const a = boosting ? r.boostAccel : this.accel;
      this.speed = Math.min(target, this.speed + a * dt);
    } else {
      const d = input.brake ? r.brakeDecel : r.drag;
      this.speed = Math.max(target, this.speed - d * dt);
    }

    // 旋回：遅いときは曲がる力を弱める
    const turnFactor = Math.min(1, this.speed / r.minTurnSpeed);
    this.angle += input.steer * this.turnRate * turnFactor * dt;

    // 進む：コースが曲がると、まっすぐ進んでいても向きのずれが増える
    const k = track.curvatureAt(this.s);
    const along = this.speed * Math.cos(this.angle) * dt;
    const ds = along / Math.max(0.2, 1 + k * this.x);
    this.angle += k * ds;
    this.x += this.speed * Math.sin(this.angle) * dt;
    this.distance += ds;
    this.s = this.wrap(this.distance);
    this.lap = Math.floor(this.distance / track.length);

    // 向きのずれには上限（コース上で逆走しないように）
    this.angle = clamp(this.angle, -r.maxAngle, r.maxAngle);

    // 壁：道の端で押し戻し、こすれている間は減速
    const limit = track.widthAt(this.s) / 2 - r.wallMargin;
    this.wallHit = false;
    if (this.x > limit) {
      this.x = limit;
      if (this.angle > 0) this.angle *= r.wallAngleKeep;
      this.wallHit = true;
    } else if (this.x < -limit) {
      this.x = -limit;
      if (this.angle < 0) this.angle *= r.wallAngleKeep;
      this.wallHit = true;
    }
    if (this.wallHit) {
      this.speed *= Math.max(0, 1 - r.wallFriction * dt);
    }

    // このステップでは地上のみ
    this.y = 0;
    this.state = 'drive';
  }

  // ブースト開始（ボタン・ミニターボ・ブーストリング共通）
  startBoost(seconds) {
    this.boostTime = Math.max(this.boostTime, seconds);
  }

  // ---- 描画用 ----

  // 前回と今回の計算結果の間（alpha = 0〜1）の位置と向きを求める
  computeRenderPose(alpha) {
    const d = this.prevDistance + (this.distance - this.prevDistance) * alpha;
    const s = this.wrap(d);
    const x = this.prevX + (this.x - this.prevX) * alpha;
    const y = this.prevY + (this.y - this.prevY) * alpha;
    const angle = this.prevAngle + (this.angle - this.prevAngle) * alpha;
    this.track.toWorld(s, x, y, this.renderPos);
    // 右向きのずれは、画面上では左回り（yaw）と逆向き
    this.renderYaw = this.track.yawAt(s) - angle;
  }

  // 今の位置を画面上の座標で out に入れる
  getWorldPosition(out) {
    return this.track.toWorld(this.s, this.x, this.y, out);
  }

  // 速さの割合（0〜1。ブースト中は1を超える）
  getSpeedRatio() {
    return this.speed / this.maxSpeed;
  }

  // ---- 補助 ----
  wrap(distance) {
    const len = this.track.length;
    let s = distance % len;
    if (s < 0) s += len;
    return s;
  }
}

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}
