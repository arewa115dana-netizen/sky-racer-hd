/*
  ファイル名 : Game.js
  保存場所   : /js/core
  役割       : ゲーム全体の司令塔。描画の準備、状態の管理、
               毎フレームの更新と描画を各部品に指示する
  バージョン : 0.2.2（Phase2 Step2-2）
  メモ       : このステップでは仮の車を指とキーボードで操作する。
               本番の物理とカメラはStep2-3で追加する
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Loop } from './Loop.js';
import { Input } from './Input.js';
import { Debug } from './Debug.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.state = 'BOOT';
    this.stateParams = {};

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.loop = null;
    this.input = null;
    this.debug = null;
    this.pixelRatio = 1;

    // 仮の車（Step2-3で本物のレーサーに置き換える）
    this.car = {
      x: 0, y: 0, z: 0, heading: 0,
      prevX: 0, prevY: 0, prevZ: 0, prevHeading: 0,
      speed: 0,
      boostTime: 0,
      drifting: false,
      braking: false,
      mesh: null
    };

    this.versionEl = document.getElementById('version');

    // 毎フレーム使い回す計算用の入れ物（毎回作らない）
    this.tmpLook = new THREE.Vector3();
    this.debugLines = ['', '', ''];
  }

  // ---- 起動 ----
  async init() {
    if (this.versionEl) {
      this.versionEl.textContent = 'v' + CONFIG.VERSION;
    }

    this.setupRenderer();
    this.setupScene();
    this.buildTestField();
    this.buildTestCar();
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
      // スタート地点のまわりには置かない
      const dist = t.demoRadius + random() * (t.groundSize / 2 - t.demoRadius - 10);
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
  buildTestCar() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 2),
      new THREE.MeshLambertMaterial({ color: 0xffb347 })
    );
    mesh.position.y = 0.4;
    this.scene.add(mesh);
    this.car.mesh = mesh;
  }

  // ---- 画面の変化への対応 ----
  setupEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 200);
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
      this.updateTestCar(dt, this.input.getState());
    }
  }

  // 仮の車の動き（動作確認用の簡単な計算。Step2-3で本番の物理に置き換える）
  updateTestCar(dt, input) {
    const t = CONFIG.test;
    const car = this.car;

    // 前回の位置を覚えておく（描画で滑らかにつなぐため）
    car.prevX = car.x;
    car.prevY = car.y;
    car.prevZ = car.z;
    car.prevHeading = car.heading;

    // ブースト
    if (input.boost && car.boostTime <= 0) {
      car.boostTime = t.boostTime;
      this.debug.log('ブースト！');
    }
    if (car.boostTime > 0) {
      car.boostTime = Math.max(0, car.boostTime - dt);
    }

    // 自動アクセル（ブレーキ中は止まる方向へ）
    let target = t.carSpeed;
    if (car.boostTime > 0) target *= t.boostMultiplier;
    if (input.brake) target = 0;
    const rate = input.brake ? 3 : 1.5;
    car.speed += (target - car.speed) * Math.min(1, dt * rate);

    // 旋回（右入力で右へ曲がる）
    car.heading -= input.steer * t.turnRate * dt;

    // 前進
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;

    // 上下（入力確認用。本番では空中区間だけ有効になる）
    car.y = clamp(car.y + input.pitch * t.liftSpeed * dt, 0, t.maxLift);

    // 試走場の外に出ないようにする
    const limit = t.groundSize / 2 - 5;
    car.x = clamp(car.x, -limit, limit);
    car.z = clamp(car.z, -limit, limit);

    car.drifting = input.drift;
    car.braking = input.brake;

    // デバッグ表示用の文字
    this.debugLines[0] = '旋回 ' + fmt(input.steer) + '  上下 ' + fmt(input.pitch);
    this.debugLines[1] = 'ドリフト ' + (input.drift ? '○' : '－') +
                         '  ブレーキ ' + (input.brake ? '○' : '－') +
                         '  ブースト残 ' + car.boostTime.toFixed(1);
    this.debugLines[2] = '速度 ' + car.speed.toFixed(1) + ' m/s  高さ ' + car.y.toFixed(1) + ' m';
  }

  // ---- 描画（毎フレーム） ----
  render(alpha, frameTime) {
    if (this.state === 'TEST') {
      this.renderTestCar(alpha);
    }

    this.renderer.render(this.scene, this.camera);

    this.debug.update(frameTime, {
      state: this.loop.paused ? '一時停止中' : this.state,
      fps: this.loop.fps,
      pixelRatio: this.pixelRatio,
      lines: this.debugLines
    });
  }

  // 仮の車とカメラの位置を決める
  renderTestCar(alpha) {
    const c = CONFIG.camera;
    const car = this.car;

    // 前回と今回の計算結果の間を補間して滑らかにする
    const x = car.prevX + (car.x - car.prevX) * alpha;
    const y = car.prevY + (car.y - car.prevY) * alpha;
    const z = car.prevZ + (car.z - car.prevZ) * alpha;
    const h = car.prevHeading + (car.heading - car.prevHeading) * alpha;
    const fx = Math.sin(h);
    const fz = Math.cos(h);

    car.mesh.position.set(x, 0.4 + y, z);
    car.mesh.rotation.y = h;

    // 状態で色を変える（ドリフト＝水色、ブースト＝赤、ブレーキ＝灰色）
    let color = 0xffb347;
    if (car.drifting) color = 0x66ccff;
    if (car.boostTime > 0) color = 0xff5533;
    if (car.braking) color = 0x888888;
    car.mesh.material.color.setHex(color);

    // 車の後ろ上からカメラで追いかける
    this.camera.position.set(x - fx * c.distance, c.height + y, z - fz * c.distance);
    this.tmpLook.set(x + fx * c.lookAhead, c.lookHeight + y, z + fz * c.lookAhead);
    this.camera.lookAt(this.tmpLook);
  }
}

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

// 数値を符号付き小数2桁の文字にする
function fmt(v) {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}
