/*
  ファイル名 : ModeSelect.js
  保存場所   : /js/ui
  役割       : モード選択画面（タイトルの次）。景色入りの大きなカード3枚から遊び方を選ぶ。
                 ひとりで走る … コースを選んで1レース
                 グランプリ   … カップを選んで続けて走る
                 みんなで対戦 … 友達と部屋を作る・入る
               右上に今のキャラ。下に「◀ タイトル」「キャラ変更」「設定」「遊び方」
  バージョン : 2.5.0（新しいデザイン：夕暮れのドット）
  操作       : スマホ … カードをタップ（すぐ決定）／下のボタン
               PC     … ← → で選ぶ、Enter・スペースで決定、Esc でタイトルへ
  メモ       : ボタンが押されたときの中身は Screens.js から渡された関数が行う（この画面は見た目と操作だけ）
*/

import { CONFIG } from '../config.js';

const CELL = 32;
const FRONT_COL = 6;   // ドット絵の画像の中の「正面」の列

// カード（並び順）
const MODES = [
  { key: 'single', en: 'SINGLE RACE', name: 'ひとりで走る', sub: '好きなコースで3周', img: 'img/mode_single.png' },
  { key: 'cup', en: 'GRAND PRIX', name: 'グランプリ', sub: '続けて走って総合優勝', img: 'img/mode_cup.png' },
  { key: 'online', en: 'ONLINE', name: 'みんなで対戦', sub: '友達と最大4人', img: 'img/mode_online.png' }
];

export class ModeSelect {
  /**
   * @param {object} o
   * @param {string} o.mode        最初に選んでおくカード（'single' / 'cup' / 'online'）
   * @param {object} o.character   今のキャラ（Characters.js の1人）
   * @param {number} o.charIndex   今のキャラ番号（顔の絵を切り抜く）
   * @param {HTMLCanvasElement} o.atlasCanvas キャラの絵
   * @param {function} o.onMode    カードを決定した（'single' / 'cup' / 'online'）
   * @param {function} o.onCharacter / o.onSettings / o.onHowto / o.onBack 下のボタン
   * @param {function} o.onSound   効果音
   */
  constructor(o) {
    this.o = o;
    this.onSound = o.onSound || (() => {});
    this.index = Math.max(0, MODES.findIndex((m) => m.key === o.mode));
    this.done = false;
    // 表示した直後の入力は受け付けない。タイトルをタップした指の「クリック」が、
    // 出たばかりのこの画面のカードに届いて、勝手に決定してしまうのを防ぐ
    this.readyAt = performance.now() + CONFIG.ui.screenInputDelay * 1000;

    const el = document.createElement('div');
    el.id = 'modeselect';
    el.className = 'screen';
    let cards = '';
    MODES.forEach((m, i) => {
      cards +=
        '<button class="ms-card" type="button" data-index="' + i + '">' +
        '  <img class="ms-img" src="' + m.img + '" alt="">' +
        '  <span class="ms-line"></span>' +
        '  <span class="ms-text">' +
        '    <span class="ms-en">' + m.en + '</span>' +
        '    <span class="ms-name">' + m.name + '</span>' +
        '    <span class="ms-sub">' + m.sub + '</span>' +
        '  </span>' +
        '</button>';
    });
    el.innerHTML =
      '<div class="ms-inner">' +
      '  <div class="ms-head">' +
      '    <div class="ms-title"><span class="px-en">MODE SELECT</span><span class="ms-title-ja">モードを選ぶ</span></div>' +
      '    <button class="ms-char px-frame" type="button" data-action="character">' +
      '      <canvas class="ms-face" width="' + CELL + '" height="' + CELL + '"></canvas>' +
      '      <span>' + o.character.name + '</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="ms-cursor-row"><span class="ms-cursor"></span></div>' +
      '  <div class="ms-cards">' + cards + '</div>' +
      '  <div class="ms-foot">' +
      '    <button class="ms-back" type="button" data-action="back">◀ タイトル</button>' +
      '    <div class="ms-foot-btns">' +
      '      <button class="px-btn main" type="button" data-action="character">キャラ変更</button>' +
      '      <button class="px-btn" type="button" data-action="settings">設定</button>' +
      '      <button class="px-btn" type="button" data-action="howto">遊び方</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(el);
    this.el = el;
    this.inner = el.querySelector('.ms-inner');
    this.cards = Array.from(el.querySelectorAll('.ms-card'));
    this.cursor = el.querySelector('.ms-cursor');

    // 顔のドット絵
    const face = el.querySelector('.ms-face');
    const ctx = face.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(o.atlasCanvas, FRONT_COL * CELL, o.charIndex * CELL, CELL, CELL, 0, 0, CELL, CELL);

    // カード：触れたら選び、押したら決定
    this.cards.forEach((card, i) => {
      // マウスを乗せたら選ぶ（指のときは選ばない。指はタップで決定）
      card.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse' && this.ready()) this.select(i, true);
      });
      card.addEventListener('click', () => {
        if (!this.ready()) return;
        this.select(i, true);
        this.decide();
      });
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b || this.done || !this.ready()) return;
      const a = b.dataset.action;
      if (a === 'back') this.leave(o.onBack);
      else if (a === 'character') this.leave(o.onCharacter, 'decide');
      else if (a === 'settings') { this.onSound('select'); o.onSettings(); }
      else if (a === 'howto') { this.onSound('select'); o.onHowto(); }
    });

    this.onKey = (e) => {
      if (this.done || this.blocked || !this.ready()) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.select((this.index + MODES.length - 1) % MODES.length);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.select((this.index + 1) % MODES.length);
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.decide(); }
      else if (e.code === 'Escape') this.leave(o.onBack);
    };
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => { this.fit(); this.placeCursor(); };
    window.addEventListener('resize', this.onResize);

    this.select(this.index, true);
    this.fit();
    requestAnimationFrame(() => this.placeCursor());
  }

  ready() {
    return performance.now() >= this.readyAt;
  }

  select(i, silent) {
    if (this.done) return;
    if (i !== this.index && !silent) this.onSound('select');
    this.index = i;
    this.cards.forEach((c, k) => c.classList.toggle('selected', k === i));
    this.placeCursor();
  }

  // 選んでいるカードの上に ▼ を動かす
  placeCursor() {
    const card = this.cards[this.index];
    if (!card) return;
    this.cursor.style.left = (card.offsetLeft + card.offsetWidth / 2) + 'px';
  }

  decide() {
    if (this.done) return;
    const key = MODES[this.index].key;
    this.leave(() => this.o.onMode(key), 'decide');
  }

  leave(fn, sound) {
    if (this.done) return;
    this.done = true;
    if (sound) this.onSound(sound);
    this.close();
    fn();
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
    this.el.classList.add('hide');
    setTimeout(() => {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }, 400);
  }
}
