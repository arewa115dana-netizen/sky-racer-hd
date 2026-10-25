/*
  ファイル名 : Landmarks.js
  保存場所   : /js/world
  役割       : 目印になる建物と、動きのある小物
                 ・本殿       … 天空神殿の道の外側に建つ大きな建物（階段・6本の柱・屋根）。下は浮遊島の岩
                 ・かがり火   … ゴールの門の両側・神殿の道沿い・本殿の前。炎はドット絵のパラパラ動画、火の粉が舞う
                 ・旗         … 神殿の柱に下がる、赤地に金の太陽の紋章の旗
                 ・ツタ       … 古代遺跡の柱や梁から垂れる
                 ・浮かぶ瓦礫 … 古代遺跡の空中ルートのまわりに浮かぶ石のかたまり
  バージョン : 0.8.7（Phase8 Step8-7）

  軽くするための工夫
    ・石の部分は Buildings.js と同じ「まとめて1回で描く」入れ物を使う
    ・炎は、4コマを横に並べた1枚の画像の「見る場所」をずらすだけで動かす（全部の炎で1回の計算）
    ・旗・ツタ・炎は、それぞれ種類ごとにまとめて1回で描く
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBuilders, addMeshes } from './Buildings.js';

const FLAME_FRAMES = 4;

/**
 * 本殿・かがり火・旗・ツタ・浮かぶ瓦礫を作る
 * @param {Track} track
 * @param {object} anchors Buildings.js が記録した、ツタと旗を付ける場所
 * @param {string} level 画質 'high' / 'mid' / 'low'
 * @returns {{ group: THREE.Group, update(dt) }}
 */
export function buildLandmarks(track, anchors, level) {
  const group = new THREE.Group();
  const builders = createBuilders();
  const fires = [];   // かがり火の炎の位置

  const shrine = findShrineSpot(track);
  if (shrine) buildShrine(builders, shrine, fires);
  buildBraziers(track, builders, fires);
  buildDebris(track, builders);
  addMeshes(group, builders);

  // 小物の画像（旗・ツタ）
  const propTexture = drawPropAtlas();
  const propMaterial = new THREE.MeshBasicMaterial({ map: propTexture, alphaTest: 0.5, side: THREE.DoubleSide });
  if (anchors.banners.length > 0) {
    group.add(makeHanging(anchors.banners, propMaterial, 1.4, 4.2, 0, () => 1));
  }
  if (anchors.vines.length > 0) {
    group.add(makeHanging(anchors.vines, propMaterial, 1.6, 1, 1, (a) => a.length));
  }

  // 炎と火の粉
  const flames = buildFlames(fires);
  group.add(flames.mesh);
  const embers = level === 'low' ? null : buildEmbers(fires);
  if (embers) group.add(embers.points);

  let time = 0;
  let frame = -1;
  return {
    group,
    shrine,
    update(dt) {
      time += dt;
      // 炎のコマを進める（画像の見る場所を横にずらすだけ）
      const f = Math.floor(time * CONFIG.landmarks.flameFps) % FLAME_FRAMES;
      if (f !== frame) {
        frame = f;
        flames.texture.offset.x = f / FLAME_FRAMES;
      }
      if (embers) embers.update(time);
    }
  };
}

// ---- 本殿の置き場所を探す ----
// 天空神殿の地上区間で、道の外側にコースと重ならない広い場所を、ゴールに近い方から探す
function findShrineSpot(track) {
  const l = CONFIG.landmarks;
  const p = { x: 0, y: 0, z: 0 };
  for (let s = track.length - 20; s > 0; s -= 10) {
    const i = Math.floor(s / track.step);
    if (track.area[i] !== 'temple' || track.zone[i] !== 'ground') continue;
    for (const side of [1, -1]) {
      track.toWorld(s, side * (track.width[i] / 2 + l.shrineOffset), 0, p);
      let clear = Infinity;
      for (let k = 0; k < track.count; k += 3) {
        const d = Math.hypot(track.px[k] - p.x, track.pz[k] - p.z) - track.width[k] / 2;
        if (d < clear) clear = d;
      }
      if (clear >= l.shrineClearance) {
        // 正面（建物の +z）を道の方へ向ける
        return { x: p.x, y: p.y, z: p.z, yaw: track.yaw[i] + side * Math.PI / 2 };
      }
    }
  }
  return null;
}

// ---- 本殿 ----
function buildShrine(builders, c, fires) {
  const { ruin, flute, block } = builders;
  const cos = Math.cos(c.yaw);
  const sin = Math.sin(c.yaw);
  // 建物の中の位置（x: 横、z: 前）→ 世界の位置
  const at = (x, z) => ({ x: c.x + x * cos + z * sin, z: c.z - x * sin + z * cos });
  const box = (b, x, y, z, sx, sy, sz, shade) => {
    const q = at(x, z);
    b.box(q.x, c.y + y, q.z, sx, sy, sz, c.yaw, shade);
  };

  // 下の浮遊島（岩を3段、下ほど細く）
  box(ruin, 0, -3.5, 0, 26, 5, 20, 0.85);
  box(ruin, 0, -8.5, 0, 18, 5, 13, 0.8);
  box(ruin, 0, -13, 0, 9, 4, 7, 0.75);
  // 階段状の基壇（3段）
  box(block, 0, 0.5, 0, 26, 1, 20, 0.95);
  box(block, 0, 1.5, -0.5, 23, 1, 17, 1);
  box(block, 0, 2.5, -1, 20, 1, 14, 1.05);
  const floor = 3;
  const height = 9;
  // 奥の壁と左右の壁
  box(block, 0, floor + height / 2, -5.5, 17, height, 1, 0.9);
  box(block, -8, floor + height / 2, -1.5, 1, height, 8, 0.9);
  box(block, 8, floor + height / 2, -1.5, 1, height, 8, 0.9);
  // 入口（暗い四角）
  box(ruin, 0, floor + 2.6, -4.95, 3.2, 5.2, 0.2, 0.35);
  // 正面の6本の柱
  for (let k = 0; k < 6; k += 1) {
    const x = -8.5 + k * 3.4;
    const q = at(x, 4.5);
    block.box(q.x, c.y + floor + 0.25, q.z, 2.0, 0.5, 2.0, c.yaw, 0.95);
    flute.cylinder(q.x, c.y + floor + 0.5, q.z, 0.75, height - 1.2, 1);
    block.box(q.x, c.y + floor + height - 0.35, q.z, 2.0, 0.7, 2.0, c.yaw, 1.08);
  }
  // 梁と屋根（三角の破風）
  box(block, 0, floor + height + 0.7, -0.5, 21, 1.4, 13, 1);
  box(block, 0, floor + height + 1.7, -0.5, 22, 0.6, 14, 1.1);
  const roof = at(0, -0.5);
  block.prism(roof.x, c.y + floor + height + 2.0, roof.z, 21, 4.8, 13.5, c.yaw, 1.04);

  // 正面の階段の両わきに、かがり火
  for (const x of [-11, 11]) {
    const q = at(x, 8.5);
    addBrazier(builders, q.x, c.y + 1, q.z, c.yaw, fires);
  }
}

// ---- かがり火（石の台と火皿。炎の位置を fires に記録） ----
function addBrazier(builders, x, y, z, yaw, fires) {
  builders.block.box(x, y + 0.7, z, 1.0, 1.4, 1.0, yaw, 0.95);
  builders.block.box(x, y + 1.5, z, 1.3, 0.2, 1.3, yaw, 1.05);
  builders.ruin.box(x, y + 1.8, z, 1.5, 0.4, 1.5, yaw, 0.55);
  fires.push({ x, y: y + 1.95, z });
}

// ゴールの門の両側と、神殿の道沿い（柱と柱の間に、1つおき）
function buildBraziers(track, builders, fires) {
  const e = CONFIG.environment;
  const b = CONFIG.buildings;
  const p = { x: 0, y: 0, z: 0 };
  const gateS = track.length - 12;
  for (const side of [-1, 1]) {
    const s = gateS - 5;
    track.toWorld(s, side * (track.widthAt(s) / 2 + 4.6), 0, p);
    addBrazier(builders, p.x, p.y, p.z, track.yawAt(s), fires);
  }
  const every = Math.round(e.columnSpacing / track.step);
  let n = 0;
  for (let i = Math.round(every / 2); i < track.count; i += every) {
    if (track.area[i] !== 'temple' || track.zone[i] !== 'ground') continue;
    const toGate = Math.abs(i * track.step - gateS);
    if (Math.min(toGate, track.length - toGate) < b.gateClearance) continue;
    n += 1;
    if (n % 2 === 1) continue;
    for (const side of [-1, 1]) {
      track.toWorld(i * track.step, side * (track.width[i] / 2 + b.columnOffset), 0, p);
      addBrazier(builders, p.x, p.y, p.z, track.yaw[i], fires);
    }
  }
}

// ---- 浮かぶ瓦礫（古代遺跡の空中ルートのまわり。飛ぶ道はふさがない） ----
function buildDebris(track, builders) {
  const l = CONFIG.landmarks;
  const random = seededRandom(5150);
  const p = { x: 0, y: 0, z: 0 };
  for (let s = 0; s < track.length; s += l.debrisSpacing) {
    const i = Math.floor(s / track.step);
    if (track.area[i] !== 'ruins' || track.zone[i] !== 'air') continue;
    const count = 1 + Math.floor(random() * 2);
    for (let k = 0; k < count; k += 1) {
      const side = random() < 0.5 ? -1 : 1;
      const x = side * (track.width[i] / 2 + 7 + random() * 16);
      track.toWorld(s + random() * l.debrisSpacing, x, -8 + random() * 22, p);
      const size = 1.2 + random() * 2.6;
      builders.ruin.box(p.x, p.y, p.z, size, size * (0.6 + random() * 0.5), size * (0.8 + random() * 0.4),
        random() * Math.PI * 2, 0.8 + random() * 0.2, random() * 0.9);
    }
  }
}

// ---- 吊り下げる板（旗・ツタ）。上端を付ける場所に合わせ、下へ垂らす ----
// cell: 小物の画像の何番目の絵か / lengthOf: 長さ（メートル）を返す関数
function makeHanging(list, material, width, height, cell, lengthOf) {
  const geo = new THREE.PlaneGeometry(width, height);
  geo.translate(0, -height / 2, 0);   // 上端を基準にする
  // 画像の中の絵の場所（16×48 の絵が横に並んでいる）
  const u0 = (cell * 16 + 0.25) / 64;
  const u1 = (cell * 16 + 16 - 0.25) / 64;
  const v0 = 1 - 48 / 64 + 0.25 / 64;
  const v1 = 1 - 0.25 / 64;
  const uv = geo.attributes.uv;
  uv.setXY(0, u0, v1);
  uv.setXY(1, u1, v1);
  uv.setXY(2, u0, v0);
  uv.setXY(3, u1, v0);
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const dummy = new THREE.Object3D();
  list.forEach((a, n) => {
    dummy.position.set(a.x, a.y, a.z);
    dummy.rotation.set(0, a.yaw, 0);
    dummy.scale.set(1, lengthOf(a), 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// ---- 炎（十字に組んだ板に、4コマの炎の画像を貼る） ----
function buildFlames(fires) {
  const l = CONFIG.landmarks;
  const texture = drawFlameStrip();
  texture.repeat.set(1 / FLAME_FRAMES, 1);   // 1コマ分だけを見る
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,   // 光を足して明るく見せる
    side: THREE.DoubleSide
  });
  const h = l.flameHeight;
  const w = h * 0.5;
  const positions = [];
  const uvs = [];
  for (const angle of [0, Math.PI / 2]) {
    const cx = Math.cos(angle) * w / 2;
    const cz = Math.sin(angle) * w / 2;
    const quad = [[-cx, 0, -cz, 0, 0], [cx, 0, cz, 1, 0], [cx, h, cz, 1, 1], [-cx, 0, -cz, 0, 0], [cx, h, cz, 1, 1], [-cx, h, -cz, 0, 1]];
    for (const v of quad) {
      positions.push(v[0], v[1], v[2]);
      uvs.push(v[3], v[4]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, fires.length));
  const dummy = new THREE.Object3D();
  fires.forEach((f, n) => {
    dummy.position.set(f.x, f.y, f.z);
    dummy.rotation.set(0, n * 0.7, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
  });
  mesh.count = fires.length;
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, texture };
}

// ---- 火の粉（炎の上へ、ゆらゆら昇って消える小さな光） ----
function buildEmbers(fires) {
  const l = CONFIG.landmarks;
  const per = l.embersPerFire;
  const count = fires.length * per;
  if (count === 0) return null;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let n = 0; n < count; n += 1) phase[n] = (n * 0.618) % 1;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  points.frustumCulled = false;
  return {
    points,
    update(time) {
      for (let n = 0; n < count; n += 1) {
        const f = fires[Math.floor(n / per)];
        const t = (time * l.emberSpeed + phase[n]) % 1;   // 0 → 1 で昇って消える
        const j = n * 3;
        const sway = phase[n] * 40;
        positions[j] = f.x + Math.sin(sway + t * 4) * 0.35 * t;
        positions[j + 1] = f.y + 0.8 + t * l.emberRise;
        positions[j + 2] = f.z + Math.cos(sway + t * 3) * 0.35 * t;
        const fade = 1 - t;
        colors[j] = 1.0 * fade;
        colors[j + 1] = 0.55 * fade;
        colors[j + 2] = 0.15 * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  };
}

// ============================================================
// ドット絵
// ============================================================

// 色の番号の表を、キャンバスの決まった場所に描く（null = 透明）
function paint(ctx, grid, ox, oy) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const c = grid[y][x];
      if (c === null) continue;
      ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function emptyGrid(w, h) {
  const g = [];
  for (let y = 0; y < h; y += 1) g.push(new Array(w).fill(null));
  return g;
}

function pixelTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 炎の4コマ（16×32 を横に4つ）
function drawFlameStrip() {
  const canvas = document.createElement('canvas');
  canvas.width = 16 * FLAME_FRAMES;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const layers = [[1.0, 0xd8442a], [0.72, 0xff8a2a], [0.45, 0xffd25a], [0.2, 0xfff6d8]];
  for (let f = 0; f < FLAME_FRAMES; f += 1) {
    const g = emptyGrid(16, 32);
    const tip = 6 + (f % 2) * 3;          // 炎の先の高さがコマごとに変わる
    for (const [scale, color] of layers) {
      const top = tip + (1 - scale) * 12;
      for (let y = Math.floor(top); y < 32; y += 1) {
        const t = (y - top) / (31 - top);
        const hw = 6.5 * scale * Math.pow(t, 0.6) * (1 - Math.pow(t, 6) * 0.35);
        const sway = Math.sin(f * 1.7 + y * 0.45) * 1.3 * (1 - t);   // 上ほど揺れる
        for (let x = 0; x < 16; x += 1) {
          if (Math.abs(x + 0.5 - 8 - sway) <= hw) g[y][x] = color;
        }
      }
    }
    paint(ctx, g, f * 16, 0);
  }
  return pixelTexture(canvas);
}

// 小物の画像（64×64）：0 = 旗、1 = ツタ（どちらも 16×48）
function drawPropAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  paint(ctx, drawBanner(), 0, 0);
  paint(ctx, drawVine(seededRandom(8)), 16, 0);
  return pixelTexture(canvas);
}

// 旗：赤地、金のふち、金の太陽の紋章、下は燕尾（V字の切れ込み）
function drawBanner() {
  const red = 0xa8283a;
  const redDark = 0x7c1c2c;
  const gold = 0xe0b040;
  const goldDark = 0xa87a20;
  const rod = 0x6a4428;
  const g = emptyGrid(16, 48);
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      // 下の燕尾：真ん中ほど短い
      const cut = 40 + Math.abs(x - 7.5) * 1.1;
      if (y > cut) continue;
      let c = x >= 13 ? redDark : red;
      if (x === 1 || x === 14 || y === 3 || (y > cut - 1.5)) c = gold;
      if (x === 0 || x === 15) c = goldDark;
      g[y][x] = c;
    }
  }
  // 上の棒
  for (let x = 0; x < 16; x += 1) {
    g[0][x] = rod;
    g[1][x] = rod;
  }
  // 太陽の紋章（中心と光の筋）
  const cx = 7.5;
  const cy = 16;
  for (let y = 8; y < 25; y += 1) {
    for (let x = 2; x < 14; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      const a = Math.atan2(y - cy, x - cx);
      const ray = Math.abs(Math.sin(a * 4)) > 0.85 && d < 6.5;
      if (d < 2.6) g[y][x] = gold;
      else if (d < 3.4) g[y][x] = goldDark;
      else if (ray) g[y][x] = gold;
    }
  }
  return g;
}

// ツタ：長さの違う3本の茎に、左右交互の葉
function drawVine(random) {
  const leaf = [0x2f6b3a, 0x4f9a48, 0x7fc25a];
  const stem = 0x3a5a2a;
  const g = emptyGrid(16, 48);
  for (const [x0, len] of [[3, 34], [8, 47], [12, 40]]) {
    let x = x0;
    for (let y = 0; y < len; y += 1) {
      if (y % 6 === 0) x = Math.max(1, Math.min(14, x + (random() < 0.5 ? -1 : 1)));
      g[y][x] = stem;
      if (y % 3 === 1) {
        const side = (y % 6 === 1) ? -1 : 1;
        const lx = x + side;
        if (lx >= 0 && lx < 16) {
          g[y][lx] = leaf[1];
          if (lx + side >= 0 && lx + side < 16) g[y][lx + side] = leaf[2];
          if (y + 1 < 48) g[y + 1][lx] = leaf[0];
        }
      }
    }
  }
  return g;
}

// 毎回同じ並びになる乱数
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
