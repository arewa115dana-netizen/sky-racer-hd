/*
  ファイル名 : Game.js
  保存場所   : /js/core
  役割       : ゲーム全体の司令塔。描画の準備、状態の管理、
               毎フレームの更新と描画を各部品に指示する
  バージョン : 0.3.1（Phase3 Step3-1）
  メモ       : 天空神殿コースを、ドット絵のキャラクターで走る。
               空中区間はまだ自動で滑空する（上下操作はPhase6）
               PCでは数字キー 1〜6 でキャラクター切り替え、P で省電力モード切り替え
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { Debug } from './Debug.js';
import { Quality } from './Quality.js';
import { AudioManager } from '../audio/AudioManager.js';
import { Track } from '../world/Track.js';
import { SKY_TEMPLE } from '../world/CourseData.js';
import { buildCourse } from '../world/CourseBuilder.js';
import { Racer } from '../entities/Racer.js';
import { RacerSprite } from '../entities/RacerSprite.js';
import { CHARACTERS } from '../entities/Characters.js';
import { buildAtlas } from '../art/PixelArt.js';
import { CameraRig } from '../render/CameraRig.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.state = 'BOOT';
    this.stateParams = {};

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cameraRig = null;
    this.loop = null;
    this.input = null;
    this.debug = null;
    this.quality = null;
    this.audio = null;
    this.lastBoostTime = 0;

    // 実際に描いた回数（省電力モードでの本当のFPS）
    this.drawnFrames = 0;
    this.drawnTime = 0;
    this.drawnFps = 0;

    this.track = null;
    this.atlas = null;
    this.player = null;
    this.playerSprite = null;

    this.versionEl = document.getElementById('version');
    this.debugLines = ['', '', '', '', ''];
  }

  // ---- 起動 ----
  async init() {
    if (this.versionEl) {
      this.versionEl.textContent = 'v' + CONFIG.VERSION;
    }

    this.setupRenderer();
    this.quality = new Quality(this.renderer);
    this.audio = new AudioManager();
    this.setupScene();

    // コース：制御点から中心線を計算し、見た目を自動で作る
    this.track = new Track(SKY_TEMPLE);
    this.scene.add(buildCourse(this.track));

    // 全キャラクターのドット絵を1枚の画像にまとめて作る
    this.atlas = buildAtlas(CHARACTERS);

    this.player = new Racer({
      id: 0,
      character: CHARACTERS[0],
      track: this.track,
      isPlayer: true
    });
    this.player.placeAt(0, 0);

    this.playerSprite = new RacerSprite(this.atlas, CHARACTERS[0].id);
    this.scene.add(this.playerSprite.object3d);

    this.cameraRig = new CameraRig(this.camera);
    this.player.computeRenderPose(1);
    this.cameraRig.snap(this.player);

    this.setupEvents();

    this.input = new Input(this.renderer.domElement);
    this.input.onPause = () => this.togglePause();
    this.debug = new Debug(this.renderer);

    this.loop = new Loop({
      step: CONFIG.loop.step,
      maxSubSteps: CONFIG.loop.maxSubSteps,
      update: (dt) => this.update(dt),
      render: (alpha, frameTime) => this.render(alpha, frameTime)
    });

    this.setState('TEST');
    this.debug.log(this.player.character.name + '（' + this.player.character.type + '）');
    this.loop.start();
  }

  // ---- 状態の切り替え ----
  setState(name, params = {}) {
    this.state = name;
    this.stateParams = params;
  }

  togglePause() {
    if (!this.loop) return;
    this.loop.setPaused(!this.loop.paused);
    this.audio.setPaused(this.loop.paused);
    this.debug.log(this.loop.paused ? '一時停止' : '再開');
  }

  togglePowerSave() {
    this.quality.setPowerSave(!this.quality.powerSave);
    this.debug.log('省電力モード ' + (this.quality.powerSave ? 'ON（30FPS）' : 'OFF'));
  }

  // キャラクターの切り替え（能力と色の確認用）
  selectCharacter(index) {
    const ch = CHARACTERS[index];
    if (!ch || !this.player) return;
    this.player.setCharacter(ch);
    this.playerSprite.setCharacter(ch.id);
    this.debug.log(ch.name + '（' + ch.type + '）');
  }

  // ---- 描画の準備 ----
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });
    // 描画解像度は Quality が決める
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);
  }

  setupScene() {
    const r = CONFIG.render;
    this.scene = new THREE.Scene();
    const sky = new THREE.Color(r.skyColor);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, r.fogNear, r.fogFar);

    this.camera = new THREE.PerspectiveCamera(
      r.fov,
      window.innerWidth / window.innerHeight,
      r.near,
      r.far
    );

    // ライトは2つだけ
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5577aa, 1.2);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.6);
    sun.position.set(30, 50, 20);
    this.scene.add(sun);
  }

  // ---- 画面の変化・キー操作への対応 ----
  setupEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 200);
    });

    // 最初のタッチ・キー操作で音を使えるようにする（iPhone対策）
    const unlockAudio = () => {
      this.audio.unlock();
      if (this.audio.unlocked) {
        window.removeEventListener('pointerdown', unlockAudio, true);
        window.removeEventListener('keydown', unlockAudio, true);
        this.debug.log('サウンド有効');
      }
    };
    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);

    // 数字キー 1〜6 でキャラクター切り替え、P で省電力モード（PCでの確認用）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && !e.repeat) {
        this.togglePowerSave();
      }
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= CHARACTERS.length) {
          this.selectCharacter(n - 1);
        }
      }
    });
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- ゲームロジック（1秒60回） ----
  update(dt) {
    this.debug.countUpdate();

    if (this.state === 'TEST') {
      const input = this.input.getState();
      this.player.applyInput(input);
      this.player.step(dt);

      // ブーストが始まった瞬間に音を鳴らす
      if (this.player.boostTime > this.lastBoostTime + 0.01) {
        this.audio.play('boost');
      }
      this.lastBoostTime = this.player.boostTime;

      this.updateDebugLines(input);
    }
  }

  updateDebugLines(input) {
    const p = this.player;
    this.debugLines[0] = '旋回 ' + fmt(input.steer) + '  上下 ' + fmt(input.pitch);
    this.debugLines[1] = '速度 ' + (p.speed * 3.6).toFixed(0) + ' km/h  最高 ' +
                         (p.maxSpeed * 3.6).toFixed(0) + ' km/h';
    this.debugLines[2] = '周回 ' + p.lap + '  位置 ' + p.s.toFixed(0) + '/' +
                         this.track.length.toFixed(0) + ' m  横 ' + fmt(p.x) +
                         '  ' + AREA_NAMES[this.track.areaAt(p.s)] +
                         (this.track.zoneAt(p.s) === 'air' ? '（空中）' : '');
    this.debugLines[3] = 'ゲージ ' + Math.round(p.gauge * 100) + '%  ブースト残 ' +
                         p.boostTime.toFixed(1) + (p.wallHit ? '  壁' : '');
    this.debugLines[4] = this.quality.describe() + '  音 ' + (this.audio.unlocked ? 'ON' : '未');
  }

  // ---- 描画（毎フレーム） ----
  render(alpha, frameTime) {
    if (this.state === 'TEST') {
      // 順番が大事：位置を決める → カメラを動かす → 絵をカメラへ向ける
      this.player.computeRenderPose(alpha);
      this.cameraRig.follow(this.player, this.track, frameTime);
      this.playerSprite.update(this.player, this.camera, frameTime);
      // 空中では足元の影を消す（下に地面がないため）
      this.playerSprite.shadow.visible = this.track.zoneAt(this.player.s) === 'ground';
      this.audio.setEngine(this.loop.paused ? 0 : this.player.getSpeedRatio());
    }

    // 画質の自動調整と、省電力モードでの描画の間引き
    this.quality.sample(frameTime);
    if (this.quality.shouldRender(frameTime)) {
      this.renderer.render(this.scene, this.camera);
      this.drawnFrames += 1;
    }
    this.drawnTime += frameTime;
    if (this.drawnTime >= 0.5) {
      this.drawnFps = Math.round(this.drawnFrames / this.drawnTime);
      this.drawnFrames = 0;
      this.drawnTime = 0;
    }

    this.debug.update(frameTime, {
      state: this.loop.paused ? '一時停止中' : this.state,
      fps: this.drawnFps,
      pixelRatio: this.quality.pixelRatio,
      lines: this.debugLines
    });
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
