/*
  ファイル名 : Rings.js
  保存場所   : /js/world
  役割       : 空中のリング。見た目を作り、レーサーが通り抜けたかを判定する
               ・青（gauge）：ブーストゲージが溜まる
               ・金（boost）：その場でブースト
  バージョン : 0.6.3（Phase6 Step6-3）

  リングの置き方（CourseData の rings）
    { area: 'cloud', at: 0.35, x: -5, y: 7, type: 'gauge' }
      area : どの区間か（その区間の空中部分の始まり〜終わりを 0〜1 とする）
      at   : 区間のどのあたりか（0〜1）
      x, y : 中心線から右へ・上へのずれ（メートル）
    区間の割合で置くので、コースの形を変えてもリングが一緒に動く
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Rings {
  constructor(scene, track, ringData) {
    this.scene = scene;
    this.track = track;
    this.list = [];
    this.meshes = [];
    this.time = 0;

    this.resolve(ringData || []);
    this.build();
  }

  // ---- 区間の割合から、コース上の位置（s）を求める ----
  resolve(ringData) {
    const t = this.track;
    const spans = {};
    for (let i = 0; i < t.count; i += 1) {
      if (t.zone[i] !== 'air') continue;
      const area = t.area[i];
      const s = i * t.step;
      if (!spans[area]) spans[area] = { start: s, end: s };
      spans[area].end = s;
    }
    for (const d of ringData) {
      const span = spans[d.area];
      if (!span) continue;
      const s = span.start + (span.end - span.start) * d.at;
      this.list.push({ s, x: d.x, y: d.y, type: d.type });
    }
  }

  // ---- 見た目（種類ごとに1回でまとめて描く） ----
  build() {
    const c = CONFIG.rings;
    const geo = new THREE.TorusGeometry(c.radius, c.tube, 6, 20);
    const dummy = new THREE.Object3D();
    const p = {};

    // 光のにじみ（軽量ブルーム風）：太くて半透明のリングを、光を足し合わせる描き方で重ねる
    const glowGeo = new THREE.TorusGeometry(c.radius, c.glowTube, 6, 20);

    for (const type of ['gauge', 'boost']) {
      const items = this.list.filter((r) => r.type === type);
      if (items.length === 0) continue;
      const color = type === 'gauge' ? c.gaugeColor : c.boostColor;

      // 本体：遠くでも空の色に溶けないよう、フォグをかけない
      const material = new THREE.MeshBasicMaterial({ color, fog: false });
      const mesh = new THREE.InstancedMesh(geo, material, items.length);

      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: c.glowOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      });
      const glow = new THREE.InstancedMesh(glowGeo, glowMaterial, items.length);

      items.forEach((ring, k) => {
        this.track.toWorld(ring.s, ring.x, ring.y, p);
        dummy.position.set(p.x, p.y, p.z);
        // リングの穴が進行方向を向くように回す
        dummy.rotation.set(0, this.track.yawAt(ring.s), 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        glow.setMatrixAt(k, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      glow.instanceMatrix.needsUpdate = true;
      mesh.userData.baseColor = new THREE.Color(color);
      glow.userData.baseColor = new THREE.Color(color);
      this.scene.add(mesh);
      this.scene.add(glow);
      this.meshes.push(mesh, glow);
    }
  }

  /**
   * レーサーがこの計算の間にリングを通り抜けたか調べる
   * @param {Racer} racer
   * @param {function} onPass 通り抜けたリングごとに呼ぶ onPass(ring)
   */
  check(racer, onPass) {
    if (racer.state === 'respawn') return;
    const c = CONFIG.rings;
    const len = this.track.length;
    if (!racer.ringsTaken) racer.ringsTaken = new Set();

    for (let i = 0; i < this.list.length; i += 1) {
      const ring = this.list[i];
      // 何周目のこのリングを越えたか
      const lapIndex = Math.floor((racer.distance - ring.s) / len);
      const pointS = ring.s + lapIndex * len;
      if (pointS <= racer.prevDistance || pointS > racer.distance) continue;

      // 穴の中を通ったか（左右・上下の両方が範囲内）
      if (Math.abs(racer.x - ring.x) > c.hitSize) continue;
      if (Math.abs(racer.y - ring.y) > c.hitSize) continue;

      // 同じ周回の同じリングは1回だけ（復帰で戻ったときの二重取り防止）
      const key = i + ':' + lapIndex;
      if (racer.ringsTaken.has(key)) continue;
      racer.ringsTaken.add(key);

      onPass(ring);
    }
  }

  // 毎フレーム：リングをゆっくり明滅させて目立たせる
  update(dt) {
    this.time += dt;
    const glow = 0.85 + 0.15 * Math.sin(this.time * 4);
    for (const mesh of this.meshes) {
      mesh.material.color.copy(mesh.userData.baseColor).multiplyScalar(glow);
    }
  }

  // 片付け
  dispose() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.material.dispose();
    }
    const geometries = new Set(this.meshes.map((m) => m.geometry));
    geometries.forEach((g) => g.dispose());
    this.meshes = [];
  }
}
