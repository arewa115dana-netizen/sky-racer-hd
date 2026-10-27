/*
  ファイル名 : CourseMiniature.js
  保存場所   : /js/ui
  役割       : コース選択画面の「くるくる回るコースのミニチュア」。
               選んだコースの道の形から、浮かぶ島のような小さな立体模型を作り、ゆっくり回して見せる。
                 ・地上の道 … 路面の色の帯 ＋ その下の草・岩（浮遊島の断面）
                 ・空中の道 … 白く光る点線（輪っかのリングの道しるべ）
                 ・スタート … 白い線
               わざと粗い解像度で描いて拡大し、ゲームのドット絵の雰囲気に合わせる
  バージョン : 2.6.0（新規）
  メモ       : ゲーム本体とは別の小さな描画（WebGL）を使う。画面を閉じるときに dispose で必ず片付ける。
               コースの模型は一度作ったら取っておく（選び直しても作り直さない）
*/

import * as THREE from 'three';
import { Track } from '../world/Track.js';
import { themedValue } from '../world/Theme.js';

const STEP = 3;             // 何メートルごとに道を区切るか
const PIXEL = 2;            // 何ピクセルを1つのドットにするか（大きいほど粗い）
const SIZE = 10;            // 模型の大きさ（半径）
const WIDE = 2.4;           // 道幅を何倍に見せるか（そのままだと細い糸のようで、形がわかりにくい）
const ISLAND = 0.75;        // 道の両側の島（草）の幅（道の半分の幅に対する割合）
const DEPTH = 1.3;          // 島の厚み（道の半分の幅に対する割合）

export class CourseMiniature {
  /**
   * @param {HTMLCanvasElement} canvas 描く場所（表示の大きさは CSS で決める）
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.models = new Map();   // コースの id → 模型
    this.current = null;
    this.angle = 0.6;
    this.running = false;
    this.lastTime = 0;
    this.accum = 0;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    } catch (e) {
      this.renderer = null;   // 描けない端末では何も出さない（コース選択はそのまま使える）
      return;
    }
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.resize();

    this.scene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight(0xfff2dc, 0x5a4a6a, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe0b8, 1.6);
    this.sun.position.set(-6, 10, 4);
    this.scene.add(this.sun);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

    this.tick = this.tick.bind(this);
  }

  // 表示の大きさに合わせて、粗い解像度で描く
  resize() {
    if (!this.renderer) return;
    const w = Math.max(1, Math.round((this.canvas.clientWidth || 200) / PIXEL));
    const h = Math.max(1, Math.round((this.canvas.clientHeight || 150) / PIXEL));
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  // 見せるコースを変える（null なら何も出さない）
  setCourse(course) {
    if (!this.renderer) return;
    this.resize();
    if (this.current) this.pivot.remove(this.current.group);
    this.current = null;
    if (!course || !course.ready || !course.data) return;
    let model = this.models.get(course.id);
    if (!model) {
      model = buildModel(course);
      this.models.set(course.id, model);
    }
    this.current = model;
    this.pivot.add(model.group);
    // 模型全体が収まる距離から、斜め上に見下ろす
    const d = SIZE / Math.sin((this.camera.fov / 2) * Math.PI / 180) * 0.86;
    this.camera.position.set(0, d * 0.6, d * 0.8);
    this.camera.lookAt(0, -0.5, 0);
    if (!this.running) this.start();
  }

  start() {
    if (!this.renderer || this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  tick(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    // 1秒に30回まで（メニューなので電池を使いすぎない）
    this.accum += dt;
    if (this.accum < 1 / 30) return;
    this.angle += this.accum * 0.45;
    this.accum = 0;
    this.pivot.rotation.y = this.angle;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    for (const model of this.models.values()) {
      model.group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
    this.models.clear();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
      this.renderer = null;
    }
  }
}

// ---- コースの模型を作る ----
function buildModel(course) {
  const track = new Track(course.data);
  const theme = course.theme || {};
  const roadColors = themedValue(theme, 'course', 'roadColors') || {};
  const rockColors = themedValue(theme, 'course', 'rockColors') || {};
  const rockColor = themedValue(theme, 'course', 'rockColor') || 0x7d6a58;
  const grassColor = themedValue(theme, 'environment', 'grassColor') || 0x7fbf5a;
  const curbColor = themedValue(theme, 'course', 'curbDark') || 0xb5543c;

  const pos = [];
  const col = [];
  const air = [];
  const c = new THREE.Color();
  const tmp = { x: 0, y: 0, z: 0 };
  const P = (s, x, y) => {
    track.toWorld(s, x, y, tmp);
    return [tmp.x, tmp.y, tmp.z];
  };
  // 四角を1枚（2つの三角）足す
  const quad = (a, b, d, e, color, shade) => {
    c.set(color).multiplyScalar(shade);
    for (const p of [a, b, d, a, d, e]) {
      pos.push(p[0], p[1], p[2]);
      col.push(c.r, c.g, c.b);
    }
  };

  // 小さな四角い木（底の中心 p、半分の幅 r、高さ h）
  const cube = (p, r, h, color, shade) => {
    const [x, y, z] = p;
    const v = (dx, dy, dz) => [x + dx, y + dy, z + dz];
    quad(v(-r, h, -r), v(-r, h, r), v(r, h, r), v(r, h, -r), color, shade * 1.25);
    quad(v(-r, 0, r), v(r, 0, r), v(r, h, r), v(-r, h, r), color, shade);
    quad(v(r, 0, -r), v(-r, 0, -r), v(-r, h, -r), v(r, h, -r), color, shade * 0.85);
    quad(v(r, 0, r), v(r, 0, -r), v(r, h, -r), v(r, h, r), color, shade * 0.95);
    quad(v(-r, 0, -r), v(-r, 0, r), v(-r, h, r), v(-r, h, -r), color, shade * 0.9);
  };

  const n = Math.ceil(track.length / STEP);
  for (let k = 0; k < n; k += 1) {
    const s0 = k * STEP;
    const s1 = Math.min(track.length, (k + 1) * STEP);
    const zone = track.zoneAt(s0);
    if (zone === 'air') {
      // 空中は点線（1つおき）
      if (k % 2 === 0) {
        const y = (track.yMinAt(s0) + track.yMaxAt(s0)) * 0.5;
        air.push(P(s0, -1.4, y), P(s0, 1.4, y), P(s1, 1.4, y), P(s1, -1.4, y));
      }
      continue;
    }
    const area = track.areaAt(s0);
    const w0 = track.widthAt(s0) / 2 * WIDE;
    const w1 = track.widthAt(s1) / 2 * WIDE;
    const road = roadColors[area] !== undefined ? roadColors[area] : (roadColors.default !== undefined ? roadColors.default : 0xa8a090);
    const rock = rockColors[area] !== undefined ? rockColors[area] : rockColor;
    const depth = w0 * DEPTH;
    const g0 = w0 * (1 + ISLAND);
    const g1 = w1 * (1 + ISLAND);
    // 路面と縁石
    quad(P(s0, -w0, 0.15), P(s1, -w1, 0.15), P(s1, w1, 0.15), P(s0, w0, 0.15), road, 1);
    quad(P(s0, -w0 - 0.8, 0.12), P(s1, -w1 - 0.8, 0.12), P(s1, -w1, 0.12), P(s0, -w0, 0.12), curbColor, 1);
    quad(P(s0, w0, 0.12), P(s1, w1, 0.12), P(s1, w1 + 0.8, 0.12), P(s0, w0 + 0.8, 0.12), curbColor, 1);
    // 道の両側の草（浮遊島の上）
    quad(P(s0, -g0, 0), P(s1, -g1, 0), P(s1, -w1 - 0.8, 0), P(s0, -w0 - 0.8, 0), grassColor, 0.95);
    quad(P(s0, w0 + 0.8, 0), P(s1, w1 + 0.8, 0), P(s1, g1, 0), P(s0, g0, 0), grassColor, 0.95);
    // 浮遊島の断面（岩）：左右の側面と底
    quad(P(s0, -g0, 0), P(s0, -g0 * 0.45, -depth), P(s1, -g1 * 0.45, -depth), P(s1, -g1, 0), rock, 0.8);
    quad(P(s1, g1, 0), P(s1, g1 * 0.45, -depth), P(s0, g0 * 0.45, -depth), P(s0, g0, 0), rock, 0.65);
    quad(P(s0, -g0 * 0.45, -depth), P(s0, g0 * 0.45, -depth), P(s1, g1 * 0.45, -depth), P(s1, -g1 * 0.45, -depth), rock, 0.5);
    // ドットの木（島の上に、ところどころ）
    if (k % 7 === 3) {
      const side = (k % 14 === 3) ? -1 : 1;
      cube(P(s0, side * (w0 + 0.8 + w0 * ISLAND * 0.5), 0), w0 * 0.16, w0 * 0.5, grassColor, 0.62);
    }
  }
  // スタートの白い線
  const sw = track.widthAt(0) / 2 * WIDE;
  quad(P(-1.5, -sw, 0.25), P(1.5, -sw, 0.25), P(1.5, sw, 0.25), P(-1.5, sw, 0.25), 0xffffff, 1);

  const group = new THREE.Group();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  group.add(ground);

  if (air.length) {
    const ap = [];
    for (let i = 0; i < air.length; i += 4) {
      const [a, b, d, e] = [air[i], air[i + 1], air[i + 2], air[i + 3]];
      for (const p of [a, b, d, a, d, e]) ap.push(p[0], p[1], p[2]);
    }
    const ageo = new THREE.BufferGeometry();
    ageo.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
    group.add(new THREE.Mesh(ageo, new THREE.MeshBasicMaterial({ color: 0xfff6e6, side: THREE.DoubleSide })));
  }

  // 真ん中に寄せて、決まった大きさに縮める
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  // 回しても枠からはみ出ないよう、対角線の長さで大きさを決める
  const radius = Math.hypot(size.x, size.z) / 2 || 1;
  const k = SIZE / radius;
  for (const child of group.children) {
    child.position.set(-center.x, -center.y, -center.z);
  }
  const holder = new THREE.Group();
  holder.add(group);
  holder.scale.setScalar(k);
  return { group: holder };
}

