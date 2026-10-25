/*
  ファイル名 : observatory.js
  保存場所   : /js/courses
  役割       : 星空の天文塔コース。テーマ（紫の星雲が流れる夜空・流れ星）・草木（水晶の木・光る花など）・
               建物（らせんの坂の内側にそびえる天文塔・丸屋根と望遠鏡・塔のまわりを回る光の輪・
               水晶の橋の下の結晶・広場の灯り）
  バージョン : 1.16.0（Phase16 Step16-1）
  メモ       : コースの形とリングは observatoryData.js。らせんの坂は塔のまわりを1周と少し回るので、
               上の道と下の道は高さが30m以上離れている（道の下の岩は浅くして、下の道にぶつからないようにする）
*/

import * as THREE from 'three';
import { OBSERVATORY, TOWER } from './observatoryData.js';
import { emptyGrid, outline, drawGrass, drawPine } from '../world/Decor.js';
import { ShapeBuilder, makeTexture, drawMarbleBlocks, seededRandom } from '../world/Buildings.js';

// ---- 星雲の夜のテーマ ----
const THEME = {
  environment: {
    skyTopColor: 0x0a0620,
    horizonColor: 0x3a2a6a,
    fogNear: 100,
    fogFar: 430,
    sunDirection: { x: -0.3, y: 0.55, z: 0.78 },   // 月
    sunSize: 70,
    sunGlow: 'rgba(232,224,255,1)',
    cloudColor: 0x4a3a7a,
    farIslandColor: 'rgba(90, 70, 150, 0.55)',
    grassColor: 0x3a4a7a,        // 夜の青い草
    rockColor: 0x3a3450,
    templeColor: 0xc8c4dc,
    starCount: 520,
    aurora: { angle: 200, colors: ['#c070ff', '#5ad0ff'] }   // 星雲（紫と水色の光の帯）
  },
  lights: {
    hemiSky: 0xb8a8ff,
    hemiGround: 0x2a1a4a,
    hemiIntensity: 1.35,
    sunColor: 0xd0c8ff,
    sunIntensity: 1.2,
    sunPosition: { x: -20, y: 36, z: 50 }
  },
  course: {
    roadColors: {
      gate: 0x8a86a8,
      spiral: 0x9c94b8,
      crystal: 0xc4a0ff,         // 光る水晶の道
      comet: 0x8c88aa,
      default: 0x8a86a8
    },
    rockColor: 0x3e3856,
    rockColors: { crystal: 0x8a68d8 },
    rockDepth: { gate: 12, spiral: 6, crystal: 5, comet: 12, default: 10 },
    curbLight: 0xe8e0ff,
    curbDark: 0x7a4ad8,
    railColor: 0xd8d0ff,
    lanternColor: 0xa8f0ff
  },
  decor: {
    vergeColor: 0x3c4a78,
    dirtColor: 0x2a2a48
  },
  postfx: {
    saturation: 1.12,
    warmTint: [0.97, 0.96, 1.1],
    shadowTint: [0.02, 0.0, 0.06],
    bloomThreshold: 0.78,
    bloomStrength: 0.55
  },
  atmosphere: {
    rayColor: 0xd0c0ff,
    rayIntensity: 0.1,
    moteColor: 0xc8e0ff,         // ただよう星くず
    moteRise: 0.3,
    vignetteColor: 'rgba(10, 5, 40, 0.45)'
  }
};

// ---- 星空の草木 ----
const NIGHT_PINE = [0x0a1428, 0x162a4a, 0x24406a, 0x3a5c8c, 0xa8c8ff];
const SILVER = [0x1a2040, 0x4a5a8a, 0x7a8ab8, 0xb0c0e8, 0xffffff];
const CRYSTAL = [0x2a104a, 0x6a3ab0, 0xa070e8, 0xd0b0ff, 0xffffff];

const OBS_DECOR = {
  kinds: {
    crystalTree: { w: 24, h: 40, height: 6.5, draw: (r) => drawCrystalCluster(24, 40, r, CRYSTAL) },
    nightPine:   { w: 24, h: 48, height: 7.5, draw: (r) => drawPine(24, 48, r, NIGHT_PINE) },
    glowFlower:  { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, [0x5ae0ff, 0xe0ffff], SILVER) },
    starFlower:  { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, [0xffe070, 0xffffff], SILVER) },
    silverGrass: { w: 16, h: 12, height: 0.8, small: true, draw: (r) => drawGrass(16, 12, r, null, SILVER) },
    crystalSmall:{ w: 12, h: 16, height: 1.4, small: true, draw: (r) => drawCrystalCluster(12, 16, r, CRYSTAL) }
  },
  pickSmall(area, random) {
    const r = random();
    return r < 0.3 ? 'glowFlower' : (r < 0.5 ? 'starFlower' : (r < 0.8 ? 'silverGrass' : 'crystalSmall'));
  },
  pickTree(area, random) {
    return random() < 0.5 ? 'crystalTree' : 'nightPine';
  },
  islandTree(random) {
    return random() < 0.45 ? 'crystalTree' : 'nightPine';
  },
  islandSmall: (random) => OBS_DECOR.pickSmall('', random)
};

// 水晶のかたまり（とがった結晶を何本か束ねる）
function drawCrystalCluster(w, h, random, pal) {
  const g = emptyGrid(w, h);
  const spike = (cx, top, half, lean) => {
    for (let y = top; y < h; y += 1) {
      const t = (y - top) / (h - top);
      const hw = Math.max(0, Math.round(Math.min(1, t * 2.2) * half));
      const c = Math.round(cx + lean * (1 - t) * 3);
      for (let x = c - hw; x <= c + hw; x += 1) {
        if (x < 0 || x >= w) continue;
        g[y][x] = x < c ? pal[3] : (x === c ? pal[4] : pal[2]);
      }
    }
  };
  const n = w > 16 ? 4 : 2;
  for (let k = 0; k < n; k += 1) {
    const cx = Math.floor(w * (0.25 + 0.5 * (k / Math.max(1, n - 1))));
    const top = Math.floor(h * (k % 2 === 0 ? 0.05 : 0.3) + random() * h * 0.1);
    spike(cx, top, w * (n > 2 ? 0.11 : 0.2), (random() - 0.5) * 2);
  }
  outline(g, pal[0]);
  return g;
}

// ============================================================
// 建物
// ============================================================

// 塔の石（青みがかった切り石に、ところどころ光る星のしるし）
function drawTowerStone(random) {
  const base = 0x9a94b8;
  const tex = drawMarbleBlocks(base, random);
  return tex;
}

function buildScenery(track) {
  const random = seededRandom(7777);
  const stone = new ShapeBuilder(3.0);
  const crystal = new ShapeBuilder(2.5);
  const roof = new ShapeBuilder(2.0);
  const p = { x: 0, y: 0, z: 0 };
  const glow = [];

  // ---- 天文塔（らせんの坂の内側） ----
  const T = TOWER;
  const R = 44;
  // 下は浮かぶ島のように細くなる
  stone.cylinder(T.x, -64, T.z, R * 0.55, 20, 0.75, 24);
  stone.cylinder(T.x, -44, T.z, R * 0.8, 20, 0.85, 24);
  stone.cylinder(T.x, -24, T.z, R, 84, 1.0, 24);
  // 階ごとの張り出し（帯）
  for (let k = 0; k < 5; k += 1) {
    stone.cylinder(T.x, -8 + k * 15, T.z, R + 0.8, 1.2, 1.1, 24, true);
  }
  // 上の段：少し細い円柱と、丸屋根（半球は低い円柱と円すいを重ねて表す）
  stone.cylinder(T.x, 60, T.z, R + 1.5, 2.0, 1.1, 24, true);
  stone.cylinder(T.x, 62, T.z, R * 0.7, 10, 1.0, 24);
  roof.setTint(0x6a7ad8);
  roof.cylinder(T.x, 72, T.z, R * 0.72, 3, 1.0, 24);
  roof.cone(T.x, 75, T.z, R * 0.72, 16, 1.0);
  roof.setTint(0xffffff);
  // 望遠鏡（丸屋根から空へ斜めに突き出す箱）
  stone.setTint(0xd8c890);
  stone.box(T.x + 10, 84, T.z - 6, 5, 5, 30, 0.6, 1.1, -0.7);
  stone.setTint(0xffffff);
  // 窓あかり（塔の壁に、らせん状に並ぶ）
  for (let k = 0; k < 36; k += 1) {
    const a = k * 0.62;
    const y = -10 + k * 2.0;
    glow.push({ x: T.x + Math.cos(a) * (R + 0.3), y, z: T.z + Math.sin(a) * (R + 0.3) });
  }
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    glow.push({ x: T.x + Math.cos(a) * (R * 0.7 + 0.3), y: 66, z: T.z + Math.sin(a) * (R * 0.7 + 0.3) });
  }

  // ---- 水晶の橋の下に垂れる結晶 ----
  const every = Math.round(5 / track.step);
  for (let i = 0; i < track.count; i += every) {
    if (track.area[i] !== 'crystal' || track.zone[i] !== 'ground') continue;
    for (const side of [-1, 1]) {
      track.toWorld(i * track.step, side * (track.width[i] / 2 - 0.6 - random() * 2), -0.3, p);
      crystal.pyramidDown(p.x, p.y, p.z, 1.6 + random(), 3 + random() * 7, 1.6 + random(), random() * 3, 1.0);
    }
  }

  // ---- 広場と彗星の道の灯り（光る玉ののった柱） ----
  const lampEvery = Math.round(16 / track.step);
  let n = 0;
  for (let i = 0; i < track.count; i += lampEvery) {
    const area = track.area[i];
    if ((area !== 'gate' && area !== 'comet') || track.zone[i] !== 'ground') continue;
    const side = n % 2 === 0 ? -1 : 1;
    track.toWorld(i * track.step, side * (track.width[i] / 2 + 1.2), 0, p);
    stone.box(p.x, p.y + 1.8, p.z, 0.5, 3.6, 0.5, track.yaw[i], 0.9);
    crystal.pyramid(p.x, p.y + 3.6, p.z, 0.9, 1.4, 0.9, 0.4, 1.2);
    crystal.pyramidDown(p.x, p.y + 3.6, p.z, 0.9, 0.8, 0.9, 0.4, 1.0);
    glow.push({ x: p.x, y: p.y + 4.0, z: p.z });
    n += 1;
  }

  // ---- ゴールの門：2本の柱と、光る水晶をのせた梁 ----
  const s = track.length - 12;
  const half = track.widthAt(s) / 2 + 3;
  const yaw = track.yawAt(s);
  for (const side of [-1, 1]) {
    track.toWorld(s, side * half, 0, p);
    stone.box(p.x, p.y + 0.5, p.z, 3.4, 1.0, 3.4, yaw, 0.9);
    stone.cylinder(p.x, p.y + 1, p.z, 1.2, 12, 1.0, 12);
    crystal.pyramid(p.x, p.y + 13, p.z, 2, 4, 2, yaw, 1.2);
  }
  track.toWorld(s, 0, 12.4, p);
  stone.box(p.x, p.y, p.z, half * 2 + 4, 1.6, 2.6, yaw, 1.05);
  crystal.pyramid(p.x, p.y + 0.8, p.z, 3, 6, 3, yaw, 1.2);
  crystal.pyramidDown(p.x, p.y - 0.8, p.z, 2.4, 3, 2.4, yaw, 1.0);

  // ---- 素材 ----
  const texRandom = seededRandom(1234);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(stone.build(), new THREE.MeshLambertMaterial({ map: drawTowerStone(texRandom), vertexColors: true })));
  group.add(new THREE.Mesh(roof.build(), new THREE.MeshLambertMaterial({ map: drawMarbleBlocks(0xffffff, texRandom), vertexColors: true })));
  const crystalMat = new THREE.MeshLambertMaterial({
    map: drawCrystalTexture(texRandom), vertexColors: true, emissive: 0x4a2a90, transparent: true, opacity: 0.92
  });
  group.add(new THREE.Mesh(crystal.build(), crystalMat));
  group.add(buildGlows(glow));

  // ---- 塔のまわりを回る光の輪（ルーンの輪） ----
  const rings = [];
  for (let k = 0; k < 3; k += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(R + 44 + k * 16, 0.5, 4, 64),
      new THREE.MeshBasicMaterial({
        color: k === 1 ? 0x80e0ff : 0xc890ff, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    ring.position.set(T.x, 66 + k * 14, T.z);
    ring.rotation.x = Math.PI / 2 + (k - 1) * 0.18;
    ring.rotation.y = k * 0.7;
    group.add(ring);
    rings.push(ring);
  }

  // ---- 流れ星（ときどき空を横切る光の線） ----
  const meteors = buildMeteors(random);
  group.add(meteors.group);

  let time = 0;
  return {
    group,
    update(dt) {
      time += dt;
      rings.forEach((ring, k) => {
        ring.rotation.z += dt * (k % 2 === 0 ? 0.15 : -0.1);
      });
      crystalMat.emissive.setRGB(0.25 + Math.sin(time * 1.4) * 0.06, 0.14, 0.5 + Math.sin(time * 1.4) * 0.08);
      meteors.update(dt);
    }
  };
}

// 水晶の模様
function drawCrystalTexture(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const v = random();
      let c = v < 0.15 ? 0xa078e8 : (v > 0.9 ? 0xf0e0ff : 0xc8a8ff);
      if ((x + y) % 13 === 0) c = 0xffffff;
      row.push(c);
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

// 光る点（窓あかり・灯り）
function buildGlows(list) {
  const positions = [];
  for (const g of list) positions.push(g.x, g.y, g.z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe6a8, size: 1.5 }));
}

// 流れ星：細長い光の線を、空の高い所でななめに走らせる。走り終えたら別の場所から
function buildMeteors(random) {
  const group = new THREE.Group();
  const list = [];
  for (let k = 0; k < 3; k += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    line.frustumCulled = false;
    group.add(line);
    list.push({ line, t: -random() * 6, from: new THREE.Vector3(), dir: new THREE.Vector3() });
  }
  const reset = (m) => {
    const a = random() * Math.PI * 2;
    m.from.set(Math.cos(a) * 260, 160 + random() * 80, 160 + Math.sin(a) * 260);
    m.dir.set(-Math.cos(a) + (random() - 0.5), -0.35, -Math.sin(a) + (random() - 0.5)).normalize();
    m.t = -(2 + random() * 5);   // 次に流れるまでの待ち時間
  };
  list.forEach(reset);
  return {
    group,
    update(dt) {
      for (const m of list) {
        m.t += dt;
        const pos = m.line.geometry.attributes.position;
        if (m.t < 0) {
          m.line.visible = false;
          continue;
        }
        if (m.t > 1.2) {
          reset(m);
          continue;
        }
        m.line.visible = true;
        const head = m.t * 180;
        const tail = Math.max(0, head - 40);
        pos.setXYZ(0, m.from.x + m.dir.x * head, m.from.y + m.dir.y * head, m.from.z + m.dir.z * head);
        pos.setXYZ(1, m.from.x + m.dir.x * tail, m.from.y + m.dir.y * tail, m.from.z + m.dir.z * tail);
        pos.needsUpdate = true;
      }
    }
  };
}

export const OBSERVATORY_COURSE = {
  id: 'observatory',
  ready: true,
  name: '星空の天文塔',
  sub: '天文塔をらせんに上り、水晶の橋から星の海へ',
  stars: 4,
  color: '#b49cff',
  data: OBSERVATORY,
  theme: THEME,
  decor: OBS_DECOR,
  music: 'race',
  titleStart: 260,   // タイトルの背景：らせんの坂から塔を見上げる
  keepOut: [{ x: TOWER.x, z: TOWER.z, r: 120 }],
  scenery: (track) => buildScenery(track)
};
