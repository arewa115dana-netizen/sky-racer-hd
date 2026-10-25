/*
  ファイル名 : Racer.js
  保存場所   : /js/entities
  役割       : レーサー1人の状態と物理。プレイヤーもCPUも同じ計算で走る
  バージョン : 0.7.1（Phase7 Step7-1）
  メモ       : 状態は 走行（drive）・ドリフト（drift）・空中（air）・復帰中（respawn）。
               空中では上下に動ける（飛行の能力で速さが変わる）。
               ドリフト：地上でドリフトボタンを押しながら曲がると始まり、火花を2段階で溜め、
               離すとミニターボ（ドリフトの能力で溜まる速さと長さが変わる）
               柵のない道の端から外に出ると落下し、少し手前に戻って再開する

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
    this.bumped = false;       // 他のレーサーとぶつかっているか（Collision が設定）
    this.speedScale = 1;       // 最高速の倍率（CPUの追い上げ補正に使う）

    // ドリフト
    this.driftDir = 0;         // ドリフトの向き（-1 = 左、1 = 右）
    this.driftCharge = 0;      // 溜まり具合（秒に近い単位）
    this.driftLevel = 0;       // 0 = なし、1 = 青、2 = オレンジ
    this.lastTurbo = 0;        // 直前に出したミニターボの段階（演出・音の合図。読んだら0に戻す）

    // コースアウトと復帰
    this.respawnTimer = 0;     // 落ちてからの時間
    this.fallDirection = 0;    // 落ちた向き（-1 = 左、1 = 右）
    this.invincibleTime = 0;   // 復帰直後の点滅時間（Phase4以降は衝突しない時間）
    this.justRespawned = false;// 復帰した瞬間だけ true（カメラを合わせ直す合図）
    this.fallCount = 0;

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
    // 飛行の能力：空中での上下の速さと、空中での最高速の倍率
    this.climbRate = r.climbRate * (1 + (st.flight - 3) * r.climbPerStat);
    this.airSpeedScale = 1 + (st.flight - 3) * r.airSpeedPerStat;
    // ドリフトの能力：火花の溜まる速さと、ミニターボの長さ
    this.driftChargeRate = 1 + (st.drift - 3) * r.driftChargePerStat;
    this.turboScale = 1 + (st.drift - 3) * r.turboPerStat;
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

    if (this.invincibleTime > 0) {
      this.invincibleTime = Math.max(0, this.invincibleTime - dt);
    }

    // 落下中は操作を受け付けず、落下と復帰だけを計算する
    if (this.state === 'respawn') {
      this.stepRespawn(dt);
      return;
    }

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

    // 速さ：自動アクセルで目標の速さへ近づける（空中では飛行の能力で変わる）
    const inAir = track.zoneAt(this.s) === 'air';
    this.updateDrift(dt, inAir);
    const drifting = this.state === 'drift';
    let top = this.maxSpeed * this.speedScale * (inAir ? this.airSpeedScale : 1);
    if (drifting) top *= r.driftSpeedScale;
    let target = boosting ? top * r.boostMultiplier : top;
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
    if (drifting) {
      // ドリフト中：始めた向きに強く曲がる。同じ向きに倒すとより鋭く、逆に倒すとゆるく
      const amount = r.driftBaseTurn + r.driftSteerRange * input.steer * this.driftDir;
      this.angle += this.driftDir * amount * this.turnRate * r.driftTurnScale * turnFactor * dt;
      // 少し外側へ滑る
      this.x -= this.driftDir * r.driftSlide * dt;
    } else {
      this.angle += input.steer * this.turnRate * turnFactor * dt;
    }

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

    const zone = track.zoneAt(this.s);
    const half = track.widthAt(this.s) / 2;
    this.wallHit = false;

    // 柵のない道の端：外に出すぎると落下
    if (zone === 'ground' && track.edgeAt(this.s) === 'open') {
      this.y = 0;
      if (this.state !== 'drift') this.state = 'drive';
      if (Math.abs(this.x) > half + r.fallMargin) {
        this.startFall();
      }
      return;
    }

    // 柵のある所・空中区間：道の端で押し戻し、こすれている間は減速
    const limit = half - r.wallMargin;
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

    if (zone === 'air') {
      if (this.state === 'drift') this.endDrift(true);
      this.stepFlight(dt);
      this.state = 'air';
    } else {
      this.y = 0;
      this.vy = 0;
      if (this.state !== 'drift') this.state = 'drive';
    }
  }

  // ---- ドリフト ----
  // 始める・溜める・終わるの判定（毎回、旋回の計算より前に呼ぶ）
  updateDrift(dt, inAir) {
    const r = CONFIG.racer;
    const input = this.input;

    if (this.state === 'drift') {
      // ボタンを離した・空中に出た → 溜めた段階のミニターボ
      if (!input.drift || inAir) {
        this.endDrift(true);
        return;
      }
      // 遅くなりすぎた → ミニターボなしで終わる
      if (this.speed < r.driftMinSpeed * 0.7) {
        this.endDrift(false);
        return;
      }
      // 溜める（曲がる向きに強く倒しているほど早く溜まる）
      const tight = (input.steer * this.driftDir + 1) / 2;
      this.driftCharge += dt * this.driftChargeRate * (0.6 + 0.4 * tight);
      this.driftLevel = this.driftCharge >= r.driftLevel2 ? 2 : (this.driftCharge >= r.driftLevel1 ? 1 : 0);
      return;
    }

    // 始める：地上で、ボタンを押しながら、ある程度曲がっていて、十分速い
    if (!inAir && this.state === 'drive' && input.drift &&
        Math.abs(input.steer) > r.driftStartSteer && this.speed > r.driftMinSpeed) {
      this.state = 'drift';
      this.driftDir = input.steer > 0 ? 1 : -1;
      this.driftCharge = 0;
      this.driftLevel = 0;
    }
  }

  // ドリフトを終える（withTurbo が true なら、溜めた段階のミニターボを出す）
  endDrift(withTurbo) {
    const r = CONFIG.racer;
    if (withTurbo && this.driftLevel > 0) {
      const time = this.driftLevel === 2 ? r.turboTime2 : r.turboTime1;
      this.startBoost(time * this.turboScale);
      this.lastTurbo = this.driftLevel;
    }
    this.state = 'drive';
    this.driftDir = 0;
    this.driftCharge = 0;
    this.driftLevel = 0;
  }

  // ---- 空中の上下の動き ----
  stepFlight(dt) {
    const r = CONFIG.racer;
    const track = this.track;

    // スティックの上下で、上下の速さの目標を決める（なめらかに近づける）
    const targetVy = this.input.pitch * this.climbRate;
    this.vy += (targetVy - this.vy) * Math.min(1, dt * r.pitchResponse);

    // 着地アシスト：少し先が地上なら、高さを路面に寄せる
    if (track.zoneAt(this.s + r.landingAssist) === 'ground') {
      this.vy *= Math.max(0, 1 - dt * r.landingPull);
      this.y += (0 - this.y) * Math.min(1, dt * r.landingPull);
    }

    this.y += this.vy * dt;

    // 飛べる高さの範囲（端では止まるだけで、落ちない）
    const yMin = track.yMinAt(this.s);
    const yMax = track.yMaxAt(this.s);
    if (this.y < yMin) {
      this.y = yMin;
      if (this.vy < 0) this.vy = 0;
    } else if (this.y > yMax) {
      this.y = yMax;
      if (this.vy > 0) this.vy = 0;
    }
  }

  // ---- コースアウトと復帰 ----
  startFall() {
    this.driftDir = 0;
    this.driftCharge = 0;
    this.driftLevel = 0;
    this.state = 'respawn';
    this.respawnTimer = 0;
    this.fallDirection = this.x > 0 ? 1 : -1;
    this.vy = 0;
    this.boostTime = 0;
    this.fallCount += 1;
  }

  stepRespawn(dt) {
    const r = CONFIG.racer;
    this.respawnTimer += dt;

    if (this.respawnTimer < r.fallTime) {
      // 道の外へ流れながら落ちていく（前には進まない）
      this.vy -= r.gravity * dt;
      this.y += this.vy * dt;
      this.x += this.fallDirection * this.speed * 0.3 * dt;
      this.speed *= Math.max(0, 1 - 1.5 * dt);
      return;
    }

    if (this.respawnTimer >= r.respawnTime) {
      // 少し手前の道の中央に戻し、速度を半分にして再開
      const back = Math.max(0, this.distance - r.respawnBack);
      this.placeAt(back, 0);
      this.speed = this.maxSpeed * r.respawnSpeed;
      this.state = this.track.zoneAt(this.s) === 'air' ? 'air' : 'drive';
      this.invincibleTime = r.respawnBlink;
      this.justRespawned = true;
    }
  }

  // 落下中で、絵を隠す時間か
  isHidden() {
    return this.state === 'respawn' && this.respawnTimer >= CONFIG.racer.fallTime;
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
