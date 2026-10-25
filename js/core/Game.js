/*
  ファイル名 : Game.js
  保存場所   : /js/core
  役割       : ゲーム全体の司令塔。描画の準備、状態の管理、
               毎フレームの更新と描画を各部品に指示する
  バージョン : 0.2.5（Phase2 Step2-5）
  メモ       : 試走用オーバルコースを本番の物理で走り、専用カメラで追いかける。
               ドット絵はStep2-6で追加する
               PCでは数字キー 1〜6 でキャラクターを切り替えられる（能力の確認用）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { Debug } from './Debug.js';
import { TestTrack } from '../world/TestTrack.js';
import { Racer } from '../entities/Racer.js';
import { CHARACTERS } from '../entities/Characters.js';
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
    this.pixelRatio = 1;

    this.track = null;
    this.player = null;
    this.playerMesh = null;

    this.versionEl = document.getElementById('version');
    this.debugLines = ['', '', '', ''];
  }

  // ---- 起動 ----
  async init() {
    if (this.versionEl) {
      this.versionEl.textContent = 'v' + CONFIG.VERSION;
    }

    this.setupRenderer();
    this.setupScene();
    this.buildTestField();

    this.track = new TestTrack();
    this.scene.add(this.track.buildMesh());

    this.player = new Racer({
      id: 0,
      character: CHARACTERS[0],
      track: this.track,
      isPlayer: true
    });
    this.player.placeAt(0, 0);
    this.buildPlayerMesh();

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
    this.debug.log(this.loop.paused ? '一時停止' : '再開');
  }

  // キャラクターの切り替え（能力の確認用）
  selectCharacter(index) {
    const ch = CHARACTERS[index];
    if (!ch || !this.player) return;
    this.player.setCharacter(ch);
    this.playerBaseColor = ch.palette.main;
    this.debug.log(ch.name + '（' + ch.type + '）');
  }

  // ---- 描画の準備 ----
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
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

  // ---- 試走場の地面と目印の柱 ----
  buildTestField() {
    const t = CONFIG.test;
    const tt = CONFIG.testTrack;

    const groundGeo = new THREE.PlaneGeometry(t.groundSize, t.groundSize);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshLambertMaterial({ color: 0x6fae5a })
    );
    this.scene.add(ground);

    const grid = new THREE.GridHelper(t.groundSize, t.groundSize / 10, 0x3f7a35, 0x4f8a45);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // 目印の柱（コースに重ならない場所だけに置く）
    const pillarGeo = new THREE.BoxGeometry(2, 1, 2);
    pillarGeo.translate(0, 0.5, 0);
    const pillars = new THREE.InstancedMesh(
      pillarGeo,
      new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }),
      t.pillarCount
    );

    let seed = 12345;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // コースの外周＋余白の範囲
    const outerX = tt.radius + tt.width + 6;
    const outerZ = tt.straight / 2 + tt.radius + tt.width + 6;
    // コースの内側（直線の間）の安全な範囲
    const innerX = tt.radius - tt.width - 4;
    const innerZ = tt.straight / 2;

    const dummy = new THREE.Object3D();
    const halfGround = t.groundSize / 2 - 4;
    let placed = 0;
    let tries = 0;
    while (placed < t.pillarCount && tries < 5000) {
      tries += 1;
      const x = (random() * 2 - 1) * halfGround;
      const z = (random() * 2 - 1) * halfGround;
      const nearTrack = Math.abs(x) < outerX && Math.abs(z) < outerZ;
      const inInfield = Math.abs(x) < innerX && Math.abs(z) < innerZ;
      if (nearTrack && !inInfield) continue;
      dummy.position.set(x, 0, z);
      dummy.scale.set(1, 4 + random() * 16, 1);
      dummy.updateMatrix();
      pillars.setMatrixAt(placed, dummy.matrix);
      placed += 1;
    }
    pillars.count = placed;
    pillars.instanceMatrix.needsUpdate = true;
    this.scene.add(pillars);
  }

  // ---- プレイヤーの見た目（仮の箱。Step2-6でドット絵に置き換える） ----
  buildPlayerMesh() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 2),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    this.scene.add(mesh);
    this.playerMesh = mesh;
    this.playerBaseColor = this.player.character.palette.main;
  }

  // ---- 画面の変化・キー操作への対応 ----
  setupEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 200);
    });

    // 数字キー 1〜6 でキャラクター切り替え（PCでの能力確認用）
    window.addEventListener('keydown', (e) => {
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
      this.updateDebugLines(input);
    }
  }

  updateDebugLines(input) {
    const p = this.player;
    this.debugLines[0] = '旋回 ' + fmt(input.steer) + '  上下 ' + fmt(input.pitch);
    this.debugLines[1] = '速度 ' + (p.speed * 3.6).toFixed(0) + ' km/h  最高 ' +
                         (p.maxSpeed * 3.6).toFixed(0) + ' km/h';
    this.debugLines[2] = '周回 ' + p.lap + '  位置 ' + p.s.toFixed(0) + '/' +
                         this.track.length.toFixed(0) + ' m  横 ' + fmt(p.x);
    this.debugLines[3] = 'ゲージ ' + Math.round(p.gauge * 100) + '%  ブースト残 ' +
                         p.boostTime.toFixed(1) + (p.wallHit ? '  壁' : '');
  }

  // ---- 描画（毎フレーム） ----
  render(alpha, frameTime) {
    if (this.state === 'TEST') {
      this.renderPlayer(alpha);
      this.cameraRig.follow(this.player, this.track, frameTime);
    }

    this.renderer.render(this.scene, this.camera);

    this.debug.update(frameTime, {
      state: this.loop.paused ? '一時停止中' : this.state,
      fps: this.loop.fps,
      pixelRatio: this.pixelRatio,
      lines: this.debugLines
    });
  }

  // プレイヤーの見た目の位置と色を決める
  renderPlayer(alpha) {
    const p = this.player;
    p.computeRenderPose(alpha);
    const pos = p.renderPos;
    const yaw = p.renderYaw;

    this.playerMesh.position.set(pos.x, 0.4 + pos.y, pos.z);
    this.playerMesh.rotation.y = yaw;

    // 状態で色を変える（ブースト＝赤、ブレーキ＝灰色、壁＝白っぽく点滅）
    let color = this.playerBaseColor;
    if (p.boostTime > 0) color = 0xff5533;
    if (p.input.brake) color = 0x888888;
    if (p.wallHit) color = 0xffffff;
    this.playerMesh.material.color.setHex(color);
  }
}

// 数値を符号付き小数2桁の文字にする
function fmt(v) {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}
