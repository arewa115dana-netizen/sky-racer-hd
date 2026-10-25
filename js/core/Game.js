/*
  ファイル名 : Game.js
  保存場所   : /js/core
  役割       : ゲーム全体の司令塔（土台）。描画・ループ・入力・画質・音・コース・背景を準備し、
               1レース分のまとまり（RaceSession）を作って毎回動かす
  バージョン : 0.5.2（Phase5 Step5-2）
  メモ       : レースの中身（6人・CPU・押し合い・順位・HUD）は RaceSession.js が担当。
               タイトル・キャラ選択などの画面はPhase9で追加する
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
import { Environment } from '../world/Environment.js';
import { CHARACTERS } from '../entities/Characters.js';
import { buildAtlas } from '../art/PixelArt.js';
import { CameraRig } from '../render/CameraRig.js';
import { RaceSession } from '../systems/RaceSession.js';

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
    this.track = null;
    this.environment = null;
    this.atlas = null;
    this.session = null;       // 今のレース（RaceSession）
    this.playerCharIndex = 0;  // プレイヤーのキャラクター番号

    // 実際に描いた回数（省電力モードでの本当のFPS）
    this.drawnFrames = 0;
    this.drawnTime = 0;
    this.drawnFps = 0;

    this.lastInput = { steer: 0, pitch: 0 };
    this.versionEl = document.getElementById('version');
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

    // 背景：空・雲海・浮遊島・遺跡・神殿
    this.environment = new Environment(this.scene, this.quality, this.track);

    // 全キャラクターのドット絵を1枚の画像にまとめて作る
    this.atlas = buildAtlas(CHARACTERS);
    this.cameraRig = new CameraRig(this.camera);

    this.input = new Input(this.renderer.domElement);
    this.input.onPause = () => this.togglePause();
    this.debug = new Debug(this.renderer);
    this.setupEvents();

    this.loop = new Loop({
      step: CONFIG.loop.step,
      maxSubSteps: CONFIG.loop.maxSubSteps,
      update: (dt) => this.update(dt),
      render: (alpha, frameTime) => this.render(alpha, frameTime)
    });

    this.startRace(0);
    this.loop.start();

    // 結果表が出ているときは Enter キーでも「もう一度」
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && this.session && this.session.resultsShown) {
        this.startRace(this.playerCharIndex);
      }
    });
  }

  // ---- レースを始める（前のレースがあれば片付けてから） ----
  startRace(playerCharIndex) {
    if (this.session) {
      this.session.dispose();
    }
    this.playerCharIndex = playerCharIndex;
    this.input.setEnabled(true);
    this.session = new RaceSession({
      scene: this.scene,
      track: this.track,
      atlas: this.atlas,
      camera: this.camera,
      cameraRig: this.cameraRig,
      audio: this.audio,
      debug: this.debug,
      playerCharIndex,
      onRetry: () => this.startRace(this.playerCharIndex)
    });
    this.setState('RACE');
    const ch = CHARACTERS[playerCharIndex];
    this.debug.log(ch.name + '（' + ch.type + '）でスタート');
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
    // 空の色とフォグは Environment が設定する

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
      if (e.code.startsWith('Digit') && this.session) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= CHARACTERS.length) {
          this.session.selectCharacter(n - 1);
          this.playerCharIndex = n - 1;
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
    const input = this.input.getState();
    this.lastInput = input;

    if (this.state === 'RACE' && this.session) {
      this.session.update(dt, input);
    }
  }

  // ---- 描画（毎フレーム） ----
  render(alpha, frameTime) {
    if (this.state === 'RACE' && this.session) {
      this.session.render(alpha, frameTime, this.environment, this.loop.paused);
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

    // デバッグ表示の文字は、表示を書き換えるときだけ作る（毎フレーム作らない）
    const willRefresh = this.debug.visible &&
      this.debug.timer + frameTime >= CONFIG.debug.interval;
    const lines = willRefresh && this.session ? this.session.describe(this.lastInput) : [];
    if (willRefresh) {
      lines.push(this.quality.describe() + '  音 ' + (this.audio.unlocked ? 'ON' : '未'));
    }
    this.debug.update(frameTime, {
      state: this.loop.paused ? '一時停止中' : this.state,
      fps: this.drawnFps,
      pixelRatio: this.quality.pixelRatio,
      lines
    });
  }
}
