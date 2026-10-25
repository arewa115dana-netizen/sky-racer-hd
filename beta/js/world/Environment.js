/*
  ファイル名 : Environment.js
  保存場所   : /js/world
  役割       : 背景。空・太陽・雲海・浮遊島・遠景の島（どのコースにもある物）。
               浮遊島の上とコースの路肩には、ドット絵の草木を置く（Decor.js。種類はコースごと）
               コースだけの建物や名所（天空神殿なら遺跡・神殿・かがり火）は、コースの scenery が作る
               スマホで軽く動くよう、重い後処理を使わず「見た目だけ再現」する
               （ぼかした遠景で被写界深度風、光る板で軽量ブルーム風）
  バージョン : 1.13.0（Phase13 Step13-1：コースごとに作り直せるように）
  メモ       : 作った物はすべて this.root（1つのまとまり）に入れる。dispose で丸ごと片付けられる
*/

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildDecor } from './Decor.js';

export class Environment {
  /**
   * @param {THREE.Scene} scene
   * @param {Quality} quality
   * @param {Track} track
   * @param {object} course コース（Courses.js）。decor = 草木の組、scenery = コースだけの建物を作る関数
   */
  constructor(scene, quality, track, course) {
    this.scene = scene;
    this.quality = quality;
    this.track = track;
    this.cloudLayers = [];
    this.time = 0;
    this.islandSpots = [];   // 置いた浮遊島の位置と大きさ（草木を置くのに使う）
    this.root = new THREE.Group();
    scene.add(this.root);

    const e = CONFIG.environment;
    const low = quality.level === 'low';

    // 空の色とフォグ（遠くを空の色に溶かす）
    scene.background = new THREE.Color(e.horizonColor);
    scene.fog = new THREE.Fog(e.horizonColor, e.fogNear, e.fogFar);

    this.sky = this.buildSky();
    this.root.add(this.sky);

    this.sun = this.buildSun();
    this.root.add(this.sun);

    // 浮遊島を置かない場所（コースの建物のまわり。{ x, z, r } の一覧）
    this.keepOut = course && course.keepOut ? course.keepOut : [];

    this.buildClouds(low ? 1 : 2);
    this.root.add(this.buildFarIslands(low ? 6 : 10));
    this.root.add(this.buildIslands(low ? Math.round(e.islandCount / 2) : e.islandCount));
    // コースだけの建物・名所（毎フレーム動かす物があれば update を持つ）
    this.scenery = course && course.scenery ? course.scenery(track, quality.level) : null;
    if (this.scenery) {
      this.root.add(this.scenery.group);
      // 建物側が作った島（オアシスなど）にも、草木を置く
      if (this.scenery.islands) this.islandSpots.push(...this.scenery.islands);
    }
    // 草木（浮遊島の上と、コースの路肩）
    this.decor = buildDecor(track, this.islandSpots, quality.level, course ? course.decor : undefined);
    this.root.add(this.decor);
  }

  // ---- 片付け（別のコースに切り替えるとき）。形・材質・画像を全部手放す ----
  dispose() {
    this.scene.remove(this.root);
    disposeTree(this.root);
    this.root = null;
  }

  // ---- 自動軽量化（重い端末で、Game.js から1段ずつ呼ばれる）。減らした物があれば true ----
  //   'smallDecor' … 草・花・茂みを隠す（木は残す）
  //   'clouds'     … 下の雲の層を隠す（画面いっぱいの半透明の板なので、描く手間が大きい）
  reduce(kind) {
    let changed = false;
    if (kind === 'smallDecor') {
      for (const mesh of this.decor.children) {
        if (mesh.userData.small && mesh.visible) {
          mesh.visible = false;
          changed = true;
        }
      }
    } else if (kind === 'clouds') {
      const lower = this.cloudLayers[1];
      if (lower && lower.visible) {
        lower.visible = false;
        changed = true;
      }
    }
    return changed;
  }

  // 毎フレーム呼ぶ（カメラを動かした後）
  update(dt, cameraPosition) {
    const e = CONFIG.environment;
    this.time += dt;
    if (this.scenery && this.scenery.update) this.scenery.update(dt);

    // 空と太陽はカメラについて動かす（どこまで行っても届かない遠さに見せる）
    this.sky.position.copy(cameraPosition);
    this.sun.position.set(
      cameraPosition.x + e.sunDirection.x * e.sunDistance,
      cameraPosition.y + e.sunDirection.y * e.sunDistance,
      cameraPosition.z + e.sunDirection.z * e.sunDistance
    );

    // オーロラをゆっくりゆらめかせる（模様を横に流す）
    if (this.auroraMaps) {
      this.auroraMaps.forEach((map, n) => {
        map.offset.x = (this.time * (n === 0 ? 0.012 : -0.008)) % 1;
      });
    }

    // 雲海をゆっくり流す
    this.cloudLayers.forEach((layer, i) => {
      const speed = e.cloudSpeed * (i === 0 ? 1 : 0.6);
      layer.material.map.offset.x = (this.time * speed) % 1;
    });
  }

  // ---- 空（上が濃い青、地平線が白っぽいグラデーションの大きな球） ----
  buildSky() {
    const e = CONFIG.environment;
    const geo = new THREE.SphereGeometry(e.skyRadius, 24, 12);
    const top = new THREE.Color(e.skyTopColor);
    const horizon = new THREE.Color(e.horizonColor);
    const colors = [];
    const pos = geo.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const h = pos.getY(i) / e.skyRadius;          // -1〜1
      const t = Math.max(0, Math.min(1, h * 1.6));  // 地平線から上へ
      c.copy(horizon).lerp(top, t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -1;
    // 夜のコースは星をちりばめる（空と一緒にカメラについて動く）
    if (e.starCount > 0) mesh.add(this.buildStars(e.starCount, e.skyRadius * 0.95));
    // オーロラ（夜のコース）
    if (e.aurora) {
      this.aurora = this.buildAurora(e.aurora, e.skyRadius * 0.9);
      mesh.add(this.aurora);
    }
    return mesh;
  }

  // ---- オーロラ（空にゆらめく光のカーテン。2枚を少しずらして重ねる） ----
  buildAurora(opt, radius) {
    const group = new THREE.Group();
    const tex = makeAuroraTexture(opt.colors || ['#7dffb0', '#a070ff']);
    tex.wrapS = THREE.RepeatWrapping;
    this.auroraMaps = [];
    const center = (opt.angle || 0) * Math.PI / 180;
    for (let n = 0; n < 2; n += 1) {
      const segs = 36;
      const span = (n === 0 ? 110 : 80) * Math.PI / 180;
      const start = center - span / 2 + n * 0.35;
      const bottom = radius * (0.12 + n * 0.06);
      const top = radius * (0.5 + n * 0.08);
      const positions = [];
      const uvs = [];
      for (let k = 0; k <= segs; k += 1) {
        const t = k / segs;
        const a = start + t * span;
        // カーテンのひだ（半径を波打たせる）
        const r = radius * (0.92 + Math.sin(t * 9 + n * 2) * 0.04);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const lift = Math.sin(t * Math.PI) * radius * 0.06;   // 真ん中ほど少し高く
        positions.push(x, bottom + lift, z, x, top + lift, z);
        uvs.push(t * 3, 0, t * 3, 1);
      }
      const index = [];
      for (let k = 0; k < segs; k += 1) {
        const i = k * 2;
        index.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(index);
      const map = n === 0 ? tex : tex.clone();
      this.auroraMaps.push(map);
      const mat = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        opacity: n === 0 ? 0.72 : 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = -1;
      group.add(mesh);
    }
    return group;
  }

  // ---- 星（空の上半分に、明るさの違う小さな点を散らす） ----
  buildStars(count, radius) {
    const random = seededRandom(4242);
    const positions = [];
    const colors = [];
    for (let i = 0; i < count; i += 1) {
      // 上半分に均等に散らす（地平線の近くは少なめ）
      const y = 0.08 + random() * 0.92;
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      positions.push(Math.cos(a) * r * radius, y * radius, Math.sin(a) * r * radius);
      const b = 0.45 + random() * 0.55;
      const tint = random();
      colors.push(b * (tint < 0.2 ? 1 : 0.85), b * 0.9, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,   // 遠さに関係なく同じ大きさ（画面で2ドットくらい）
      vertexColors: true,
      fog: false,
      depthWrite: false
    });
    const stars = new THREE.Points(geo, mat);
    stars.renderOrder = -1;
    return stars;
  }

  // ---- 太陽（光がにじむ板。軽量ブルーム風） ----
  buildSun() {
    const e = CONFIG.environment;
    const tex = makeGlowTexture(128, e.sunGlow, 'rgba(255,230,170,0)');
    const mat = new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(e.sunSize, e.sunSize, 1);
    return sprite;
  }

  // ---- 雲海（コードで描いた雲の画像を大きな板に貼り、重ねて流す） ----
  buildClouds(layers) {
    const e = CONFIG.environment;
    const center = this.courseCenter();
    for (let i = 0; i < layers; i += 1) {
      const tex = makeCloudTexture(256, 40 + i * 13);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(e.cloudRepeat, e.cloudRepeat);
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(e.cloudSize, e.cloudSize);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: e.cloudColor,
        transparent: true,
        opacity: i === 0 ? 0.95 : 0.7,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(center.x, e.cloudHeight - i * 14, center.z);
      this.root.add(mesh);
      this.cloudLayers.push(mesh);
    }
  }

  // ---- 遠景の島（あらかじめぼかしたシルエット。被写界深度風） ----
  buildFarIslands(count) {
    const e = CONFIG.environment;
    const tex = makeFarIslandTexture(e.farIslandColor);
    const geo = new THREE.PlaneGeometry(1, 0.5);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      fog: false
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const center = this.courseCenter();
    const random = seededRandom(777);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + random() * 0.4;
      const dist = e.farIslandDistance * (0.85 + random() * 0.3);
      const size = 120 + random() * 140;
      dummy.position.set(
        center.x + Math.sin(angle) * dist,
        -10 + random() * 60,
        center.z + Math.cos(angle) * dist
      );
      // コースの中心の方を向かせる
      dummy.rotation.set(0, angle + Math.PI, 0);
      dummy.scale.set(size, size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = -1;
    return mesh;
  }

  // ---- 浮遊島（上が草、下が岩の小島を、コースに重ならない所に散らす） ----
  buildIslands(count) {
    const e = CONFIG.environment;
    const geo = makeIslandGeometry(e.grassColor, e.rockColor);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const random = seededRandom(2024);
    const dummy = new THREE.Object3D();
    const center = this.courseCenter();
    let placed = 0;
    // 偏らないよう、コースのまわりを角度で均等に区切り、各区切りに1つずつ置く
    for (let k = 0; k < count; k += 1) {
      for (let tries = 0; tries < 40; tries += 1) {
        const angle = ((k + random()) / count) * Math.PI * 2;
        const dist = e.islandArea * (0.15 + random() * 0.85);
        const x = center.x + Math.sin(angle) * dist;
        const z = center.z + Math.cos(angle) * dist;
        const size = 5 + random() * 16;
        if (this.distanceToTrack(x, z) < e.islandClearance + size) continue;
        if (this.keepOut.some((k) => Math.hypot(k.x - x, k.z - z) < k.r + size)) continue;
        const y = -18 + random() * 50;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        dummy.scale.set(size, size * (0.8 + random() * 0.6), size);
        this.islandSpots.push({ x, y, z, size });
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed += 1;
        break;
      }
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  // ---- 補助 ----

  // コースの中心（上から見た範囲の真ん中）
  courseCenter() {
    if (this.center) return this.center;
    const t = this.track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < t.count; i += 1) {
      minX = Math.min(minX, t.px[i]); maxX = Math.max(maxX, t.px[i]);
      minZ = Math.min(minZ, t.pz[i]); maxZ = Math.max(maxZ, t.pz[i]);
    }
    this.center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    return this.center;
  }

  // 上から見て、コースまで何メートルあるか
  distanceToTrack(x, z) {
    const t = this.track;
    let best = Infinity;
    for (let i = 0; i < t.count; i += 4) {
      const d = Math.hypot(t.px[i] - x, t.pz[i] - z) - t.width[i] / 2;
      if (d < best) best = d;
    }
    return best;
  }
}

// ---- 画像・形を作る関数 ----

// まとまりの中の、形・材質・画像をすべて手放す（同じ物を何度手放しても問題ない）
export function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
    const list = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    for (const m of list) {
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture && v.dispose) v.dispose();
      }
      if (m.dispose) m.dispose();
    }
    if (obj.isInstancedMesh && obj.dispose) obj.dispose();
  });
}

// 毎回同じ並びになる乱数
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 浮遊島の形（上に平らな草地、その下に土の層、いちばん下に尖った岩）。大きさ1の基準形
function makeIslandGeometry(grassHex, rockHex) {
  const sides = 9;
  const positions = [];
  const colors = [];
  const grass = new THREE.Color(grassHex);
  const grassEdge = new THREE.Color(grassHex).multiplyScalar(0.8);
  const dirt = new THREE.Color(CONFIG.decor.dirtColor);
  const dirtDark = new THREE.Color(CONFIG.decor.dirtColor).multiplyScalar(0.8);
  const rock = new THREE.Color(rockHex);
  const rockDark = new THREE.Color(rockHex).multiplyScalar(0.72);
  const push = (v, c) => {
    positions.push(v[0], v[1], v[2]);
    colors.push(c.r, c.g, c.b);
  };
  const tri = (a, b, c, color) => { push(a, color); push(b, color); push(c, color); };
  // 高さごとの輪（[高さ, 広がり]）：草地のふち → 草の垂れ → 土 → 岩の中ほど
  const ring = (k, y, scale) => {
    const a = (k / sides) * Math.PI * 2;
    const r = (1 + 0.15 * Math.sin(k * 2.3)) * scale;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  for (let k = 0; k < sides; k += 1) {
    const k1 = k + 1;
    const top0 = ring(k, 0, 1);
    const top1 = ring(k1, 0, 1);
    const lip0 = ring(k, -0.12, 0.98);    // 草が少し垂れる
    const lip1 = ring(k1, -0.12, 0.98);
    const dirt0 = ring(k, -0.45, 0.85);   // 土の層の下端
    const dirt1 = ring(k1, -0.45, 0.85);
    const mid0 = ring(k, -1.0, 0.5);      // 岩の中ほど
    const mid1 = ring(k1, -1.0, 0.5);
    const bottom = [0.08 * Math.sin(k), -1.7, 0.08 * Math.cos(k)];
    const odd = k % 2 === 1;
    // 草地（上の面）
    tri([0, 0.05, 0], top1, top0, grass);
    // 草の垂れ
    tri(top0, top1, lip1, grassEdge);
    tri(top0, lip1, lip0, grassEdge);
    // 土の層
    tri(lip0, lip1, dirt1, odd ? dirtDark : dirt);
    tri(lip0, dirt1, dirt0, odd ? dirtDark : dirt);
    // 岩
    tri(dirt0, dirt1, mid1, odd ? rockDark : rock);
    tri(dirt0, mid1, mid0, odd ? rockDark : rock);
    tri(mid0, mid1, bottom, odd ? rock : rockDark);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// オーロラの模様：下が明るい色、上へ行くほど別の色に変わりながら消える。縦のすじでカーテンらしく
function makeAuroraTexture(colors) {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, h, 0, 0);   // 下 → 上
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.08, colors[0]);
  g.addColorStop(0.45, colors[0]);
  g.addColorStop(0.8, colors[1]);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 縦のすじ（明るさを列ごとに変える。端がつながるように）。1ドットずつ透明度を掛ける
  const random = seededRandom(909);
  const img = ctx.getImageData(0, 0, w, h);
  for (let x = 0; x < w; x += 1) {
    const v = 0.25 + 0.75 * Math.abs(Math.sin(x / w * Math.PI * 6 + Math.sin(x / w * Math.PI * 2) * 2)) * (0.7 + random() * 0.3);
    for (let y = 0; y < h; y += 1) {
      img.data[(y * w + x) * 4 + 3] *= v;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 中心が明るく外側が透明な丸い光
function makeGlowTexture(size, inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 雲の画像（白いふわふわを散らす。端がつながるように描く）
function makeCloudTexture(size, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  for (let i = 0; i < 46; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = size * (0.06 + random() * 0.14);
    // 端でつながるよう、上下左右にずらした位置にも同じ雲を描く
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.6, 'rgba(250,250,255,0.45)');
        g.addColorStop(1, 'rgba(240,245,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
  return new THREE.CanvasTexture(canvas);
}

// 遠景の島のシルエット（影のぼかしを使って、どのブラウザでもぼかす）
function makeFarIslandTexture(color) {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 形そのものは画面の外に描き、ぼけた影だけを画面内に落とす
  const shift = 1000;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = shift;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(w * 0.5 - shift, h * 0.38, w * 0.36, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.16 - shift, h * 0.4);
  ctx.lineTo(w * 0.84 - shift, h * 0.4);
  ctx.lineTo(w * 0.55 - shift, h * 0.88);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
