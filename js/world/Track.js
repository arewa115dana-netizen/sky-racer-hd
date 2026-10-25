/*
  ファイル名 : Track.js
  保存場所   : /js/world
  役割       : コースの中心線。CourseData の制御点をなめらかな曲線でつなぎ、
               2メートルごとに「位置・向き・道幅・区間の種類」を前もって計算しておく。
               レーサーの位置（コース基準座標）と画面上の位置の変換を担当する
  バージョン : 0.3.1（Phase3 Step3-1）

  コース基準座標
    s : スタートから何メートル進んだか（0〜コース全長）
    x : 中心線から右へ何メートルずれているか（左はマイナス）
    y : 中心線（路面）から何メートル上か
  向き（yaw）は Three.js の rotation.y と同じ。0 で +Z 方向、増えると左回り
  このファイルは Three.js を使わない（計算だけなので軽く、検証もしやすい）
*/

const SAMPLE_STEP = 2;        // 何メートルごとに前計算するか
const CURVE_SMOOTH = 4;       // 曲がり具合をならすサンプル数（前後）

export class Track {
  constructor(courseData) {
    this.data = courseData;
    this.name = courseData.name;
    this.sectorCount = courseData.sectors || 8;

    this.buildSamples(courseData.points);
  }

  // ---- 外から使う関数 ----

  widthAt(s) { return this.lerpField(this.width, s); }
  heightAt(s) { return this.lerpField(this.py, s); }
  curvatureAt(s) { return this.lerpField(this.curv, s); }
  yMinAt(s) { return this.lerpField(this.yMin, s); }
  yMaxAt(s) { return this.lerpField(this.yMax, s); }

  // 区間の種類（'ground' または 'air'）
  zoneAt(s) {
    return this.zone[this.indexAt(s)];
  }

  // 区間の名前（'start' / 'cloud' / 'corridor' / 'ruins' / 'temple'）
  areaAt(s) {
    return this.area[this.indexAt(s)];
  }

  // 道の端に柵があるか（'wall' = 柵あり、'open' = 柵なし）
  edgeAt(s) {
    return this.edge[this.indexAt(s)];
  }

  // 中心線の向き
  yawAt(s) {
    const t = this.locate(s);
    const a = this.yaw[t.i0];
    const b = this.yaw[t.i1];
    return a + wrapAngle(b - a) * t.f;
  }

  // コースを何区画目にいるか（0〜sectorCount-1。周回の不正防止用）
  sectorAt(s) {
    return Math.min(this.sectorCount - 1, Math.floor(this.wrap(s) / this.length * this.sectorCount));
  }

  // コース基準座標（s, x, y）を画面上の位置に変換して out に入れる
  toWorld(s, x, y, out) {
    const t = this.locate(s);
    const f = t.f;
    const px = this.px[t.i0] + (this.px[t.i1] - this.px[t.i0]) * f;
    const py = this.py[t.i0] + (this.py[t.i1] - this.py[t.i0]) * f;
    const pz = this.pz[t.i0] + (this.pz[t.i1] - this.pz[t.i0]) * f;
    const a = this.yaw[t.i0];
    const yaw = a + wrapAngle(this.yaw[t.i1] - a) * f;
    // 進行方向の右向き（水平） = (-cos(yaw), 0, sin(yaw))
    out.x = px - Math.cos(yaw) * x;
    out.y = py + y;
    out.z = pz + Math.sin(yaw) * x;
    return out;
  }

  // ---- 前計算 ----
  buildSamples(points) {
    const n = points.length;

    // 1) 制御点の間を細かく区切り、曲線の長さを測る
    const fine = [];
    const FINE_PER_SEG = 60;
    for (let i = 0; i < n; i += 1) {
      for (let k = 0; k < FINE_PER_SEG; k += 1) {
        const u = k / FINE_PER_SEG;
        const p = catmullRom(points, i, u);
        fine.push({ x: p.x, y: p.y, z: p.z, seg: i, u });
      }
    }
    fine.push({ ...fine[0], seg: n, u: 0 });

    const dist = [0];
    for (let i = 1; i < fine.length; i += 1) {
      const a = fine[i - 1];
      const b = fine[i];
      dist.push(dist[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
    }
    const total = dist[dist.length - 1];

    // 2) 2メートルごとに等間隔で取り直す
    const count = Math.max(8, Math.round(total / SAMPLE_STEP));
    this.count = count;
    this.length = total;
    this.step = total / count;

    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.pz = new Float32Array(count);
    this.yaw = new Float32Array(count);
    this.curv = new Float32Array(count);
    this.width = new Float32Array(count);
    this.yMin = new Float32Array(count);
    this.yMax = new Float32Array(count);
    this.zone = new Array(count);
    this.area = new Array(count);
    this.edge = new Array(count);

    let j = 0;
    for (let i = 0; i < count; i += 1) {
      const target = i * this.step;
      while (j < dist.length - 2 && dist[j + 1] < target) j += 1;
      const span = dist[j + 1] - dist[j] || 1;
      const f = (target - dist[j]) / span;
      const a = fine[j];
      const b = fine[j + 1];
      this.px[i] = a.x + (b.x - a.x) * f;
      this.py[i] = a.y + (b.y - a.y) * f;
      this.pz[i] = a.z + (b.z - a.z) * f;

      // 道幅などは制御点の値を区間内で直線的に変える
      const seg = a.seg % n;
      const u = a.seg === b.seg ? a.u + (b.u - a.u) * f : a.u;
      const p0 = points[seg];
      const p1 = points[(seg + 1) % n];
      this.width[i] = p0.width + (p1.width - p0.width) * u;
      this.yMin[i] = (p0.yMin || 0) + ((p1.yMin || 0) - (p0.yMin || 0)) * u;
      this.yMax[i] = (p0.yMax || 0) + ((p1.yMax || 0) - (p0.yMax || 0)) * u;
      this.zone[i] = p0.zone;
      this.area[i] = p0.area || '';
      this.edge[i] = p0.edge || 'wall';
    }

    // 3) 向き（前後のサンプルから求める）
    for (let i = 0; i < count; i += 1) {
      const prev = (i - 1 + count) % count;
      const next = (i + 1) % count;
      this.yaw[i] = Math.atan2(this.px[next] - this.px[prev], this.pz[next] - this.pz[prev]);
    }

    // 4) 曲がり具合（向きの変化 ÷ 距離）を前後でならす
    const raw = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const next = (i + 1) % count;
      raw[i] = wrapAngle(this.yaw[next] - this.yaw[i]) / this.step;
    }
    for (let i = 0; i < count; i += 1) {
      let sum = 0;
      for (let k = -CURVE_SMOOTH; k <= CURVE_SMOOTH; k += 1) {
        sum += raw[(i + k + count) % count];
      }
      this.curv[i] = sum / (CURVE_SMOOTH * 2 + 1);
    }
  }

  // ---- 補助 ----
  wrap(s) {
    let d = s % this.length;
    if (d < 0) d += this.length;
    return d;
  }

  locate(s) {
    const pos = this.wrap(s) / this.step;
    const i0 = Math.floor(pos) % this.count;
    return { i0, i1: (i0 + 1) % this.count, f: pos - Math.floor(pos) };
  }

  indexAt(s) {
    return Math.floor(this.wrap(s) / this.step) % this.count;
  }

  lerpField(arr, s) {
    const t = this.locate(s);
    return arr[t.i0] + (arr[t.i1] - arr[t.i0]) * t.f;
  }
}

// 閉じた曲線の Catmull-Rom 補間（制御点 i と i+1 の間、u = 0〜1）
function catmullRom(points, i, u) {
  const n = points.length;
  const p0 = points[(i - 1 + n) % n];
  const p1 = points[i];
  const p2 = points[(i + 1) % n];
  const p3 = points[(i + 2) % n];
  const u2 = u * u;
  const u3 = u2 * u;
  const f = (a, b, c, d) =>
    0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return {
    x: f(p0.x, p1.x, p2.x, p3.x),
    y: f(p0.y, p1.y, p2.y, p3.y),
    z: f(p0.z, p1.z, p2.z, p3.z)
  };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
