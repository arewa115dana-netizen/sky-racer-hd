/*
  ファイル名 : TestTrack.js
  保存場所   : /js/world
  役割       : Phase2の試走用オーバルコース（直線2本＋半円カーブ2つ）。
               Phase3で作る本番の Track.js と同じ使い方ができるようにしてある
  バージョン : 0.2.4（Phase2 Step2-4）
  メモ       : Phase3で天空神殿コース（Track.js）に置き換えたら使わなくなる

  コース基準座標
    s : スタートから何メートル進んだか（0〜コース全長）
    x : 中心線から右へ何メートルずれているか（左はマイナス）
    y : 路面から何メートル上か
  向き（yaw）は Three.js の rotation.y と同じ。0 で +Z 方向、増えると左回り
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class TestTrack {
  constructor() {
    const c = CONFIG.testTrack;
    this.straight = c.straight;
    this.radius = c.radius;
    this.width = c.width;
    this.halfStraight = c.straight / 2;
    this.arc = Math.PI * c.radius;
    this.length = 2 * c.straight + 2 * this.arc;

    // 計算結果の一時置き場（毎回物を作らない）
    this.px = 0;
    this.pz = 0;
    this.yaw = 0;
    this.k = 0;
  }

  // ---- 外から使う関数（本番の Track.js と共通） ----

  // 道幅
  widthAt() {
    return this.width;
  }

  // 区間の種類（試走コースはすべて地上）
  zoneAt() {
    return 'ground';
  }

  // 曲がり具合（左カーブがプラス。1/半径）
  curvatureAt(s) {
    this.evaluate(s);
    return this.k;
  }

  // 中心線の向き
  yawAt(s) {
    this.evaluate(s);
    return this.yaw;
  }

  // コース基準座標（s, x, y）を画面上の位置に変換して out に入れる
  toWorld(s, x, y, out) {
    this.evaluate(s);
    // 進行方向の右向き = (-cos(yaw), 0, sin(yaw))
    const rx = -Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);
    out.x = this.px + rx * x;
    out.y = y;
    out.z = this.pz + rz * x;
    return out;
  }

  // ---- 中心線の計算 ----
  evaluate(s) {
    const L = this.straight;
    const R = this.radius;
    const h = this.halfStraight;
    const arc = this.arc;

    let d = s % this.length;
    if (d < 0) d += this.length;

    if (d < L) {
      // 直線1：x = -R を +Z 方向へ
      this.px = -R;
      this.pz = -h + d;
      this.yaw = 0;
      this.k = 0;
    } else if (d < L + arc) {
      // カーブ1：左へ半周
      const u = (d - L) / R;
      this.px = -R * Math.cos(u);
      this.pz = h + R * Math.sin(u);
      this.yaw = u;
      this.k = 1 / R;
    } else if (d < 2 * L + arc) {
      // 直線2：x = +R を -Z 方向へ
      const t = d - L - arc;
      this.px = R;
      this.pz = h - t;
      this.yaw = Math.PI;
      this.k = 0;
    } else {
      // カーブ2：左へ半周してスタートへ戻る
      const u = (d - 2 * L - arc) / R;
      this.px = R * Math.cos(u);
      this.pz = -h - R * Math.sin(u);
      this.yaw = Math.PI + u;
      this.k = 1 / R;
    }
  }

  // ---- 見た目（路面・杭・スタートライン）を作る ----
  buildMesh() {
    const group = new THREE.Group();
    const half = this.width / 2;
    const p = { x: 0, y: 0, z: 0 };

    // 路面：中心線に沿って細かく区切った帯
    const segments = Math.ceil(this.length / 2);
    const positions = new Float32Array((segments + 1) * 2 * 3);
    for (let i = 0; i <= segments; i += 1) {
      const s = (i / segments) * this.length;
      this.toWorld(s, -half, 0.03, p);
      positions.set([p.x, p.y, p.z], i * 6);
      this.toWorld(s, half, 0.03, p);
      positions.set([p.x, p.y, p.z], i * 6 + 3);
    }
    const indices = [];
    for (let i = 0; i < segments; i += 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();
    const road = new THREE.Mesh(
      roadGeo,
      new THREE.MeshLambertMaterial({ color: 0x9a8f80, side: THREE.DoubleSide })
    );
    group.add(road);

    // 道の両端の杭（インスタンス描画で1回にまとめる）
    const spacing = CONFIG.testTrack.postSpacing;
    const perSide = Math.floor(this.length / spacing);
    const postGeo = new THREE.BoxGeometry(0.4, 1, 0.4);
    postGeo.translate(0, 0.5, 0);
    const posts = new THREE.InstancedMesh(
      postGeo,
      new THREE.MeshLambertMaterial({ color: 0xf4f1e8 }),
      perSide * 2
    );
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < perSide; i += 1) {
      const s = i * spacing;
      for (const side of [-1, 1]) {
        this.toWorld(s, side * (half + 0.3), 0, p);
        dummy.position.set(p.x, 0, p.z);
        dummy.updateMatrix();
        posts.setMatrixAt(n, dummy.matrix);
        n += 1;
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    group.add(posts);

    // スタートライン
    const lineGeo = new THREE.PlaneGeometry(this.width, 1.5);
    lineGeo.rotateX(-Math.PI / 2);
    const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.toWorld(0, 0, 0.05, p);
    line.position.set(p.x, p.y, p.z);
    line.rotation.y = this.yawAt(0);
    group.add(line);

    return group;
  }
}
