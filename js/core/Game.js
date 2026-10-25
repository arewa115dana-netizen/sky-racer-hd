/*
  ファイル名 : Game.js
  保存場所   : /js/core
  役割       : ゲーム全体の司令塔（土台）。描画・ループ・入力・画質・音・コース・背景を準備し、
               1レース分のまとまり（RaceSession）を作って毎回動かす
  バージョン : 0.11.3（Phase11 Step11-3）
  メモ       : レースの中身（6人・CPU・押し合い・順位・HUD）は RaceSession.js が担当。
               画面の流れ（タイトル → キャラ選択 → レース、一時停止メニュー、設定の保存）は Screens.js が担当。
               PCでは数字キー 1〜6 でキャラクター切り替え（レース中）、P で省電力モード、
               F で仕上げ処理の ON / OFF（どちらも設定に保存される）
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
import { Atmosphere } from '../render/Atmosphere.js';
import { PostFX } from '../render/PostFX.js';
import { RaceSession } from '../systems/RaceSession.js';
import { Screens } from './Screens.js';

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
    this.atmosphere = null;    // 光の筋・光る粒・周辺減光
    this.postfx = null;        // 画面全体の仕上げ（ティルトシフト・ブルーム・色づくり）
    this.atlas = null;
    this.session = null;       // 今のレース（RaceSession）
    this.screens = null;       // 画面の流れ（Screens.js）

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
    this.postfx = new PostFX(this.renderer, this.quality);
    // 解像度を一番下げても重いときに、見た目の飾りを1段ずつ減らす
    this.shedLevel = 0;
    this.quality.onShed = () => this.shedLoad();
    this.audio = new AudioManager();
    this.setupScene();

    // コース：制御点から中心線を計算し、見た目を自動で作る
    this.track = new Track(SKY_TEMPLE);
    this.scene.add(buildCourse(this.track));

    // 背景：空・雲海・浮遊島・遺跡・神殿
    this.environment = new Environment(this.scene, this.quality, this.track);
    // HD-2Dらしい空気感（光の筋・光る粒・周辺減光）
    this.atmosphere = new Atmosphere(this.scene, this.quality);

    // 全キャラクターのドット絵を1枚の画像にまとめて作る
    this.atlas = buildAtlas(CHARACTERS);
    this.cameraRig = new CameraRig(this.camera);

    this.input = new Input(this.renderer.domElement);
    // 「II」ボタン・Esc キーで一時停止メニュー
    this.input.onPause = () => this.screens.togglePauseMenu();
    this.debug = new Debug(this.renderer);
    this.screens = new Screens(this);
    this.screens.applyAllSettings();   // 保存してある設定（音量・省電力など）を反映
    this.setupEvents();

    this.loop = new Loop({
      step: CONFIG.loop.step,
      maxSubSteps: CONFIG.loop.maxSubSteps,
      update: (dt) => this.update(dt),
      render: (alpha, frameTime) => this.render(alpha, frameTime)
    });

    this.screens.showTitle();
    // 景色の描き方（シェーダー）を、最初にまとめて準備しておく（初めて映った瞬間の引っかかりを防ぐ）
    this.precompile();
    this.loop.start();

    // 結果表が出ているときは Enter キーでも「もう一度」
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && this.session && this.session.resultsShown) {
        this.startRace(this.screens.charIndex);
      }
    });
  }

  // ---- レースを始める（前のレースがあれば片付けてから） ----
  startRace(playerCharIndex) {
    if (this.session) {
      this.session.dispose();
    }
    this.screens.charIndex = playerCharIndex;
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
      onRetry: () => this.startRace(this.screens.charIndex),
      onSelect: () => this.screens.showCharacterSelect(),
      onTitle: () => this.screens.showTitle()
    });
    this.setState('RACE');
    this.screens.onRaceStart(this.session);   // レース曲を流す
    // レースで初めて使う物（リング・火花・キャラ）の描き方を、カウントダウン中に準備しておく。
    // しないと、空中ルートのリングなどが初めて画面に入った瞬間に、レース中に引っかかる
    this.precompile();
    const ch = CHARACTERS[playerCharIndex];
    this.debug.log(ch.name + '（' + ch.type + '）でスタート');
  }

  // ---- 自動軽量化：見た目への影響が小さい順に、1段ずつ減らす（一度減らしたら、その回は戻さない） ----
  shedLoad() {
    while (this.shedLevel < SHED_STEPS.length) {
      const step = SHED_STEPS[this.shedLevel];
      this.shedLevel += 1;
      if (step.run(this)) {
        this.debug.log('自動軽量化 ' + this.shedLevel + '：' + step.label);
        return;
      }
      // その端末では最初から無いもの（画質lowで光る粒がない等）は飛ばして次へ
    }
  }

  // 画面に映っていない物も含めて、全部の描き方（シェーダー）と画像を準備する
  precompile() {
    // 今は隠している物（太陽の光の筋など）も準備の対象にするため、一時的に全部を表示扱いにする
    const hidden = [];
    this.scene.traverse((obj) => {
      if (!obj.visible) {
        hidden.push(obj);
        obj.visible = true;
      }
    });
    try {
      // compileAsync は「準備が本当に終わるまで」裏で待つ版（端末が裏で並行して準備できる）。
      // ない場合は普通の compile を使う
      if (this.renderer.compileAsync) {
        this.renderer.compileAsync(this.scene, this.camera)
          .then(() => this.finishPrograms())
          .catch(() => {});
      } else {
        this.renderer.compile(this.scene, this.camera);
      }
      // 画像（模様・ドット絵）も、初めて映った瞬間ではなく今のうちに送っておく
      const done = new Set();
      this.scene.traverse((obj) => {
        const list = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        for (const m of list) {
          if (m.map && !done.has(m.map)) {
            done.add(m.map);
            this.renderer.initTexture(m.map);
          }
        }
      });
    } catch (e) {
      // 準備に失敗しても、映ったときに準備されるだけなので、ゲームは続ける
      console.warn('描き方の事前準備に失敗:', e);
    }
    for (const obj of hidden) obj.visible = false;
  }

  // 準備できた描き方の「中身の確認」まで今のうちに済ませる。
  // three.js は初めて使う瞬間にこれを行うので、レース中の小さな引っかかりの原因になる
  finishPrograms() {
    for (const program of this.renderer.info.programs) {
      try {
        program.getUniforms();
        program.getAttributes();
      } catch (e) {
        // 確認できなくても、使う瞬間に確認されるだけ
      }
    }
  }

  // ---- 状態の切り替え ----
  setState(name, params = {}) {
    this.state = name;
    this.stateParams = params;
  }

  togglePowerSave() {
    this.screens.setSetting('powerSave', !this.quality.powerSave);
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
    // 描画回数などの数え方：仕上げ処理で何回も描くので、1フレーム分をまとめて数える
    this.renderer.info.autoReset = false;
    // 描き方（シェーダー）の間違い確認を止める。開発用の確認で、初めて使う瞬間に処理が止まり、
    // レース中の引っかかりの原因になるため（このゲームの描き方は確認済み）
    this.renderer.debug.checkShaderErrors = false;
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

    // タッチ・キー操作のたびに、音が鳴る状態になるまで「再開」をかける。
    // Android の Chrome は指を離したとき（pointerup / touchend / click）しか操作と認めないので、
    // それらでも呼ぶ。本当に鳴り始めたら見張りをやめる
    const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const unlockAudio = () => {
      this.audio.unlock();
      if (this.audio.isRunning()) {
        for (const name of events) window.removeEventListener(name, unlockAudio, true);
        this.debug.log('サウンド有効');
      }
    };
    for (const name of events) window.addEventListener(name, unlockAudio, true);

    // 数字キー 1〜6 でキャラクター切り替え、P で省電力モード（PCでの確認用）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && !e.repeat) {
        this.togglePowerSave();
      }
      if (e.code === 'KeyF' && !e.repeat) {
        this.screens.setSetting('postfx', !this.postfx.enabled);
        this.debug.log(this.postfx.describe());
      }
      if (e.code.startsWith('Digit') && this.session && this.state === 'RACE') {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= CHARACTERS.length) {
          this.session.selectCharacter(n - 1);
          this.screens.charIndex = n - 1;
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
    } else if ((this.state === 'TITLE' || this.state === 'SELECT') && !this.loop.paused) {
      this.screens.updateTitleCamera(frameTime);
    }
    // 空気感の演出（カメラを動かした後に。一時停止中は止める）
    if (!this.loop.paused) {
      this.atmosphere.update(frameTime, this.camera);
    }

    // 画質の自動調整と、描く回数の間引き（場面ごとの上限：レース60・メニュー30・一時停止10）
    const q = CONFIG.quality;
    this.quality.setCap(this.loop.paused ? q.pausedFps : (this.state === 'RACE' ? q.maxFps : q.menuFps));
    this.quality.sample(frameTime);
    if (this.quality.shouldRender(frameTime)) {
      this.renderer.info.reset();
      this.postfx.render(this.scene, this.camera);
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
      lines.push(this.quality.describe() + '  音 ' + (this.audio.isRunning() ? 'ON' : (this.audio.unlocked ? '停止中' : '未')));
      lines.push(this.postfx.describe() + '  自動軽量化 ' + this.shedLevel + '/' + SHED_STEPS.length +
        '  平均FPS ' + Math.round(this.quality.lastFps));
    }
    this.debug.update(frameTime, {
      state: this.loop.paused ? '一時停止中' : this.state,
      fps: this.drawnFps,
      pixelRatio: this.quality.pixelRatio,
      lines
    });
  }
}

// 自動軽量化の段階（上から順に。run が true を返したら、その段階を実行したことになる）
const SHED_STEPS = [
  {
    label: '仕上げ処理（ぼかし・光のにじみ）をOFF',
    run: (game) => {
      if (!game.postfx.enabled) return false;
      game.postfx.enabled = false;
      game.postfx.autoOff = true;
      return true;
    }
  },
  { label: '光る粒・光の筋をOFF', run: (game) => game.atmosphere.reduce() },
  { label: '草・花・茂みを非表示', run: (game) => game.environment.reduce('smallDecor') },
  { label: '下の雲の層を非表示', run: (game) => game.environment.reduce('clouds') },
  {
    // ここまで減らしても60に届かないなら、40〜50でガタガタ揺れるより、30でそろえた方がなめらかに見える
    label: 'レースも1秒30回にそろえる',
    run: (game) => {
      if (game.quality.halfRate) return false;
      game.quality.halfRate = true;
      return true;
    }
  }
];
