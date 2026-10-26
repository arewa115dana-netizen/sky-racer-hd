/*
  ファイル名 : ice.js
  保存場所   : /js/courses
  役割       : 氷の空中城コース。テーマ（オーロラの夜空・降る雪）・草木（雪のモミの木・雪だるまなど）・
               建物（氷の城の本丸・城壁と塔・城門・氷の橋のつらら・光る氷の結晶）
  バージョン : 1.14.0（Phase14 Step14-3）
  メモ       : コースの形とリング、すべる区間（grip）は iceData.js。
               建物は模様ごとに1回で描く（城の石・青い屋根・氷 の3回）
*/

import * as THREE from 'three';
import { ICE } from './iceData.js';
import { emptyGrid, outline, paintCanopy, drawGrass, drawBush, drawPine } from '../world/Decor.js';
import { ShapeBuilder, makeTexture, drawMarbleBlocks, seededRandom } from '../world/Buildings.js';

// ---- オーロラの夜のテーマ ----
const THEME = {
  environment: {
    skyTopColor: 0x060a24,       // 真上は濃い紺
    horizonColor: 0x23406e,      // 地平線は青
    fogNear: 90,
    fogFar: 420,
    sunDirection: { x: 0.32, y: 0.45, z: -0.83 },   // 月の方向
    sunSize: 80,
    sunGlow: 'rgba(225,238,255,1)',
    cloudColor: 0x6a7fae,        // 月明かりの雲海
    farIslandColor: 'rgba(80, 110, 160, 0.6)',
    grassColor: 0xeef5ff,        // 浮遊島の上は雪
    rockColor: 0x55607e,         // 青みがかった岩
    starCount: 320,
    aurora: { angle: 10, colors: ['#5dffa8', '#8a5cff'] }
  },
  lights: {
    hemiSky: 0xb0ccff,
    hemiGround: 0x2a2c5c,
    hemiIntensity: 1.3,
    sunColor: 0xc8dcff,
    sunIntensity: 1.15,
    sunPosition: { x: 20, y: 30, z: -50 }
  },
  course: {
    roadColors: {
      gate: 0xd4e0ee,            // 踏み固めた雪
      bridge: 0x8fd2ee,          // 氷
      castle: 0xb4c0d6,          // 城の石だたみ
      lake: 0x9cdcf2,            // 凍った湖
      default: 0xc4d2e6
    },
    rockColor: 0x525c7a,
    rockColors: { bridge: 0x9ad6f0, lake: 0x7ab4d4 },   // 氷の区間の下は氷のかたまり
    rockDepth: { gate: 12, bridge: 6, castle: 14, lake: 9, default: 10 },
    curbLight: 0xffffff,
    curbDark: 0x4a74c4,
    railColor: 0xdcefff,
    lanternColor: 0x9ff4ff       // 空中の目印は光る氷
  },
  decor: {
    vergeColor: 0xeef4ff,        // 路肩は雪
    dirtColor: 0x7d8cae
  },
  postfx: {
    contrast: 1.08,
    saturation: 1.06,
    warmTint: [0.94, 0.99, 1.1],
    shadowTint: [0.0, 0.02, 0.06],
    bloomThreshold: 0.8,
    bloomStrength: 0.55
  },
  atmosphere: {
    rayColor: 0xbfd6ff,
    rayIntensity: 0.1,
    moteColor: 0xffffff,         // 降る雪
    moteRise: -1.1,              // マイナス = 下へ落ちる
    moteDrift: 0.9,
    moteSize: 0.3,
    vignetteColor: 'rgba(5, 10, 40, 0.45)'
  }
};

// ---- 雪の草木 ----
const SNOW_PINE = [0x0e2626, 0x1c463f, 0x2f6a5a, 0xcfe6f2, 0xffffff];   // 明るい所が雪
const DARK_PINE = [0x0c1f22, 0x163a38, 0x24584e, 0x3a7a66, 0x8cc0b0];
const SNOW_BUSH = [0x4a5a7e, 0x9aaccc, 0xc8d6ee, 0xe8f0ff, 0xffffff];
const FROST = [0x2a3a5a, 0x5a7a9a, 0x8aaac8, 0xc4dcf2, 0xffffff];

const ICE_DECOR = {
  kinds: {
    snowPine:  { w: 24, h: 48, height: 8.0, draw: (r) => drawPine(24, 48, r, SNOW_PINE) },
    darkPine:  { w: 24, h: 48, height: 7.0, draw: (r) => drawPine(24, 48, r, DARK_PINE) },
    snowBush:  { w: 24, h: 16, height: 1.5, small: true, draw: (r) => drawBush(24, 16, SNOW_BUSH, r) },
    frost:     { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, null, FROST) },
    iceShard:  { w: 12, h: 16, height: 1.4, small: true, draw: (r) => drawShard(12, 16, r) },
    snowman:   { w: 12, h: 16, height: 1.6, small: true, draw: () => drawSnowman(12, 16) }
  },
  pickSmall(area, random) {
    const r = random();
    if (area === 'castle') return r < 0.5 ? 'frost' : (r < 0.8 ? 'iceShard' : 'snowBush');
    if (area === 'lake') return r < 0.12 ? 'snowman' : (r < 0.5 ? 'snowBush' : (r < 0.75 ? 'iceShard' : 'frost'));
    return r < 0.08 ? 'snowman' : (r < 0.5 ? 'snowBush' : 'frost');
  },
  pickTree(area, random) {
    return random() < 0.7 ? 'snowPine' : 'darkPine';
  },
  islandTree(random) {
    return random() < 0.75 ? 'snowPine' : 'darkPine';
  },
  islandSmall(random) {
    const r = random();
    return r < 0.06 ? 'snowman' : (r < 0.5 ? 'snowBush' : (r < 0.75 ? 'frost' : 'iceShard'));
  }
};

// 氷のかけら（ひし形の結晶が2本）
function drawShard(w, h, random) {
  const g = emptyGrid(w, h);
  const pal = [0x2a5a8a, 0x5ab0e0, 0x9adcf8, 0xd8f6ff, 0xffffff];
  const crystal = (cx, top, bottom, half) => {
    const mid = top + (bottom - top) * 0.4;
    for (let y = top; y <= bottom; y += 1) {
      const t = y < mid ? (y - top) / (mid - top) : (bottom - y) / (bottom - mid);
      const hw = Math.max(0, Math.round(t * half));
      for (let x = cx - hw; x <= cx + hw; x += 1) {
        if (x < 0 || x >= w) continue;
        g[y][x] = x < cx ? pal[3] : (x === cx ? pal[4] : pal[2]);
      }
    }
  };
  crystal(4, 3, 15, 2.6);
  crystal(8, 6, 15, 2.2);
  outline(g, pal[0]);
  g[2 + Math.floor(random() * 2)][4] = pal[4];
  return g;
}

// 雪だるま（バケツの帽子・にんじんの鼻・青いマフラー）
function drawSnowman(w, h) {
  const g = emptyGrid(w, h);
  const snow = [0x6a7a9e, 0xb8c8e4, 0xe0eaf8, 0xffffff, 0xffffff];
  const circle = (cx, cy, r) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const v = -(dx * 0.6 + dy * 0.8) / r;
        g[y][x] = v > 0.35 ? snow[3] : (v > -0.25 ? snow[2] : snow[1]);
      }
    }
  };
  circle(6, 11.5, 4.2);
  circle(6, 5.5, 3.0);
  outline(g, snow[0]);
  // バケツの帽子
  for (let x = 4; x <= 8; x += 1) g[2][x] = 0x8a3a2a;
  for (let x = 5; x <= 7; x += 1) { g[1][x] = 0xb04a34; g[0][x] = 0xb04a34; }
  // 目と鼻
  g[5][5] = 0x1a1a2a;
  g[5][7] = 0x1a1a2a;
  g[6][7] = 0xff8a2a;
  g[6][8] = 0xff8a2a;
  // マフラー
  for (let x = 3; x <= 9; x += 1) g[8][x] = 0x3a6ad8;
  g[9][8] = 0x3a6ad8;
  g[10][8] = 0x2a4ab0;
  return g;
}

// ============================================================
// 建物
// ============================================================

// 青い屋根の瓦
function drawRoof(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const rowN = Math.floor(y / 4);
      const off = rowN % 2 === 0 ? 0 : 4;
      const edge = y % 4 === 3 || (x + off) % 8 === 0;
      let c = edge ? 0x1e3470 : (y % 4 === 0 ? 0x5a84e0 : 0x3a5cb8);
      if (!edge && random() < 0.08) c = 0x4a70cc;
      // 雪が少し積もっている
      if (y % 4 === 0 && random() < 0.35) c = 0xe8f2ff;
      row.push(c);
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

// 氷（青白い面に、斜めのきらめきの線）
function drawIce(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const v = random();
      let c = v < 0.15 ? 0x7cc8ee : (v > 0.9 ? 0xd8f6ff : 0xa6e0f8);
      if ((x + y) % 11 === 0) c = 0xeafaff;
      if ((x - y + 64) % 17 === 0) c = 0xffffff;
      row.push(c);
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

function buildScenery(track) {
  const random = seededRandom(2121);
  const stone = new ShapeBuilder(2.4);    // 城の石
  const roof = new ShapeBuilder(2.0);     // 青い屋根
  const ice = new ShapeBuilder(2.5);      // 氷（つらら・結晶）
  const p = { x: 0, y: 0, z: 0 };

  // ---- 氷の城の本丸（コースの内側の浮かぶ島の上） ----
  buildKeep(stone, roof, ice, 66, 4, -32, random);

  // ---- 城壁と塔（城の中の区間の両側） ----
  const every = Math.round(4 / track.step);
  let n = 0;
  for (let i = 0; i < track.count; i += every) {
    if (track.area[i] !== 'castle' || track.zone[i] !== 'ground') continue;
    const yaw = track.yaw[i];
    const k = track.curv[i];
    for (const side of [-1, 1]) {
      const inside = (k > 0 && side < 0) || (k < 0 && side > 0);
      const h = inside && Math.abs(k) > 0.02 ? 2.6 : 5.0;   // カーブの内側は低く（カメラの前をふさがない）
      track.toWorld(i * track.step, side * (track.width[i] / 2 + 1.8), 0, p);
      stone.box(p.x, p.y + h / 2 - 1, p.z, 2.4, h + 2, 4.4, yaw, 0.95);
      // 胸壁（凸凹）：1つおきに
      if (n % 2 === 0) stone.box(p.x, p.y + h + 0.5, p.z, 2.6, 1.0, 1.8, yaw, 1.05);
      // 塔：一定の間隔で
      if (n % 9 === 4 && !inside) {
        track.toWorld(i * track.step, side * (track.width[i] / 2 + 4.5), 0, p);
        stone.cylinder(p.x, p.y - 4, p.z, 3.2, 17, 0.95);
        stone.box(p.x, p.y + 13.5, p.z, 7.6, 1.2, 7.6, yaw, 1.05);
        roof.cone(p.x, p.y + 14.1, p.z, 4.4, 8, 1.0);
      }
    }
    n += 1;
  }

  // ---- 城門（スタートの少し手前。2本の塔とアーチの梁） ----
  const s = track.length - 12;
  const half = track.widthAt(s) / 2 + 3.5;
  const yaw = track.yawAt(s);
  for (const side of [-1, 1]) {
    track.toWorld(s, side * half, 0, p);
    stone.cylinder(p.x, p.y - 3, p.z, 3.6, 21, 0.97);
    stone.box(p.x, p.y + 18.5, p.z, 8.4, 1.4, 8.4, yaw, 1.05);
    for (let c = 0; c < 4; c += 1) {
      const a = yaw + c * Math.PI / 2;
      stone.box(p.x + Math.sin(a) * 3.4, p.y + 19.8, p.z + Math.cos(a) * 3.4, 1.6, 1.2, 1.6, a, 1.08);
    }
    roof.cone(p.x, p.y + 19.2, p.z, 4.8, 10, 1.0);
  }
  track.toWorld(s, 0, 11, p);
  stone.box(p.x, p.y, p.z, half * 2 + 4, 4.0, 4.4, yaw, 1.0);
  track.toWorld(s, 0, 13.6, p);
  for (let c = -3; c <= 3; c += 1) {
    const ox = c * (half * 2 / 7);
    stone.box(p.x + Math.cos(yaw) * ox, p.y, p.z - Math.sin(yaw) * ox, 1.6, 1.2, 4.6, yaw, 1.08);
  }

  // ---- 氷の橋のつらら（橋の両端の下に垂れる） ----
  const icicleEvery = Math.round(5 / track.step);
  for (let i = 0; i < track.count; i += icicleEvery) {
    if (track.area[i] !== 'bridge' || track.zone[i] !== 'ground') continue;
    for (const side of [-1, 1]) {
      track.toWorld(i * track.step, side * (track.width[i] / 2 - 0.8 - random() * 2), -0.3, p);
      ice.pyramidDown(p.x, p.y, p.z, 1.4 + random() * 1.2, 2.5 + random() * 5, 1.4 + random(), track.yaw[i], 1.0);
    }
  }

  // ---- 光る氷の結晶（オーロラの空の両側に浮かぶ） ----
  const crystalEvery = Math.round(36 / track.step);
  let c = 0;
  for (let i = 0; i < track.count; i += crystalEvery) {
    if (track.area[i] !== 'aurora' || track.zone[i] !== 'air') continue;
    const side = c % 2 === 0 ? -1 : 1;
    const out = track.width[i] / 2 + 8 + random() * 10;
    track.toWorld(i * track.step, side * out, -4 + random() * 10, p);
    const size = 3 + random() * 3;
    const tall = size * (2.4 + random());
    const yaw2 = random() * Math.PI;
    ice.pyramid(p.x, p.y, p.z, size, tall, size, yaw2, 1.05);
    ice.pyramidDown(p.x, p.y, p.z, size, tall * 0.6, size, yaw2, 0.9);
    // 小さな結晶を2つ添える
    for (let k = 0; k < 2; k += 1) {
      const sx = p.x + (random() - 0.5) * 8;
      const sz = p.z + (random() - 0.5) * 8;
      const sy = p.y + (random() - 0.5) * 6;
      const s2 = size * 0.4;
      ice.pyramid(sx, sy, sz, s2, s2 * 2.5, s2, random() * 3, 1.0);
      ice.pyramidDown(sx, sy, sz, s2, s2 * 1.5, s2, random() * 3, 0.9);
    }
    c += 1;
  }

  // ---- 素材 ----
  const texRandom = seededRandom(808);
  const group = new THREE.Group();
  if (!stone.isEmpty()) {
    group.add(new THREE.Mesh(stone.build(), new THREE.MeshLambertMaterial({
      map: drawMarbleBlocks(0xb8c6de, texRandom), vertexColors: true
    })));
  }
  if (!roof.isEmpty()) {
    group.add(new THREE.Mesh(roof.build(), new THREE.MeshLambertMaterial({
      map: drawRoof(texRandom), vertexColors: true
    })));
  }
  let iceMat = null;
  if (!ice.isEmpty()) {
    iceMat = new THREE.MeshLambertMaterial({
      map: drawIce(texRandom), vertexColors: true, emissive: 0x1a5a80, transparent: true, opacity: 0.9
    });
    group.add(new THREE.Mesh(ice.build(), iceMat));
  }

  // 本丸の窓あかり（あたたかい色の小さな光の点）
  const windows = buildWindows(66, 4, -32);
  group.add(windows);

  let time = 0;
  return {
    group,
    update(dt) {
      time += dt;
      // 氷の結晶がゆっくり光を強めたり弱めたりする
      if (iceMat) iceMat.emissive.setRGB(0.08, 0.3 + Math.sin(time * 1.2) * 0.06, 0.45 + Math.sin(time * 1.2) * 0.08);
    }
  };
}

// 本丸：浮かぶ岩の島の上に、四角い建物・四すみの塔・真ん中の高い塔
function buildKeep(stone, roof, ice, x, y, z, random) {
  // 岩の島（上は雪で白っぽく、下は細くなる）
  stone.box(x, y - 2, z, 70, 4, 64, 0.1, 1.1);
  for (let k = 1; k <= 4; k += 1) {
    const w = 70 * (1 - k * 0.2);
    stone.box(x, y - 4 - k * 6 + 3, z, w, 6, w * 0.9, 0.1 + k * 0.12, 0.8 - k * 0.05);
    // 島の下のつらら
    ice.pyramidDown(x + (random() - 0.5) * w * 0.8, y - 4 - k * 6, z + (random() - 0.5) * w * 0.7, 3, 6 + random() * 6, 3, 0, 1.0);
  }
  // 建物の本体
  stone.box(x, y + 9, z, 34, 18, 28, 0.1, 1.0);
  for (let c = -4; c <= 4; c += 1) {
    stone.box(x + c * 3.8, y + 18.6, z + 14.2, 1.8, 1.2, 1.2, 0.1, 1.08);
  }
  // 四すみの塔
  for (const [dx, dz] of [[-17, -14], [17, -14], [-17, 14], [17, 14]]) {
    stone.cylinder(x + dx, y, z + dz, 4.2, 26, 0.95);
    stone.box(x + dx, y + 26.5, z + dz, 9.6, 1.2, 9.6, 0.1, 1.05);
    roof.cone(x + dx, y + 27.1, z + dz, 5.4, 12, 1.0);
  }
  // 真ん中の高い塔
  stone.cylinder(x, y + 18, z, 6, 26, 1.0);
  stone.box(x, y + 44.6, z, 13.6, 1.4, 13.6, 0.1, 1.05);
  roof.cone(x, y + 45.3, z, 7.6, 20, 1.0);
  // てっぺんの氷の結晶
  ice.pyramid(x, y + 65, z, 2.4, 6, 2.4, 0.3, 1.1);
  ice.pyramidDown(x, y + 65, z, 2.4, 3, 2.4, 0.3, 1.0);
}

// 窓あかり：本丸の壁と塔に、光る小さな四角を並べる（1回で描く）
function buildWindows(x, y, z) {
  const positions = [];
  const add = (px, py, pz) => positions.push(px, py, pz);
  for (let row = 0; row < 2; row += 1) {
    for (let c = -3; c <= 3; c += 1) add(x + c * 4.4, y + 6 + row * 6, z + 14.3);
  }
  for (const [dx, dz] of [[-17, -14], [17, -14], [-17, 14], [17, 14]]) {
    for (let k = 0; k < 3; k += 1) add(x + dx, y + 8 + k * 6, z + dz + 4.3);
  }
  for (let k = 0; k < 3; k += 1) add(x, y + 24 + k * 6, z + 6.1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffd27a, size: 1.6, fog: true });
  return new THREE.Points(geo, mat);
}

export const ICE_COURSE = {
  id: 'ice',
  ready: true,
  name: '氷の空中城',
  sub: 'すべる氷の橋と、オーロラの夜空を飛ぶ',
  stars: 4,
  color: '#a8e4ff',
  data: ICE,
  theme: THEME,
  decor: ICE_DECOR,
  music: 'ice',
  titleStart: 200,   // タイトルの背景：氷の橋からオーロラへ
  keepOut: [{ x: 66, z: -32, r: 60 }],
  scenery: (track) => buildScenery(track)
};
