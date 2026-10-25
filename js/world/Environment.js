/*
  ファイル名 : Environment.js
  保存場所   : /js/world
  役割       : 背景。空・太陽・雲海・浮遊島・遠景の島・古代遺跡のアーチ・神殿の柱と門。
               スマホで軽く動くよう、重い後処理を使わず「見た目だけ再現」する
               （ぼかした遠景で被写界深度風、光る板で軽量ブルーム風）
  バージョン : 0.3.2（Phase3 Step3-2）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Environment {
  constructor(scene, quality, track) {
    this.scene = scene;
    this.quality = quality;
    this.track = track;
    this.cloudLayers = [];
    this.time = 0;

    const e = CONFIG.environment;
    const low = quality.level === 'low';

    // 空の色とフォグ（遠くを空の色に溶かす）
    scene.background = new THREE.Color(e.horizonColor);
    scene.fog = new THREE.Fog(e.horizonColor, e.fogNear, e.fogFar);

    this.sky = this.buildSky();
    scene.add(this.sky);

    this.sun = this.buildSun();
    scene.add(this.sun);

    this.buildClouds(low ? 1 : 2);
    scene.add(this.buildFarIslands(low ? 6 : 10));
    scene.add(this.buildIslands(low ? Math.round(e.islandCount / 2) : e.islandCount));
    scene.add(this.buildRuins());
    scene.add(this.buildTempleColumns());
    scene.add(this.buildTempleGate());
  }

  // 毎フレーム呼ぶ（カメラを動かした後）
  update(dt, cameraPosition) {
    const e = CONFIG.environment;
    this.time += dt;

    // 空と太陽はカメラについて動かす（どこまで行っても届かない遠さに見せる）
    this.sky.position.copy(cameraPosition);
    this.sun.position.set(
      cameraPosition.x + e.sunDirection.x * e.sunDistance,
      cameraPosition.y + e.sunDirection.y * e.sunDistance,
      cameraPosition.z + e.sunDirection.z * e.sunDistance
    );

    // 雲海をゆっくり流す
    this.cloudLayers.forEach((layer, i) => {
      const speed = e.cloudSpeed * (i === 0 ? 1 : 0.6);
      layer.material.map.offset.x = (this.time * speed) % 1;
    });
  }

  // ---- 空（上が濃い青、地平線が白っぽいグラデーションの大きな球） ----
  buildSky() {
    const e = CONFIG.environment;
    const geo = new THREE.SphereGeometry(e.skyRadius, 24, 12);
    const top = new THREE.Color(e.skyTopColor);
    const horizon = new THREE.Color(e.horizonColor);
    const colors = [];
    const pos = geo.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const h = pos.getY(i) / e.skyRadius;          // -1〜1
      const t = Math.max(0, Math.min(1, h * 1.6));  // 地平線から上へ
      c.copy(horizon).lerp(top, t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -1;
    return mesh;
  }

  // ---- 太陽（光がにじむ板。軽量ブルーム風） ----
  buildSun() {
    const e = CONFIG.environment;
    const tex = makeGlowTexture(128, 'rgba(255,250,225,1)', 'rgba(255,230,170,0)');
    const mat = new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(e.sunSize, e.sunSize, 1);
    return sprite;
  }

  // ---- 雲海（コードで描いた雲の画像を大きな板に貼り、重ねて流す） ----
  buildClouds(layers) {
    const e = CONFIG.environment;
    const center = this.courseCenter();
    for (let i = 0; i < layers; i += 1) {
      const tex = makeCloudTexture(256, 40 + i * 13);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(e.cloudRepeat, e.cloudRepeat);
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(e.cloudSize, e.cloudSize);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: i === 0 ? 0.95 : 0.7,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(center.x, e.cloudHeight - i * 14, center.z);
      this.scene.add(mesh);
      this.cloudLayers.push(mesh);
    }
  }

  // ---- 遠景の島（あらかじめぼかしたシルエット。被写界深度風） ----
  buildFarIslands(count) {
    const e = CONFIG.environment;
    const tex = makeFarIslandTexture();
    const geo = new THREE.PlaneGeometry(1, 0.5);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      fog: false
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const center = this.courseCenter();
    const random = seededRandom(777);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + random() * 0.4;
      const dist = e.farIslandDistance * (0.85 + random() * 0.3);
      const size = 120 + random() * 140;
      dummy.position.set(
        center.x + Math.sin(angle) * dist,
        -10 + random() * 60,
        center.z + Math.cos(angle) * dist
      );
      // コースの中心の方を向かせる
      dummy.rotation.set(0, angle + Math.PI, 0);
      dummy.scale.set(size, size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = -1;
    return mesh;
  }

  // ---- 浮遊島（上が草、下が岩の小島を、コースに重ならない所に散らす） ----
  buildIslands(count) {
    const e = CONFIG.environment;
    const geo = makeIslandGeometry(e.grassColor, e.rockColor);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const random = seededRandom(2024);
    const dummy = new THREE.Object3D();
    const center = this.courseCenter();
    let placed = 0;
    // 偏らないよう、コースのまわりを角度で均等に区切り、各区切りに1つずつ置く
    for (let k = 0; k < count; k += 1) {
      for (let tries = 0; tries < 40; tries += 1) {
        const angle = ((k + random()) / count) * Math.PI * 2;
        const dist = e.islandArea * (0.15 + random() * 0.85);
        const x = center.x + Math.sin(angle) * dist;
        const z = center.z + Math.cos(angle) * dist;
        const size = 5 + random() * 16;
        if (this.distanceToTrack(x, z) < e.islandClearance + size) continue;
        dummy.position.set(x, -18 + random() * 50, z);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        dummy.scale.set(size, size * (0.8 + random() * 0.6), size);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed += 1;
        break;
      }
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  // ---- 古代遺跡（空中ルートをまたぐアーチ。いくつかは崩れている） ----
  buildRuins() {
    const e = CONFIG.environment;
    const track = this.track;
    const boxes = [];
    const p = {};
    let n = 0;
    for (let i = 0; i < track.count; i += Math.round(e.archSpacing / track.step)) {
      if (track.area[i] !== 'ruins' || track.zone[i] !== 'air') continue;
      const s = i * track.step;
      const half = track.width[i] / 2 + 2;
      const yaw = track.yaw[i];
      const broken = n % 3 === 2;
      // 左右の柱（中心線の14 m下から、梁の高さまで。崩れた柱は途中まで）
      const bottom = -14;
      const full = e.archHeight - bottom;
      for (const side of [-1, 1]) {
        const height = broken && side > 0 ? full * 0.5 : full;
        track.toWorld(s, side * half, bottom + height / 2, p);
        boxes.push({ x: p.x, y: p.y, z: p.z, sx: 3, sy: height, sz: 3, yaw });
      }
      // 上の梁（崩れたアーチにはない）
      if (!broken) {
        track.toWorld(s, 0, e.archHeight, p);
        boxes.push({ x: p.x, y: p.y, z: p.z, sx: half * 2 + 3, sy: 2.5, sz: 3, yaw });
      }
      n += 1;
    }
    return makeBoxInstances(boxes, e.ruinColor);
  }

  // ---- 神殿の柱（神殿の道の両側に並ぶ白い柱） ----
  buildTempleColumns() {
    const e = CONFIG.environment;
    const track = this.track;
    const spots = [];
    const p = {};
    const every = Math.round(e.columnSpacing / track.step);
    for (let i = 0; i < track.count; i += every) {
      if (track.area[i] !== 'temple' || track.zone[i] !== 'ground') continue;
      for (const side of [-1, 1]) {
        track.toWorld(i * track.step, side * (track.width[i] / 2 + 3), 0, p);
        spots.push({ x: p.x, y: p.y, z: p.z });
      }
    }
    const geo = new THREE.CylinderGeometry(0.9, 1.1, e.columnHeight, 8);
    geo.translate(0, e.columnHeight / 2, 0);
    const mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshLambertMaterial({ color: e.templeColor }),
      Math.max(1, spots.length)
    );
    const dummy = new THREE.Object3D();
    spots.forEach((s, k) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  // ---- ゴールの門（スタートライン少し手前） ----
  buildTempleGate() {
    const e = CONFIG.environment;
    const track = this.track;
    const s = track.length - 12;
    const half = track.widthAt(s) / 2 + 3;
    const yaw = track.yawAt(s);
    const p = {};
    const boxes = [];
    for (const side of [-1, 1]) {
      track.toWorld(s, side * half, 0, p);
      boxes.push({ x: p.x, y: p.y + 7, z: p.z, sx: 2.6, sy: 14, sz: 2.6, yaw });
    }
    track.toWorld(s, 0, 14.5, p);
    boxes.push({ x: p.x, y: p.y, z: p.z, sx: half * 2 + 6, sy: 2.4, sz: 3.4, yaw });
    track.toWorld(s, 0, 17, p);
    boxes.push({ x: p.x, y: p.y, z: p.z, sx: half * 2 - 2, sy: 2.6, sz: 2.6, yaw });
    return makeBoxInstances(boxes, e.templeColor);
  }

  // ---- 補助 ----

  // コースの中心（上から見た範囲の真ん中）
  courseCenter() {
    if (this.center) return this.center;
    const t = this.track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < t.count; i += 1) {
      minX = Math.min(minX, t.px[i]); maxX = Math.max(maxX, t.px[i]);
      minZ = Math.min(minZ, t.pz[i]); maxZ = Math.max(maxZ, t.pz[i]);
    }
    this.center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    return this.center;
  }

  // 上から見て、コースまで何メートルあるか
  distanceToTrack(x, z) {
    const t = this.track;
    let best = Infinity;
    for (let i = 0; i < t.count; i += 4) {
      const d = Math.hypot(t.px[i] - x, t.pz[i] - z) - t.width[i] / 2;
      if (d < best) best = d;
    }
    return best;
  }
}

// ---- 画像・形を作る関数 ----

// 毎回同じ並びになる乱数
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 箱をまとめて1回で描く（遺跡・門）
function makeBoxInstances(boxes, color) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshLambertMaterial({ color }),
    Math.max(1, boxes.length)
  );
  const dummy = new THREE.Object3D();
  boxes.forEach((b, k) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.rotation.set(0, b.yaw, 0);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix);
  });
  mesh.count = boxes.length;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// 浮遊島の形（上に平らな草地、下に尖った岩）。大きさ1の基準形
function makeIslandGeometry(grassHex, rockHex) {
  const sides = 7;
  const positions = [];
  const colors = [];
  const grass = new THREE.Color(grassHex);
  const rock = new THREE.Color(rockHex);
  const rockDark = new THREE.Color(rockHex).multiplyScalar(0.7);
  const push = (v, c) => {
    positions.push(v[0], v[1], v[2]);
    colors.push(c.r, c.g, c.b);
  };
  for (let k = 0; k < sides; k += 1) {
    const a0 = (k / sides) * Math.PI * 2;
    const a1 = ((k + 1) / sides) * Math.PI * 2;
    const r0 = 1 + 0.15 * Math.sin(k * 2.3);
    const r1 = 1 + 0.15 * Math.sin((k + 1) * 2.3);
    const top0 = [Math.cos(a0) * r0, 0, Math.sin(a0) * r0];
    const top1 = [Math.cos(a1) * r1, 0, Math.sin(a1) * r1];
    // 草地（上の面）
    push([0, 0.05, 0], grass);
    push(top1, grass);
    push(top0, grass);
    // 岩（下の尖り）
    const bottom = [0, -1.6, 0];
    const shade = k % 2 === 0 ? rock : rockDark;
    push(top0, shade);
    push(top1, shade);
    push(bottom, shade);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// 中心が明るく外側が透明な丸い光
function makeGlowTexture(size, inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 雲の画像（白いふわふわを散らす。端がつながるように描く）
function makeCloudTexture(size, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  for (let i = 0; i < 46; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = size * (0.06 + random() * 0.14);
    // 端でつながるよう、上下左右にずらした位置にも同じ雲を描く
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.6, 'rgba(250,250,255,0.45)');
        g.addColorStop(1, 'rgba(240,245,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
  return new THREE.CanvasTexture(canvas);
}

// 遠景の島のシルエット（影のぼかしを使って、どのブラウザでもぼかす）
function makeFarIslandTexture() {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 形そのものは画面の外に描き、ぼけた影だけを画面内に落とす
  const shift = 1000;
  ctx.shadowColor = 'rgba(150, 180, 215, 0.9)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = shift;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(w * 0.5 - shift, h * 0.38, w * 0.36, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.16 - shift, h * 0.4);
  ctx.lineTo(w * 0.84 - shift, h * 0.4);
  ctx.lineTo(w * 0.55 - shift, h * 0.88);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
