/*
  ファイル名 : Decor.js
  保存場所   : /js/world
  役割       : 背景の作り込み。木・茂み・草・花をドット絵で描き、
               ・コースの柵の外側に作った「草の路肩」
               ・浮遊島の上
               に並べる。HD-2Dらしい「ドット絵の草木が立つ箱庭」の見た目にする
  バージョン : 0.11.2（Phase11 Step11-2）

  軽くするための工夫
    ・草木の絵は、プログラムで1枚の小さな画像（256×64）にまとめて描く（画像ファイル不要）
    ・草木は「板を十字に組んだ形」。どの向きから見ても厚みがあるように見え、毎フレームの計算もない
    ・同じ種類はまとめて1回で描く（種類の数＝描画回数。全部で9回程度）
    ・柵のない所（落ちる所）には路肩を作らない（地面があるように見えると紛らわしいため）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const ATLAS_W = 256;
const ATLAS_H = 64;

// 草木の種類：画像の中の位置（x, y, 幅, 高さ）と、ゲーム内での高さ（メートル）
const KINDS = {
  treeRound:   { x: 0,   y: 0,  w: 32, h: 48, height: 7.0 },
  treePine:    { x: 32,  y: 0,  w: 24, h: 48, height: 8.0 },
  treeBlossom: { x: 56,  y: 0,  w: 32, h: 48, height: 6.5 },
  bush:        { x: 88,  y: 0,  w: 24, h: 16, height: 1.6 },
  bushDark:    { x: 88,  y: 16, w: 24, h: 16, height: 1.8 },
  grass:       { x: 112, y: 0,  w: 16, h: 12, height: 0.8 },
  flowerRed:   { x: 128, y: 0,  w: 16, h: 12, height: 0.8 },
  flowerYellow:{ x: 144, y: 0,  w: 16, h: 12, height: 0.8 },
  flowerBlue:  { x: 160, y: 0,  w: 16, h: 12, height: 0.8 }
};

// 色（ドット絵の色の段階：ふち・暗・中・明・ハイライト）
const LEAF = [0x1d3622, 0x2f6b3a, 0x4f9a48, 0x7fc25a, 0xb6e07a];
const PINE = [0x14302a, 0x1f5446, 0x2f7a5a, 0x4f9e6a, 0x86c48a];
const BLOSSOM = [0x5a2a3e, 0xc0607e, 0xe88aa6, 0xf6b6c8, 0xfff0f4];
const BUSH_DARK = [0x16301e, 0x24543a, 0x3a7a4a, 0x5a9a58, 0x8cc070];
const TRUNK = [0x2a1a10, 0x5a3a22, 0x7a5232, 0x9a6c44];

/**
 * 背景の草木と路肩を作る
 * @param {Track} track
 * @param {Array} islands [{ x, y, z, size }] 浮遊島の位置と大きさ（Environment が置いたもの）
 * @param {string} level 画質 'high' / 'mid' / 'low'
 * @returns {THREE.Group}
 */
export function buildDecor(track, islands, level) {
  const group = new THREE.Group();
  const texture = buildDecorAtlas();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    alphaTest: 0.5,          // 透明部分を切り抜く（並べ替え不要で軽い）
    side: THREE.DoubleSide
  });

  // 種類ごとの置き場所を集める
  const spots = {};
  for (const name of Object.keys(KINDS)) spots[name] = [];
  const random = seededRandom(777);
  const thin = level === 'low' ? 2 : 1;   // 画質 low では小物を半分に

  // ---- 草の路肩と、そこに並べる草木 ----
  group.add(buildVerges(track));
  placeAlongCourse(track, spots, random, thin);

  // ---- 浮遊島の上 ----
  placeOnIslands(islands, spots, random, thin);

  // ---- 種類ごとにまとめて1回で描く ----
  for (const [name, list] of Object.entries(spots)) {
    if (list.length === 0) continue;
    const mesh = makeInstances(KINDS[name], list, material);
    // 草・花・茂み（木以外）は「小物」。重い端末では自動で隠す（Environment.reduce）
    mesh.userData.small = !name.startsWith('tree');
    group.add(mesh);
  }
  return group;
}

// ---- 路肩（柵の外側の草地） ----
// 地上区間で、柵のある所だけに作る。外側の端は土の崖にする
function buildVerges(track) {
  const d = CONFIG.decor;
  const positions = [];
  const colors = [];
  const grass = new THREE.Color(d.vergeColor);
  const grassDark = new THREE.Color(d.vergeColor).multiplyScalar(0.88);
  const dirt = new THREE.Color(d.dirtColor);
  const p = { x: 0, y: 0, z: 0 };
  const quad = (a, b, c, e, color) => {
    for (const v of [a, b, c, a, c, e]) {
      positions.push(v.x, v.y, v.z);
      colors.push(color.r, color.g, color.b);
    }
  };
  const point = (i, x, y) => {
    track.toWorld(i * track.step, x, y, p);
    return { x: p.x, y: p.y, z: p.z };
  };

  const step = 2;   // 2サンプル（4 m）ごとに1枚
  for (let i = 0; i < track.count; i += step) {
    const j = (i + step) % track.count;
    if (!isVerge(track, i) || !isVerge(track, j)) continue;
    const hi = track.width[i] / 2;
    const hj = track.width[j] / 2;
    const shade = (i / step) % 2 === 0 ? grass : grassDark;
    for (const side of [-1, 1]) {
      const inI = side * (hi + d.vergeInner);
      const inJ = side * (hj + d.vergeInner);
      const outI = side * (hi + d.vergeWidth);
      const outJ = side * (hj + d.vergeWidth);
      // 草地（道より少しだけ低く。縁石と重ならないように）
      quad(point(i, inI, -0.03), point(j, inJ, -0.03), point(j, outJ, -0.03), point(i, outI, -0.03), shade);
      // 外側の土の崖
      quad(point(i, outI, -0.03), point(j, outJ, -0.03), point(j, outJ, -d.dirtDepth), point(i, outI, -d.dirtDepth), dirt);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}

// 路肩を作る場所か（地上で、柵がある）
function isVerge(track, i) {
  return track.zone[i] === 'ground' && track.edge[i] !== 'open';
}

// コース沿いに草木を置く
function placeAlongCourse(track, spots, random, thin) {
  const d = CONFIG.decor;
  const p = { x: 0, y: 0, z: 0 };
  let count = 0;
  for (let s = 0; s < track.length; s += d.smallSpacing) {
    const i = Math.floor(s / track.step) % track.count;
    if (!isVerge(track, i)) continue;
    const half = track.width[i] / 2;
    const area = track.area[i];
    const k = track.curv[i];
    for (const side of [-1, 1]) {
      count += 1;
      // 小物（草・花・茂み）
      if (count % thin === 0) {
        const x = side * (half + d.vergeInner + 0.6 + random() * (d.vergeWidth - d.vergeInner - 1.2));
        track.toWorld(s + random() * 2, x, 0, p);
        spots[pickSmall(area, random)].push(spot(p, 0.8 + random() * 0.5, random));
      }
      // 木（間隔をあけて。カーブの内側には置かない：カメラの前をふさがないように）
      const inside = (k > 0 && side < 0) || (k < 0 && side > 0);
      const sharp = Math.abs(k) > d.treeCurvatureLimit;
      if (random() < d.treeChance && !(inside && sharp)) {
        const x = side * (half + d.vergeWidth - 1.2 - random() * 1.0);
        track.toWorld(s + random() * 2, x, 0, p);
        spots[pickTree(area, random)].push(spot(p, 0.85 + random() * 0.35, random));
      }
    }
  }
}

// 浮遊島の上に草木を置く（大きい島ほど多く）
function placeOnIslands(islands, spots, random, thin) {
  const p = { x: 0, y: 0, z: 0 };
  for (const isl of islands) {
    const trees = 1 + Math.floor(isl.size / 7);
    const smalls = Math.floor((2 + isl.size / 3) / thin);
    const r = isl.size * 0.7;
    for (let n = 0; n < trees + smalls; n += 1) {
      const a = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * r;
      p.x = isl.x + Math.cos(a) * dist;
      p.y = isl.y + 0.03 * isl.size;
      p.z = isl.z + Math.sin(a) * dist;
      if (n < trees) {
        const name = random() < 0.2 ? 'treeBlossom' : (random() < 0.5 ? 'treePine' : 'treeRound');
        spots[name].push(spot(p, 0.8 + random() * 0.5, random));
      } else {
        spots[pickSmall('start', random)].push(spot(p, 0.8 + random() * 0.5, random));
      }
    }
  }
}

// 区間に合わせた小物の選び方（神殿は花が多い）
function pickSmall(area, random) {
  const r = random();
  if (area === 'temple') {
    return r < 0.3 ? 'flowerYellow' : (r < 0.55 ? 'flowerBlue' : (r < 0.75 ? 'flowerRed' : 'grass'));
  }
  if (r < 0.35) return 'grass';
  if (r < 0.55) return 'bush';
  if (r < 0.65) return 'bushDark';
  if (r < 0.77) return 'flowerRed';
  if (r < 0.89) return 'flowerYellow';
  return 'flowerBlue';
}

// 区間に合わせた木の選び方（神殿は桜、スタートは広葉樹、ほかは混ぜる）
function pickTree(area, random) {
  const r = random();
  if (area === 'temple') return r < 0.7 ? 'treeBlossom' : 'treeRound';
  if (area === 'start') return r < 0.6 ? 'treeRound' : (r < 0.85 ? 'treePine' : 'treeBlossom');
  return r < 0.5 ? 'treePine' : 'treeRound';
}

function spot(p, scale, random) {
  return { x: p.x, y: p.y, z: p.z, scale, yaw: random() * Math.PI };
}

// 1種類分を、まとめて1回で描く形にする
function makeInstances(kind, list, material) {
  const geo = makeCrossGeometry(kind);
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const dummy = new THREE.Object3D();
  list.forEach((s, n) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.set(s.scale, s.scale, s.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// 板を十字に組んだ形（下端が地面。画像の中の決まった場所の絵を貼る）
function makeCrossGeometry(kind) {
  const h = kind.height;
  const w = h * (kind.w / kind.h);
  const u0 = (kind.x + 0.25) / ATLAS_W;
  const u1 = (kind.x + kind.w - 0.25) / ATLAS_W;
  const v1 = 1 - (kind.y + 0.25) / ATLAS_H;            // 画像の上端
  const v0 = 1 - (kind.y + kind.h - 0.25) / ATLAS_H;   // 画像の下端
  const positions = [];
  const uvs = [];
  for (const angle of [0, Math.PI / 2]) {
    const cx = Math.cos(angle) * w / 2;
    const cz = Math.sin(angle) * w / 2;
    const bl = [-cx, 0, -cz];
    const br = [cx, 0, cz];
    const tr = [cx, h, cz];
    const tl = [-cx, h, -cz];
    for (const [v, uv] of [[bl, [u0, v0]], [br, [u1, v0]], [tr, [u1, v1]], [bl, [u0, v0]], [tr, [u1, v1]], [tl, [u0, v1]]]) {
      positions.push(v[0], v[1], v[2]);
      uvs.push(uv[0], uv[1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

// ---- 草木のドット絵を1枚の画像に描く ----
export function buildDecorAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);

  const random = seededRandom(42);
  drawGrid(ctx, KINDS.treeRound, drawTree(32, 48, LEAF, random, [[16, 16, 13], [9, 21, 8], [23, 21, 8], [16, 9, 8]]));
  drawGrid(ctx, KINDS.treePine, drawPine(24, 48, random));
  drawGrid(ctx, KINDS.treeBlossom, drawTree(32, 48, BLOSSOM, random, [[16, 15, 12], [8, 19, 8], [24, 19, 8], [16, 9, 7]]));
  drawGrid(ctx, KINDS.bush, drawBush(24, 16, LEAF, random));
  drawGrid(ctx, KINDS.bushDark, drawBush(24, 16, BUSH_DARK, random));
  drawGrid(ctx, KINDS.grass, drawGrass(16, 12, random, null));
  drawGrid(ctx, KINDS.flowerRed, drawGrass(16, 12, random, [0xe0483e, 0xff8a7a]));
  drawGrid(ctx, KINDS.flowerYellow, drawGrass(16, 12, random, [0xf2c330, 0xfff09a]));
  drawGrid(ctx, KINDS.flowerBlue, drawGrass(16, 12, random, [0x5a7ae0, 0xa8c4ff]));

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;   // ドットのまま拡大
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 色の番号の表（null = 透明）を画像に描く
function drawGrid(ctx, kind, grid) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const c = grid[y][x];
      if (c === null) continue;
      ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
      ctx.fillRect(kind.x + x, kind.y + y, 1, 1);
    }
  }
}

function emptyGrid(w, h) {
  const g = [];
  for (let y = 0; y < h; y += 1) g.push(new Array(w).fill(null));
  return g;
}

// 丸い葉のかたまり（いくつかの円を重ねた形）を、左上から光が当たるように塗る
function paintCanopy(grid, circles, pal, random) {
  const h = grid.length;
  const w = grid[0].length;
  const inside = (x, y) => circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  // 全体の中心（光の向きの基準）
  let mx = 0, my = 0;
  for (const [cx, cy] of circles) { mx += cx; my += cy; }
  mx /= circles.length; my /= circles.length;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      // どの円の中で、その円の左上にあるほど明るい
      let best = -9;
      for (const [cx, cy, r] of circles) {
        const dx = (x + 0.5 - cx) / r;
        const dy = (y + 0.5 - cy) / r;
        if (dx * dx + dy * dy > 1) continue;
        best = Math.max(best, -(dx * 0.6 + dy * 0.8));
      }
      const v = best + (random() - 0.5) * 0.35 - ((y - my) / h) * 0.6;
      grid[y][x] = v > 0.55 ? pal[4] : v > 0.15 ? pal[3] : v > -0.3 ? pal[2] : pal[1];
    }
  }
  outline(grid, pal[0]);
}

// 透明な所と接している端をふち色にする
function outline(grid, color) {
  const h = grid.length;
  const w = grid[0].length;
  const copy = grid.map((row) => row.slice());
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (copy[y][x] === null) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx < 0 || ny < 0 || nx >= w || ny >= h || copy[ny][nx] === null;
      });
      if (edge) grid[y][x] = color;
    }
  }
}

// 幹（下から葉の中まで）
function paintTrunk(grid, cx, top, bottom, width) {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = cx - Math.floor(width / 2); x < cx - Math.floor(width / 2) + width; x += 1) {
      if (grid[y][x] !== null && y < top + 3) continue;
      const rel = x - (cx - Math.floor(width / 2));
      grid[y][x] = rel === 0 ? TRUNK[3] : (rel === width - 1 ? TRUNK[1] : TRUNK[2]);
    }
  }
  // 根元を少し広げる
  grid[bottom][cx - Math.floor(width / 2) - 1] = TRUNK[1];
  grid[bottom][cx - Math.floor(width / 2) + width] = TRUNK[1];
}

function drawTree(w, h, pal, random, circles) {
  const g = emptyGrid(w, h);
  // 葉の下側に幹
  paintTrunk(g, Math.floor(w / 2), 26, h - 1, 4);
  const leaves = emptyGrid(w, h);
  paintCanopy(leaves, circles, pal, random);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (leaves[y][x] !== null) g[y][x] = leaves[y][x];
    }
  }
  // 幹のふち（塗る前の状態を見て決める。ふちの色からさらにふちが広がらないように）
  const before = g.map((row) => row.slice());
  const bark = [TRUNK[1], TRUNK[2], TRUNK[3]];
  for (let y = 26; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!bark.includes(before[y][x])) continue;
      if (x > 0 && before[y][x - 1] === null) g[y][x - 1] = TRUNK[0];
      if (x < w - 1 && before[y][x + 1] === null) g[y][x + 1] = TRUNK[0];
    }
  }
  return g;
}

// とがった針葉樹（三角を3段に重ねる）
function drawPine(w, h, random) {
  const g = emptyGrid(w, h);
  paintTrunk(g, Math.floor(w / 2), 34, h - 1, 3);
  const leaves = emptyGrid(w, h);
  const tiers = [[2, 16, 5], [10, 26, 8], [18, 36, 11]];   // [上端, 下端, 下端での半幅]
  const cx = w / 2;
  for (const [top, bottom, half] of tiers) {
    for (let y = top; y <= bottom; y += 1) {
      const t = (y - top) / (bottom - top);
      const hw = 1 + t * half;
      for (let x = 0; x < w; x += 1) {
        const dx = x + 0.5 - cx;
        if (Math.abs(dx) > hw) continue;
        const v = -dx / hw * 0.7 - t * 0.5 + (random() - 0.5) * 0.4 + 0.3;
        leaves[y][x] = v > 0.6 ? PINE[4] : v > 0.2 ? PINE[3] : v > -0.25 ? PINE[2] : PINE[1];
      }
    }
  }
  outline(leaves, PINE[0]);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (leaves[y][x] !== null) g[y][x] = leaves[y][x];
    }
  }
  return g;
}

function drawBush(w, h, pal, random) {
  const g = emptyGrid(w, h);
  paintCanopy(g, [[7, 10, 6], [14, 8, 7], [19, 11, 5]], pal, random);
  return g;
}

// 草の束（flowers を渡すと、先に花を咲かせる）
function drawGrass(w, h, random, flowers) {
  const g = emptyGrid(w, h);
  // 草の葉：[x, 先端の高さ]。真ん中ほど背が高い
  const blades = [];
  for (let bx = 1; bx < w - 1; bx += 1) {
    const mid = 1 - Math.abs(bx - w / 2) / (w / 2);
    blades.push([bx, Math.max(1, Math.round(7 - mid * 5 + (random() - 0.5) * 3))]);
  }
  for (const [bx, top] of blades) {
    const lean = random() < 0.5 ? -1 : 1;
    for (let y = top; y < h; y += 1) {
      const x = bx + (y < top + 3 ? lean : 0);
      if (x < 0 || x >= w) continue;
      g[y][x] = y < top + 3 ? LEAF[3] : (y > h - 4 ? LEAF[1] : LEAF[2]);
    }
  }
  if (flowers) {
    for (const [bx, top] of blades) {
      if (random() < 0.7) continue;
      const fx = Math.min(w - 2, Math.max(1, bx));
      const fy = Math.max(1, top);
      g[fy][fx] = flowers[1];
      g[fy - 1][fx] = flowers[0];
      g[fy][fx - 1] = flowers[0];
      g[fy][fx + 1] = flowers[0];
      g[fy + 1][fx] = flowers[0];
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
