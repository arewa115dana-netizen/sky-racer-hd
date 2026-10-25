/*
  ファイル名 : Buildings.js
  保存場所   : /js/world
  役割       : 遺跡と神殿の建物。石の模様（ドット絵）を貼った、作り込んだ形を作る
                 ・古代遺跡のアーチ … 土台・柱・柱頭の3段の柱に、要石つきの梁。
                                      崩れたアーチは柱の上が欠け、まわりに石のかけらが浮かぶ
                 ・神殿の柱         … 土台・溝の入った丸い柱・柱頭
                 ・ゴールの門       … 溝の入った2本の柱、梁、上に三角の飾り（破風）
  バージョン : 1.14.0（Phase14：素材をコースごとに作り直す・ピラミッドの形・石の模様を外から使えるように）
  メモ       : 本殿・かがり火・旗・ツタなどは Landmarks.js が作る。
               そのために、形をためる入れ物（ShapeBuilder）と石の素材（stoneMaterials）を外から使えるようにし、
               旗とツタを付ける場所（anchors）を記録して返す

  軽くするための工夫
    ・石の模様は、プログラムで小さな画像（32×32）を3枚描くだけ（画像ファイル不要）
    ・同じ模様の部品は、全部を1つの形にまとめて1回で描く（全部で3回）
    ・模様の大きさは「何メートルごとにくり返すか」で決めるので、大きな柱でも模様が伸びない
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const TEX = 32;   // 模様の画像の大きさ（マス）

/**
 * 遺跡・神殿の建物をすべて作る
 * @param {Track} track
 * @returns {{ group: THREE.Group, anchors: { vines: Array, banners: Array } }}
 *          anchors = ツタ・旗を付ける場所（Landmarks.js が使う）
 */
export function buildBuildings(track) {
  const group = new THREE.Group();
  const anchors = { vines: [], banners: [] };
  const builders = createBuilders();

  buildArches(track, builders.ruin, anchors);
  buildTempleColumns(track, builders.flute, builders.block, anchors);
  buildGate(track, builders.flute, builders.block);

  addMeshes(group, builders);
  return { group, anchors };
}

// 模様ごとに1つずつ、形をためる入れ物を作る
export function createBuilders() {
  const b = CONFIG.buildings;
  return {
    ruin: new ShapeBuilder(b.ruinTile),
    flute: new ShapeBuilder(b.marbleTile),
    block: new ShapeBuilder(b.marbleTile * 2)
  };
}

// ためた形を、石の素材を付けて group に加える（空の入れ物は飛ばす）
export function addMeshes(group, builders) {
  const m = stoneMaterials();
  for (const name of ['ruin', 'flute', 'block']) {
    if (builders[name].isEmpty()) continue;
    group.add(new THREE.Mesh(builders[name].build(), m[name]));
  }
}

// 石の素材（遺跡の石・溝の柱・切り石）。1つの世界の中では一度だけ作って使い回す
// （コースを切り替えるときは World.js が resetStoneMaterials を呼び、新しいコースの色で作り直す）
let cachedMaterials = null;
export function resetStoneMaterials() {
  cachedMaterials = null;
}

export function stoneMaterials() {
  if (cachedMaterials) return cachedMaterials;
  const e = CONFIG.environment;
  const random = seededRandom(99);
  const make = (texture) => new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
  cachedMaterials = {
    ruin: make(drawRuinStone(e.ruinColor, random)),
    flute: make(drawFlutedMarble(e.templeColor, random)),
    block: make(drawMarbleBlocks(e.templeColor, random))
  };
  return cachedMaterials;
}

// ---- 古代遺跡のアーチ（空中ルートをまたぐ。3つに1つは崩れている） ----
function buildArches(track, ruin, anchors) {
  const e = CONFIG.environment;
  const b = CONFIG.buildings;
  const random = seededRandom(31);
  const p = { x: 0, y: 0, z: 0 };
  let n = 0;
  for (let i = 0; i < track.count; i += Math.round(e.archSpacing / track.step)) {
    if (track.area[i] !== 'ruins' || track.zone[i] !== 'air') continue;
    const s = i * track.step;
    const half = track.width[i] / 2 + 2;
    const yaw = track.yaw[i];
    const broken = n % 3 === 2;
    const bottom = b.archBottom;
    const top = e.archHeight;

    for (const side of [-1, 1]) {
      const cut = broken && side > 0;   // 崩れたアーチの右の柱は途中まで
      const shaftTop = cut ? bottom + (top - bottom) * 0.5 : top - 1.0;
      const at = (x, y) => track.toWorld(s, x, y, p);
      // 土台
      at(side * half, bottom + 0.8);
      ruin.box(p.x, p.y, p.z, 4.2, 1.6, 4.2, yaw, 0.9);
      // 柱
      at(side * half, (bottom + 1.6 + shaftTop) / 2);
      ruin.box(p.x, p.y, p.z, 3, shaftTop - bottom - 1.6, 3, yaw, 1);
      if (cut) {
        // 欠けた上端：高さの違う小さな石をいくつか
        for (let k = 0; k < 4; k += 1) {
          const ox = ((k % 2) - 0.5) * 1.5;
          const oz = (Math.floor(k / 2) - 0.5) * 1.5;
          const hgt = 0.6 + random() * 1.8;
          at(side * half + ox, shaftTop + hgt / 2);
          ruin.box(p.x + Math.sin(yaw) * oz, p.y, p.z + Math.cos(yaw) * oz, 1.4, hgt, 1.4, yaw + random() * 0.2, 0.95);
        }
        // 崩れた石のかけらが、まわりに浮かぶ
        for (let k = 0; k < b.floatingStones; k += 1) {
          const size = 0.8 + random() * 1.4;
          at(side * (half + 2 + random() * 6), shaftTop + 2 + random() * 8);
          ruin.box(p.x, p.y, p.z, size, size * 0.8, size, yaw + random() * 3, 0.85, random() * 0.8);
        }
      } else {
        // 柱頭（上の飾り）
        at(side * half, top - 0.5);
        ruin.box(p.x, p.y, p.z, 4.0, 1.0, 4.0, yaw, 1.05);
        // ツタ：飛んでくる人から見える面（手前側）に垂らす
        for (const ox of [-0.8, 0.7]) {
          track.toWorld(s - 1.58, side * half + ox, top - 1.0, p);
          anchors.vines.push({ x: p.x, y: p.y, z: p.z, yaw, length: 5 + random() * 7 });
        }
      }
    }

    if (!broken) {
      // 梁（2段）と、てっぺんの要石
      track.toWorld(s, 0, top + 1.0, p);
      ruin.box(p.x, p.y, p.z, half * 2 + 4.4, 2.0, 3.4, yaw, 1);
      track.toWorld(s, 0, top + 2.4, p);
      ruin.box(p.x, p.y, p.z, half * 2 + 2, 0.8, 3.0, yaw, 1.08);
      track.toWorld(s, 0, top + 3.4, p);
      ruin.box(p.x, p.y, p.z, 2.0, 1.6, 3.6, yaw, 1.12);
      // 梁から垂れるツタ（道の真ん中は避け、左右寄りに）
      for (let k = 0; k < 4; k += 1) {
        const x = (k < 2 ? -1 : 1) * (half * (0.45 + random() * 0.45));
        track.toWorld(s - 1.75, x, top, p);
        anchors.vines.push({ x: p.x, y: p.y, z: p.z, yaw, length: 2 + random() * 3 });
      }
    }
    n += 1;
  }
}

// ---- 神殿の柱（神殿の道の両側に並ぶ白い柱） ----
function buildTempleColumns(track, flute, block, anchors) {
  const e = CONFIG.environment;
  const b = CONFIG.buildings;
  const p = { x: 0, y: 0, z: 0 };
  const every = Math.round(e.columnSpacing / track.step);
  const h = e.columnHeight;
  const gateS = track.length - 12;
  for (let i = 0; i < track.count; i += every) {
    if (track.area[i] !== 'temple' || track.zone[i] !== 'ground') continue;
    // ゴールの門と重ならないよう、門の近くには立てない
    const toGate = Math.abs(i * track.step - gateS);
    if (Math.min(toGate, track.length - toGate) < b.gateClearance) continue;
    const yaw = track.yaw[i];
    for (const side of [-1, 1]) {
      track.toWorld(i * track.step, side * (track.width[i] / 2 + b.columnOffset), 0, p);
      // 土台（2段）
      block.box(p.x, p.y + 0.3, p.z, 2.6, 0.6, 2.6, yaw, 0.92);
      block.box(p.x, p.y + 0.75, p.z, 2.1, 0.3, 2.1, yaw, 0.97);
      // 溝の入った丸い柱
      flute.cylinder(p.x, p.y + 0.9, p.z, 0.85, h - 2.0, 1);
      // 柱頭
      block.box(p.x, p.y + h - 0.85, p.z, 2.0, 0.3, 2.0, yaw, 1.05);
      block.box(p.x, p.y + h - 0.35, p.z, 2.5, 0.7, 2.5, yaw, 1.1);
      // 1本おきに、道の側へ旗を下げる
      if (Math.floor(i / every) % 2 === 0) {
        track.toWorld(i * track.step, side * (track.width[i] / 2 + b.columnOffset - 0.95), h - 1.2, p);
        anchors.banners.push({ x: p.x, y: p.y, z: p.z, yaw: yaw + side * Math.PI / 2 });
      }
    }
  }
}

// ---- ゴールの門（スタートラインの少し手前） ----
function buildGate(track, flute, block) {
  const b = CONFIG.buildings;
  const s = track.length - 12;
  const half = track.widthAt(s) / 2 + 3;
  const yaw = track.yawAt(s);
  const p = { x: 0, y: 0, z: 0 };
  const height = b.gateHeight;
  for (const side of [-1, 1]) {
    track.toWorld(s, side * half, 0, p);
    block.box(p.x, p.y + 0.5, p.z, 3.6, 1.0, 3.6, yaw, 0.92);
    block.box(p.x, p.y + 1.25, p.z, 3.0, 0.5, 3.0, yaw, 0.97);
    flute.cylinder(p.x, p.y + 1.5, p.z, 1.2, height - 2.6, 1);
    block.box(p.x, p.y + height - 0.55, p.z, 3.2, 1.1, 3.2, yaw, 1.08);
  }
  // 梁（3段）
  track.toWorld(s, 0, height + 0.8, p);
  block.box(p.x, p.y, p.z, half * 2 + 6, 1.6, 3.6, yaw, 1);
  track.toWorld(s, 0, height + 2.0, p);
  block.box(p.x, p.y, p.z, half * 2 + 7, 0.8, 4.0, yaw, 1.1);
  // 三角の飾り（破風）
  track.toWorld(s, 0, height + 2.4, p);
  block.prism(p.x, p.y, p.z, half * 2 + 5, 4.2, 3.4, yaw, 1.04);
}

// ============================================================
// 形をためる入れ物。箱・円柱・三角柱を足していき、最後に1つの形にする
// ============================================================
export class ShapeBuilder {
  constructor(tile) {
    this.tile = tile;          // 模様を何メートルごとにくり返すか
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
  }

  isEmpty() {
    return this.positions.length === 0;
  }

  // 四角い面を1枚足す（a, b, c, d は反時計回り。uv は面の上でのメートル）
  quad(a, b, c, d, normal, uvA, uvB, uvC, uvD, shade) {
    const t = this.tile;
    // 面の向きで明るさを変える（上は明るく、下は暗く）。光の計算に加えて、ドット絵らしいメリハリを出す
    const k = shade * (normal[1] > 0.5 ? 1.08 : (normal[1] < -0.5 ? 0.7 : 1));
    for (const [v, uv] of [[a, uvA], [b, uvB], [c, uvC], [a, uvA], [c, uvC], [d, uvD]]) {
      this.positions.push(v[0], v[1], v[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.uvs.push(uv[0] / t, uv[1] / t);
      this.colors.push(k, k, k);
    }
  }

  // 箱（中心・大きさ・向き・明るさ。tilt を渡すと少し傾ける＝浮かぶ石のかけら用）
  box(cx, cy, cz, sx, sy, sz, yaw, shade, tilt = 0) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    // 箱の中の位置 → 世界の位置（傾け → 回す → 動かす）
    const tr = (x, y, z) => {
      const y1 = y * cosT - z * sinT;
      const z1 = y * sinT + z * cosT;
      return [cx + x * cosY + z1 * sinY, cy + y1, cz - x * sinY + z1 * cosY];
    };
    const rn = (x, y, z) => {
      const y1 = y * cosT - z * sinT;
      const z1 = y * sinT + z * cosT;
      return [x * cosY + z1 * sinY, y1, -x * sinY + z1 * cosY];
    };
    // 模様が箱ごとにずれるよう、位置で模様の始まりを変える
    const o = (cx * 0.37 + cz * 0.61) % this.tile;
    const faces = [
      // [法線, 4つの角（箱の中の位置）, 面の幅, 面の高さ]
      [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], sx, sy],
      [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], sx, sy],
      [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], sz, sy],
      [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], sz, sy],
      [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], sx, sz],
      [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], sx, sz]
    ];
    for (const [n, c, w, h] of faces) {
      this.quad(tr(...c[0]), tr(...c[1]), tr(...c[2]), tr(...c[3]), rn(...n),
        [o, 0], [o + w, 0], [o + w, h], [o, h], shade);
    }
  }

  // 円柱（下の中心・半径・高さ）。模様が一周でちょうどつながるよう、くり返し回数を整数にする
  cylinder(cx, by, cz, r, h, shade) {
    const segments = 16;
    const around = Math.max(1, Math.round((Math.PI * 2 * r) / this.tile)) * this.tile;
    for (let k = 0; k < segments; k += 1) {
      const a0 = (k / segments) * Math.PI * 2;
      const a1 = ((k + 1) / segments) * Math.PI * 2;
      const x0 = Math.cos(a0) * r;
      const z0 = Math.sin(a0) * r;
      const x1 = Math.cos(a1) * r;
      const z1 = Math.sin(a1) * r;
      const am = (a0 + a1) / 2;
      const n = [Math.cos(am), 0, Math.sin(am)];
      const u0 = (k / segments) * around;
      const u1 = ((k + 1) / segments) * around;
      this.quad(
        [cx + x1, by, cz + z1], [cx + x0, by, cz + z0], [cx + x0, by + h, cz + z0], [cx + x1, by + h, cz + z1],
        n, [u1, 0], [u0, 0], [u0, h], [u1, h], shade
      );
    }
  }

  // 三角柱（破風）：底の中心・幅・高さ・奥行き
  prism(cx, by, cz, w, h, d, yaw, shade) {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const tr = (x, y, z) => [cx + x * cosY + z * sinY, by + y, cz - x * sinY + z * cosY];
    const rn = (x, y, z) => [x * cosY + z * sinY, y, -x * sinY + z * cosY];
    const hw = w / 2;
    const hd = d / 2;
    // 前と後ろの三角（三角は、頂点を2回使った四角として足す）
    this.quad(tr(-hw, 0, hd), tr(hw, 0, hd), tr(0, h, hd), tr(0, h, hd), rn(0, 0, 1),
      [0, 0], [w, 0], [hw, h], [hw, h], shade);
    this.quad(tr(hw, 0, -hd), tr(-hw, 0, -hd), tr(0, h, -hd), tr(0, h, -hd), rn(0, 0, -1),
      [0, 0], [w, 0], [hw, h], [hw, h], shade);
    // 左右の斜めの屋根
    const slope = Math.hypot(hw, h);
    const nl = [-h / slope, hw / slope, 0];
    const nr = [h / slope, hw / slope, 0];
    this.quad(tr(-hw, 0, -hd), tr(-hw, 0, hd), tr(0, h, hd), tr(0, h, -hd), rn(...nl),
      [0, 0], [d, 0], [d, slope], [0, slope], shade);
    this.quad(tr(hw, 0, hd), tr(hw, 0, -hd), tr(0, h, -hd), tr(0, h, hd), rn(...nr),
      [0, 0], [d, 0], [d, slope], [0, slope], shade);
  }

  // 四角すい（ピラミッド）：底の中心・幅・高さ・奥行き。4つの斜めの面
  pyramid(cx, by, cz, w, h, d, yaw, shade) {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const tr = (x, y, z) => [cx + x * cosY + z * sinY, by + y, cz - x * sinY + z * cosY];
    const rn = (x, y, z) => [x * cosY + z * sinY, y, -x * sinY + z * cosY];
    const hw = w / 2;
    const hd = d / 2;
    const top = tr(0, h, 0);
    const sx = Math.hypot(hd, h);   // 前後の面の斜めの長さ
    const sz = Math.hypot(hw, h);   // 左右の面の斜めの長さ
    // 前・後ろ・右・左（三角は、頂点を2回使った四角として足す）
    this.quad(tr(-hw, 0, hd), tr(hw, 0, hd), top, top, rn(0, hd / sx, h / sx),
      [0, 0], [w, 0], [hw, sx], [hw, sx], shade);
    this.quad(tr(hw, 0, -hd), tr(-hw, 0, -hd), top, top, rn(0, hd / sx, -h / sx),
      [0, 0], [w, 0], [hw, sx], [hw, sx], shade * 0.8);
    this.quad(tr(hw, 0, hd), tr(hw, 0, -hd), top, top, rn(h / sz, hw / sz, 0),
      [0, 0], [d, 0], [hd, sz], [hd, sz], shade * 0.92);
    this.quad(tr(-hw, 0, -hd), tr(-hw, 0, hd), top, top, rn(-h / sz, hw / sz, 0),
      [0, 0], [d, 0], [hd, sz], [hd, sz], shade * 0.86);
  }

  // 下向きの四角すい（つらら・結晶の下半分）：上の面の中心・幅・下への長さ・奥行き
  pyramidDown(cx, ty, cz, w, h, d, yaw, shade) {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const tr = (x, y, z) => [cx + x * cosY + z * sinY, ty + y, cz - x * sinY + z * cosY];
    const rn = (x, y, z) => [x * cosY + z * sinY, y, -x * sinY + z * cosY];
    const hw = w / 2;
    const hd = d / 2;
    const tip = tr(0, -h, 0);
    const sx = Math.hypot(hd, h);
    const sz = Math.hypot(hw, h);
    this.quad(tr(hw, 0, hd), tr(-hw, 0, hd), tip, tip, rn(0, -hd / sx, h / sx),
      [0, 0], [w, 0], [hw, sx], [hw, sx], shade);
    this.quad(tr(-hw, 0, -hd), tr(hw, 0, -hd), tip, tip, rn(0, -hd / sx, -h / sx),
      [0, 0], [w, 0], [hw, sx], [hw, sx], shade * 0.8);
    this.quad(tr(hw, 0, -hd), tr(hw, 0, hd), tip, tip, rn(h / sz, -hw / sz, 0),
      [0, 0], [d, 0], [hd, sz], [hd, sz], shade * 0.9);
    this.quad(tr(-hw, 0, hd), tr(-hw, 0, -hd), tip, tip, rn(-h / sz, -hw / sz, 0),
      [0, 0], [d, 0], [hd, sz], [hd, sz], shade * 0.85);
  }

  // 円すい（塔のとがった屋根）：底の中心・半径・高さ
  cone(cx, by, cz, r, h, shade) {
    const segments = 12;
    const slope = Math.hypot(r, h);
    const around = Math.max(1, Math.round((Math.PI * 2 * r) / this.tile)) * this.tile;
    const top = [cx, by + h, cz];
    for (let k = 0; k < segments; k += 1) {
      const a0 = (k / segments) * Math.PI * 2;
      const a1 = ((k + 1) / segments) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const n = [Math.cos(am) * h / slope, r / slope, Math.sin(am) * h / slope];
      const u0 = (k / segments) * around;
      const u1 = ((k + 1) / segments) * around;
      this.quad(
        [cx + Math.cos(a1) * r, by, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, by, cz + Math.sin(a0) * r], top, top,
        n, [u1, 0], [u0, 0], [(u0 + u1) / 2, slope], [(u0 + u1) / 2, slope], shade
      );
    }
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    return geo;
  }
}

// ============================================================
// 石の模様（ドット絵）を描く
// ============================================================

// 色の表から、模様の画像を作る（くり返して貼れる設定にする）
export function makeTexture(grid) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX;
  canvas.height = TEX;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < TEX; y += 1) {
    for (let x = 0; x < TEX; x += 1) {
      ctx.fillStyle = '#' + grid[y][x].toString(16).padStart(6, '0');
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;   // ドットのまま拡大
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 遺跡の石：ずらして積んだ石のブロック。目地・ひび・苔
export function drawRuinStone(baseHex, random) {
  const b = CONFIG.buildings;
  const grid = [];
  const shades = [0.82, 0.92, 1.0, 1.08];
  const rowH = 8;
  // 各ブロックの明るさを決めておく
  for (let y = 0; y < TEX; y += 1) grid.push(new Array(TEX).fill(baseHex));
  for (let row = 0; row < TEX / rowH; row += 1) {
    const offset = row % 2 === 0 ? 0 : 6;
    const widths = [12, 10, 10];   // 合計32（くり返してもつながる）
    let x0 = offset;
    for (const w of widths) {
      const shade = shades[Math.floor(random() * shades.length)];
      for (let y = row * rowH; y < (row + 1) * rowH; y += 1) {
        for (let dx = 0; dx < w; dx += 1) {
          const x = (x0 + dx) % TEX;
          const top = y === row * rowH;
          const left = dx === 0;
          let k = shade + (random() - 0.5) * 0.08;
          if (top || left) k = 0.55;                          // 目地（暗い線）
          else if (y === row * rowH + 1 || dx === 1) k += 0.1; // 目地のすぐ内側は明るく（角が欠けた感じ）
          grid[y][x] = scaleColor(baseHex, k);
        }
      }
      x0 += w;
    }
  }
  // ひび割れ（斜めに数マス、暗く）
  for (let n = 0; n < b.cracks; n += 1) {
    let x = Math.floor(random() * TEX);
    let y = Math.floor(random() * TEX);
    for (let k = 0; k < 4; k += 1) {
      grid[y % TEX][x % TEX] = scaleColor(baseHex, 0.5);
      x += random() < 0.5 ? 1 : 0;
      y += 1;
    }
  }
  // 苔（緑のかたまり）
  for (let n = 0; n < b.moss; n += 1) {
    const cx = random() * TEX;
    const cy = random() * TEX;
    const r = 1.5 + random() * 2.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
      for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || random() < 0.25) continue;
        const yy = ((y % TEX) + TEX) % TEX;
        const xx = ((x % TEX) + TEX) % TEX;
        grid[yy][xx] = random() < 0.5 ? 0x5f8a3e : 0x7aa64c;
      }
    }
  }
  return makeTexture(grid);
}

// 神殿の柱：縦の溝（明・明・中・暗をくり返す）と、うっすらした石目
export function drawFlutedMarble(baseHex, random) {
  const grid = [];
  const pattern = [1.06, 1.1, 1.0, 0.86];
  for (let y = 0; y < TEX; y += 1) {
    const row = [];
    for (let x = 0; x < TEX; x += 1) {
      const k = pattern[x % pattern.length] + (random() - 0.5) * 0.04;
      row.push(scaleColor(baseHex, k));
    }
    grid.push(row);
  }
  // 石目（薄い灰色の筋）
  for (let n = 0; n < 3; n += 1) {
    let x = Math.floor(random() * TEX);
    for (let y = 0; y < TEX; y += 1) {
      if (random() < 0.3) x = (x + (random() < 0.5 ? 1 : TEX - 1)) % TEX;
      grid[y][x] = scaleColor(baseHex, 0.9);
    }
  }
  return makeTexture(grid);
}

// 神殿の石材：大きな切り石を積んだ模様（目地は細く明るめ）
export function drawMarbleBlocks(baseHex, random) {
  const grid = [];
  for (let y = 0; y < TEX; y += 1) grid.push(new Array(TEX).fill(baseHex));
  const rowH = 8;
  for (let row = 0; row < TEX / rowH; row += 1) {
    const offset = row % 2 === 0 ? 0 : 8;
    for (let bx = 0; bx < 2; bx += 1) {
      const shade = 0.94 + random() * 0.1;
      for (let y = row * rowH; y < (row + 1) * rowH; y += 1) {
        for (let dx = 0; dx < 16; dx += 1) {
          const x = (offset + bx * 16 + dx) % TEX;
          let k = shade + (random() - 0.5) * 0.03;
          if (y === row * rowH || dx === 0) k = 0.8;
          else if (y === (row + 1) * rowH - 1) k -= 0.06;   // 下の縁に影
          grid[y][x] = scaleColor(baseHex, k);
        }
      }
    }
  }
  return makeTexture(grid);
}

// 色を明るく／暗くする（k: 1 = そのまま）
function scaleColor(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// 毎回同じ並びになる乱数
export function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
