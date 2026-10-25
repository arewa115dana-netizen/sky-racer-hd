/*
  ファイル名 : Effects.js
  保存場所   : /js/render
  役割       : 粒の演出（パーティクル）。ドリフトの火花、ミニターボの火花、
               ブーストの炎、リングを通ったときのきらめき。
               最大200粒を1つにまとめて描き、使い終わった粒を使い回す（軽い）
  バージョン : 0.7.2（Phase7 Step7-2）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

// 火花の色（ドリフトの段階ごと）
const SPARK_COLORS = [0xfff2b0, 0x4aa8ff, 0xff8a2a];

export class Effects {
  constructor(scene) {
    const max = CONFIG.effects.maxParticles;
    this.max = max;
    this.next = 0;            // 次に使う粒の番号（いっぱいなら古い粒から上書き）

    // 粒ごとの状態
    this.life = new Float32Array(max);      // 残りの時間（0 なら使っていない）
    this.maxLife = new Float32Array(max);
    this.vel = new Float32Array(max * 3);   // 速さ（x, y, z）
    this.baseColor = new Float32Array(max * 3);

    // 描画用
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry = geo;

    const mat = new THREE.PointsMaterial({
      size: CONFIG.effects.size,
      map: makeDotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending   // 光を足し合わせて明るく見せる
    });
    this.points = new THREE.Points(geo, mat);
    // 粒が画面のどこにあっても消えないよう、見えない範囲での省略をしない
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.scene = scene;

    // 毎回作らないための入れ物
    this.color = new THREE.Color();
    this.emitCarry = new Map();   // レーサーごとの「出しきれなかった粒の端数」
  }

  // ---- 粒を1つ出す ----
  spawn(x, y, z, vx, vy, vz, colorHex, life) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.color.setHex(colorHex);
    this.baseColor[i * 3] = this.color.r;
    this.baseColor[i * 3 + 1] = this.color.g;
    this.baseColor[i * 3 + 2] = this.color.b;
  }

  // ---- レーサーごとの演出（毎フレーム、絵の位置が決まった後に呼ぶ） ----
  emitForRacer(racer, dt) {
    const e = CONFIG.effects;
    if (racer.state === 'respawn') return;
    const pos = racer.renderPos;
    const fx = Math.sin(racer.renderYaw);
    const fz = Math.cos(racer.renderYaw);
    // ボードの後ろの位置
    const backX = pos.x - fx * e.backOffset;
    const backZ = pos.z - fz * e.backOffset;
    const baseY = pos.y + 0.25;

    // 1秒あたりの数 × 経過時間 だけ出す（端数は次のフレームへ持ち越す）
    let rate = 0;
    if (racer.state === 'drift') rate += e.driftRate;
    if (racer.boostTime > 0) rate += e.boostRate;
    if (rate === 0) {
      this.emitCarry.set(racer, 0);
      return;
    }
    let carry = (this.emitCarry.get(racer) || 0) + rate * dt;
    while (carry >= 1) {
      carry -= 1;
      if (racer.state === 'drift') {
        // ドリフトの火花：ボードの後ろの左右から、後ろ上へ飛び散る
        const side = Math.random() < 0.5 ? -1 : 1;
        const sx = -fz * side * 0.6;
        const sz = fx * side * 0.6;
        this.spawn(
          backX + sx, baseY, backZ + sz,
          -fx * 3 + (Math.random() - 0.5) * 3,
          1.5 + Math.random() * 2.5,
          -fz * 3 + (Math.random() - 0.5) * 3,
          SPARK_COLORS[racer.driftLevel],
          e.sparkLife
        );
      }
      if (racer.boostTime > 0) {
        // ブーストの炎：ボードの真後ろから、後ろへ流れる
        this.spawn(
          backX, baseY + 0.2, backZ,
          -fx * 6 + (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.0,
          -fz * 6 + (Math.random() - 0.5) * 1.5,
          Math.random() < 0.5 ? 0xffb347 : 0xff6a2a,
          e.flameLife
        );
      }
    }
    this.emitCarry.set(racer, carry);
  }

  // ---- 一度にパッと散らす（ミニターボ・リング） ----
  burst(x, y, z, colorHex, count, speed) {
    for (let k = 0; k < count; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.3) * Math.PI;
      const v = speed * (0.5 + Math.random() * 0.5);
      this.spawn(
        x, y, z,
        Math.cos(a) * Math.cos(b) * v,
        Math.sin(b) * v,
        Math.sin(a) * Math.cos(b) * v,
        colorHex,
        CONFIG.effects.burstLife
      );
    }
  }

  // ミニターボの火花（段階の色で）
  turboBurst(racer, level) {
    const p = racer.renderPos;
    this.burst(p.x, p.y + 0.5, p.z, SPARK_COLORS[Math.max(1, level)], CONFIG.effects.turboBurst, 6);
  }

  // リングを通ったときのきらめき
  ringBurst(position, colorHex) {
    this.burst(position.x, position.y, position.z, colorHex, CONFIG.effects.ringBurst, 9);
  }

  // ---- 毎フレーム：粒を動かし、だんだん消す ----
  update(dt) {
    const pos = this.positions;
    const col = this.colors;
    const gravity = CONFIG.effects.gravity;
    for (let i = 0; i < this.max; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) {
        // 使い終わった粒は見えない場所へ（色を0に）
        col[j] = 0; col[j + 1] = 0; col[j + 2] = 0;
        continue;
      }
      this.vel[j + 1] -= gravity * dt;
      pos[j] += this.vel[j] * dt;
      pos[j + 1] += this.vel[j + 1] * dt;
      pos[j + 2] += this.vel[j + 2] * dt;
      // 残り時間に合わせて暗くする（光を足す描き方なので、暗い＝透明に見える）
      const fade = this.life[i] / this.maxLife[i];
      col[j] = this.baseColor[j] * fade;
      col[j + 1] = this.baseColor[j + 1] * fade;
      col[j + 2] = this.baseColor[j + 2] * fade;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  // 片付け
  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.points.material.map.dispose();
    this.points.material.dispose();
  }
}

// 粒の形（中心が明るく外側がぼやけた丸）
function makeDotTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
