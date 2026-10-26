/*
  ファイル名 : harbor.js
  保存場所   : /js/courses
  役割       : 雲海の港町コース。テーマ（晴れた朝）・草木（花の多い町）・
               建物（カラフルな家並み・時計台・桟橋の杭と街灯・飛行船と係留塔・光の回る灯台）
  バージョン : 1.15.0（Phase15 Step15-2）
  メモ       : コースの形・丘・リングは harborData.js。
               家の壁や屋根は1つの形にまとめ、色は ShapeBuilder の setTint で家ごとに変える
*/

import * as THREE from 'three';
import { HARBOR } from './harborData.js';
import { TEMPLE_DECOR } from '../world/Decor.js';
import { ShapeBuilder, makeTexture, drawRuinStone, seededRandom } from '../world/Buildings.js';

// ---- 晴れた朝のテーマ ----
const THEME = {
  environment: {
    skyTopColor: 0x3a8ce6,
    horizonColor: 0xdaf0ff,
    fogNear: 110,
    fogFar: 440,
    sunDirection: { x: 0.35, y: 0.62, z: 0.7 },
    grassColor: 0x86c85a,
    rockColor: 0x9a8a78,
    ruinColor: 0xb8b0a4
  },
  course: {
    stripeLength: 2,
    stripeShade: 0.88,
    roadColors: {
      plaza: 0xd8c8a8,           // 石だたみ
      hill: 0xcab694,
      pier: 0x9c6c42,            // 板の道（しまが板の継ぎ目に見える）
      lighthouse: 0xc4bcaa,
      default: 0xcab694
    },
    rockColor: 0x8c7c6c,
    rockColors: { pier: 0x6a4a30 },
    rockDepth: { plaza: 12, hill: 14, pier: 2.5, lighthouse: 14, default: 10 },
    curbLight: 0xffffff,
    curbDark: 0x2a86c8,          // 白と海の青
    railColor: 0xffffff,
    lanternColor: 0xffe08a
  },
  decor: {
    vergeWidth: 3.0,             // 路肩は細い歩道（その外に家が並ぶ）
    vergeColor: 0x7cbc58,
    smallSpacing: 4,
    treeChance: 0.04
  },
  postfx: {
    saturation: 1.18,
    warmTint: [1.03, 1.0, 0.96]
  },
  atmosphere: {
    moteColor: 0xffffff,
    moteRise: 0.15
  }
};

// ---- 草木：天空神殿の絵を使い、花を多めにする ----
const HARBOR_DECOR = {
  kinds: TEMPLE_DECOR.kinds,
  pickSmall(area, random) {
    const r = random();
    return r < 0.25 ? 'flowerRed' : (r < 0.45 ? 'flowerYellow' : (r < 0.6 ? 'flowerBlue' : (r < 0.8 ? 'bush' : 'grass')));
  },
  pickTree(area, random) {
    return random() < 0.5 ? 'treeRound' : 'treeBlossom';
  },
  islandTree(random) {
    const r = random();
    return r < 0.5 ? 'treeRound' : (r < 0.75 ? 'treeBlossom' : 'treePine');
  },
  islandSmall: (random) => HARBOR_DECOR.pickSmall('', random)
};

// 家の色（壁・屋根）
const WALLS = [0xffe9a8, 0xffc8a0, 0xbfe4ff, 0xffc4d4, 0xc8f0b8, 0xfff6e8, 0xf8d8ff];
const ROOFS = [0xe0503c, 0xf08a2c, 0x2aa0a8, 0x3a6ad0, 0xc04070, 0xe8b830];

// ============================================================
// 模様
// ============================================================

// しっくいの壁（白っぽい面に、少しのむらと、すみの木の柱）
function drawPlaster(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const v = random();
      row.push(v < 0.1 ? 0xe6e2da : (v > 0.95 ? 0xffffff : 0xf4f2ee));
    }
    grid.push(row);
  }
  // 横の木の帯（階の境目）
  for (let x = 0; x < 32; x += 1) {
    grid[0][x] = 0x8a6a4a;
    grid[1][x] = 0x6a4a30;
  }
  return makeTexture(grid);
}

// 屋根がわら（白っぽく描き、家ごとの色を掛ける）
function drawTiles(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) {
      const off = Math.floor(y / 4) % 2 === 0 ? 0 : 3;
      const edge = y % 4 === 3 || (x + off) % 6 === 0;
      let c = edge ? 0x9a9a9a : (y % 4 === 0 ? 0xffffff : 0xe0e0e0);
      if (!edge && random() < 0.06) c = 0xc8c8c8;
      row.push(c);
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

// 木の板
function drawPlanks(random) {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    const plank = Math.floor(y / 8);
    const base = [0x9a6a40, 0x8a5c36, 0xa8764a, 0x7e5432][plank];
    for (let x = 0; x < 32; x += 1) {
      let c = base;
      if (y % 8 === 0) c = 0x4a3020;
      else if ((x + plank * 11) % 32 === 0) c = 0x5a3a24;
      else if (random() < 0.12) c = scale(base, 0.9);
      row.push(c);
    }
    grid.push(row);
  }
  return makeTexture(grid);
}

// 灯台のしま（赤と白）
function drawStripes() {
  const grid = [];
  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 1) row.push(Math.floor(y / 8) % 2 === 0 ? 0xf6f2ea : 0xd0383a);
    grid.push(row);
  }
  return makeTexture(grid);
}

// 飛行船の袋（横じま）
function drawEnvelope() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const cols = ['#f6efe0', '#e0503c', '#f6efe0', '#2a86c8'];
  for (let k = 0; k < 8; k += 1) {
    ctx.fillStyle = cols[k % cols.length];
    ctx.fillRect(0, k * 4, 64, 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < 64; x += 8) ctx.fillRect(x, 0, 1, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function scale(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// ============================================================
// 建物
// ============================================================

// 灯台の場所（灯台の丘のうずの真ん中）
const LIGHTHOUSE = { x: -98, y: 2, z: -92 };

function buildScenery(track) {
  const random = seededRandom(5150);
  const walls = new ShapeBuilder(3.0);    // しっくいの壁
  const roofs = new ShapeBuilder(2.0);    // 屋根がわら
  const wood = new ShapeBuilder(2.0);     // 木（窓わく・ドア・桟橋の杭・係留塔）
  const stone = new ShapeBuilder(2.5);    // 石（家の土台・時計台・灯台の島）
  const stripe = new ShapeBuilder(8.0);   // 灯台の赤白しま
  const glow = [];                        // 光る物（街灯・窓あかり・灯台の灯）の位置
  const p = { x: 0, y: 0, z: 0 };

  // ---- 家並み（広場・坂・灯台の丘の両側） ----
  const vergeOut = 3.0;
  for (const side of [-1, 1]) {
    let s = 4;
    while (s < track.length) {
      const i = Math.floor(s / track.step) % track.count;
      const area = track.area[i];
      const width = 6.5 + random() * 3.5;     // 道に沿った長さ
      if ((area === 'plaza' || area === 'hill' || area === 'lighthouse') && track.zone[i] === 'ground') {
        const k = track.curv[i];
        const inside = (k > 0 && side < 0) || (k < 0 && side > 0);
        // 灯台の丘の内側（灯台のある方）と、急なカーブの内側には建てない
        const skip = (area === 'lighthouse' && inside) || (inside && Math.abs(k) > 0.03) ||
          s < 14 || s > track.length - 26;
        if (!skip && random() < 0.85) {
          addHouse(track, s, side, track.width[i] / 2 + vergeOut + 0.4, width, random, walls, roofs, wood, stone, glow);
        }
      }
      s += width + 1.5 + random() * 2;
    }
  }

  // ---- 時計台（スタートの横） ----
  track.toWorld(36, -(track.widthAt(36) / 2 + vergeOut + 6), 0, p);
  const yaw0 = track.yawAt(36);
  stone.box(p.x, p.y - 5, p.z, 9, 10, 9, yaw0, 0.85);
  stone.box(p.x, p.y + 9, p.z, 7, 18, 7, yaw0, 1.0);
  stone.box(p.x, p.y + 18.6, p.z, 8, 1.2, 8, yaw0, 1.05);
  wood.setTint(0xffe9a0);
  // 時計の文字盤（道の側の面。道は箱の -x の向き）
  wood.box(p.x - Math.cos(yaw0) * 3.55, p.y + 15, p.z + Math.sin(yaw0) * 3.55, 0.3, 3.2, 3.2, yaw0, 1.2);
  wood.setTint(0xffffff);
  roofs.setTint(0x3a6ad0);
  roofs.pyramid(p.x, p.y + 19.2, p.z, 8.4, 6, 8.4, yaw0, 1.0);
  roofs.setTint(0xffffff);

  // ---- 桟橋：下の杭・ふちの係留柱・街灯 ----
  const pileEvery = Math.round(8 / track.step);
  let n = 0;
  for (let i = 0; i < track.count; i += pileEvery) {
    if (track.area[i] !== 'pier' || track.zone[i] !== 'ground') continue;
    const yaw = track.yaw[i];
    for (const side of [-1, 1]) {
      track.toWorld(i * track.step, side * (track.width[i] / 2 - 1), 0, p);
      wood.cylinder(p.x, p.y - 16, p.z, 0.55, 16, 0.8);
      if (n % 2 === 0) {
        // 係留柱（短い黒い柱）
        track.toWorld(i * track.step, side * (track.width[i] / 2 - 0.6), 0, p);
        stone.setTint(0x555a66);
        stone.cylinder(p.x, p.y, p.z, 0.35, 0.8, 1.0);
        stone.setTint(0xffffff);
      }
    }
    // 街灯（左右交互）
    if (n % 3 === 0) {
      const side = n % 6 === 0 ? -1 : 1;
      track.toWorld(i * track.step, side * (track.width[i] / 2 - 0.5), 0, p);
      wood.setTint(0x3a3a46);
      wood.box(p.x, p.y + 2.2, p.z, 0.25, 4.4, 0.25, yaw, 1.0);
      wood.box(p.x, p.y + 4.6, p.z, 0.7, 0.4, 0.7, yaw, 1.0);
      wood.setTint(0xffffff);
      glow.push({ x: p.x, y: p.y + 4.1, z: p.z, size: 1.4 });
    }
    n += 1;
  }

  // ---- 灯台（灯台の丘のうずの真ん中の島） ----
  const L = LIGHTHOUSE;
  stone.box(L.x, L.y - 2, L.z, 34, 4, 34, 0.3, 1.0);
  for (let k = 1; k <= 3; k += 1) {
    const w = 34 * (1 - k * 0.25);
    stone.box(L.x, L.y - 4 - k * 5 + 2.5, L.z, w, 5, w, 0.3 + k * 0.2, 0.85 - k * 0.05);
  }
  stone.cylinder(L.x, L.y, L.z, 5.2, 2.0, 0.9);
  stripe.cylinder(L.x, L.y + 2, L.z, 4.2, 28, 1.0);
  stone.cylinder(L.x, L.y + 30, L.z, 5.0, 1.0, 1.05);
  wood.setTint(0x2a2a36);
  wood.cylinder(L.x, L.y + 31, L.z, 3.0, 0.6, 1.0);
  wood.setTint(0xffffff);
  roofs.setTint(0xd0383a);
  roofs.cone(L.x, L.y + 35.2, L.z, 3.6, 4.5, 1.0);
  roofs.setTint(0xffffff);
  glow.push({ x: L.x, y: L.y + 33.2, z: L.z, size: 5 });

  // ---- 素材をまとめる ----
  const texRandom = seededRandom(31337);
  const group = new THREE.Group();
  const lambert = (map) => new THREE.MeshLambertMaterial({ map, vertexColors: true });
  if (!walls.isEmpty()) group.add(new THREE.Mesh(walls.build(), lambert(drawPlaster(texRandom))));
  if (!roofs.isEmpty()) group.add(new THREE.Mesh(roofs.build(), lambert(drawTiles(texRandom))));
  if (!wood.isEmpty()) group.add(new THREE.Mesh(wood.build(), lambert(drawPlanks(texRandom))));
  if (!stone.isEmpty()) group.add(new THREE.Mesh(stone.build(), lambert(drawRuinStone(0xc8c0b4, texRandom))));
  if (!stripe.isEmpty()) group.add(new THREE.Mesh(stripe.build(), lambert(drawStripes())));
  group.add(buildGlows(glow));

  // 灯台のガラスの部屋（光る）と、回る光の帯
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 3.4, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0 })
  );
  lamp.position.set(L.x, L.y + 33.2, L.z);
  group.add(lamp);
  const beamGeo = new THREE.ConeGeometry(7, 70, 12, 1, true);
  beamGeo.translate(0, -35, 0);
  beamGeo.rotateZ(Math.PI / 2);   // 横向きに
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0xfff0b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false
  }));
  beam.position.copy(lamp.position);
  group.add(beam);

  // ---- 飛行船（ゆっくり上下に揺れる） ----
  const airships = buildAirships(track, random);
  group.add(airships.group);

  return {
    group,
    update(dt) {
      beam.rotation.y += dt * 0.8;
      airships.update(dt);
    }
  };
}

// 家を1軒建てる（道からの距離 offset、道に沿った長さ width）
function addHouse(track, s, side, offset, width, random, walls, roofs, wood, stone, glow) {
  const p = { x: 0, y: 0, z: 0 };
  const depth = 6.5 + random() * 2.5;
  const floors = random() < 0.45 ? 2 : (random() < 0.8 ? 3 : 1);
  const h = 2.4 + floors * 2.6;
  const yaw = track.yawAt(s);
  track.toWorld(s, side * (offset + depth / 2), 0, p);
  const base = p.y;
  // 土台（坂でも浮かないよう、下まで石を伸ばす）
  // 箱の大きさは（道を横切る向き・高さ・道に沿う向き）の順
  stone.box(p.x, base - 4.5, p.z, depth + 0.6, 9, width + 0.6, yaw, 0.8);
  // 壁
  walls.setTint(WALLS[Math.floor(random() * WALLS.length)]);
  walls.box(p.x, base + h / 2, p.z, depth, h, width, yaw, 1.0);
  walls.setTint(0xffffff);
  // 屋根：半分は道に平行、半分は道に向けた三角の面
  roofs.setTint(ROOFS[Math.floor(random() * ROOFS.length)]);
  const roofH = 2.4 + random() * 1.4;
  if (random() < 0.5) {
    roofs.prism(p.x, base + h, p.z, depth + 0.8, roofH, width + 0.8, yaw, 1.0);               // 棟が道に平行
  } else {
    roofs.prism(p.x, base + h, p.z, width + 0.8, roofH, depth + 0.8, yaw + Math.PI / 2, 1.0); // 三角の面が道を向く
  }
  roofs.setTint(0xffffff);
  // 煙突（ときどき）
  if (random() < 0.35) {
    stone.box(p.x + Math.sin(yaw) * width * 0.25, base + h + roofH * 0.7, p.z + Math.cos(yaw) * width * 0.25, 0.9, 2.2, 0.9, yaw, 0.9);
  }
  // 道に向いた面の窓とドア
  const face = side * (offset - 0.06);   // 壁の道側の面（中心から道の方へ）
  const cols = Math.max(1, Math.floor(width / 2.6));
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const along = (c - (cols - 1) / 2) * 2.6;
      const isDoor = f === 0 && c === Math.floor(cols / 2);
      track.toWorld(s + along, face, 0, p);
      if (isDoor) {
        wood.setTint(0x8a5030);
        wood.box(p.x, base + 1.15, p.z, 0.2, 2.3, 1.3, yaw, 0.9);
      } else {
        wood.setTint(0x3a4a6a);
        wood.box(p.x, base + 1.6 + f * 2.6, p.z, 0.2, 1.2, 1.1, yaw, 1.0);
        // 窓あかり（1割くらい）
        if (random() < 0.12) glow.push({ x: p.x, y: base + 1.6 + f * 2.6, z: p.z, size: 0.9 });
      }
    }
  }
  wood.setTint(0xffffff);
}

// 光る点（街灯・窓あかり・灯台）をまとめて1回で描く
function buildGlows(list) {
  const positions = [];
  const sizes = [];
  for (const g of list) {
    positions.push(g.x, g.y, g.z);
    sizes.push(g.size);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffe6a0, size: 1.2, transparent: true, opacity: 0.9 });
  return new THREE.Points(geo, mat);
}

// 飛行船：袋（楕円）と、ゴンドラ・尾びれ。同じ形を何隻か置き、それぞれゆっくり揺らす
function buildAirships(track, random) {
  const group = new THREE.Group();
  // 置き場所：飛行船の港の空中ルートの外側と内側
  const spots = [];
  const p = { x: 0, y: 0, z: 0 };
  let start = null;
  let end = null;
  for (let i = 0; i < track.count; i += 1) {
    if (track.area[i] === 'airship' && track.zone[i] === 'air') {
      if (start === null) start = i * track.step;
      end = i * track.step;
    }
  }
  if (start !== null) {
    const plan = [[0.18, 1, 32, 2], [0.45, -1, 36, 12], [0.7, 1, 34, -4], [0.95, -1, 40, 10]];
    for (const [at, side, out, up] of plan) {
      const s = start + (end - start) * at;
      track.toWorld(s, side * out, up, p);
      spots.push({ x: p.x, y: p.y, z: p.z, yaw: track.yawAt(s) + (random() - 0.5) * 0.8, phase: random() * 6 });
    }
  }

  // 袋
  const envGeo = new THREE.SphereGeometry(1, 16, 10);
  envGeo.scale(7, 6, 18);
  const envMat = new THREE.MeshLambertMaterial({ map: drawEnvelope() });
  // ゴンドラと尾びれ（木の形を、袋の中心からの位置で作る）
  const parts = new ShapeBuilder(2.0);
  parts.setTint(0x8a5a34);
  parts.box(0, -7.4, 0, 3.6, 2.2, 8, 0, 1.0);            // ゴンドラ
  parts.setTint(0x3a4a6a);
  parts.box(0, -7.2, 0, 3.7, 0.7, 6.4, 0, 1.0);          // ゴンドラの窓の帯
  parts.setTint(0xe0503c);
  parts.box(0, 4.4, -16, 0.5, 5.6, 5.0, 0, 1.0);         // 尾びれ（上）
  parts.box(0, 0, -16, 11.0, 0.5, 4.6, 0, 1.0);          // 尾びれ（横）
  parts.setTint(0x6a6a72);
  parts.box(0, -6.1, -6, 0.3, 2.4, 0.3, 0, 1.0);         // 吊りひも
  parts.box(0, -6.1, 6, 0.3, 2.4, 0.3, 0, 1.0);
  const partsGeo = parts.build();
  const partsMat = new THREE.MeshLambertMaterial({ map: drawPlanks(seededRandom(7)), vertexColors: true });

  const envelopes = new THREE.InstancedMesh(envGeo, envMat, Math.max(1, spots.length));
  const gondolas = new THREE.InstancedMesh(partsGeo, partsMat, Math.max(1, spots.length));
  envelopes.count = spots.length;
  gondolas.count = spots.length;
  group.add(envelopes);
  group.add(gondolas);

  const dummy = new THREE.Object3D();
  let time = 0;
  const place = () => {
    spots.forEach((sp, k) => {
      dummy.position.set(sp.x, sp.y + Math.sin(time * 0.6 + sp.phase) * 0.8, sp.z);
      dummy.rotation.set(Math.sin(time * 0.4 + sp.phase) * 0.03, sp.yaw + Math.sin(time * 0.15 + sp.phase) * 0.05, 0);
      dummy.updateMatrix();
      envelopes.setMatrixAt(k, dummy.matrix);
      gondolas.setMatrixAt(k, dummy.matrix);
    });
    envelopes.instanceMatrix.needsUpdate = true;
    gondolas.instanceMatrix.needsUpdate = true;
  };
  place();
  return {
    group,
    update(dt) {
      time += dt;
      place();
    }
  };
}

export const HARBOR_COURSE = {
  id: 'harbor',
  ready: true,
  name: '雲海の港町',
  sub: '坂の町並みと桟橋を抜け、飛行船の間を飛ぶ',
  stars: 3,
  color: '#ffd36e',
  data: HARBOR,
  theme: THEME,
  decor: HARBOR_DECOR,
  music: 'harbor',
  titleStart: 60,   // タイトルの背景：広場から坂の町並みへ
  keepOut: [{ x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: 30 }],
  scenery: (track) => buildScenery(track)
};
