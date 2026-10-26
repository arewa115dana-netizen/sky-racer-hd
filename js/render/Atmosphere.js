/*
  ファイル名 : Atmosphere.js
  保存場所   : /js/render
  役割       : HD-2Dらしい空気感の演出。重い処理（画面全体のぼかし・光の計算）は使わず、
               軽い3つの工夫で雰囲気を出す
                 1. 光の筋   … 太陽から放射状に伸びるうっすらした光（太陽が画面にあるときだけ）
                 2. 光る粒   … カメラのまわりを漂う小さな光（花粉・魔力のような粒）
                 3. 周辺減光 … 画面の四隅を少し暗くして、真ん中に目が行くようにする
  バージョン : 1.13.0（Phase13 Step13-1：コースを切り替えるときに片付けられるように）
  メモ       : 画質 low の端末では光の筋と光る粒を出さない（周辺減光だけ）。
               色はコースのテーマ（config.js の atmosphere）で変わるので、コースごとに作り直す
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Atmosphere {
  /**
   * @param {THREE.Scene} scene
   * @param {Quality} quality 画質（level が 'high' / 'mid' / 'low'）
   */
  constructor(scene, quality) {
    const a = CONFIG.atmosphere;
    this.scene = scene;
    this.time = 0;

    const level = quality.level;
    this.raysEnabled = level !== 'low' && a.rays;
    const moteCount = level === 'high' ? a.moteCountHigh : (level === 'mid' ? a.moteCountMid : 0);

    // 毎回作らないための入れ物
    this.forward = new THREE.Vector3();
    this.sunPos = new THREE.Vector3();

    if (this.raysEnabled) this.buildRays();
    if (moteCount > 0) this.buildMotes(moteCount);
    if (a.vignette) this.buildVignette();
  }

  // ---- 1. 光の筋 ----
  // 太陽の位置に、カメラの方を向いた細い三角形を何本か放射状に並べる。
  // 根元が明るく先が黒（光を足す描き方なので、黒＝透明に見える）
  buildRays() {
    const a = CONFIG.atmosphere;
    const n = a.rayCount;
    const positions = new Float32Array(n * 9);
    const colors = new Float32Array(n * 9);
    const root = new THREE.Color(a.rayColor);

    for (let i = 0; i < n; i += 1) {
      // 下向き（270度）を中心に左右へ広げる。決まった並びにして毎回同じ見た目にする
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angle = (200 + t * 140 + Math.sin(i * 7.1) * 8) * Math.PI / 180;
      const half = (1.2 + (Math.sin(i * 3.7) + 1) * 1.4) * Math.PI / 180;  // 筋の太さ（角度）
      const length = a.rayLength * (0.6 + (Math.sin(i * 5.3) + 1) * 0.2);
      const j = i * 9;
      // 根元（太陽の中心）
      positions[j] = 0; positions[j + 1] = 0; positions[j + 2] = 0;
      // 先の2点
      positions[j + 3] = Math.cos(angle - half) * length;
      positions[j + 4] = Math.sin(angle - half) * length;
      positions[j + 5] = 0;
      positions[j + 6] = Math.cos(angle + half) * length;
      positions[j + 7] = Math.sin(angle + half) * length;
      positions[j + 8] = 0;
      // 色：根元だけ明るく、先は 0（透明）
      colors[j] = root.r; colors[j + 1] = root.g; colors[j + 2] = root.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,     // 手前の物にも重ねて、光が差し込んで見えるようにする
      fog: false,
      side: THREE.DoubleSide
    });
    this.rays = new THREE.Mesh(geo, mat);
    this.rays.frustumCulled = false;
    this.rays.renderOrder = 20;   // ほかの物を描いた後に重ねる
    this.scene.add(this.rays);
  }

  // ---- 2. 光る粒 ----
  buildMotes(count) {
    const a = CONFIG.atmosphere;
    this.moteCount = count;
    this.motePos = new Float32Array(count * 3);
    this.motePhase = new Float32Array(count);
    this.moteColors = new Float32Array(count * 3);
    this.moteBase = new THREE.Color(a.moteColor);
    this.motesPlaced = false;   // 最初のフレームでカメラのまわりにばらまく

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.moteColors, 3));
    const mat = new THREE.PointsMaterial({
      size: a.moteSize,
      map: makeGlowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  // ---- 3. 周辺減光（画面の四隅を少し暗く） ----
  // HTMLの半透明の膜を1枚重ねるだけ（毎フレームの処理なし）
  buildVignette() {
    const a = CONFIG.atmosphere;
    const el = document.createElement('div');
    el.id = 'vignette';
    const s = el.style;
    s.position = 'fixed';
    s.left = '0';
    s.top = '0';
    s.right = '0';
    s.bottom = '0';
    s.pointerEvents = 'none';   // 指の操作を邪魔しない
    s.zIndex = '5';             // ゲーム画面の上、HUD（15）・操作部品（20）の下
    s.background = 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, ' + a.vignetteColor + ' 100%)';
    document.body.appendChild(el);
    this.vignette = el;
  }

  // ---- 自動軽量化：光の筋と光る粒をやめる（周辺減光は軽いので残す）。やめた物があれば true ----
  reduce() {
    let changed = false;
    if (this.rays) {
      this.scene.remove(this.rays);
      this.rays.geometry.dispose();
      this.rays.material.dispose();
      this.rays = null;
      changed = true;
    }
    if (this.motes) {
      this.scene.remove(this.motes);
      this.motes.geometry.dispose();
      if (this.motes.material.map) this.motes.material.map.dispose();
      this.motes.material.dispose();
      this.motes = null;
      changed = true;
    }
    return changed;
  }

  // ---- 片付け（別のコースに切り替えるとき） ----
  dispose() {
    this.reduce();
    if (this.vignette && this.vignette.parentNode) this.vignette.parentNode.removeChild(this.vignette);
    this.vignette = null;
  }

  // ---- 毎フレーム（カメラを動かした後に呼ぶ） ----
  update(dt, camera) {
    this.time += dt;
    if (this.rays) this.updateRays(camera);
    if (this.motes) this.updateMotes(dt, camera);
  }

  updateRays(camera) {
    const a = CONFIG.atmosphere;
    const e = CONFIG.environment;
    const sun = e.sunDirection;
    camera.getWorldDirection(this.forward);
    // カメラが太陽の方を向いているほど明るく。背を向けたら描かない（無駄な描画をしない）
    const facing = this.forward.x * sun.x + this.forward.y * sun.y + this.forward.z * sun.z;
    const strength = Math.min(1, Math.max(0, (facing - a.rayFadeStart) / (1 - a.rayFadeStart)));
    if (strength <= 0) {
      this.rays.visible = false;
      return;
    }
    this.rays.visible = true;
    // 太陽と同じ場所に置き、カメラと同じ向きにする（＝こちらを向く）
    this.rays.position.set(
      camera.position.x + sun.x * e.sunDistance,
      camera.position.y + sun.y * e.sunDistance,
      camera.position.z + sun.z * e.sunDistance
    );
    this.rays.quaternion.copy(camera.quaternion);
    // ゆっくり揺らめかせる
    this.rays.rotateZ(Math.sin(this.time * 0.15) * 0.04);
    const shimmer = 0.85 + Math.sin(this.time * 0.7) * 0.15;
    this.rays.material.color.setScalar(a.rayIntensity * strength * shimmer);
  }

  updateMotes(dt, camera) {
    const a = CONFIG.atmosphere;
    const pos = this.motePos;
    const col = this.moteColors;
    const range = a.moteRange;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    if (!this.motesPlaced) {
      // カメラのまわりにばらまく（決まった並び）
      for (let i = 0; i < this.moteCount; i += 1) {
        pos[i * 3] = cx + (rand(i * 1.3) * 2 - 1) * range;
        pos[i * 3 + 1] = cy + (rand(i * 2.9) * 2 - 1) * range * 0.5;
        pos[i * 3 + 2] = cz + (rand(i * 4.7) * 2 - 1) * range;
        this.motePhase[i] = rand(i * 6.1) * Math.PI * 2;
      }
      this.motesPlaced = true;
    }

    const t = this.time;
    const base = this.moteBase;
    for (let i = 0; i < this.moteCount; i += 1) {
      const j = i * 3;
      const ph = this.motePhase[i];
      // ふわふわ漂う（ゆっくり上へ、少し横揺れ）
      pos[j] += Math.sin(t * 0.6 + ph) * a.moteDrift * dt;
      pos[j + 1] += a.moteRise * dt;
      pos[j + 2] += Math.cos(t * 0.5 + ph) * a.moteDrift * dt;
      // カメラから離れすぎた粒は反対側へ回す（数を増やさずに、いつもまわりにある）
      pos[j] = wrap(pos[j], cx, range);
      pos[j + 1] = wrap(pos[j + 1], cy, range * 0.5);
      pos[j + 2] = wrap(pos[j + 2], cz, range);
      // きらきら点滅
      const twinkle = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.0 + ph * 3));
      col[j] = base.r * twinkle;
      col[j + 1] = base.g * twinkle;
      col[j + 2] = base.b * twinkle;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
    this.motes.geometry.attributes.color.needsUpdate = true;
  }
}

// 中心から ±range の範囲に収まるよう、はみ出たら反対側へ回す
function wrap(v, center, range) {
  const size = range * 2;
  let d = v - center;
  if (d > range) d -= size * Math.ceil((d - range) / size);
  else if (d < -range) d += size * Math.ceil((-range - d) / size);
  return center + d;
}

// 0〜1 の疑似乱数（同じ数を入れると同じ結果）
function rand(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

// 光る粒の形（中心が明るく、外側がやわらかく消える丸）
function makeGlowTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
