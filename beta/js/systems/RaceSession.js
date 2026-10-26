/*
  ファイル名 : RaceSession.js
  保存場所   : /js/systems
  役割       : 1レース分のまとまり。6人のレーサー・CPUの思考・見た目・押し合い・
               追い上げ補正・レース進行（RaceManager）・画面表示（HUD）をまとめて動かす。
               Game.js から「レースを1つ作る → 毎回動かす → 終わったら片付ける」ように使う
  バージョン : 1.18.0（Phase19：みんなで対戦。相手の機体は届いた位置で動かす）
*/

import { CONFIG } from '../config.js';
import { Racer } from '../entities/Racer.js';
import { RacerSprite } from '../entities/RacerSprite.js';
import { CHARACTERS } from '../entities/Characters.js';
import { AIController } from '../ai/AIController.js';
import { updateBest } from './Records.js';
import { resolveCollisions } from './Collision.js';
import { RaceManager } from './RaceManager.js';
import { HUD } from '../ui/HUD.js';
import { Rings } from '../world/Rings.js';
import { Effects } from '../render/Effects.js';
import { NetRace } from '../net/NetRace.js';

export class RaceSession {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {Track} o.track
   * @param {object} o.course コース（Courses.js。自己ベストの保存先に id を使う）
   * @param {GrandPrix} o.gp   グランプリ中なら、その進み具合（得点を数える）
   * @param {function} o.onNext グランプリの結果画面で「次のレースへ」が押されたときに呼ぶ関数
   * @param {object} o.atlas      ドット絵の画像（buildAtlas の戻り値）
   * @param {THREE.Camera} o.camera
   * @param {CameraRig} o.cameraRig
   * @param {AudioManager} o.audio
   * @param {Debug} o.debug
   * @param {number} o.playerCharIndex プレイヤーのキャラクター番号（0〜5）
   * @param {function} o.onRetry  結果画面の「もう一度」が押されたときに呼ぶ関数
   * @param {function} o.onSelect 結果画面の「キャラ選択」が押されたときに呼ぶ関数
   * @param {function} o.onTitle  結果画面の「タイトル」が押されたときに呼ぶ関数
   * @param {object} o.net  みんなで対戦なら { room, slots: [{ pid, char, name }], mySlot }
   * @param {function} o.onRoom  みんなで対戦の結果画面「部屋に戻る」
   * @param {function} o.onLeave みんなで対戦の結果画面「部屋を出る」
   */
  constructor(o) {
    this.scene = o.scene;
    this.track = o.track;
    this.course = o.course;
    this.gp = o.gp || null;
    this.onNext = o.onNext || null;
    this.atlas = o.atlas;
    this.camera = o.camera;
    this.cameraRig = o.cameraRig;
    this.audio = o.audio;
    this.debug = o.debug;
    this.onRetry = o.onRetry || null;
    this.onSelect = o.onSelect || null;
    this.onTitle = o.onTitle || null;
    this.net = o.net || null;
    this.onRoom = o.onRoom || null;
    this.onLeave = o.onLeave || null;
    this.netRace = null;
    this.shownFinishes = 0;

    this.racers = [];    // 全レーサー（プレイヤーを含む6人）
    this.sprites = [];   // racers と同じ順番の見た目
    this.ais = [];       // racers と同じ順番のCPU思考（プレイヤーは null）
    this.player = null;
    this.playerSprite = null;
    this.playerBumps = 0;
    this.bumpSoundWait = 0;   // ぶつかる音を続けて鳴らしすぎないための待ち時間
    this.ringCombo = 0;       // リングを続けて取った数（音が高くなる）
    this.lastRingTime = -99;
    this.lastBoostTime = 0;
    this.hudView = { rank: 0, total: 0, lap: 1, laps: 3, time: 0, gauge: 0, countdown: null, drift: -1 };
    this.playerTurbos = 0;

    // スタートダッシュ：'none'（まだ）/ 'ready'（成功の予定）/ 'early'（押すのが早すぎ）
    this.dashState = 'none';
    // 結果表
    this.resultsShown = false;
    this.resultsWait = 0;

    if (this.net) this.createNetRacers();
    else this.createRacers(o.playerCharIndex || 0);

    // 空中のリング（ゲージは最初は空で、リングで溜める）
    this.rings = new Rings(this.scene, this.track, this.track.data.rings);
    for (const r of this.racers) {
      r.gauge = CONFIG.rings.startGauge;
    }
    // CPUにリングの場所を教える（リングを狙って飛ぶ）
    for (const ai of this.ais) {
      if (ai) ai.setRings(this.rings);
    }
    this.airHintShown = false;
    this.playerRings = 0;

    // 粒の演出（火花・炎・きらめき）
    this.effects = new Effects(this.scene);
    this.ringPos = { x: 0, y: 0, z: 0 };   // リングのきらめき用（毎回作らない）

    this.race = new RaceManager(this.racers, this.track);
    this.hud = new HUD(document.body);
    this.setupRaceEvents();
    if (this.net) {
      // 全員のコースの読み込みが終わるまで、カウントダウンを始めない（release で始まる）
      this.race.hold = true;
      this.netRace = new NetRace({ room: this.net.room, racers: this.racers, race: this.race, slots: this.net.slots });
      this.netRace.onLeft = (racer, slot) => this.takeOver(racer, slot);
      this.hud.showBanner('みんなの準備を待っています…', 0, 'hint');
    } else {
      this.hud.showBanner('GO直前にブーストでスタートダッシュ！', 2.2, 'hint');
    }

    // カメラをプレイヤーの真後ろに合わせる
    this.player.computeRenderPose(1);
    this.cameraRig.snap(this.player);
  }

  // ---- レーサーを作る（CPUはプレイヤー以外の5人） ----
  createRacers(playerCharIndex) {
    const r = CONFIG.race;
    const others = CHARACTERS.filter((_, i) => i !== playerCharIndex);
    let cpu = 0;

    for (let slot = 0; slot < r.racerCount; slot += 1) {
      const isPlayer = slot === r.playerGridSlot;
      const character = isPlayer ? CHARACTERS[playerCharIndex] : others[cpu % others.length];
      const racer = new Racer({ id: slot, character, track: this.track, isPlayer });

      // スタートグリッド：2列で、前の人ほどスタートラインに近い
      const row = Math.floor(slot / 2);
      const side = slot % 2 === 0 ? -1 : 1;
      racer.placeAt(-(r.gridFront + row * r.gridRowGap), side * r.gridSideOffset);

      const sprite = new RacerSprite(this.atlas, character.id);
      sprite.time = slot * 0.7;   // ふわふわの動きをずらす
      this.scene.add(sprite.object3d);

      let ai = null;
      if (isPlayer) {
        this.player = racer;
        this.playerSprite = sprite;
      } else {
        const p = CONFIG.ai.personalities[cpu % CONFIG.ai.personalities.length];
        ai = new AIController(racer, this.track, { ...p, seed: slot * 3.1 });
        cpu += 1;
      }

      this.racers.push(racer);
      this.sprites.push(sprite);
      this.ais.push(ai);
    }
  }

  // ---- みんなで対戦：スタートの位置と、だれが動かすかを決めてレーサーを作る ----
  // 人の機体：自分の分は自分で動かし、他の人の分は届いた位置で動かす。
  // CPU：ホストが動かし、ゲストの画面では届いた位置で動かす
  createNetRacers() {
    const r = CONFIG.race;
    const net = this.net;
    const isHost = net.room.isHost;
    let cpu = 0;
    net.slots.forEach((slot, i) => {
      const character = CHARACTERS[slot.char] || CHARACTERS[0];
      const isPlayer = i === net.mySlot;
      const racer = new Racer({ id: i, character, track: this.track, isPlayer });
      racer.isHuman = slot.pid >= 0;
      racer.netName = racer.isHuman ? slot.name : character.name;
      racer.remote = !isPlayer && (racer.isHuman || !isHost);
      const row = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      racer.placeAt(-(r.gridFront + row * r.gridRowGap), side * r.gridSideOffset);

      const sprite = new RacerSprite(this.atlas, character.id);
      sprite.time = i * 0.7;
      if (racer.isHuman && !isPlayer) sprite.setLabel(slot.name);
      this.scene.add(sprite.object3d);

      let ai = null;
      if (isPlayer) {
        this.player = racer;
        this.playerSprite = sprite;
      } else if (!racer.isHuman) {
        const p = CONFIG.ai.personalities[cpu % CONFIG.ai.personalities.length];
        cpu += 1;
        if (!racer.remote) ai = new AIController(racer, this.track, { ...p, seed: i * 3.1 });
      }
      this.racers.push(racer);
      this.sprites.push(sprite);
      this.ais.push(ai);
    });
  }

  // みんなで対戦：全員の準備ができたので、カウントダウンを始める
  release() {
    if (!this.race.hold) return;
    this.race.hold = false;
    this.hud.showBanner('GO直前にブーストでスタートダッシュ！', 2.2, 'hint');
  }

  // ホスト：抜けた人の機体をCPUが引き継ぐ
  takeOver(racer, slot) {
    racer.remote = false;
    racer.isHuman = false;
    racer.moveAngle = racer.angle;
    const ai = new AIController(racer, this.track, { lineOffset: 0, skill: 0.85, seed: slot * 3.1 });
    ai.setRings(this.rings);
    this.ais[slot] = ai;
    this.hud.showBanner(racer.netName + ' が抜けました（CPUが代わりに走ります）', 2.5, 'hint');
  }

  // ---- レースの合図に合わせて、画面にお知らせを出し、効果音を鳴らす ----
  setupRaceEvents() {
    const race = this.race;
    race.on('count', () => this.audio.play('count'));
    race.on('go', () => {
      const r = CONFIG.race;
      this.audio.play('go');
      if (this.dashState === 'ready') {
        this.player.startBoost(r.startDashTime);
        this.hud.showBanner('ダッシュ！', 1.0, 'go');
      } else {
        this.hud.showBanner('GO!', 1.0, 'go');
      }
      if (this.dashState === 'early') {
        this.debug.log('スタートダッシュ失敗（早すぎ）');
      }
      // CPUは腕前に応じた確率でスタートダッシュ（毎回同じ結果にならないよう時刻で変える）
      const salt = (Date.now() % 997) / 997;
      for (let i = 0; i < this.racers.length; i += 1) {
        const ai = this.ais[i];
        if (!ai) continue;
        const roll = (Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453) % 1;
        if (Math.abs(roll) < ai.skill * r.cpuDashChance) {
          this.racers[i].startBoost(r.startDashTime * 0.8);
        }
      }
    });
    race.on('lap', (racer, lap) => {
      if (racer.isPlayer && lap < race.laps) {
        this.hud.showBanner('LAP ' + lap, 1.5);
        this.audio.play('lap');   // 最終周に入るときはここに来ず、finalLap の音が鳴る
      }
    });
    race.on('finalLap', (racer) => {
      if (racer.isPlayer) {
        this.hud.showBanner('FINAL LAP', 2.0, 'final');
        this.audio.play('finalLap');
      }
    });
    race.on('finish', (racer, rank) => {
      this.debug.log(racer.character.name + ' ゴール ' + rank + '位');
      if (racer.isPlayer) {
        this.hud.showBanner('GOAL!  ' + rank + '位', 0, 'goal');
        this.audio.play('goal');
        // ゴール後はCPUと同じ思考で自動で走らせる
        const index = this.racers.indexOf(racer);
        this.ais[index] = new AIController(racer, this.track, { lineOffset: 0, skill: 0.9, seed: 1 });
        this.ais[index].setRings(this.rings);
      }
    });
  }

  // ---- ゲームロジック（1秒60回） ----
  update(dt, input) {
    const player = this.player;
    const wasRespawning = player.state === 'respawn';

    // みんなで対戦：位置を送り、届いた位置で相手を動かす
    if (this.netRace) this.netRace.update(dt);

    // カウントダウン中はレーサーを止めておく
    if (this.race.isRunning()) {
      this.updateRubberBand();

      // 全員：入力を決めて（プレイヤーは指・キー、CPUは思考）、同じ物理で動かす
      for (let i = 0; i < this.racers.length; i += 1) {
        const ai = this.ais[i];
        if (this.racers[i].remote) continue;   // 届いた位置で動く相手（NetRace が動かす）
        this.racers[i].applyInput(ai ? ai.think(dt) : input);
        this.racers[i].step(dt);
      }

      // レーサー同士の押し合い
      const wasBumped = player.bumped;
      resolveCollisions(this.racers, this.track);
      this.bumpSoundWait = Math.max(0, this.bumpSoundWait - dt);
      if (player.bumped && !wasBumped) {
        this.playerBumps += 1;
        if (this.bumpSoundWait <= 0) {
          this.audio.play('bump');
          this.bumpSoundWait = CONFIG.audio.bumpSoundInterval;
        }
      }

      // リングを通り抜けたか
      for (const racer of this.racers) {
        if (racer.remote) continue;
        this.rings.check(racer, (ring) => this.onRing(racer, ring));
      }

      // 初めて空中に入ったときに、上下操作の案内を出す
      if (!this.airHintShown && this.track.zoneAt(player.s) === 'air') {
        this.airHintShown = true;
        this.hud.showBanner('↕ 上下で上昇・下降！リングを通ろう', 2.5, 'hint');
      }
    }

    // スタートダッシュの判定（カウントダウン中にブーストを押したか）
    if (this.race.phase === 'countdown' && input.boost && this.dashState !== 'early') {
      this.dashState = this.race.countdown <= CONFIG.race.startDashWindow ? 'ready' : 'early';
    }

    // 周回・順位・ゴールの判定
    this.race.step(dt);

    // 自分がゴールしたら、少し待ってから結果表を出す
    if (this.race.phase === 'finished' && !this.resultsShown) {
      this.resultsWait += dt;
      const r = CONFIG.race;
      const allDone = this.race.finishOrder.length === this.racers.length;
      const maxWait = this.net ? CONFIG.net.resultWait : r.resultMaxWait;
      if (this.resultsWait >= r.resultMinWait && (allDone || this.resultsWait >= maxWait)) {
        this.showResults();
      }
    } else if (this.net && this.resultsShown && this.race.finishOrder.length !== this.shownFinishes) {
      // みんなで対戦：結果を出した後に、他の人のゴールが届いたら表を書き直す
      this.showResults();
    }

    // コースから落ちたとき・復帰したときの音
    if (!wasRespawning && player.state === 'respawn') {
      this.debug.log('コースアウト！');
      this.audio.play('fall');
    } else if (wasRespawning && player.state !== 'respawn') {
      this.audio.play('respawn');
    }

    // ミニターボ：火花をパッと散らす。自分なら音を鳴らして数える（デバッグ表示用）
    for (const r of this.racers) {
      if (r.lastTurbo > 0) {
        if (!r.remote) r.lastTurboSeen = r.lastTurbo;   // 相手の画面にも火花を出してもらう（NetRace が送る）
        this.effects.turboBurst(r, r.lastTurbo);
        if (r.isPlayer) {
          this.playerTurbos += 1;
          this.audio.play('turbo');
        }
        r.lastTurbo = 0;
      }
    }

    // ブーストが始まった瞬間に音を鳴らす
    if (player.boostTime > this.lastBoostTime + 0.01) {
      this.audio.play('boost');
    }
    this.lastBoostTime = player.boostTime;
  }

  // リングを通り抜けたとき
  onRing(racer, ring) {
    const c = CONFIG.rings;
    if (ring.type === 'gauge') {
      racer.gauge = Math.min(1, racer.gauge + c.gaugeAmount);
      if (racer.isPlayer) {
        // 前のリングからすぐなら連続ボーナス：1つごとに音を全音（半音2つ）ずつ上げる
        const a = CONFIG.audio;
        const now = this.race.time;
        this.ringCombo = now - this.lastRingTime < a.ringComboTime ? this.ringCombo + 1 : 0;
        this.lastRingTime = now;
        const steps = Math.min(this.ringCombo, a.ringComboMax);
        this.audio.play('ring', { pitch: Math.pow(2, (steps * 2) / 12) });
        this.playerRings += 1;
      }
    } else if (ring.type === 'boost') {
      racer.startBoost(c.boostTime);
      if (racer.isPlayer) {
        this.playerRings += 1;
        this.lastRingTime = this.race.time;   // ブーストリングでも連続は途切れない
      }
      // ブースト音は、ブースト開始を見張っている update で鳴る
    }
    // 自分が通ったときだけ、リングからきらめきを散らす（粒を使いすぎないため）
    if (racer.isPlayer) {
      this.track.toWorld(ring.s, ring.x, ring.y, this.ringPos);
      this.effects.ringBurst(this.ringPos, ring.type === 'gauge' ? c.gaugeColor : c.boostColor);
    }
  }

  // 結果画面を出す（ゴールしていない人は「記録なし」で、走った距離の順）
  showResults() {
    this.resultsShown = true;
    this.shownFinishes = this.race.finishOrder.length;
    const ranking = this.race.getRanking();
    const rows = ranking.map((racer, i) => ({
      rank: i + 1,
      name: racer.netName || racer.character.name,
      human: !!racer.isHuman,
      charIndex: CHARACTERS.indexOf(racer.character),
      time: this.race.finishTimeOf(racer),
      isPlayer: racer.isPlayer
    }));
    this.hud.hideBanner();
    const call = (fn) => () => { if (fn) fn(); };
    this.hud.showResults({
      rows,
      atlasCanvas: this.atlas.texture.image,
      best: updateBest(this.course ? this.course.id : 'skyTemple', this.race.finishTimeOf(this.player), this.player.character),
      courseName: this.course ? this.course.name : '',
      gp: this.gp ? this.gp.addRace(rows) : null,
      online: !!this.net,
      onRoom: call(this.onRoom),
      onLeave: call(this.onLeave),
      onNext: call(this.onNext),
      onRetry: call(this.onRetry),
      onSelect: call(this.onSelect),
      onTitle: call(this.onTitle)
    });
  }

  // CPUの追い上げ補正：前にいるCPUは少し遅く、後ろにいるCPUは少し速く。難しさで全体の速さも変わる
  updateRubberBand() {
    const rb = CONFIG.rubberBand;
    // みんなで対戦では、人の機体の平均の位置を基準にする
    let base = this.player.distance;
    if (this.net) {
      let sum = 0;
      let n = 0;
      for (const r of this.racers) {
        if (r.isHuman || r.isPlayer) { sum += r.distance; n += 1; }
      }
      if (n) base = sum / n;
    }
    for (const racer of this.racers) {
      if (racer.isPlayer || racer.remote || racer.isHuman) continue;
      const gap = racer.distance - base;
      const ratio = Math.min(1, Math.abs(gap) / rb.range);
      // cpuSpeed は難しさによる最高速の倍率（ふつう = 1）
      racer.speedScale = (gap > 0 ? 1 - ratio * rb.maxSlow : 1 + ratio * rb.maxFast) * (rb.cpuSpeed || 1);
    }
  }

  // ---- 描画の準備（毎フレーム） ----
  // 順番が大事：位置を決める → カメラを動かす → 背景 → 絵をカメラへ向ける
  render(alpha, frameTime, environment, paused) {
    const player = this.player;
    player.computeRenderPose(alpha);
    if (player.justRespawned) {
      // 復帰した瞬間はカメラをすぐ後ろへ合わせ直す
      player.justRespawned = false;
      this.cameraRig.snap(player);
    } else {
      this.cameraRig.follow(player, this.track, frameTime);
    }
    environment.update(frameTime, this.camera.position);

    for (let i = 0; i < this.racers.length; i += 1) {
      const racer = this.racers[i];
      if (racer !== player) {
        racer.computeRenderPose(alpha);
        racer.justRespawned = false;
      }
      this.updateSprite(racer, this.sprites[i], frameTime);
      // 一時停止中は新しい粒を出さない
      if (!paused) this.effects.emitForRacer(racer, frameTime);
    }
    if (!paused) this.effects.update(frameTime);
    this.audio.setEngine(paused ? 0 : player.getSpeedRatio());
    this.audio.setDrift(!paused && player.state === 'drift' ? player.driftLevel : -1);
    // 風の音：速いほど強く、空中では地上より大きく
    const a = CONFIG.audio;
    const fast = Math.max(0, Math.min(1, (player.getSpeedRatio() - a.windStartSpeed) / (1.2 - a.windStartSpeed)));
    const inAir = this.track.zoneAt(player.s) === 'air' && player.state !== 'respawn';
    this.audio.setWind(paused ? 0 : fast * (inAir ? 1 : a.windGroundRatio));
    this.rings.update(frameTime);

    // 順位・周回・タイム・ゲージ・カウントダウン
    const race = this.race;
    const v = this.hudView;
    const finishTime = race.finishTimeOf(player);
    v.rank = race.rankOf(player);
    v.total = this.racers.length;
    v.lap = race.currentLap(player);
    v.laps = race.laps;
    v.time = finishTime !== null ? finishTime : race.time;
    v.gauge = player.gauge;
    v.drift = player.state === 'drift' ? player.driftLevel : -1;
    v.countdown = race.countdownText();
    this.hud.update(v, frameTime);
  }

  // レーサー1人の見た目を更新する
  updateSprite(racer, sprite, frameTime) {
    sprite.update(racer, this.camera, frameTime);
    // 空中と落下中は足元の影を消す（下に地面がないため）
    sprite.shadow.visible = this.track.zoneAt(racer.s) === 'ground' && racer.state !== 'respawn';
    // 落ちきったら隠す。復帰直後は点滅させる
    const blinkOff = racer.invincibleTime > 0 && Math.floor(racer.invincibleTime * 10) % 2 === 0;
    // カメラのすぐ近く（自分とカメラの間など）にいるCPUは隠す。
    // ドット絵が画面いっぱいに大きく映って、前が見えなくなるのを防ぐ
    let tooClose = false;
    if (!racer.isPlayer) {
      const dx = racer.renderPos.x - this.camera.position.x;
      const dy = racer.renderPos.y - this.camera.position.y;
      const dz = racer.renderPos.z - this.camera.position.z;
      const near = CONFIG.sprite.nearHide;
      tooClose = dx * dx + dy * dy + dz * dz < near * near;
    }
    sprite.object3d.visible = !racer.isHidden() && !blinkOff && !tooClose;
  }

  // キャラクターの切り替え（PCの数字キーでの確認用）
  selectCharacter(index) {
    const ch = CHARACTERS[index];
    if (!ch || this.net) return;
    this.player.setCharacter(ch);
    this.playerSprite.setCharacter(ch.id);
    this.debug.log(ch.name + '（' + ch.type + '）');
  }

  // デバッグ表示用の文字（左上に出す）
  describe(input) {
    const p = this.player;
    const t = this.track;
    let cpuFalls = 0;
    for (const r of this.racers) {
      if (r !== p) cpuFalls += r.fallCount;
    }
    return [
      '旋回 ' + fmt(input.steer) + '  上下 ' + fmt(input.pitch),
      '速度 ' + (p.speed * 3.6).toFixed(0) + ' km/h  最高 ' + (p.maxSpeed * 3.6).toFixed(0) + ' km/h' +
        '  高さ ' + fmt(p.y) + ' m',
      '位置 ' + p.s.toFixed(0) + '/' + t.length.toFixed(0) + ' m  横 ' + fmt(p.x) + '  ' +
        AREA_NAMES[t.areaAt(p.s)] + (t.zoneAt(p.s) === 'air' ? '（空中）' : ''),
      'ゲージ ' + Math.round(p.gauge * 100) + '%  ブースト残 ' + p.boostTime.toFixed(1) +
        (p.wallHit ? '  壁' : '') + '  状態 ' + p.state + '  落下 ' + p.fallCount + '回' +
        (p.state === 'drift' ? '  ドリフト ' + ['溜め中', '青●', 'オレンジ●●'][p.driftLevel] : ''),
      'レース ' + this.race.phase + '  CPUの落下 ' + cpuFalls + '回  自分の接触 ' + this.playerBumps + '回' +
        '  リング ' + this.playerRings + '個  ミニターボ ' + this.playerTurbos + '回'
    ];
  }

  // 片付け（次のレースを作る前に呼ぶ。Step5-2で使う）
  dispose() {
    if (this.netRace) this.netRace.dispose();
    for (const sprite of this.sprites) {
      this.scene.remove(sprite.object3d);
      sprite.geometry.dispose();
      sprite.shadow.geometry.dispose();   // 足元の影（v1.0.0 まで片付け忘れていた）
      sprite.disposeLabel();
    }
    this.hud.dispose();
    this.rings.dispose();
    this.effects.dispose();
    // レースの音を止める（キャラ選択やタイトルで、エンジン音が鳴り続けないように）
    this.audio.setDrift(-1);
    this.audio.setWind(0);
    this.audio.silenceEngine();
  }
}

// デバッグ表示用の区間名
const AREA_NAMES = {
  start: 'スタート浮遊島',
  cloud: '雲海',
  corridor: '空中回廊',
  ruins: '古代遺跡',
  temple: '天空神殿'
};

// 数値を符号付き小数2桁の文字にする
function fmt(v) {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}
