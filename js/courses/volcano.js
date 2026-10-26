/*
  ファイル名 : volcano.js
  保存場所   : /js/courses
  役割       : 溶岩の火山島コース。テーマ（赤く焼けた空と火の粉）・草木（焼けた木・灰の草・燃える花など）・
               景色（火山の山・火口の溶岩の湖・山肌を流れる溶岩・噴煙・溶岩の川・玄武岩の柱・ゴールの門）
  バージョン : 1.15.0（Phase15 Step15-3）
  メモ       : コースの形・でこぼこ・リングは volcanoData.js。
               溶岩は光って見えるよう、光の計算をしない素材（MeshBasicMaterial）で描き、模様を流して動かす
*/

import * as THREE from 'three';
import { VOLCANO, VOLCANO_CENTER } from './volcanoData.js';
import { emptyGrid, outline, paintCanopy, drawGrass, TRUNK } from '../world/Decor.js';
import { ShapeBuilder, makeTexture, seededRandom } from '../world/Buildings.js';

// ---- 火山のテーマ ----
const THEME = {
  environment: {
    skyTopColor: 0x2a0c18,
    horizonColor: 0xb8603e,      // 煙にかすむ赤い地平線
    fogNear: 100,
    fogFar: 430,
    sunDirection: { x: -0.4, y: 0.25, z: 0.88 },   // 煙の向こうの赤い太陽
    sunSize: 150,
    sunGlow: 'rgba(255,170,110,1)',
    cloudColor: 0x7a3828,        // 下は灰の雲
    farIslandColor: 'rgba(90, 36, 30, 0.6)',
    grassColor: 0x4a4440,        // 浮遊島の上は灰
    rockColor: 0x2c2628          // 玄武岩
  },
  lights: {
    hemiSky: 0xffb08a,
    hemiGround: 0x8a3a20,        // 溶岩の照り返し
    hemiIntensity: 1.6,
    sunColor: 0xffa070,
    sunIntensity: 2.0,
    sunPosition: { x: -24, y: 18, z: 52 }
  },
  course: {
    roadColors: {
      basalt: 0x7a7074,          // 明るめの灰色にして、赤い景色の中で道が分かるように
      slope: 0x86766e,
      crater: 0x7c6a64,
      lavaflow: 0x766c70,
      default: 0x7a7074
    },
    rockColor: 0x3a3234,
    rockDepth: { basalt: 12, slope: 14, crater: 26, lavaflow: 12, default: 12 },
    curbLight: 0xffa030,         // 光るオレンジと黒のしま
    curbDark: 0x2a2224,
    railColor: 0x3a3234,
    lanternColor: 0xff7a30
  },
  decor: {
    vergeColor: 0x5a5452,        // 灰をかぶった地面
    dirtColor: 0x2a2224
  },
  postfx: {
    contrast: 1.12,
    saturation: 1.08,
    warmTint: [1.08, 0.97, 0.9],
    shadowTint: [0.04, 0.0, 0.02],
    bloomThreshold: 0.72,        // 溶岩がよくにじむように
    bloomStrength: 0.6
  },
  atmosphere: {
    rayColor: 0xff9060,
    rayIntensity: 0.18,
    moteColor: 0xff8a3a,         // 舞い上がる火の粉
    moteRise: 1.4,
    moteDrift: 1.0,
    moteSize: 0.32,
    vignetteColor: 'rgba(40, 6, 6, 0.45)'
  }
};

// ---- 火山の草木 ----
const ASH = [0x1e1c1c, 0x3a3634, 0x5a5450, 0x7c746c, 0xa49a90];
const OBSIDIAN = [0x0c0814, 0x2a1a3a, 0x4a2c6a, 0x7a50a8, 0xc8a8ff];

const VOLCANO_DECOR = {
  kinds: {
    deadTree:    { w: 24, h: 40, height: 6.0, draw: (r) => drawDeadTree(24, 40, r) },
    obsidian:    { w: 16, h: 24, height: 3.2, draw: (r) => drawObsidian(16, 24, r) },
    ashGrass:    { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, null, ASH) },
    fireFlower:  { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, [0xff5a1e, 0xffd04a], ASH) },
    emberRock:   { w: 16, h: 12, height: 1.1, small: true, draw: (r) => drawEmberRock(16, 12, r) },
    shard:       { w: 12, h: 12, height: 1.0, small: true, draw: (r) => drawObsidian(12, 12, r) }
  },
  pickSmall(area, random) {
    const r = random();
    return r < 0.35 ? 'emberRock' : (r < 0.6 ? 'ashGrass' : (r < 0.8 ? 'fireFlower' : 'shard'));
  },
  pickTree(area, random) {
    return random() < 0.65 ? 'deadTree' : 'obsidian';
  },
  islandTree(random) {
    return random() < 0.6 ? 'deadTree' : 'obsidian';
  },
  islandSmall: (random) => VOLCANO_DECOR.pickSmall('', random)
};

// 焼けた木（葉のない枝だけの木）
function drawDeadTree(w, h, random) {
  const g = emptyGrid(w, h);
  const cx = Math.floor(w / 2);
  const dark = [0x120c0c, 0x2a1e1c, 0x3e2e2a, 0x5a4440];
  // 幹
  for (let y = 12; y < h; y += 1) {
    const width = y > h - 4 ? 4 : 3;
    for (let k = 0; k < width; k += 1) g[y][cx - 1 + k] = k === 0 ? dark[3] : dark[2];
  }
  // 枝（ななめに伸びて、先が細くなる）
  const branch = (x0, y0, dx, dy, len) => {
    let x = x0;
    let y = y0;
    for (let k = 0; k < len; k += 1) {
      x += dx;
      y += dy;
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || xi >= w || yi < 0 || yi >= h) break;
      g[yi][xi] = dark[2];
      if (k < len / 2 && xi + 1 < w) g[yi][xi + 1] = dark[1];
    }
  };
  branch(cx, 22, -0.8, -1, 9);
  branch(cx + 1, 18, 0.9, -1, 9);
  branch(cx, 13, -0.4, -1, 10);
  branch(cx + 1, 14, 0.5, -1.1, 8);
  branch(cx - 4, 16, -0.9, -0.6, 4);
  outline(g, dark[0]);
  // 枝の先に、まだくすぶる火
  for (let k = 0; k < 3; k += 1) {
    const x = 4 + Math.floor(random() * (w - 8));
    const y = 2 + Math.floor(random() * 10);
    if (g[y][x] !== null) g[y][x] = 0xff7a2a;
  }
  return g;
}

// 黒曜石（とがった紫の黒い結晶）
function drawObsidian(w, h, random) {
  const g = emptyGrid(w, h);
  const spike = (cx, top, half) => {
    for (let y = top; y < h; y += 1) {
      const t = (y - top) / (h - top);
      const hw = Math.max(0, Math.round(t * half));
      for (let x = cx - hw; x <= cx + hw; x += 1) {
        if (x < 0 || x >= w) continue;
        g[y][x] = x < cx ? OBSIDIAN[3] : (x === cx ? OBSIDIAN[4] : OBSIDIAN[2]);
      }
    }
  };
  spike(Math.floor(w * 0.4), 1, w * 0.22);
  spike(Math.floor(w * 0.7), Math.floor(h * 0.35), w * 0.18);
  outline(g, OBSIDIAN[0]);
  return g;
}

// 割れ目が光る溶岩の石
function drawEmberRock(w, h, random) {
  const g = emptyGrid(w, h);
  paintCanopy(g, [[6, 8, 4.6], [10, 8.5, 4]], [0x0e0a0a, 0x241c1c, 0x3a302e, 0x524440, 0x6a5a54], random);
  for (let k = 0; k < 6; k += 1) {
    const x = 3 + Math.floor(random() * 10);
    const y = 5 + Math.floor(random() * 6);
    if (g[y][x] !== null && g[y][x] !== 0x0e0a0a) g[y][x] = random() < 0.5 ? 0xff6a1a : 0xffc040;
  }
  return g;
}

// ============================================================
// 模様
// ============================================================

// 玄武岩（黒っぽい岩。ところどころ赤く焼けている）
function drawBasalt(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const v = random();
      row.push(v < 0.2 ? 0x3a3234 : (v < 0.85 ? 0x544a4c : (v < 0.97 ? 0x6a5e60 : 0x8a3a20)));
    }
    grid.push(row);
  }
  // 割れ目
  for (let k = 0; k < 6; k += 1) {
    let x = Math.floor(random() * 32);
    let y = Math.floor(random() * 32);
    for (let n = 0; n < 10; n += 1) {
      grid[y % 32][x % 32] = 0x241c1e;
      x += random() < 0.5 ? 1 : 0;
      y += 1;
    }
  }
  return makeTexture(grid);
}

// 溶岩（明るいオレンジの流れに、黒い固まりが浮かぶ）。くり返して貼り、模様を流して動かす
function makeLavaTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff6a14';
  ctx.fillRect(0, 0, size, size);
  const random = seededRandom(616);
  const blob = (color, count, rMin, rMax) => {
    ctx.fillStyle = color;
    for (let k = 0; k < count; k += 1) {
      const x = random() * size;
      const y = random() * size;
      const r = rMin + random() * (rMax - rMin);
      // 端でつながるよう、上下左右にずらした所にも描く
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, r * 1.6, r, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };
  blob('#ffb02a', 26, 2, 6);
  blob('#fff07a', 14, 1, 3);
  blob('#5a1a0c', 16, 2, 5);
  blob('#2a0c08', 10, 1, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// やわらかい丸（煙・光）
function makeSoftTexture(inner, outer) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ============================================================
// 景色
// ============================================================

// 火山の形（中心からの距離, 高さ）。上は火口の中（溶岩の湖のふち）、下は浮かぶ島のとがった底
const PROFILE = [
  [0, 20.4], [64, 20.4], [70, 19.5], [92, 18], [125, -2], [160, -26], [210, -70],
  [190, -92], [140, -118], [70, -150], [0, -164]
];

function buildScenery(track) {
  const random = seededRandom(9090);
  const C = VOLCANO_CENTER;
  const group = new THREE.Group();
  const lavaMaps = [];

  // ---- 火山の山（回転体） ----
  // LatheGeometry は (半径, 高さ) の点を、y軸のまわりに回して形を作る。外側の面が表になるよう、上から順に並べる
  const pts = PROFILE.slice(1).map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const mountainGeo = new THREE.LatheGeometry(pts, 40);
  const basalt = drawBasalt(random);
  basalt.repeat.set(16, 6);
  const mountain = new THREE.Mesh(mountainGeo, new THREE.MeshLambertMaterial({ map: basalt }));
  mountain.position.set(C.x, 0, C.z);
  group.add(mountain);

  // ---- 火口の溶岩の湖 ----
  const lavaTex = makeLavaTexture();
  lavaTex.repeat.set(5, 5);
  lavaMaps.push({ map: lavaTex, speed: [0.004, 0.006] });
  const lakeGeo = new THREE.CircleGeometry(66, 32);
  lakeGeo.rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(lakeGeo, new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xffffff }));
  lake.position.set(C.x, 20.6, C.z);
  group.add(lake);

  // ---- 山肌を流れ落ちる溶岩（火口から外へ、何本か） ----
  const flowTex = makeLavaTexture();
  flowTex.repeat.set(1, 6);
  lavaMaps.push({ map: flowTex, speed: [0, 0.05] });
  const flowMat = new THREE.MeshBasicMaterial({ map: flowTex });
  for (const angle of [0.6, 2.3, 3.4, 5.2]) {
    group.add(buildLavaStream(C, angle, flowMat, random));
  }

  // ---- 溶岩の川（溶岩の川の区間の、道の右側の下を流れる） ----
  const riverTex = makeLavaTexture();
  riverTex.repeat.set(1, 40);
  lavaMaps.push({ map: riverTex, speed: [0, 0.03] });
  group.add(buildLavaRiver(track, new THREE.MeshBasicMaterial({ map: riverTex })));

  // ---- 玄武岩の柱・黒曜石・ゴールの門 ----
  const rock = new ShapeBuilder(3.0);
  const p = { x: 0, y: 0, z: 0 };
  const every = Math.round(10 / track.step);
  for (let i = 0; i < track.count; i += every) {
    const area = track.area[i];
    if ((area !== 'basalt' && area !== 'lavaflow') || track.zone[i] !== 'ground') continue;
    for (const side of [-1, 1]) {
      if (random() < 0.35) continue;
      // 六角形の柱を何本か束ねる（高さがばらばら）
      const base = track.width[i] / 2 + 7 + random() * 3;
      // 背の違う太い六角柱を、すき間なく寄せる（真ん中ほど高い）
      for (let k = 0; k < 4 + Math.floor(random() * 3); k += 1) {
        track.toWorld(i * track.step + (random() - 0.5) * 5, side * (base + random() * 3), 0, p);
        const h = 1 + random() * (k < 2 ? 5 : 2.5);
        rock.cylinder(p.x, p.y - 6, p.z, 1.5 + random() * 0.5, h + 6, 1.0 + random() * 0.15, 6, true);
      }
    }
  }
  // ゴールの門：玄武岩の柱2本と梁
  const s = track.length - 12;
  const half = track.widthAt(s) / 2 + 3;
  const yaw = track.yawAt(s);
  for (const side of [-1, 1]) {
    track.toWorld(s, side * half, 0, p);
    rock.cylinder(p.x, p.y - 3, p.z, 2.6, 18, 1.0, 6, true);
    rock.cylinder(p.x + 1.6, p.y - 3, p.z + 1.2, 1.4, 13, 0.9, 6, true);
  }
  track.toWorld(s, 0, 13, p);
  rock.box(p.x, p.y, p.z, half * 2 + 6, 2.6, 4, yaw, 1.0);
  group.add(new THREE.Mesh(rock.build(), new THREE.MeshLambertMaterial({ map: drawBasalt(random), vertexColors: true })));
  // 門の光るすじ（溶岩の色）
  track.toWorld(s, 0, 13, p);
  const rune = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 6.2, 0.5, 4.2), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  rune.position.set(p.x, p.y - 0.4, p.z);
  rune.rotation.y = yaw;
  group.add(rune);

  // ---- 噴煙と火の粉（火口から立ちのぼる） ----
  const plume = buildPlume(C, random);
  group.add(plume.group);

  // ---- 溶岩の湖の照り返し（火口の上に大きな光） ----
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeSoftTexture('rgba(255,140,60,0.55)', 'rgba(255,90,30,0)'),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  }));
  glow.position.set(C.x, 34, C.z);
  glow.scale.set(170, 90, 1);
  group.add(glow);

  let time = 0;
  return {
    group,
    update(dt) {
      time += dt;
      for (const l of lavaMaps) {
        l.map.offset.x = (time * l.speed[0]) % 1;
        l.map.offset.y = (time * l.speed[1]) % 1;
      }
      glow.material.opacity = 0.85 + Math.sin(time * 1.7) * 0.15;
      plume.update(dt);
    }
  };
}

// 山肌を流れ落ちる溶岩：火口のふちから外へ、山の面に沿った細い帯（少しうねる）
function buildLavaStream(C, angle, material, random) {
  const positions = [];
  const uvs = [];
  const index = [];
  const steps = 24;
  const surface = (r) => {
    for (let k = 1; k < PROFILE.length; k += 1) {
      const [r0, y0] = PROFILE[k - 1];
      const [r1, y1] = PROFILE[k];
      if (r >= r0 && r <= r1) return y0 + (y1 - y0) * (r - r0) / (r1 - r0);
    }
    return -70;
  };
  const wobble = random() * 10;
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    const r = 92 + t * 110;
    const a = angle + Math.sin(t * 4 + wobble) * 0.05;
    const halfW = 2.5 + t * 3;
    const y = surface(r) + 0.6;
    const nx = -Math.sin(a);
    const nz = Math.cos(a);
    const x = C.x + Math.cos(a) * r;
    const z = C.z + Math.sin(a) * r;
    positions.push(x - nx * halfW, y, z - nz * halfW, x + nx * halfW, y, z + nz * halfW);
    uvs.push(0, t * 6, 1, t * 6);
    if (k < steps) {
      const i = k * 2;
      index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, material);
  material.side = THREE.DoubleSide;
  return mesh;
}

// 溶岩の川：溶岩の川の区間の、道の右側（柵の外の下）に沿って流れる帯
function buildLavaRiver(track, material) {
  const positions = [];
  const uvs = [];
  const index = [];
  const p = { x: 0, y: 0, z: 0 };
  let n = 0;
  let v = 0;
  for (let i = 0; i < track.count; i += 2) {
    if (track.area[i] !== 'lavaflow') continue;
    const s = i * track.step;
    const half = track.width[i] / 2;
    track.toWorld(s, half + 3, -2.2, p);
    positions.push(p.x, p.y, p.z);
    track.toWorld(s, half + 13, -2.2, p);
    positions.push(p.x, p.y, p.z);
    uvs.push(0, v, 1, v);
    v += track.step * 2 / 10;
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
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geo, material);
}

// 噴煙（大きな灰色の煙の玉）と火の粉（小さなオレンジの点）。下から湧いて上で消える、をくり返す
function buildPlume(C, random) {
  const group = new THREE.Group();
  const SMOKE = 40;
  const EMBER = 90;
  const smokePos = new Float32Array(SMOKE * 3);
  const emberPos = new Float32Array(EMBER * 3);
  const smoke = [];
  const ember = [];
  for (let k = 0; k < SMOKE; k += 1) smoke.push({ t: random(), a: random() * 6.3, r: random() * 20, speed: 0.05 + random() * 0.04 });
  for (let k = 0; k < EMBER; k += 1) ember.push({ t: random(), a: random() * 6.3, r: random() * 40, speed: 0.12 + random() * 0.1 });

  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokeMat = new THREE.PointsMaterial({
    map: makeSoftTexture('rgba(70,56,56,0.75)', 'rgba(50,40,40,0)'),
    size: 34, transparent: true, depthWrite: false
  });
  const smokePts = new THREE.Points(smokeGeo, smokeMat);
  smokePts.frustumCulled = false;
  group.add(smokePts);

  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({
    map: makeSoftTexture('rgba(255,200,90,1)', 'rgba(255,90,20,0)'),
    size: 1.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const emberPts = new THREE.Points(emberGeo, emberMat);
  emberPts.frustumCulled = false;
  group.add(emberPts);

  const place = () => {
    smoke.forEach((o, k) => {
      const h = o.t * 130;
      const spread = o.r + o.t * 45;
      smokePos[k * 3] = C.x + Math.cos(o.a) * spread;
      smokePos[k * 3 + 1] = 22 + h;
      smokePos[k * 3 + 2] = C.z + Math.sin(o.a) * spread;
    });
    ember.forEach((o, k) => {
      const h = o.t * 80;
      const spread = o.r * (0.3 + o.t);
      emberPos[k * 3] = C.x + Math.cos(o.a + o.t * 2) * spread;
      emberPos[k * 3 + 1] = 22 + h;
      emberPos[k * 3 + 2] = C.z + Math.sin(o.a + o.t * 2) * spread;
    });
    smokeGeo.attributes.position.needsUpdate = true;
    emberGeo.attributes.position.needsUpdate = true;
  };
  place();
  return {
    group,
    update(dt) {
      for (const o of smoke) { o.t += o.speed * dt; if (o.t > 1) o.t -= 1; }
      for (const o of ember) { o.t += o.speed * dt; if (o.t > 1) o.t -= 1; }
      place();
    }
  };
}

export const VOLCANO_COURSE = {
  id: 'volcano',
  ready: true,
  name: '溶岩の火山島',
  sub: '火山を上って火口のふちを回る、最難関のコース',
  stars: 5,
  color: '#ff6a4a',
  data: VOLCANO,
  theme: THEME,
  decor: VOLCANO_DECOR,
  music: 'volcano',
  titleStart: 220,   // タイトルの背景：斜面を上って火口へ
  keepOut: [{ x: VOLCANO_CENTER.x, z: VOLCANO_CENTER.z, r: 225 }],
  scenery: (track) => buildScenery(track)
};
