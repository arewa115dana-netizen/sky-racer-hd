/*
  ファイル名 : CourseSelect.js
  保存場所   : /js/ui
  役割       : コース選択画面（キャラ選択の次）。選んだコースの形を上から見た地図で大きく表示し、
               名前・ひとこと・難しさの★・自己ベストを見せる。下のアイコンで選んで「決定」。
               準備中のコースは「？」で表示し、選べない
  バージョン : 1.13.0（Phase13 Step13-2）
  操作       : スマホ … アイコンをタップ／◀ ▶ ／「決定」／左上「◀ キャラ選択」
               PC     … ← → で選ぶ、Enter・スペースで決定、Esc でキャラ選択へ
  メモ       : 決定したあと、コースの読み込み中は「準備中…」を出す（showLoading）。
               閉じるのは Screens.js が読み込み終わってから close を呼ぶ
*/

import { CONFIG } from '../config.js';

export class CourseSelect {
  /**
   * @param {object} o
   * @param {Array} o.courses   Courses.js の COURSES
   * @param {number} o.index    最初に選んでおくコース番号
   * @param {function} o.getBest コースの id を渡すと自己ベスト { time, name } か null を返す関数
   * @param {function} o.onDecide 決定したときに呼ぶ関数（コース番号を渡す）
   * @param {function} o.onBack   キャラ選択へ戻るときに呼ぶ関数
   * @param {function} o.onSound  効果音を鳴らす関数（名前を渡す）
   */
  constructor(o) {
    this.courses = o.courses;
    this.index = Math.max(0, Math.min(o.courses.length - 1, o.index || 0));
    this.getBest = o.getBest || (() => null);
    this.onDecide = o.onDecide;
    this.onBack = o.onBack;
    this.onSound = o.onSound || (() => {});
    this.done = false;

    this.build();
    this.select(this.index, true);

    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
    this.fit();
  }

  // 中身が画面より大きければ、収まる大きさまで縮める
  fit() {
    const inner = this.inner;
    inner.style.transform = '';
    const margin = CONFIG.ui.screenMargin;
    const w = inner.offsetWidth;
    const h = inner.offsetHeight;
    if (!w || !h) return;
    const scale = Math.min(1, (window.innerWidth - margin * 2) / w, (window.innerHeight - margin * 2) / h);
    if (scale < 1) inner.style.transform = 'scale(' + scale.toFixed(3) + ')';
  }

  // ---- 画面を作る ----
  build() {
    const el = document.createElement('div');
    el.id = 'courseselect';
    el.className = 'screen';
    el.innerHTML =
      '<button class="cs-back" type="button">◀ キャラ選択</button>' +
      '<div class="cs-inner">' +
      '<div class="cs-heading">コースを選ぶ</div>' +
      '<div class="cs-main">' +
      '  <div class="cs-portrait co-map-box"><canvas class="co-map" width="200" height="200"></canvas></div>' +
      '  <div class="cs-info">' +
      '    <div class="cs-name"></div>' +
      '    <div class="co-stars"></div>' +
      '    <div class="cs-desc"></div>' +
      '    <div class="co-best"></div>' +
      '  </div>' +
      '</div>' +
      '<div class="cs-bottom">' +
      '  <button class="cs-arrow cs-prev" type="button">◀</button>' +
      '  <div class="cs-icons"></div>' +
      '  <button class="cs-arrow cs-next" type="button">▶</button>' +
      '  <button class="cs-decide" type="button">決定</button>' +
      '</div>' +
      '</div>' +
      '<div class="co-loading">コースを準備中…</div>';
    document.body.appendChild(el);
    this.el = el;

    this.inner = el.querySelector('.cs-inner');
    this.mapCanvas = el.querySelector('.co-map');
    this.nameEl = el.querySelector('.cs-name');
    this.starsEl = el.querySelector('.co-stars');
    this.descEl = el.querySelector('.cs-desc');
    this.bestEl = el.querySelector('.co-best');
    this.decideBtn = el.querySelector('.cs-decide');

    // コースのアイコン（小さな地図。準備中は「？」）
    const iconsEl = el.querySelector('.cs-icons');
    this.iconButtons = this.courses.map((course, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cs-icon co-icon' + (course.ready ? '' : ' locked');
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      drawMap(canvas, course, 3);
      button.appendChild(canvas);
      button.addEventListener('click', () => this.select(i));
      iconsEl.appendChild(button);
      return button;
    });

    el.querySelector('.cs-prev').addEventListener('click', () => this.move(-1));
    el.querySelector('.cs-next').addEventListener('click', () => this.move(1));
    this.decideBtn.addEventListener('click', () => this.decide());
    el.querySelector('.cs-back').addEventListener('click', () => this.back());
  }

  // ---- 選ぶ ----
  select(i, silent) {
    if (this.done) return;
    this.index = i;
    const course = this.courses[i];
    this.nameEl.textContent = course.ready ? course.name : '？？？';
    this.starsEl.innerHTML = '<span class="co-stars-label">難しさ</span>' +
      '★'.repeat(course.stars || 1) + '<i>' + '★'.repeat(5 - (course.stars || 1)) + '</i>';
    this.descEl.textContent = course.ready ? course.sub : '準備中のコースです。お楽しみに！（' + course.name + '）';
    const best = course.ready ? this.getBest(course.id) : null;
    this.bestEl.textContent = course.ready
      ? (best ? '自己ベスト ' + formatTime(best.time) + '（' + best.name + '）' : '自己ベスト まだなし')
      : '';
    this.decideBtn.disabled = !course.ready;
    this.iconButtons.forEach((b, k) => b.classList.toggle('selected', k === i));
    drawMap(this.mapCanvas, course, 8);
    if (!silent) this.onSound('select');
  }

  move(step) {
    const n = this.courses.length;
    this.select((this.index + step + n) % n);
  }

  decide() {
    if (this.done || !this.courses[this.index].ready) return;
    this.done = true;
    this.onSound('decide');
    this.onDecide(this.index);
  }

  back() {
    if (this.done) return;
    this.done = true;
    this.close();
    this.onBack();
  }

  // コースの読み込み中の表示
  showLoading() {
    this.el.classList.add('loading');
  }

  handleKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.move(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.move(1);
    else if (e.code === 'Enter' || e.code === 'Space') this.decide();
    else if (e.code === 'Escape') this.back();
  }

  // ふわっと消してから取り除く
  close() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.el.classList.add('hide');
    setTimeout(() => {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }, 450);
  }
}

// ---- コースの形を上から見た地図を描く ----
// 制御点をなめらかにつないで1周の線にする。地上は太い実線、空中は点線。スタートに白い印
function drawMap(canvas, course, lineWidth) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!course.ready || !course.data) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold ' + Math.round(H * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('？', W / 2, H / 2 + H * 0.03);
    return;
  }
  const pts = smoothLoop(course.data.points, 8);
  // 画面に収まるよう拡大・移動（上から見るので x と z を使う。z は上が奥）
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const pad = lineWidth * 2 + 2;
  const scale = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxZ - minZ || 1));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxZ - minZ) * scale) / 2;
  // 左右は反転して描く（ゲームのカメラから見た向きに合わせる）
  const sx = (p) => W - (ox + (p.x - minX) * scale);
  const sy = (p) => H - (oy + (p.z - minZ) * scale);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // ふち（暗い色で少し太く）
  ctx.strokeStyle = 'rgba(10,20,50,0.9)';
  ctx.lineWidth = lineWidth + 3;
  ctx.beginPath();
  pts.forEach((p, k) => (k === 0 ? ctx.moveTo(sx(p), sy(p)) : ctx.lineTo(sx(p), sy(p))));
  ctx.closePath();
  ctx.stroke();
  // 区間ごとに：地上は実線、空中は点線
  for (let k = 0; k < pts.length; k += 1) {
    const a = pts[k];
    const b = pts[(k + 1) % pts.length];
    ctx.strokeStyle = a.zone === 'air' ? 'rgba(255,255,255,0.85)' : course.color;
    ctx.lineWidth = a.zone === 'air' ? lineWidth * 0.6 : lineWidth;
    ctx.setLineDash(a.zone === 'air' ? [lineWidth * 0.8, lineWidth * 0.9] : []);
    ctx.beginPath();
    ctx.moveTo(sx(a), sy(a));
    ctx.lineTo(sx(b), sy(b));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // スタート地点
  const s = pts[0];
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(10,20,50,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx(s), sy(s), lineWidth * 0.9 + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// 制御点をなめらかな輪にする（Catmull-Rom。1区間を steps 個に分ける）
function smoothLoop(points, steps) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z), zone: p1.zone });
    }
  }
  return out;
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
}
