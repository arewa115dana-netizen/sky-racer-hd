/*
  ファイル名 : desert.js
  保存場所   : /js/courses
  役割       : 夕焼けの砂漠遺跡コース。テーマ（夕焼けの色）・草木（ヤシ・サボテンなど）・
               建物（大ピラミッド・小さなピラミッド・オベリスク・峡谷の崖・太陽の門・オアシスの泉）
  バージョン : 1.14.0（Phase14 Step14-2）
  メモ       : コースの形とリングは desertData.js。建物は Buildings.js の ShapeBuilder で作り、
               模様ごとに1回で描く（砂岩の切り石・地層の崖・金の飾り・泉の水 の4回）
*/

import * as THREE from 'three';
import { DESERT } from './desertData.js';
import {
  emptyGrid, outline, paintCanopy, drawGrass, drawBush, TRUNK
} from '../world/Decor.js';
import { ShapeBuilder, makeTexture, drawMarbleBlocks, seededRandom } from '../world/Buildings.js';

// ---- 夕焼けのテーマ（config.js の値を上書きする） ----
const THEME = {
  environment: {
    skyTopColor: 0x4a3f8f,       // 真上は紫がかった青
    horizonColor: 0xf7b585,      // 地平線は桃色がかったオレンジ
    fogNear: 95,
    fogFar: 420,
    sunDirection: { x: -0.5, y: 0.2, z: -0.84 },  // 低い夕日（大ピラミッドの向こう側）
    sunSize: 190,
    sunGlow: 'rgba(255,214,150,1)',
    cloudColor: 0xffc8a8,        // 夕日に染まった雲海
    farIslandColor: 'rgba(196, 128, 120, 0.55)',
    grassColor: 0xe3bd80,        // 浮遊島の上は砂
    rockColor: 0xa8603e,         // 赤い砂岩
    templeColor: 0xe6c891        // 切り石の色（ピラミッド・オベリスク）
  },
  lights: {
    hemiSky: 0xffd9b8,
    hemiGround: 0x7a5a8c,
    hemiIntensity: 1.15,
    sunColor: 0xffb478,
    sunIntensity: 1.9,
    sunPosition: { x: -30, y: 22, z: -50 }
  },
  course: {
    roadColors: {
      oasis: 0xc99a62,
      dunes: 0xc8925a,            // 砂丘の道は、空より濃いキャラメル色にしてメリハリを出す
      canyon: 0xa9673f,
      avenue: 0xdcc08e,
      default: 0xc8925a
    },
    rockColor: 0xa65c3c,
    rockColors: { dunes: 0xd8a466, oasis: 0xc89058 },   // 砂丘の道の下は砂色（砂丘の尾根に見せる）
    rockDepth: { oasis: 12, dunes: 7, canyon: 22, avenue: 10, default: 10 },
    curbLight: 0xf6e4bc,
    curbDark: 0x2f6cb0,          // 金と青のしま（エジプト風）
    railColor: 0xe8cd98,
    lanternColor: 0xffb04a
  },
  decor: {
    vergeColor: 0xe0b97a,        // 路肩は砂
    dirtColor: 0xb0704a
  },
  postfx: {
    contrast: 1.1,
    saturation: 1.16,
    warmTint: [1.1, 0.99, 0.86],
    shadowTint: [0.03, 0.0, 0.045],
    bloomThreshold: 0.9,
    bloomStrength: 0.4
  },
  atmosphere: {
    rayColor: 0xffc890,
    rayIntensity: 0.22,
    moteColor: 0xffd8a0,         // 舞う砂ぼこり
    vignetteColor: 'rgba(60, 20, 50, 0.35)'
  }
};

// ---- 砂漠の草木 ----
const PALM_LEAF = [0x1f3a1c, 0x3a6a2a, 0x5a9a3a, 0x86c25a, 0xbfe88a];
const CACTUS = [0x173a26, 0x2a6a3a, 0x3f8f4a, 0x66b55e, 0x9ad884];
const DRY = [0x3a2e14, 0x6a5a22, 0x8f8236, 0xb4a44c, 0xd8c878];
const SAGE = [0x1e2e1a, 0x3c5230, 0x5a7444, 0x7c945a, 0xa8bc7e];   // 乾いた土地の灰緑の茂み
const SANDROCK = [0x4a2418, 0x8a4a2c, 0xb4683e, 0xd48e5a, 0xf0b882];

const DESERT_DECOR = {
  kinds: {
    palm:        { w: 32, h: 48, height: 8.5, draw: (r) => drawPalm(32, 48, r) },
    cactus:      { w: 24, h: 40, height: 5.0, draw: (r) => drawCactus(24, 40, r) },
    cactusSmall: { w: 12, h: 12, height: 0.9, small: true, draw: (r) => drawBarrel(12, 12, r) },
    dryBush:     { w: 24, h: 16, height: 1.4, small: true, draw: (r) => drawBush(24, 16, SAGE, r) },
    dryGrass:    { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, null, DRY) },
    oasisGrass:  { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, [0xff8ab0, 0xffd0e0]) },
    stone:       { w: 16, h: 12, height: 1.1, small: true, draw: (r) => drawStone(16, 12, r) }
  },
  pickSmall(area, random) {
    const r = random();
    if (area === 'oasis') return r < 0.5 ? 'oasisGrass' : (r < 0.8 ? 'dryGrass' : 'dryBush');
    if (area === 'canyon') return r < 0.45 ? 'stone' : (r < 0.7 ? 'dryGrass' : (r < 0.85 ? 'cactusSmall' : 'dryBush'));
    return r < 0.35 ? 'dryGrass' : (r < 0.6 ? 'dryBush' : (r < 0.8 ? 'cactusSmall' : 'stone'));
  },
  pickTree(area, random) {
    const r = random();
    if (area === 'oasis' || area === 'avenue') return r < 0.75 ? 'palm' : 'cactus';
    return r < 0.75 ? 'cactus' : 'palm';
  },
  islandTree(random) {
    return random() < 0.55 ? 'cactus' : 'palm';
  },
  islandSmall(random) {
    const r = random();
    return r < 0.35 ? 'dryGrass' : (r < 0.6 ? 'stone' : (r < 0.8 ? 'dryBush' : 'cactusSmall'));
  }
};

// ヤシの木：少し曲がった、ふしのある幹と、上に広がる葉
function drawPalm(w, h, random) {
  const g = emptyGrid(w, h);
  // 幹（下から上へ、少しずつ右に曲がる）
  for (let y = h - 1; y >= 16; y -= 1) {
    const t = (h - 1 - y) / (h - 17);
    const cx = Math.round(w / 2 - 2 + Math.sin(t * 1.6) * 4);
    const ring = y % 4 === 0;
    for (let k = -1; k <= 1; k += 1) {
      g[y][cx + k] = ring ? TRUNK[1] : (k < 0 ? TRUNK[3] : (k > 0 ? TRUNK[1] : TRUNK[2]));
    }
    g[y][cx - 2] = TRUNK[0];
    g[y][cx + 2] = TRUNK[0];
  }
  // 葉：てっぺんから放射状に垂れる7本
  const topX = Math.round(w / 2 - 2 + Math.sin(1.6) * 4);
  const topY = 15;
  const leaves = emptyGrid(w, h);
  const fronds = [-2.8, -2.2, -1.5, -0.6, 0.4, 1.2, 2.0];
  for (const a of fronds) {
    const len = 10 + random() * 4;
    for (let k = 0; k < len; k += 1) {
      const t = k / len;
      const x = Math.round(topX + Math.sin(a) * k);
      const y = Math.round(topY - Math.cos(a) * k * 0.55 + t * t * 7);   // 先ほど垂れる
      for (let d = -1; d <= 1; d += 1) {
        const yy = y + d;
        if (x < 0 || x >= w || yy < 0 || yy >= h) continue;
        if (Math.abs(d) === 1 && t > 0.8) continue;
        leaves[yy][x] = d < 0 ? PALM_LEAF[4] : (d > 0 ? PALM_LEAF[2] : PALM_LEAF[3]);
      }
    }
  }
  outline(leaves, PALM_LEAF[0]);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (leaves[y][x] !== null) g[y][x] = leaves[y][x];
    }
  }
  // 実（ヤシの実）
  g[topY + 1][topX - 1] = 0x6a4020;
  g[topY + 1][topX + 1] = 0x6a4020;
  return g;
}

// 背の高いサボテン（柱に腕が2本）
function drawCactus(w, h, random) {
  const g = emptyGrid(w, h);
  const fill = (x0, x1, y0, y1) => {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const rel = (x - x0) / Math.max(1, x1 - x0);
        g[y][x] = rel < 0.25 ? CACTUS[4] : (rel < 0.5 ? CACTUS[3] : (rel < 0.8 ? CACTUS[2] : CACTUS[1]));
      }
    }
  };
  const cx = Math.floor(w / 2);
  fill(cx - 3, cx + 2, 4, h - 1);          // 本体
  for (let y = 2; y < 4; y += 1) for (let x = cx - 2; x <= cx + 1; x += 1) g[y][x] = CACTUS[3];   // 丸い頭
  // 左の腕（低い）
  fill(cx - 8, cx - 4, 22, 25);
  fill(cx - 8, cx - 6, 12, 22);
  // 右の腕（高い）
  fill(cx + 3, cx + 7, 16, 19);
  fill(cx + 5, cx + 7, 8, 16);
  outline(g, CACTUS[0]);
  // とげ（点々）
  for (let k = 0; k < 18; k += 1) {
    const x = cx - 8 + Math.floor(random() * 16);
    const y = 4 + Math.floor(random() * (h - 6));
    if (g[y][x] !== null && g[y][x] !== CACTUS[0]) g[y][x] = 0xf0f0c0;
  }
  // 花（てっぺん）
  g[2][cx - 1] = 0xff7aa0;
  g[2][cx] = 0xffb0c8;
  return g;
}

// 丸い小さなサボテン（花つき）
function drawBarrel(w, h, random) {
  const g = emptyGrid(w, h);
  paintCanopy(g, [[6, 7, 4.6]], CACTUS, random);
  g[2][5] = 0xff6a9a;
  g[2][6] = 0xffb0c8;
  g[1][6] = 0xff6a9a;
  return g;
}

// 砂岩の石
function drawStone(w, h, random) {
  const g = emptyGrid(w, h);
  paintCanopy(g, [[6, 8, 4.5], [10, 9, 3.8]], SANDROCK, random);
  return g;
}

// ============================================================
// 建物
// ============================================================

// 地層の崖の模様（横じまの赤い砂岩。ひびと影）
function drawStrata(random) {
  const N = 32;
  const bands = [0xc77a4c, 0xb0623c, 0xd89060, 0xa45434, 0xe0a070, 0xbf6e44];
  const grid = [];
  let band = 0;
  let next = 3 + Math.floor(random() * 4);
  for (let y = 0; y < N; y += 1) {
    if (y >= next) {
      band = (band + 1) % bands.length;
      next = y + 3 + Math.floor(random() * 5);
    }
    const row = [];
    for (let x = 0; x < N; x += 1) {
      let c = bands[band];
      const v = random();
      if (v < 0.12) c = scale(c, 0.86);
      else if (v > 0.93) c = scale(c, 1.1);
      row.push(c);
    }
    grid.push(row);
  }
  // 縦のひび
  for (let k = 0; k < 5; k += 1) {
    let x = Math.floor(random() * N);
    const y0 = Math.floor(random() * N);
    for (let y = y0; y < y0 + 6 + random() * 8; y += 1) {
      grid[y % N][x] = scale(grid[y % N][x], 0.6);
      if (random() < 0.3) x = (x + (random() < 0.5 ? 1 : N - 1)) % N;
    }
  }
  return makeTexture(grid);
}

function scale(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// 金の飾り（細かい点で光らせる）
function drawGold(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const v = random();
      row.push(v < 0.2 ? 0xc89020 : (v > 0.85 ? 0xfff0a0 : 0xf0c040));
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

/**
 * 砂漠の建物をすべて作る
 * @returns {{ group: THREE.Group, update(dt) }}
 */
function buildScenery(track) {
  const random = seededRandom(1717);
  const stone = new ShapeBuilder(3.2);     // 砂岩の切り石（ピラミッド・オベリスク・門）
  const cliff = new ShapeBuilder(6.0);     // 地層の崖
  const gold = new ShapeBuilder(1.0);      // 金の飾り
  const p = { x: 0, y: 0, z: 0 };

  // ---- 大ピラミッド（空中ルートの内側。浮かぶ岩の台の上に立つ） ----
  buildPyramidIsland(stone, cliff, gold, 178, -30, -52, 130, 88, random);
  // 小さなピラミッド（コースの内側と外側に）
  buildPyramidIsland(stone, cliff, gold, 110, -10, 60, 56, 40, random);
  buildPyramidIsland(stone, cliff, gold, 40, -16, 140, 44, 32, random);
  buildPyramidIsland(stone, cliff, gold, -170, -20, 60, 60, 44, random);
  buildPyramidIsland(stone, cliff, gold, 120, -24, 300, 70, 50, random);

  // ---- オベリスク（オアシスと参道の両側） ----
  const every = Math.round(18 / track.step);
  const gateS = track.length - 12;
  for (let i = 0; i < track.count; i += every) {
    const area = track.area[i];
    if ((area !== 'avenue' && area !== 'oasis') || track.zone[i] !== 'ground') continue;
    const toGate = Math.abs(i * track.step - gateS);
    if (Math.min(toGate, track.length - toGate) < 12) continue;
    const yaw = track.yaw[i];
    for (const side of [-1, 1]) {
      track.toWorld(i * track.step, side * (track.width[i] / 2 + 3), 0, p);
      stone.box(p.x, p.y + 0.4, p.z, 2.8, 0.8, 2.8, yaw, 0.9);
      // 上へ行くほど細くなる柱（3段の箱で表す）
      stone.box(p.x, p.y + 3.4, p.z, 1.7, 5.2, 1.7, yaw, 1.0);
      stone.box(p.x, p.y + 7.6, p.z, 1.45, 3.2, 1.45, yaw, 1.04);
      stone.box(p.x, p.y + 10.3, p.z, 1.2, 2.2, 1.2, yaw, 1.08);
      // 金の先端
      gold.pyramid(p.x, p.y + 11.4, p.z, 1.3, 1.6, 1.3, yaw, 1.1);
    }
  }

  // ---- 峡谷の崖（道の両側にそびえる地層の壁） ----
  const cliffEvery = Math.round(6 / track.step);
  for (let i = 0; i < track.count; i += cliffEvery) {
    if (track.area[i] !== 'canyon' || track.zone[i] !== 'ground') continue;
    const yaw = track.yaw[i];
    for (const side of [-1, 1]) {
      // カーブの内側は低めにして、カメラの前をふさがない
      const k = track.curv[i];
      const inside = (k > 0 && side < 0) || (k < 0 && side > 0);
      const height = (inside && Math.abs(k) > 0.015 ? 5 : 11) + random() * 7;
      const out = 10 + random() * 6;     // 厚い岩山（外側へ広がる）
      track.toWorld(i * track.step, side * (track.width[i] / 2 + 1.0 + out / 2), 0, p);
      cliff.box(p.x, p.y + height / 2 - 11, p.z, out, height + 22, 7.5, yaw + (random() - 0.5) * 0.2, 0.95 + random() * 0.1);
      // 岩山の下側（細くなりながら下へ。浮かぶ台地に見せる）
      track.toWorld(i * track.step, side * (track.width[i] / 2 + 1.0 + out * 0.45), 0, p);
      cliff.box(p.x, p.y - 26, p.z, out * 0.6, 12, 6.5, yaw, 0.75);
    }
  }

  // ---- 太陽の門（ゴールの手前）：台形の塔2本と梁、金の太陽 ----
  const s = track.length - 12;
  const half = track.widthAt(s) / 2 + 3.5;
  const yaw = track.yawAt(s);
  for (const side of [-1, 1]) {
    track.toWorld(s, side * half, 0, p);
    stone.box(p.x, p.y + 0.6, p.z, 6.0, 1.2, 5.0, yaw, 0.92);
    stone.box(p.x, p.y + 5.2, p.z, 5.0, 8.0, 4.2, yaw, 1.0);
    stone.box(p.x, p.y + 11.2, p.z, 4.2, 4.0, 3.6, yaw, 1.05);
    gold.box(p.x, p.y + 13.4, p.z, 4.6, 0.5, 4.0, yaw, 1.0);
  }
  track.toWorld(s, 0, 14.6, p);
  stone.box(p.x, p.y, p.z, half * 2 + 6, 2.4, 4.0, yaw, 1.02);
  // 金の太陽（四角を2つ重ねて八角形に見せる）
  track.toWorld(s, 0, 18.2, p);
  gold.box(p.x, p.y, p.z, 4.2, 4.2, 0.8, yaw, 1.1);
  gold.box(p.x, p.y, p.z, 4.2, 4.2, 0.8, yaw, 1.1, Math.PI / 4);
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    const r = 3.6;
    const rx = Math.cos(a) * r;
    const ry = Math.sin(a) * r;
    // 光線の位置（門の向きに合わせて横にずらす）
    gold.box(p.x + Math.cos(yaw) * rx, p.y + ry, p.z - Math.sin(yaw) * rx, 0.8, 1.6, 0.5, yaw, 1.1);
  }

  // ---- 素材 ----
  const texRandom = seededRandom(404);
  const group = new THREE.Group();
  const lambert = (map) => new THREE.MeshLambertMaterial({ map, vertexColors: true });
  if (!stone.isEmpty()) group.add(new THREE.Mesh(stone.build(), lambert(drawMarbleBlocks(0xe6c891, texRandom))));
  if (!cliff.isEmpty()) group.add(new THREE.Mesh(cliff.build(), lambert(drawStrata(texRandom))));
  if (!gold.isEmpty()) {
    group.add(new THREE.Mesh(gold.build(), new THREE.MeshLambertMaterial({
      map: drawGold(texRandom), vertexColors: true, emissive: 0x6a4000
    })));
  }

  // ---- オアシスの泉（スタートの横の砂の島。水面がゆっくりきらめく） ----
  const water = buildOasis(track, cliff, OASIS);
  group.add(water.mesh);

  return {
    group,
    // オアシスの島（草木を置く場所として Environment に渡す）
    islands: [{ x: OASIS.x, y: OASIS.y, z: OASIS.z, size: 22 }],
    update(dt) {
      water.update(dt);
    }
  };
}

// 浮かぶ岩の台にのったピラミッド（台の上面の中心 x, y, z・底の幅・高さ）
function buildPyramidIsland(stone, cliff, gold, x, y, z, base, height, random) {
  const yaw = random() * 0.6;
  // 台：上は平ら、下に向かって細くなる岩（逆さのピラミッドを箱で段々に）
  const pad = base * 1.25;
  cliff.box(x, y - 2, z, pad, 4, pad, yaw, 1.0);
  for (let k = 1; k <= 4; k += 1) {
    const w = pad * (1 - k * 0.2);
    cliff.box(x, y - 4 - k * 6 + 3, z, w, 6, w, yaw + k * 0.1, 0.85 - k * 0.04);
  }
  // ピラミッド本体（段を少し付けて、ドット絵らしく）
  stone.pyramid(x, y, z, base, height * 0.94, base, yaw, 1.0);
  stone.box(x, y + 0.6, z, base * 1.04, 1.2, base * 1.04, yaw, 0.9);
  // 金の頂上
  const capH = height * 0.12;
  gold.pyramid(x, y + height * 0.94 - capH * 0.5, z, base * 0.12, capH * 1.5, base * 0.12, yaw, 1.1);
}

// オアシスの島の場所（スタートの直線の左側）
const OASIS = { x: -124, y: -1.5, z: 32 };

// オアシスの泉：砂の島の上に、水色の丸い池
function buildOasis(track, cliff, o) {
  // 砂の島（上は平ら、下は細くなる岩）
  cliff.box(o.x, o.y - 1.5, o.z, 40, 3, 40, 0.2, 1.0);
  for (let k = 1; k <= 3; k += 1) {
    const w = 40 * (1 - k * 0.24);
    cliff.box(o.x, o.y - 3 - k * 5 + 2.5, o.z, w, 5, w, 0.2 + k * 0.15, 0.85 - k * 0.05);
  }
  const p = { x: o.x + 4, y: o.y + 0.05, z: o.z - 2 };
  const geo = new THREE.CircleGeometry(11, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x3fb6d8, emissive: 0x0a3a50, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(p.x, p.y, p.z);
  let time = 0;
  return {
    mesh,
    update(dt) {
      time += dt;
      // 水面の明るさをゆっくり揺らす（きらめき）
      mat.emissive.setRGB(0.04, 0.22 + Math.sin(time * 1.3) * 0.04, 0.3 + Math.sin(time * 1.7) * 0.05);
    }
  };
}

export const DESERT_COURSE = {
  id: 'desert',
  ready: true,
  name: '夕焼けの砂漠遺跡',
  sub: 'ピラミッドを回り、赤い峡谷を抜ける夕暮れのコース',
  stars: 2,
  color: '#ffb35c',
  data: DESERT,
  theme: THEME,
  decor: DESERT_DECOR,
  music: 'race',
  titleStart: 380,   // タイトルの背景で、カメラが飛び始める位置（砂丘の終わり → 大ピラミッド）
  // 背景の浮遊島を置かない場所（ピラミッドの台・オアシスのまわり）
  keepOut: [
    { x: 178, z: -52, r: 100 }, { x: 110, z: 60, r: 45 }, { x: 40, z: 140, r: 38 },
    { x: -170, z: 60, r: 48 }, { x: 120, z: 300, r: 55 }, { x: -124, z: 32, r: 30 }
  ],
  scenery: (track) => buildScenery(track)
};
