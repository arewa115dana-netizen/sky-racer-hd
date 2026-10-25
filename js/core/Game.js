/*
  ファイル名 : Game.js
  保存場所   : /js/core
  役割       : ゲーム全体の司令塔。描画の準備、状態の管理、
               毎フレームの更新と描画を各部品に指示する
  バージョン : 0.2.1（Phase2 Step2-1）
  メモ       : このステップでは仮の車が試走場を自動で周回する。
               操作はStep2-2、本番の物理はStep2-3で追加する
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Loop } from './Loop.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.state = 'BOOT';
    this.stateParams = {};

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.loop = null;
    this.pixelRatio = 1;

    // 仮の車（Step2-3で本物のレーサーに置き換える）
    this.demo = {
      angle: 0,
      prevAngle: 0,
      mesh: null
    };

    // 情報表示
    this.infoEl = document.getElementById('info');
    this.versionEl = document.getElementById('version');
    this.infoTimer = 0;
    this.updateCount = 0;

    // 毎フレーム使い回す計算用の入れ物（毎回作らない）
    this.tmpPos = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpLook = new THREE.Vector3();
  }

  // ---- 起動 ----
  async init() {
    if (this.versionEl) {
      this.versionEl.textContent = 'v' + CONFIG.VERSION;
    }

    this.setupRenderer();
    this.setupScene();
    this.buildTestField();
    this.buildDemoCar();
    this.setupEvents();

    this.loop = new Loop({
      step: CONFIG.loop.step,
      maxSubSteps: CONFIG.loop.maxSubSteps,
      update: (dt) => this.update(dt),
      render: (alpha, frameTime) => this.render(alpha, frameTime)
    });

    this.setState('TEST');
    this.loop.start();
  }

  // ---- 状態の切り替え ----
  setState(name, params = {}) {
    this.state = name;
    this.stateParams = params;
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

  // ---- 試走場（平らな地面と目印の柱） ----
  buildTestField() {
    const t = CONFIG.test;

    // 地面
    const groundGeo = new THREE.PlaneGeometry(t.groundSize, t.groundSize);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshLambertMaterial({ color: 0x6fae5a })
    );
    this.scene.add(ground);

    // 速さが分かるように格子線を引く
    const grid = new THREE.GridHelper(t.groundSize, t.groundSize / 10, 0x3f7a35, 0x4f8a45);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // 目印の柱（インスタンス描画で1回にまとめる）
    const pillarGeo = new THREE.BoxGeometry(2, 1, 2);
    pillarGeo.translate(0, 0.5, 0);
    const pillars = new THREE.InstancedMesh(
      pillarGeo,
      new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }),
      t.pillarCount
    );

    // 毎回同じ配置になる乱数
    let seed = 12345;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const dummy = new THREE.Object3D();
    for (let i = 0; i < t.pillarCount; i += 1) {
      const angle = random() * Math.PI * 2;
      // 周回コースの内側か外側に置き、車とぶつからないようにする
      const inside = random() < 0.4;
      const dist = inside
        ? random() * (t.demoRadius - 8)
        : t.demoRadius + 8 + random() * 60;
      const height = 4 + random() * 16;
      dummy.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      pillars.setMatrixAt(i, dummy.matrix);
    }
    pillars.instanceMatrix.needsUpdate = true;
    this.scene.add(pillars);
  }

  // ---- 仮の車 ----
  buildDemoCar() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 2),
      new THREE.MeshLambertMaterial({ color: 0xffb347 })
    );
    mesh.position.y = 0.4;
    this.scene.add(mesh);
    this.demo.mesh = mesh;
  }

  // ---- 画面の変化・タップへの対応 ----
  setupEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 200);
    });

    // テスト用：画面をタップすると一時停止／再開
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.loop) {
        this.loop.setPaused(!this.loop.paused);
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
    this.updateCount += 1;

    if (this.state === 'TEST') {
      const t = CONFIG.test;
      this.demo.prevAngle = this.demo.angle;
      this.demo.angle += (t.demoSpeed / t.demoRadius) * dt;
    }
  }

  // ---- 描画（毎フレーム） ----
  render(alpha, frameTime) {
    if (this.state === 'TEST') {
      this.renderDemo(alpha);
    }

    this.renderer.render(this.scene, this.camera);
    this.updateInfo(frameTime);
  }

  // 仮の車とカメラの位置を決める
  renderDemo(alpha) {
    const t = CONFIG.test;
    const c = CONFIG.camera;

    // 前回と今回の計算結果の間を補間して滑らかにする
    const a = this.demo.prevAngle + (this.demo.angle - this.demo.prevAngle) * alpha;

    const pos = this.tmpPos.set(Math.cos(a) * t.demoRadius, 0, Math.sin(a) * t.demoRadius);
    const forward = this.tmpForward.set(-Math.sin(a), 0, Math.cos(a));

    this.demo.mesh.position.set(pos.x, 0.4, pos.z);
    this.demo.mesh.rotation.y = Math.atan2(forward.x, forward.z);

    // 車の後ろ上からカメラで追いかける
    this.camera.position.set(
      pos.x - forward.x * c.distance,
      c.height,
      pos.z - forward.z * c.distance
    );
    this.tmpLook.set(
      pos.x + forward.x * c.lookAhead,
      c.lookHeight,
      pos.z + forward.z * c.lookAhead
    );
    this.camera.lookAt(this.tmpLook);
  }

  // 左上の情報表示
  updateInfo(frameTime) {
    if (!this.infoEl) return;
    if (!CONFIG.debug.show) {
      this.infoEl.style.display = 'none';
      return;
    }

    this.infoTimer += frameTime;
    if (this.infoTimer < CONFIG.debug.interval) return;

    const updatesPerSecond = Math.round(this.updateCount / this.infoTimer);
    this.infoTimer = 0;
    this.updateCount = 0;

    const info = this.renderer.info.render;
    const stateText = this.loop && this.loop.paused ? '一時停止中' : this.state;

    this.infoEl.textContent =
      '状態     : ' + stateText + '\n' +
      'FPS      : ' + this.loop.fps + '\n' +
      '計算/秒  : ' + updatesPerSecond + '\n' +
      '描画回数 : ' + info.calls + '\n' +
      '三角形   : ' + info.triangles + '\n' +
      '画面     : ' + window.innerWidth + 'x' + window.innerHeight +
      ' @' + this.pixelRatio.toFixed(2) + '\n' +
      'Three.js : r' + THREE.REVISION;
  }
}
