/*
  ファイル名 : CourseSelect.js
  保存場所   : /js/ui
  役割       : コース選択画面（キャラ選択の次）。上のタブで「1コース」と「グランプリ」を切り替える。
                 1コース   … 選んだコースの形を上から見た地図で大きく表示し、名前・ひとこと・難しさの★・自己ベストを見せる
                 グランプリ … カップ（続けて走るコースの組）を選ぶ。走るコースと、これまでの最高順位（トロフィー）を見せる
               下のアイコンで選んで「決定」。準備中のコースは「？」で表示し、選べない
  バージョン : 2.6.0（コースは、くるくる回る立体のミニチュアで見せる）
  操作       : スマホ … アイコンをタップ／◀ ▶ ／「決定」／左上「◀ キャラ選択」
               PC     … ← → で選ぶ、Enter・スペースで決定、Esc でキャラ選択へ
  メモ       : 決定したあと、コースの読み込み中は「準備中…」を出す（showLoading）。
               閉じるのは Screens.js が読み込み終わってから close を呼ぶ
*/

import { CONFIG } from '../config.js';
import { CourseMiniature } from './CourseMiniature.js';

export class CourseSelect {
  /**
   * @param {object} o
   * @param {Array} o.courses   Courses.js の COURSES
   * @param {number} o.index    最初に選んでおくコース番号
   * @param {function} o.getBest コースの id を渡すと自己ベスト { time, name } か null を返す関数
   * @param {function} o.onDecide 決定したときに呼ぶ関数（コース番号を渡す）
   * @param {function} o.onBack   キャラ選択へ戻るときに呼ぶ関数
   * @param {function} o.onSound  効果音を鳴らす関数（名前を渡す）
   * @param {Array} o.cups        グランプリのカップ（Courses.js の CUPS）
   * @param {function} o.getCupBest カップの id を渡すと、最高順位（1〜6）か null を返す関数
   * @param {function} o.onDecideCup カップを決定したときに呼ぶ関数（カップ番号を渡す）
   * @param {string} o.mode       最初のタブ（'course' または 'cup'）
   * @param {function} o.onOnline 「みんなで対戦」のタブが押されたときに呼ぶ関数
   */
  constructor(o) {
    this.courses = o.courses;
    this.cups = o.cups || [];
    this.getCupBest = o.getCupBest || (() => null);
    this.onDecideCup = o.onDecideCup || (() => {});
    this.mode = o.mode === 'cup' && this.cups.length ? 'cup' : 'course';
    this.courseIndex = Math.max(0, Math.min(o.courses.length - 1, o.index || 0));
    this.cupIndex = 0;
    this.index = this.courseIndex;
    this.getBest = o.getBest || (() => null);
    this.onDecide = o.onDecide;
    this.onBack = o.onBack;
    this.onSound = o.onSound || (() => {});
    this.onOnline = o.onOnline || null;
    this.done = false;
    this.fixed = !!o.fixed;   // true なら上のタブを出さない（モード選択で決めてきた）

    this.build();
    if (this.fixed) this.el.classList.add('fixed');
    this.setMode(this.mode, true);

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
    const scale = Math.min(1, (window.innerWidth - margin * 2) / w, (window.innerHeight - CONFIG.ui.backBarHeight - margin * 2) / h);
    if (scale < 1) inner.style.transform = 'scale(' + scale.toFixed(3) + ')';
  }

  // ---- 画面を作る ----
  build() {
    const el = document.createElement('div');
    el.id = 'courseselect';
    el.className = 'screen';
    el.innerHTML =
      '<button class="cs-back" type="button">◀ もどる</button>' +
      '<div class="cs-inner">' +
      '<div class="co-tabs">' +
      '  <button class="co-tab" type="button" data-mode="course">1コース</button>' +
      '  <button class="co-tab" type="button" data-mode="cup">グランプリ</button>' +
      '  <button class="co-tab co-tab-online" type="button" data-mode="online">みんなで対戦</button>' +
      '</div>' +
      '<div class="cs-main">' +
      '  <div class="cs-portrait co-map-box"><canvas class="co-map" width="200" height="200"></canvas><canvas class="co-mini"></canvas></div>' +
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
    // コースの立体ミニチュア（描けない端末では、今までどおり上から見た地図）
    this.mini = new CourseMiniature(el.querySelector('.co-mini'));
    if (!this.mini.renderer) el.classList.add('no-mini');
    this.nameEl = el.querySelector('.cs-name');
    this.starsEl = el.querySelector('.co-stars');
    this.descEl = el.querySelector('.cs-desc');
    this.bestEl = el.querySelector('.co-best');
    this.decideBtn = el.querySelector('.cs-decide');

    this.iconsEl = el.querySelector('.cs-icons');
    this.iconButtons = [];
    this.tabButtons = Array.from(el.querySelectorAll('.co-tab'));
    this.tabButtons.forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode)));

    el.querySelector('.cs-prev').addEventListener('click', () => this.move(-1));
    el.querySelector('.cs-next').addEventListener('click', () => this.move(1));
    this.decideBtn.addEventListener('click', () => this.decide());
    el.querySelector('.cs-back').addEventListener('click', () => this.back());
  }

  // ---- タブ（1コース／グランプリ）の切り替え ----
  setMode(mode, silent) {
    if (this.done) return;
    if (mode === 'online') {
      // みんなで対戦は別の画面（Lobby.js）
      if (!this.onOnline) return;
      this.done = true;
      this.onSound('decide');
      this.close();
      this.onOnline();
      return;
    }
    if (mode === 'cup' && !this.cups.length) return;
    this.mode = mode;
    this.tabButtons.forEach((b) => b.classList.toggle('selected', b.dataset.mode === mode));
    this.el.classList.toggle('cup-mode', mode === 'cup');
    // 下のアイコンを作り直す
    this.iconsEl.innerHTML = '';
    const list = mode === 'cup' ? this.cups : this.courses;
    this.iconButtons = list.map((item, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cs-icon co-icon' + (mode === 'course' && !item.ready ? ' locked' : '');
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      if (mode === 'cup') drawTrophy(canvas, item.color, this.getCupBest(item.id));
      else drawMap(canvas, item, 3);
      button.appendChild(canvas);
      button.addEventListener('click', () => this.select(i));
      this.iconsEl.appendChild(button);
      return button;
    });
    this.select(mode === 'cup' ? this.cupIndex : this.courseIndex, true);
    if (!silent) this.onSound('select');
    this.fit();
  }

  // ---- 選ぶ ----
  select(i, silent) {
    if (this.done) return;
    if (this.mode === 'cup') {
      this.selectCup(i, silent);
      return;
    }
    this.index = i;
    this.courseIndex = i;
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
    if (this.mini.renderer) this.mini.setCourse(course);
    else drawMap(this.mapCanvas, course, 8);
    if (!silent) this.onSound('select');
  }

  // カップを選ぶ：トロフィーの絵・名前・ひとこと・走るコース・最高順位
  selectCup(i, silent) {
    this.index = i;
    this.cupIndex = i;
    const cup = this.cups[i];
    const best = this.getCupBest(cup.id);
    this.nameEl.textContent = cup.name;
    this.starsEl.innerHTML = '<span class="co-stars-label">' + cup.courses.length + 'レース</span>';
    const names = cup.courses.map((id) => {
      const c = this.courses.find((x) => x.id === id);
      return c ? c.name : id;
    });
    this.descEl.innerHTML = cup.sub + '<br><span class="co-cup-list">' + names.join(' → ') + '</span>';
    this.bestEl.textContent = best === null ? '最高順位 まだなし' : '最高順位 ' + best + '位' + (best <= 3 ? '（' + ['金', '銀', '銅'][best - 1] + 'のトロフィー）' : '');
    this.decideBtn.disabled = false;
    this.iconButtons.forEach((b, k) => b.classList.toggle('selected', k === i));
    drawTrophy(this.mapCanvas, cup.color, best);
    if (!silent) this.onSound('select');
  }

  move(step) {
    const n = this.mode === 'cup' ? this.cups.length : this.courses.length;
    this.select((this.index + step + n) % n);
  }

  decide() {
    if (this.done) return;
    if (this.mode === 'cup') {
      this.done = true;
      this.onSound('decide');
      this.onDecideCup(this.index);
      return;
    }
    if (!this.courses[this.index].ready) return;
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
    else if (e.code === 'Tab' && !this.fixed) {
      e.preventDefault();
      this.setMode(this.mode === 'cup' ? 'course' : 'cup');
    }
  }

  // ふわっと消してから取り除く
  close() {
    if (this.mini) {
      this.mini.dispose();
      this.mini = null;
    }
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
export function drawMap(canvas, course, lineWidth) {
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

// ---- トロフィーの絵（ドット絵風。取ったトロフィーの色で塗る。まだなら カップの色のうすい絵） ----
function drawTrophy(canvas, cupColor, best) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const colors = { 1: '#ffd34a', 2: '#dfe8f2', 3: '#f0a868' };
  const won = best !== null && best <= 3;
  const main = won ? colors[best] : cupColor;
  const u = W / 16;   // 16マスで描く
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x * u), Math.round(y * u), Math.ceil(w * u), Math.ceil(h * u)); };
  ctx.globalAlpha = won ? 1 : 0.45;
  const edge = 'rgba(10,20,50,0.95)';
  // ふち
  px(3, 2, 10, 1, edge); px(2, 3, 1, 4, edge); px(13, 3, 1, 4, edge); px(3, 7, 1, 1, edge); px(12, 7, 1, 1, edge);
  px(4, 8, 1, 1, edge); px(11, 8, 1, 1, edge); px(5, 9, 6, 1, edge); px(7, 10, 2, 2, edge); px(5, 12, 6, 1, edge); px(4, 13, 8, 2, edge);
  // 取っ手
  px(0, 3, 2, 1, edge); px(0, 4, 1, 3, edge); px(1, 6, 1, 1, edge); px(14, 3, 2, 1, edge); px(15, 4, 1, 3, edge); px(14, 6, 1, 1, edge);
  // 中身
  px(3, 3, 10, 4, main); px(4, 7, 8, 1, main); px(5, 8, 6, 1, main); px(7, 9, 2, 1, main);
  px(5, 13, 6, 1, main);
  // 光
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(Math.round(4 * u), Math.round(3 * u), Math.ceil(u), Math.ceil(3 * u));
  ctx.globalAlpha = 1;
  if (won) {
    ctx.fillStyle = '#1a2a5a';
    ctx.font = 'bold ' + Math.round(4 * u) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(best), 8 * u, 5.2 * u);
  }
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
