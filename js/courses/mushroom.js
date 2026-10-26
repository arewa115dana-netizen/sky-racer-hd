/*
  ファイル名 : mushroom.js
  保存場所   : /js/courses
  役割       : キノコの森コース。テーマ（木もれ日の森）・草木（小さなキノコ・シダ・クローバーなど）・
               景色（空中ルートのまわりの巨大キノコ・森の大木・倒れた巨木のトンネル・小川・キノコの門）
  バージョン : 1.16.0（Phase16 Step16-2）
  メモ       : コースの形・でこぼこ・リングは mushroomData.js
*/

import * as THREE from 'three';
import { MUSHROOM } from './mushroomData.js';
import { emptyGrid, outline, paintCanopy, drawGrass, drawTree, LEAF, BLOSSOM } from '../world/Decor.js';
import { ShapeBuilder, makeTexture, seededRandom } from '../world/Buildings.js';

// ---- 木もれ日の森のテーマ ----
const THEME = {
  environment: {
    skyTopColor: 0x5aa6dc,
    horizonColor: 0xd6ecbc,      // 緑がかった明るい地平線
    fogNear: 80,
    fogFar: 400,
    sunDirection: { x: 0.25, y: 0.7, z: 0.66 },
    sunGlow: 'rgba(255,248,210,1)',
    cloudColor: 0xf0f8e0,
    farIslandColor: 'rgba(120, 170, 120, 0.6)',
    grassColor: 0x5ab048,
    rockColor: 0x6a4e3a
  },
  lights: {
    hemiSky: 0xfff2cc,
    hemiGround: 0x4a7a32,
    hemiIntensity: 1.25,
    sunColor: 0xfff0b8,
    sunIntensity: 1.7
  },
  course: {
    stripeLength: 3,
    roadColors: {
      glade: 0xb08e60,           // 土の道
      roots: 0x94704a,           // 木の根
      log: 0xb88a56,             // 丸太の中の木の面
      brook: 0xbca47e,           // 小石の道
      default: 0xa88a5e
    },
    rockColor: 0x6a4e3a,
    rockDepth: { glade: 12, roots: 14, log: 8, brook: 8, default: 10 },
    curbLight: 0xf2ead0,
    curbDark: 0x5c9a3a,          // こけの緑
    railColor: 0x8a6040,
    lanternColor: 0xffe070       // 空中の目印はホタルの色
  },
  decor: {
    vergeColor: 0x5aa848,
    dirtColor: 0x6a4a30,
    treeChance: 0.18
  },
  postfx: {
    saturation: 1.2,
    warmTint: [1.05, 1.02, 0.9]
  },
  atmosphere: {
    rayColor: 0xfff0b0,
    rayIntensity: 0.32,          // 木もれ日の光の筋を強めに
    moteColor: 0xfff09a,         // 花粉とホタル
    moteRise: 0.2
  }
};

// ---- 森の草木 ----
const FERN = [0x123a1a, 0x2a6a2a, 0x46963a, 0x76c25a, 0xb0e88a];
const DEEP = [0x0e2a14, 0x1c4a24, 0x2e6e34, 0x4a944a, 0x86c070];

const FOREST_DECOR = {
  kinds: {
    treeRound:   { w: 32, h: 48, height: 8.0, draw: (r) => drawTree(32, 48, DEEP, r, [[16, 16, 13], [9, 21, 8], [23, 21, 8], [16, 9, 8]]) },
    treeLight:   { w: 32, h: 48, height: 7.0, draw: (r) => drawTree(32, 48, LEAF, r, [[16, 15, 12], [8, 19, 8], [24, 19, 8], [16, 9, 7]]) },
    tallShroom:  { w: 24, h: 32, height: 4.0, draw: () => drawShroom(24, 32, 0xe0402e, 0xffffff) },
    redShroom:   { w: 12, h: 12, height: 1.0, small: true, draw: () => drawShroom(12, 12, 0xe0402e, 0xffffff) },
    blueShroom:  { w: 12, h: 12, height: 0.9, small: true, draw: () => drawShroom(12, 12, 0x3a8ae8, 0xb8f0ff) },
    fern:        { w: 24, h: 16, height: 1.5, small: true, draw: (r) => drawFern(24, 16, r) },
    clover:      { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, [0xffffff, 0xffe0f0], FERN) },
    pinkFlower:  { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, [0xf070b0, 0xffd0e8], FERN) }
  },
  pickSmall(area, random) {
    const r = random();
    if (area === 'log' || area === 'roots') return r < 0.3 ? 'redShroom' : (r < 0.55 ? 'blueShroom' : (r < 0.85 ? 'fern' : 'clover'));
    return r < 0.2 ? 'redShroom' : (r < 0.35 ? 'blueShroom' : (r < 0.6 ? 'fern' : (r < 0.8 ? 'clover' : 'pinkFlower')));
  },
  pickTree(area, random) {
    const r = random();
    return r < 0.3 ? 'tallShroom' : (r < 0.65 ? 'treeRound' : 'treeLight');
  },
  islandTree(random) {
    const r = random();
    return r < 0.35 ? 'tallShroom' : (r < 0.7 ? 'treeRound' : 'treeLight');
  },
  islandSmall: (random) => FOREST_DECOR.pickSmall('', random)
};

// キノコ（丸いかさに水玉、白い柄）
function drawShroom(w, h, capHex, dotHex) {
  const g = emptyGrid(w, h);
  const cx = w / 2;
  const capH = Math.round(h * 0.55);
  // 柄
  const stemW = Math.max(2, Math.round(w * 0.22));
  for (let y = capH - 1; y < h; y += 1) {
    for (let x = Math.round(cx - stemW / 2); x < Math.round(cx + stemW / 2); x += 1) {
      g[y][x] = x === Math.round(cx - stemW / 2) ? 0xfff8e8 : 0xe8dcc0;
    }
  }
  // かさ（半円）
  const rx = w / 2 - 0.5;
  const ry = capH;
  for (let y = 0; y < capH; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (capH - (y + 0.5)) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const light = -dx * 0.5 + dy * 0.6;
      g[y][x] = light > 0.45 ? shade(capHex, 1.25) : (light > -0.1 ? capHex : shade(capHex, 0.75));
    }
  }
  // 水玉
  const dots = w > 16 ? [[0.3, 0.45], [0.62, 0.3], [0.5, 0.7], [0.78, 0.6], [0.2, 0.75]] : [[0.3, 0.5], [0.65, 0.4]];
  for (const [fx, fy] of dots) {
    const x = Math.round(fx * (w - 1));
    const y = Math.round(fy * (capH - 1));
    if (g[y] && g[y][x] !== null) {
      g[y][x] = dotHex;
      if (w > 16 && g[y][x + 1] !== null && g[y][x + 1] !== undefined) g[y][x + 1] = dotHex;
    }
  }
  outline(g, shade(capHex, 0.4));
  return g;
}

// シダ（左右に広がる葉）
function drawFern(w, h, random) {
  const g = emptyGrid(w, h);
  const cx = Math.floor(w / 2);
  for (const dir of [-1, 1]) {
    for (let k = 0; k < 3; k += 1) {
      const len = 8 + k * 2 + Math.floor(random() * 2);
      for (let t = 0; t < len; t += 1) {
        const x = cx + dir * t;
        const y = h - 2 - k * 3 - Math.round(Math.sin(t / len * Math.PI) * 3);
        if (x < 0 || x >= w || y < 0) continue;
        g[y][x] = FERN[t < len * 0.5 ? 3 : 2];
        if (t % 2 === 0 && y - 1 >= 0) g[y - 1][x] = FERN[4];
      }
    }
  }
  for (let y = h - 8; y < h; y += 1) g[y][cx] = FERN[1];
  outline(g, FERN[0]);
  return g;
}

function shade(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// ============================================================
// 模様
// ============================================================

// 水玉のかさ（白っぽく描き、キノコごとの色を掛ける）
function drawCapTexture() {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const d1 = Math.hypot(x - 8, y - 9);
      const d2 = Math.hypot(x - 24, y - 24);
      const d3 = Math.hypot(x - 26, y - 6);
      const dot = d1 < 4.5 || d2 < 4 || d3 < 2.5;
      row.push(dot ? 0xffffff : 0xb8b8b8);
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

// 木の皮（縦のすじ）
function drawBark(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const groove = (x + Math.floor(Math.sin(y * 0.4 + x) * 1.5)) % 6 === 0;
      const v = random();
      row.push(groove ? 0x3a2414 : (v < 0.15 ? 0x5a3a22 : (v > 0.92 ? 0x8a6040 : 0x6e4a2c)));
    }
    grid.push(row);
  }
  // こけ
  for (let k = 0; k < 40; k += 1) {
    const x = Math.floor(random() * 32);
    const y = Math.floor(random() * 32);
    grid[y][x] = random() < 0.5 ? 0x5a9a3a : 0x3a7a2a;
  }
  return makeTexture(grid);
}

// キノコの柄（クリーム色のすじ）
function drawStem(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const v = random();
      row.push(x % 8 === 0 ? 0xd8ccb0 : (v < 0.1 ? 0xe4d8be : 0xf2eada));
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

// 水（小川）
function makeWaterTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3aa8d8';
  ctx.fillRect(0, 0, size, size);
  const random = seededRandom(5);
  for (let k = 0; k < 18; k += 1) {
    ctx.fillStyle = random() < 0.5 ? '#7ad4f4' : '#d8f6ff';
    ctx.fillRect(Math.floor(random() * size), Math.floor(random() * size), 3 + Math.floor(random() * 4), 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================
// 景色
// ============================================================

const CAP_COLORS = [0xe0402e, 0xf08a2a, 0x9a5ae0, 0xe0402e, 0x3a8ae8];

function buildScenery(track) {
  const random = seededRandom(4321);
  const stems = new ShapeBuilder(3.0);
  const caps = new ShapeBuilder(6.0);
  const bark = new ShapeBuilder(4.0);
  const leaves = new ShapeBuilder(5.0);
  const p = { x: 0, y: 0, z: 0 };
  const glow = [];

  // ---- 巨大キノコ（空中ルートの両側。かさの高さはルートの上下に散らす） ----
  const every = Math.round(30 / track.step);
  let n = 0;
  for (let i = 0; i < track.count; i += every) {
    if (track.area[i] !== 'caps' || track.zone[i] !== 'air') continue;
    const side = n % 2 === 0 ? -1 : 1;
    const radius = 10 + random() * 8;
    // かさが飛ぶ道にかからないよう、道の端からかさの半径ぶん以上離す
    const out = track.width[i] / 2 + radius + 3 + random() * 6;
    track.toWorld(i * track.step, side * out, 0, p);
    const capY = p.y + (n % 3 === 0 ? 10 : (n % 3 === 1 ? -8 : 3)) + random() * 4;
    addGiantShroom(stems, caps, p.x, capY, p.z, radius, CAP_COLORS[n % CAP_COLORS.length], random);
    n += 1;
  }
  // 森のあちこちにも巨大キノコ（遠くに見える）
  for (const [x, z, h, r] of [[40, 120, 18, 16], [-10, -60, 10, 12], [120, 40, 24, 20], [-170, 120, 14, 14], [60, -260, 16, 18]]) {
    addGiantShroom(stems, caps, x, h, z, r, CAP_COLORS[Math.floor(random() * CAP_COLORS.length)], random);
  }

  // ---- 森の大木（木の根の道の外側にそびえる） ----
  const treeEvery = Math.round(44 / track.step);
  let t = 0;
  for (let i = 0; i < track.count; i += treeEvery) {
    const area = track.area[i];
    if ((area !== 'roots' && area !== 'glade') || track.zone[i] !== 'ground') continue;
    const k = track.curv[i];
    const side = k > 0 ? 1 : -1;   // カーブの外側に立てる（カメラの前をふさがない）
    track.toWorld(i * track.step, side * (track.width[i] / 2 + 14 + random() * 6), 0, p);
    addBigTree(bark, leaves, p.x, p.y, p.z, 4.5 + random() * 2.5, random);
    // 根（道の方へ伸びる太い根）
    for (let r = 0; r < 3; r += 1) {
      const a = random() * Math.PI * 2;
      bark.box(p.x + Math.cos(a) * 6, p.y + 0.5, p.z + Math.sin(a) * 6, 2.2, 2.2, 10, a, 0.9, -0.25);
    }
    t += 1;
  }

  // ---- 倒れた巨木のトンネル（うろの丸太の区間を、木の輪でおおう） ----
  const ringEvery = Math.round(3 / track.step);
  for (let i = 0; i < track.count; i += ringEvery) {
    if (track.area[i] !== 'log' || track.zone[i] !== 'ground') continue;
    const s = i * track.step;
    const yaw = track.yaw[i];
    const R = track.width[i] / 2 + 2.5;
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2;
      if (Math.sin(a) < -0.25) continue;   // 下側（道の所）は作らない
      const x = Math.cos(a) * R;
      const y = Math.sin(a) * R * 0.85 + 1.2;
      track.toWorld(s, x, y, p);
      bark.box(p.x, p.y, p.z, 2.2, 2.2, 3.4, yaw, 0.85 + (k % 2) * 0.1);
      // うろの中の光るキノコ
      if (k % 4 === 1 && random() < 0.5) {
        track.toWorld(s, x * 0.82, y * 0.82, p);
        glow.push({ x: p.x, y: p.y, z: p.z });
      }
    }
  }

  // ---- キノコの門（ゴールの手前） ----
  const s = track.length - 12;
  const half = track.widthAt(s) / 2 + 4;
  const yaw = track.yawAt(s);
  for (const side of [-1, 1]) {
    track.toWorld(s, side * half, 0, p);
    addGiantShroom(stems, caps, p.x, p.y + 13, p.z, 6, 0xe0402e, random, 1.4);
  }
  track.toWorld(s, 0, 11, p);
  bark.box(p.x, p.y, p.z, half * 2 + 2, 1.6, 1.8, yaw, 1.0);
  leaves.box(p.x, p.y + 1.0, p.z, half * 2 - 2, 0.6, 2.2, yaw, 1.0);

  // ---- 素材 ----
  const texRandom = seededRandom(2468);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(stems.build(), new THREE.MeshLambertMaterial({ map: drawStem(texRandom), vertexColors: true })));
  group.add(new THREE.Mesh(caps.build(), new THREE.MeshLambertMaterial({ map: drawCapTexture(), vertexColors: true })));
  group.add(new THREE.Mesh(bark.build(), new THREE.MeshLambertMaterial({ map: drawBark(texRandom), vertexColors: true })));
  leaves.setTint(0xffffff);
  group.add(new THREE.Mesh(leaves.build(), new THREE.MeshLambertMaterial({ map: drawLeafTexture(texRandom), vertexColors: true })));

  // 光るキノコとホタル
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glow.flatMap((g) => [g.x, g.y, g.z]), 3));
  group.add(new THREE.Points(glowGeo, new THREE.PointsMaterial({ color: 0x8af0ff, size: 0.9 })));

  // ---- 小川（小川のほとりの外側を流れる） ----
  const waterTex = makeWaterTexture();
  waterTex.repeat.set(2, 30);
  group.add(buildBrook(track, waterTex));

  let time = 0;
  return {
    group,
    update(dt) {
      time += dt;
      waterTex.offset.y = (time * 0.12) % 1;
    }
  };
}

// 巨大キノコ：柄（円柱）と、かさ（平たい円すい＋ふち）。scale で全体の大きさを変える
function addGiantShroom(stems, caps, x, capY, z, radius, color, random, scale = 1) {
  const stemR = radius * 0.22;
  const bottom = capY - 70 * scale;   // 柄は雲の下まで伸ばす
  stems.cylinder(x, bottom, z, stemR, capY - bottom, 1.0, 12);
  // ひだ（かさの裏。白っぽい薄い円柱）
  stems.cylinder(x, capY - 0.6, z, radius * 0.92, 0.6, 0.8, 16, true);
  caps.setTint(color);
  caps.cylinder(x, capY, z, radius, radius * 0.18, 1.0, 16);
  caps.cone(x, capY + radius * 0.18, z, radius, radius * 0.45, 1.05);
  caps.setTint(0xffffff);
}

// 森の大木：太い幹と、高い所の葉のかたまり
function addBigTree(bark, leaves, x, y, z, r, random) {
  bark.cylinder(x, y - 40, z, r, 80, 1.0, 12);
  leaves.setTint(0x6abf4a);
  for (let k = 0; k < 3; k += 1) {
    const h = y + 30 + k * 9;
    leaves.cone(x + (random() - 0.5) * 4, h, z + (random() - 0.5) * 4, r * (4.4 - k * 1.1), 14, 1.0 - k * 0.05);
  }
  leaves.setTint(0xffffff);
}

// 葉の模様
function drawLeafTexture(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const v = random();
      row.push(v < 0.25 ? 0x9a9a9a : (v > 0.85 ? 0xffffff : 0xd0d0d0));
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

// 小川：小川のほとりの区間の、道の左側（外側）の下を流れる帯
function buildBrook(track, tex) {
  const positions = [];
  const uvs = [];
  const index = [];
  const p = { x: 0, y: 0, z: 0 };
  let n = 0;
  let v = 0;
  for (let i = 0; i < track.count; i += 2) {
    if (track.area[i] !== 'brook') continue;
    const half = track.width[i] / 2;
    track.toWorld(i * track.step, -(half + 4), -1.5, p);
    positions.push(p.x, p.y, p.z);
    track.toWorld(i * track.step, -(half + 16), -1.5, p);
    positions.push(p.x, p.y, p.z);
    uvs.push(0, v, 1, v);
    v += 0.1;
    if (n > 0) {
      const k = (n - 1) * 2;
      index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    n += 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
}

export const MUSHROOM_COURSE = {
  id: 'mushroom',
  ready: true,
  name: 'キノコの森',
  sub: '木の根のでこぼこ道と、巨大キノコの間を飛ぶ森',
  stars: 3,
  color: '#8fe07a',
  data: MUSHROOM,
  theme: THEME,
  decor: FOREST_DECOR,
  music: 'mushroom',
  titleStart: 470,   // タイトルの背景：木の根の道の終わりから巨大キノコの空へ
  scenery: (track) => buildScenery(track)
};
