/*
  ファイル名 : Lobby.js
  保存場所   : /js/ui
  役割       : みんなで対戦の画面（コース選択の「みんなで対戦」タブから来る）。
                 入口 … 名前を決めて「部屋を作る」か、友達の部屋番号（4桁）を入れて「入る」
                 部屋 … 部屋番号を大きく出し、メンバー（最大4人。あきはCPU）を並べる。
                        ホストはコースを選んで「スタート」。ゲストはホストのスタートを待つ
  バージョン : 1.18.0（Phase18 Step18-2）
  メモ       : つなぐ処理は Screens.js（Room.js）が行う。この画面は見た目と操作だけ
*/

import { CONFIG } from '../config.js';
import { drawMap } from './CourseSelect.js';

const CELL = 32;
const FRONT_COL = 6;   // ドット絵の画像の中の「正面」の列

export class Lobby {
  /**
   * @param {object} o
   * @param {string} o.name        前回の名前
   * @param {Array} o.courses      コース一覧（COURSES）
   * @param {Array} o.characters   キャラ一覧（CHARACTERS）
   * @param {HTMLCanvasElement} o.atlasCanvas キャラの絵
   * @param {function} o.onCreate  「部屋を作る」（名前）
   * @param {function} o.onJoin    「入る」（名前, 部屋番号）
   * @param {function} o.onBack    入口の「戻る」
   * @param {function} o.onLeave   部屋の「部屋を出る」
   * @param {function} o.onStart   ホストの「スタート」
   * @param {function} o.onCourse  ホストがコースを変えた（コース番号）
   * @param {function} o.onSound   効果音
   */
  constructor(o) {
    this.o = o;
    this.onSound = o.onSound || (() => {});
    this.view = 'entry';
    this.busy = false;

    const el = document.createElement('div');
    el.id = 'lobby';
    el.className = 'screen';
    el.innerHTML = '<button class="cs-back lb-back" type="button">◀ 戻る</button><div class="lb-inner"></div>';
    document.body.appendChild(el);
    this.el = el;
    this.inner = el.querySelector('.lb-inner');
    this.backBtn = el.querySelector('.lb-back');
    this.backBtn.addEventListener('click', () => this.back());

    this.onKey = (e) => {
      if (e.target && e.target.tagName === 'INPUT') {
        if (e.code === 'Enter') {
          e.preventDefault();
          if (e.target.classList.contains('lb-code')) this.join();
        }
        return;
      }
      if (e.code === 'Escape') this.back();
      else if (this.view === 'room' && this.isHost && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        this.moveCourse(e.code === 'ArrowLeft' ? -1 : 1);
      } else if (this.view === 'room' && this.isHost && e.code === 'Enter') this.start();
    };
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);

    this.showEntry(o.name || '');
  }

  // ---- 入口 ----
  showEntry(name, message) {
    this.view = 'entry';
    this.backBtn.textContent = '◀ 戻る';
    this.inner.innerHTML =
      '<div class="lb-title">みんなで対戦</div>' +
      '<div class="lb-name-row"><span>名前</span><input class="lb-name" type="text" maxlength="8" placeholder="プレイヤー" autocomplete="off"></div>' +
      '<div class="lb-choices">' +
      '  <div class="lb-choice">' +
      '    <div class="lb-choice-head">部屋を作る</div>' +
      '    <div class="lb-choice-text">部屋番号が出るので、友達に伝えよう</div>' +
      '    <button class="lb-btn main lb-create" type="button">部屋を作る</button>' +
      '  </div>' +
      '  <div class="lb-choice">' +
      '    <div class="lb-choice-head">部屋に入る</div>' +
      '    <div class="lb-choice-text">友達の部屋番号（4けた）を入れる</div>' +
      '    <div class="lb-join-row"><input class="lb-code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="0000" autocomplete="off">' +
      '    <button class="lb-btn main lb-join" type="button">入る</button></div>' +
      '  </div>' +
      '</div>' +
      '<div class="lb-status"></div>' +
      '<div class="lb-note">最大4人（あいた枠はCPU）。はじめは同じWi-Fiどうしで試すのがおすすめ</div>';
    this.nameInput = this.inner.querySelector('.lb-name');
    this.codeInput = this.inner.querySelector('.lb-code');
    this.statusEl = this.inner.querySelector('.lb-status');
    this.nameInput.value = name;
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = this.codeInput.value.replace(/[^0-9]/g, '').slice(0, 4);
    });
    this.inner.querySelector('.lb-create').addEventListener('click', () => this.create());
    this.inner.querySelector('.lb-join').addEventListener('click', () => this.join());
    this.setBusy(false);
    if (message) this.setStatus(message, true);
    this.fit();
  }

  getName() {
    return (this.nameInput ? this.nameInput.value : '').trim().slice(0, 8);
  }

  create() {
    if (this.busy) return;
    this.onSound('decide');
    this.o.onCreate(this.getName());
  }

  join() {
    if (this.busy) return;
    const code = this.codeInput.value;
    if (!/^[0-9]{4}$/.test(code)) {
      this.setStatus('部屋番号は4けたの数字です', true);
      return;
    }
    this.onSound('decide');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.o.onJoin(this.getName(), code);
  }

  // 待っている間はボタンを押せないようにして、様子を出す
  setBusy(busy, text) {
    this.busy = busy;
    this.inner.querySelectorAll('.lb-btn, input').forEach((b) => { b.disabled = busy; });
    if (text !== undefined) this.setStatus(text, false);
  }

  setStatus(text, isError) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text || '';
    this.statusEl.classList.toggle('error', !!isError);
    this.fit();
  }

  // ---- 部屋 ----
  showRoom(room) {
    this.view = 'room';
    this.room = room;
    this.isHost = room.isHost;
    this.backBtn.textContent = '◀ 部屋を出る';
    this.inner.innerHTML =
      '<div class="lb-code-big"><small>部屋番号</small><b>' + room.code + '</b></div>' +
      '<div class="lb-code-hint">' + (room.isHost ? '友達にこの番号を伝えてね' : '部屋に入りました！') + '</div>' +
      '<div class="lb-members"></div>' +
      '<div class="lb-course">' +
      '  <button class="cs-arrow lb-prev" type="button">◀</button>' +
      '  <canvas class="lb-map" width="72" height="72"></canvas>' +
      '  <div class="lb-course-text"><div class="lb-course-name"></div><div class="lb-course-sub"></div></div>' +
      '  <button class="cs-arrow lb-next" type="button">▶</button>' +
      '</div>' +
      '<div class="lb-bottom">' +
      (room.isHost ? '<button class="lb-btn main lb-start" type="button">スタート</button>' : '<div class="lb-wait">ホストのスタートを待っています…</div>') +
      '</div>' +
      '<div class="lb-status"></div>';
    this.statusEl = this.inner.querySelector('.lb-status');
    this.membersEl = this.inner.querySelector('.lb-members');
    this.mapCanvas = this.inner.querySelector('.lb-map');
    this.courseName = this.inner.querySelector('.lb-course-name');
    this.courseSub = this.inner.querySelector('.lb-course-sub');
    this.startBtn = this.inner.querySelector('.lb-start');
    this.el.classList.toggle('guest', !room.isHost);
    this.inner.querySelector('.lb-prev').addEventListener('click', () => this.moveCourse(-1));
    this.inner.querySelector('.lb-next').addEventListener('click', () => this.moveCourse(1));
    if (this.startBtn) this.startBtn.addEventListener('click', () => this.start());
    this.refresh();
  }

  // 部屋の様子（メンバー・コース）を表示し直す
  refresh() {
    if (this.view !== 'room') return;
    const room = this.room;
    let html = '';
    for (let k = 0; k < CONFIG.net.maxPlayers; k += 1) {
      const m = room.members[k];
      if (m) {
        html += '<div class="lb-member' + (m.pid === room.myPid ? ' me' : '') + '">' +
          '<canvas class="lb-face" width="' + CELL + '" height="' + CELL + '" data-char="' + m.char + '"></canvas>' +
          '<div class="lb-member-name">' + m.name + '</div>' +
          '<div class="lb-member-tag">' + (m.host ? 'ホスト' : '') + (m.pid === room.myPid ? (m.host ? '・' : '') + 'あなた' : '') + '</div>' +
          '</div>';
      } else {
        html += '<div class="lb-member empty"><div class="lb-empty-face">CPU</div><div class="lb-member-name">あき</div><div class="lb-member-tag"></div></div>';
      }
    }
    this.membersEl.innerHTML = html;
    this.membersEl.querySelectorAll('.lb-face').forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.o.atlasCanvas, FRONT_COL * CELL, Number(canvas.dataset.char) * CELL, CELL, CELL, 0, 0, CELL, CELL);
    });
    const course = this.o.courses[room.course];
    if (course) {
      this.courseName.textContent = course.name;
      this.courseSub.textContent = '難しさ ' + '★'.repeat(course.stars || 1) + (room.isHost ? '' : '（ホストが選びます）');
      drawMap(this.mapCanvas, course, 3);
    }
    if (this.startBtn) {
      const enough = room.members.length >= 2;
      this.startBtn.disabled = !enough || this.busy;
      if (!this.busy) this.setStatus(enough ? '' : '友達が入るのを待っています…（2人からスタートできます）', false);
    }
    this.fit();
  }

  moveCourse(step) {
    if (!this.isHost || this.busy) return;
    const list = this.o.courses;
    let i = this.room.course;
    for (let k = 0; k < list.length; k += 1) {
      i = (i + step + list.length) % list.length;
      if (list[i].ready) break;
    }
    this.onSound('select');
    this.o.onCourse(i);
  }

  start() {
    if (!this.isHost || this.busy || this.room.members.length < 2) return;
    this.onSound('decide');
    this.o.onStart();
  }

  back() {
    if (this.view === 'room') this.o.onLeave();
    else if (!this.busy) this.o.onBack();
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

  close() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
