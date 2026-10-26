/*
  ファイル名 : CourseBuilder.js
  保存場所   : /js/world
  役割       : コースの見た目を中心線（Track）から自動で作る。
               路面・縁石・浮遊島の岩肌・柵・空中ルートの灯籠・スタートライン。
               部品ごとに1つにまとめて、描画回数を少なくする
  バージョン : 1.14.0（Phase14：区間ごとに岩肌の色を変えられるように）
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * コースの見た目を作る
 * @param {Track} track
 * @returns {THREE.Group}
 */
export function buildCourse(track) {
  const group = new THREE.Group();
  group.add(buildRoad(track));
  group.add(buildCurbs(track));
  group.add(buildRock(track));
  group.add(buildRails(track));
  group.add(buildLanterns(track));
  group.add(buildStartLine(track));
  return group;
}

// ---- 共通の道具 ----

// 地上区間かどうか（i 番目のサンプルとその次がどちらも地上）
function isGroundSeg(track, i) {
  const j = (i + 1) % track.count;
  return track.zone[i] === 'ground' && track.zone[j] === 'ground';
}

// サンプル i の、中心から右へ x、上へ y の位置を out に入れる
function pointAt(track, i, x, y, out) {
  return track.toWorld(i * track.step, x, y, out);
}

// 三角形を集めて、色付きの立体を作るための入れ物
class MeshBuilder {
  constructor() {
    this.positions = [];
    this.colors = [];
  }

  // 四角形（a→b→c→d の順の4点）を1色で追加
  quad(a, b, c, d, color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  tri(a, b, c, color) {
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let k = 0; k < 3; k += 1) {
      this.colors.push(color.r, color.g, color.b);
    }
  }

  build(materialOptions) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      ...materialOptions
    });
    return new THREE.Mesh(geo, mat);
  }
}

function makeColor(hex, brightness = 1) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(brightness);
  return c;
}

// ---- 路面 ----
function buildRoad(track) {
  const c = CONFIG.course;
  const mb = new MeshBuilder();
  const a = {}, b = {}, d = {}, e = {};
  const stripeSamples = Math.max(1, Math.round(c.stripeLength / track.step));

  for (let i = 0; i < track.count; i += 1) {
    if (!isGroundSeg(track, i)) continue;
    const j = i + 1;
    const half = track.width[i] / 2;
    const halfNext = track.width[j % track.count] / 2;
    pointAt(track, i, -half, 0, a);
    pointAt(track, j, -halfNext, 0, b);
    pointAt(track, j, halfNext, 0, d);
    pointAt(track, i, half, 0, e);
    // 一定間隔で明るさを変え、スピード感を出す
    const stripe = Math.floor(i / stripeSamples) % 2 === 0 ? 1 : c.stripeShade;
    const base = c.roadColors[track.area[i]] || c.roadColors.default;
    mb.quad(a, b, d, e, makeColor(base, stripe));
  }
  return mb.build();
}

// ---- 縁石（道の両端の細い帯） ----
function buildCurbs(track) {
  const c = CONFIG.course;
  const mb = new MeshBuilder();
  const a = {}, b = {}, d = {}, e = {};
  const stripeSamples = Math.max(1, Math.round(c.stripeLength / track.step));
  const light = makeColor(c.curbLight);
  const dark = makeColor(c.curbDark);

  for (let i = 0; i < track.count; i += 1) {
    if (!isGroundSeg(track, i)) continue;
    const j = i + 1;
    const color = Math.floor(i / stripeSamples) % 2 === 0 ? light : dark;
    for (const side of [-1, 1]) {
      const outer = track.width[i] / 2;
      const outerNext = track.width[j % track.count] / 2;
      pointAt(track, i, side * (outer - c.curbWidth), 0.03, a);
      pointAt(track, j, side * (outerNext - c.curbWidth), 0.03, b);
      pointAt(track, j, side * outerNext, 0.03, d);
      pointAt(track, i, side * outer, 0.03, e);
      mb.quad(a, b, d, e, color);
    }
  }
  return mb.build();
}

// ---- 浮遊島の岩肌（路面の下の逆三角の岩） ----
function buildRock(track) {
  const c = CONFIG.course;
  const mb = new MeshBuilder();
  const l0 = {}, l1 = {}, r0 = {}, r1 = {}, b0 = {}, b1 = {};

  for (let i = 0; i < track.count; i += 1) {
    if (!isGroundSeg(track, i)) continue;
    const j = i + 1;
    const area = track.area[i];
    const depth = c.rockDepth[area] !== undefined ? c.rockDepth[area] : c.rockDepth.default;
    // 深さを少し揺らして、岩らしいデコボコにする
    const wobble = 1 + 0.25 * Math.sin(i * 0.7) + 0.15 * Math.sin(i * 1.9);
    const wobbleNext = 1 + 0.25 * Math.sin(j * 0.7) + 0.15 * Math.sin(j * 1.9);
    const half = track.width[i] / 2;
    const halfNext = track.width[j % track.count] / 2;

    pointAt(track, i, -half, 0, l0);
    pointAt(track, j, -halfNext, 0, l1);
    pointAt(track, i, half, 0, r0);
    pointAt(track, j, halfNext, 0, r1);
    pointAt(track, i, 0, -depth * wobble, b0);
    pointAt(track, j, 0, -depth * wobbleNext, b1);

    // 岩肌の色は区間ごとに変えられる（rockColors。なければ rockColor）
    const hex = c.rockColors && c.rockColors[area] !== undefined ? c.rockColors[area] : c.rockColor;
    const rockTop = makeColor(hex, 1);
    const rockSide = makeColor(hex, 0.75);
    mb.quad(l0, l1, b1, b0, rockTop);
    mb.quad(r0, b0, b1, r1, rockSide);
  }
  return mb.build();
}

// ---- 柵（柵ありの所だけ、両端に杭を並べる） ----
function buildRails(track) {
  const c = CONFIG.course;
  const every = Math.max(1, Math.round(c.railSpacing / track.step));
  const spots = [];
  const p = {};
  for (let i = 0; i < track.count; i += every) {
    if (track.zone[i] !== 'ground' || track.edge[i] !== 'wall') continue;
    for (const side of [-1, 1]) {
      pointAt(track, i, side * (track.width[i] / 2 + 0.2), 0, p);
      spots.push({ x: p.x, y: p.y, z: p.z });
    }
  }

  const geo = new THREE.BoxGeometry(0.35, c.railHeight, 0.35);
  geo.translate(0, c.railHeight / 2, 0);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshLambertMaterial({ color: c.railColor }),
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

// ---- 空中ルートの目印（浮かぶ灯籠） ----
function buildLanterns(track) {
  const c = CONFIG.course;
  const every = Math.max(1, Math.round(c.lanternSpacing / track.step));
  const spots = [];
  const p = {};
  for (let i = 0; i < track.count; i += every) {
    if (track.zone[i] !== 'air') continue;
    for (const side of [-1, 1]) {
      pointAt(track, i, side * (track.width[i] / 2), 1.5, p);
      spots.push({ x: p.x, y: p.y, z: p.z });
    }
  }

  const geo = new THREE.OctahedronGeometry(0.7, 0);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshBasicMaterial({ color: c.lanternColor }),
    Math.max(1, spots.length)
  );
  const dummy = new THREE.Object3D();
  spots.forEach((s, k) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.scale.set(1, 1.6, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix);
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// ---- スタートライン ----
function buildStartLine(track) {
  const width = track.width[0];
  const geo = new THREE.PlaneGeometry(width, 1.6);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const p = {};
  track.toWorld(0, 0, 0.06, p);
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotation.y = track.yawAt(0);
  return mesh;
}
