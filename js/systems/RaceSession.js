/*
  ファイル名 : RaceSession.js
  保存場所   : /js/systems
  役割       : 1レース分のまとまり。6人のレーサー・CPUの思考・見た目・押し合い・
               追い上げ補正・レース進行（RaceManager）・画面表示（HUD）をまとめて動かす。
               Game.js から「レースを1つ作る → 毎回動かす → 終わったら片付ける」ように使う
  バージョン : 0.5.2（Phase5 Step5-2）
*/

import { CONFIG } from '../config.js';
import { Racer } from '../entities/Racer.js';
import { RacerSprite } from '../entities/RacerSprite.js';
import { CHARACTERS } from '../entities/Characters.js';
import { AIController } from '../ai/AIController.js';
import { resolveCollisions } from './Collision.js';
import { RaceManager } from './RaceManager.js';
import { HUD } from '../ui/HUD.js';

export class RaceSession {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {Track} o.track
   * @param {object} o.atlas      ドット絵の画像（buildAtlas の戻り値）
   * @param {THREE.Camera} o.camera
   * @param {CameraRig} o.cameraRig
   * @param {AudioManager} o.audio
   * @param {Debug} o.debug
   * @param {number} o.playerCharIndex プレイヤーのキャラクター番号（0〜5）
   * @param {function} o.onRetry 結果表の「もう一度」が押されたときに呼ぶ関数
   */
  constructor(o) {
    this.scene = o.scene;
    this.track = o.track;
    this.atlas = o.atlas;
    this.camera = o.camera;
    this.cameraRig = o.cameraRig;
    this.audio = o.audio;
    this.debug = o.debug;
    this.onRetry = o.onRetry || null;

    this.racers = [];    // 全レーサー（プレイヤーを含む6人）
    this.sprites = [];   // racers と同じ順番の見た目
    this.ais = [];       // racers と同じ順番のCPU思考（プレイヤーは null）
    this.player = null;
    this.playerSprite = null;
    this.playerBumps = 0;
    this.lastBoostTime = 0;
    this.hudView = { rank: 0, total: 0, lap: 1, laps: 3, time: 0, gauge: 0, countdown: null };

    // スタートダッシュ：'none'（まだ）/ 'ready'（成功の予定）/ 'early'（押すのが早すぎ）
    this.dashState = 'none';
    // 結果表
    this.resultsShown = false;
    this.resultsWait = 0;

    this.createRacers(o.playerCharIndex || 0);

    this.race = new RaceManager(this.racers, this.track);
    this.hud = new HUD(document.body);
    this.setupRaceEvents();
    this.hud.showBanner('GO直前にブーストでスタートダッシュ！', 2.2, 'hint');

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

  // ---- レースの合図に合わせて画面にお知らせを出す ----
  setupRaceEvents() {
    const race = this.race;
    race.on('go', () => {
      const r = CONFIG.race;
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
      }
    });
    race.on('finalLap', (racer) => {
      if (racer.isPlayer) {
        this.hud.showBanner('FINAL LAP', 2.0, 'final');
      }
    });
    race.on('finish', (racer, rank) => {
      this.debug.log(racer.character.name + ' ゴール ' + rank + '位');
      if (racer.isPlayer) {
        this.hud.showBanner('GOAL!  ' + rank + '位', 0, 'goal');
        // ゴール後はCPUと同じ思考で自動で走らせる
        const index = this.racers.indexOf(racer);
        this.ais[index] = new AIController(racer, this.track, { lineOffset: 0, skill: 0.9, seed: 1 });
      }
    });
  }

  // ---- ゲームロジック（1秒60回） ----
  update(dt, input) {
    const player = this.player;
    const wasRespawning = player.state === 'respawn';

    // カウントダウン中はレーサーを止めておく
    if (this.race.isRunning()) {
      this.updateRubberBand();

      // 全員：入力を決めて（プレイヤーは指・キー、CPUは思考）、同じ物理で動かす
      for (let i = 0; i < this.racers.length; i += 1) {
        const ai = this.ais[i];
        this.racers[i].applyInput(ai ? ai.think(dt) : input);
        this.racers[i].step(dt);
      }

      // レーサー同士の押し合い
      const wasBumped = player.bumped;
      resolveCollisions(this.racers, this.track);
      if (player.bumped && !wasBumped) this.playerBumps += 1;
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
      if (this.resultsWait >= r.resultMinWait && (allDone || this.resultsWait >= r.resultMaxWait)) {
        this.showResults();
      }
    }

    if (!wasRespawning && player.state === 'respawn') {
      this.debug.log('コースアウト！');
    }

    // ブーストが始まった瞬間に音を鳴らす
    if (player.boostTime > this.lastBoostTime + 0.01) {
      this.audio.play('boost');
    }
    this.lastBoostTime = player.boostTime;
  }

  // 結果表を出す（ゴールしていない人は「記録なし」で、走った距離の順）
  showResults() {
    this.resultsShown = true;
    const ranking = this.race.getRanking();
    const rows = ranking.map((racer, i) => ({
      rank: i + 1,
      name: racer.character.name,
      time: this.race.finishTimeOf(racer),
      isPlayer: racer.isPlayer
    }));
    this.hud.hideBanner();
    this.hud.showResults(rows, () => {
      if (this.onRetry) this.onRetry();
    });
  }

  // CPUの追い上げ補正：前にいるCPUは少し遅く、後ろにいるCPUは少し速く
  updateRubberBand() {
    const rb = CONFIG.rubberBand;
    for (const racer of this.racers) {
      if (racer.isPlayer) continue;
      const gap = racer.distance - this.player.distance;
      const ratio = Math.min(1, Math.abs(gap) / rb.range);
      racer.speedScale = gap > 0 ? 1 - ratio * rb.maxSlow : 1 + ratio * rb.maxFast;
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
    }
    this.audio.setEngine(paused ? 0 : player.getSpeedRatio());

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
    sprite.object3d.visible = !racer.isHidden() && !blinkOff;
  }

  // キャラクターの切り替え（PCの数字キーでの確認用）
  selectCharacter(index) {
    const ch = CHARACTERS[index];
    if (!ch) return;
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
      '速度 ' + (p.speed * 3.6).toFixed(0) + ' km/h  最高 ' + (p.maxSpeed * 3.6).toFixed(0) + ' km/h',
      '位置 ' + p.s.toFixed(0) + '/' + t.length.toFixed(0) + ' m  横 ' + fmt(p.x) + '  ' +
        AREA_NAMES[t.areaAt(p.s)] + (t.zoneAt(p.s) === 'air' ? '（空中）' : ''),
      'ゲージ ' + Math.round(p.gauge * 100) + '%  ブースト残 ' + p.boostTime.toFixed(1) +
        (p.wallHit ? '  壁' : '') + '  状態 ' + p.state + '  落下 ' + p.fallCount + '回',
      'レース ' + this.race.phase + '  CPUの落下 ' + cpuFalls + '回  自分の接触 ' + this.playerBumps + '回'
    ];
  }

  // 片付け（次のレースを作る前に呼ぶ。Step5-2で使う）
  dispose() {
    for (const sprite of this.sprites) {
      this.scene.remove(sprite.object3d);
      sprite.geometry.dispose();
    }
    if (this.hud.root.parentNode) {
      this.hud.root.parentNode.removeChild(this.hud.root);
    }
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
